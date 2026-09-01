import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  BulkDiscount,
  Order,
  OrderItem,
  OrderStatus,
  SubmarinePart,
} from '@ff14/entities';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-status.dto';
import { UpdateOrderNotesDto } from './dto/update-notes.dto';

@Injectable()
export class OrdersService {
  /** Only these part types count toward bulk-discount tiers; product rows like repair kits (partType 'Materials') do not */
  private static readonly DISCOUNTABLE_PART_TYPES = new Set(['bow', 'bridge', 'hull', 'stern']);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(SubmarinePart)
    private readonly partRepo: Repository<SubmarinePart>,
    @InjectRepository(BulkDiscount)
    private readonly discountRepo: Repository<BulkDiscount>,
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}

  /**
   * Generates a unique, hard-to-guess order code, e.g. SUB-7K9P-2M4X-8QRT.
   * 12 random characters from a 32-char alphabet (no 0/O, 1/I) in three
   * groups — ~1.15e18 combinations, so confirmation codes can't be guessed
   * to peek at other customers' orders.
   */
  private async generateUniqueOrderCode(): Promise<string> {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes confusing characters 0/O, 1/I
    const group = (): string => {
      const bytes = crypto.randomBytes(4);
      let out = '';
      for (let i = 0; i < 4; i++) {
        out += chars[bytes[i] % chars.length];
      }
      return out;
    };

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `SUB-${group()}-${group()}-${group()}`;
      const existing = await this.orderRepo.findOne({ where: { orderCode: code } });
      if (!existing) {
        return code;
      }
    }
    // Fallback if loop finishes (practically impossible with 32^12 combos)
    return `SUB-${Date.now().toString(36).toUpperCase()}`;
  }

  /**
   * Masks a client name for public endpoints: keeps the first 2 and the
   * last letter ("Alexander" -> "Al***r"). Short names only keep their
   * first letter so they aren't fully revealed.
   */
  private maskClientName(name: string | null | undefined): string {
    const trimmed = (name ?? '').trim();
    if (trimmed.length <= 4) {
      return trimmed ? `${trimmed.slice(0, 1)}***` : '';
    }
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
  }

  async findAll(
    status?: OrderStatus,
    page = 1,
    limit = 20,
  ): Promise<{ items: Order[]; total: number }> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.part', 'part')
      // Unconfirmed (pending) orders are hidden everywhere — spam protection.
      // They only become visible once activated with their confirmation code.
      .where('o.status != :hidden', { hidden: 'pending' });

    if (status) {
      qb.andWhere('o.status = :status', { status });
    }

    const [items, total] = await qb
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async findInProgress(): Promise<{
    orders: Array<{
      id: string;
      orderCode: string;
      clientName: string;
      contactInfo: string | null;
      notes: string | null;
      confirmedAt: Date | null;
      createdAt: Date;
      items: Array<{
        partId: string;
        partName: string;
        partType: string | null;
        buildName: string | null;
        quantity: number;   // ordered
        stock: number;      // currently ready in retainers
        unitPrice: number;
        lineTotal: number;
      }>;
    }>;
  }> {
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.part', 'part')
      .where('o.status = :status', { status: 'in_progress' })
      .orderBy('o.confirmedAt', 'ASC')
      .getMany();

    return {
      orders: orders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        clientName: this.maskClientName(o.clientName),
        contactInfo: o.contactInfo,
        notes: o.notes,
        confirmedAt: o.confirmedAt,
        createdAt: o.createdAt,
        items: (o.items ?? []).map((item) => ({
          partId: item.part?.id ?? '',
          partName: item.partName,
          partType: item.partType,
          buildName: item.buildName,
          quantity: item.quantity,
          stock: item.part?.stock ?? 0,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      })),
    };
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'items.part'],
    });
    if (!order) throw new NotFoundException(`Order "${id}" not found`);
    return order;
  }

  async findByCode(code: string): Promise<Order> {
    const normalized = code.trim().toUpperCase();
    const order = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.part', 'part')
      .where('UPPER(o.order_code) = :code', { code: normalized })
      .getOne();

    if (!order) throw new NotFoundException(`Order with code "${code}" not found`);
    // Public lookup — mask the client name so codes can't be used to harvest names
    return { ...order, clientName: this.maskClientName(order.clientName) };
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    if (!dto.items?.length) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const partIds = [...new Set(dto.items.map((i) => i.partId))];
    const parts = await this.partRepo.find({ where: { id: In(partIds) } });
    const partMap = new Map<string, SubmarinePart>(parts.map((p) => [p.id, p]));

    // Verify all parts exist
    for (const itemDto of dto.items) {
      if (!partMap.has(itemDto.partId)) {
        throw new NotFoundException(`Submarine part "${itemDto.partId}" not found`);
      }
    }

    // 1. Calculate line totals and subtotal
    let subtotal = 0;
    const preparedItems: Array<{
      part: SubmarinePart;
      quantity: number;
      buildName: string | null;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const itemDto of dto.items) {
      const part = partMap.get(itemDto.partId)!;
      const unitPrice = part.price;
      const lineTotal = unitPrice * itemDto.quantity;
      subtotal += lineTotal;

      preparedItems.push({
        part,
        quantity: itemDto.quantity,
        buildName: itemDto.buildName ?? null,
        unitPrice,
        lineTotal,
      });
    }

    // 2. Fetch bulk discounts and apply the highest matching tier based on total parts quantity
    const totalPartsCount = preparedItems.reduce(
      (acc, i) =>
        acc +
        (OrdersService.DISCOUNTABLE_PART_TYPES.has(i.part.partType.toLowerCase())
          ? i.quantity
          : 0),
      0,
    );
    const discounts = await this.discountRepo.find({
      order: { threshold: 'DESC' },
    });
    const matchingTier = discounts.find((d) => totalPartsCount >= d.threshold);

    const discountPct = matchingTier ? Number(matchingTier.discountPercent) : 0;
    const discountAmt = Math.round(subtotal * (discountPct / 100));
    const total = subtotal - discountAmt;
    const orderCode = await this.generateUniqueOrderCode();

    // 3. Save Order and OrderItems in a transaction with 'pending' status
    const savedOrder = await this.ds.transaction(async (em) => {
      const order = em.create(Order, {
        orderCode,
        clientName: dto.clientName,
        contactInfo: dto.contactInfo ?? null,
        rawText: dto.rawText ?? null,
        notes: dto.notes ?? null,
        fulfillmentDt: dto.fulfillmentDt ?? null,
        subtotal,
        discountPct,
        discountAmt,
        total,
        status: 'pending',
      });
      await em.save(order);

      for (const pi of preparedItems) {
        const orderItem = em.create(OrderItem, {
          order,
          part: pi.part,
          partName: pi.part.name,
          partType: pi.part.partType,
          quantity: pi.quantity,
          unitPrice: pi.unitPrice,
          lineTotal: pi.lineTotal,
          buildName: pi.buildName,
        });
        await em.save(orderItem);
      }

      return em.findOne(Order, {
        where: { id: order.id },
        relations: ['items', 'items.part'],
      });
    });

    return savedOrder!;
  }

  /**
   * Admin confirms & activates the order by providing the client's confirmation code.
   * Orders never touch inventory — this only stamps the confirmation and moves
   * the order to in_progress; admins manage further status changes manually.
   */
  async confirmByCode(code: string): Promise<Order> {
    const order = await this.findByCode(code);
    return this.activateOrder(order);
  }

  /** Admin confirms & activates the order by order ID. */
  async confirmById(id: string): Promise<Order> {
    const order = await this.findOne(id);
    return this.activateOrder(order);
  }

  private async activateOrder(order: Order): Promise<Order> {
    if (order.status !== 'pending') {
      throw new BadRequestException(`Order "${order.orderCode}" is already in "${order.status}" status (can only confirm pending orders)`);
    }

    order.confirmedAt = new Date();
    order.status = 'confirmed';
    await this.orderRepo.save(order);

    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findOne(id);
    order.status = dto.status;
    await this.orderRepo.save(order);
    return this.findOne(id);
  }

  async updateNotes(id: string, dto: UpdateOrderNotesDto): Promise<Order> {
    const order = await this.findOne(id);
    if (dto.notes !== undefined) order.notes = dto.notes;
    if (dto.fulfillmentDt !== undefined) order.fulfillmentDt = dto.fulfillmentDt;
    await this.orderRepo.save(order);
    return this.findOne(id);
  }

  async cancel(id: string): Promise<Order> {
    const order = await this.findOne(id);
    if (order.status !== 'pending' && order.status !== 'confirmed') {
      throw new BadRequestException(`Cannot cancel order in "${order.status}" status (only pending or confirmed orders can be cancelled)`);
    }
    order.status = 'cancelled';
    await this.orderRepo.save(order);
    return this.findOne(id);
  }
}
