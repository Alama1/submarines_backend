import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  BaseMaterial,
  BulkDiscount,
  computeCraftCosts,
  expandAllPartMaterials,
  ExpandedMaterialRequirement,
  Order,
  OrderItem,
  OrderStatus,
  SubmarinePart,
} from '@ff14/entities';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-status.dto';
import { UpdateOrderNotesDto } from './dto/update-notes.dto';

@Injectable()
export class OrdersService {
  private static readonly CRAFTABLE_PART_TYPES = new Set(['bow', 'bridge', 'hull', 'stern']);

  private static readonly EDITABLE_STATUSES = new Set<OrderStatus>(['confirmed', 'in_progress']);

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
    return `SUB-${Date.now().toString(36).toUpperCase()}`;
  }

  private maskClientName(name: string | null | undefined): string {
    const trimmed = (name ?? '').trim();
    if (trimmed.length <= 4) {
      return trimmed ? `${trimmed.slice(0, 1)}***` : '';
    }
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
  }

  private publicClientName(order: Pick<Order, 'clientName' | 'isAnonymous'>): string {
    if (order.isAnonymous) return 'Anonymous';
    return this.maskClientName(order.clientName);
  }

  async findAll(
    statuses?: OrderStatus[],
    page = 1,
    limit = 20,
  ): Promise<{ items: Order[]; total: number }> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.part', 'part')
      .where('o.status != :hidden', { hidden: 'pending' });

    if (statuses && statuses.length > 0) {
      qb.andWhere('o.status IN (:...statuses)', { statuses });
    }

    const [items, total] = await qb
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async findInProgress(unmask = false): Promise<{
    orders: Array<{
      id: string;
      orderCode: string;
      clientName: string;
      isAnonymous: boolean;
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
      missingMaterials: Array<{
        materialId: string;
        name: string;
        itemId: number | null;
        needed: number;
        available: number;
        missing: number;
      }>;
      financials: {
        revenue: number;
        materialCost: number;
        profit: number;
      };
    }>;
    aggregate: {
      revenue: number;
      materialCost: number;
      profit: number;
      materials: Array<{
        materialId: string;
        name: string;
        itemId: number | null;
        needed: number;
        available: number;
        missing: number;
      }>;
    };
  }> {
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.part', 'part')
      .where('o.status = :status', { status: 'in_progress' })
      .orderBy('o.confirmedAt', 'ASC')
      .getMany();

    const allParts = await this.partRepo.find({
      relations: ['materials', 'materials.material'],
    });
    const partsById = new Map<string, SubmarinePart>(allParts.map((p) => [p.id, p]));
    const partsByName = new Map<string, SubmarinePart>(
      allParts.map((p) => [p.name.toLowerCase(), p]),
    );
    const allMaterials = await this.ds.getRepository(BaseMaterial).find();
    const matById = new Map<string, BaseMaterial>(
      allMaterials.map((m) => [m.id, m]),
    );
    const craftCosts = computeCraftCosts(matById);
    const expanded = expandAllPartMaterials(allParts);

    const costPerPart = new Map<string, number>();
    for (const p of allParts) {
      let cost = 0;
      for (const req of expanded.get(p.id) ?? []) {
        const mat = matById.get(req.materialId);
        let unit = mat ? (mat.myPrice ?? mat.marketPrice ?? mat.npcPrice ?? 0) : 0;
        // Fall back to computed craft cost when a craftable material has no price set
        if (mat && unit <= 0) {
          unit = craftCosts.get(mat.id)?.craftCost ?? 0;
        }
        cost += unit * req.quantity;
      }
      costPerPart.set(p.id, cost);
    }

    const availableStock = new Map<string, number>();

    const mapped = orders.map((o) => {
      let materialCost = 0;
      let partsRevenue = 0;
      const items = (o.items ?? []).map((item) => {
        const part = partsById.get(item.part?.id ?? '') ?? item.part;
        const isCraftable =
          !!part &&
          OrdersService.CRAFTABLE_PART_TYPES.has(
            (item.partType ?? part.partType ?? '').toLowerCase(),
          );
        if (part && isCraftable) {
          materialCost += (costPerPart.get(part.id) ?? 0) * item.quantity;
          partsRevenue += item.lineTotal;
        }
        return {
          partId: item.part?.id ?? '',
          partName: item.partName,
          partType: item.partType,
          buildName: item.buildName,
          quantity: item.quantity,
          stock: item.part?.stock ?? 0,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        };
      });
      const revenue = Math.max(0, partsRevenue - o.discountAmt);

      return {
        id: o.id,
        orderCode: o.orderCode,
        clientName: unmask ? o.clientName : this.publicClientName(o),
        isAnonymous: o.isAnonymous,
        contactInfo: unmask ? o.contactInfo : null,
        notes: unmask ? o.notes : null,
        confirmedAt: o.confirmedAt,
        createdAt: o.createdAt,
        items,
        missingMaterials: this.computeMissingMaterials(
          o,
          partsById,
          partsByName,
          matById,
          expanded,
          availableStock,
        ),
        financials: {
          revenue,
          materialCost,
          profit: revenue - materialCost,
        },
      };
    });

    const aggregate = this.computeAggregate(
      orders,
      partsById,
      partsByName,
      matById,
      expanded,
    );

    const revenue = mapped.reduce((sum, o) => sum + o.financials.revenue, 0);
    const materialCost = mapped.reduce(
      (sum, o) => sum + o.financials.materialCost,
      0,
    );

    return {
      orders: mapped,
      aggregate: {
        revenue,
        materialCost,
        profit: revenue - materialCost,
        materials: aggregate.materials,
      },
    };
  }

  private computeAggregate(
    orders: Order[],
    partsById: Map<string, SubmarinePart>,
    partsByName: Map<string, SubmarinePart>,
    matById: Map<string, BaseMaterial>,
    expanded: Map<string, ExpandedMaterialRequirement[]>,
  ): {
    materials: Array<{
      materialId: string;
      name: string;
      itemId: number | null;
      needed: number;
      available: number;
      missing: number;
    }>;
  } {
    const demandByPart = new Map<string, number>();
    for (const o of orders) {
      for (const item of o.items ?? []) {
        const part = partsById.get(item.part?.id ?? '') ?? item.part;
        if (!part) continue;
        const toCraft = Math.max(0, item.quantity - part.stock);
        if (toCraft <= 0) continue;
        demandByPart.set(part.id, (demandByPart.get(part.id) ?? 0) + toCraft);
      }
    }

    const rawNeeds = new Map<string, number>();
    const partNeeds = new Map<string, number>();

    for (const [partId, toCraft] of demandByPart) {
      const part = partsById.get(partId)!;
      for (const req of expanded.get(part.id) ?? []) {
        rawNeeds.set(req.materialId, (rawNeeds.get(req.materialId) ?? 0) + toCraft * req.quantity);
      }
      for (const pm of part.materials ?? []) {
        if (!pm.material) continue;
        const nested = partsByName.get(pm.material.name.toLowerCase());
        if (!nested || nested.id === part.id) continue;
        partNeeds.set(nested.id, (partNeeds.get(nested.id) ?? 0) + toCraft * pm.quantity);
      }
    }

    const coveredByPart = new Map<string, number>();
    for (const [nestedId, needed] of partNeeds) {
      const nested = partsById.get(nestedId);
      if (!nested) continue;
      const covered = Math.min(needed, nested.stock);
      coveredByPart.set(nestedId, covered);
      if (covered > 0) {
        for (const req of expanded.get(nested.id) ?? []) {
          rawNeeds.set(req.materialId, (rawNeeds.get(req.materialId) ?? 0) - covered * req.quantity);
        }
      }
    }

    const materials: Array<{
      materialId: string;
      name: string;
      itemId: number | null;
      needed: number;
      available: number;
      missing: number;
    }> = [];

    for (const [materialId, needed] of rawNeeds) {
      if (needed <= 0) continue;
      const mat = matById.get(materialId);
      if (!mat) continue;
      materials.push({
        materialId,
        name: mat.name,
        itemId: mat.itemId,
        needed,
        available: mat.currentStock,
        missing: Math.max(0, needed - mat.currentStock),
      });
    }

    materials.sort(
      (a, b) => b.missing - a.missing || a.name.localeCompare(b.name),
    );

    return { materials };
  }

  private computeMissingMaterials(
    order: Order,
    partsById: Map<string, SubmarinePart>,
    partsByName: Map<string, SubmarinePart>,
    matById: Map<string, BaseMaterial>,
    expanded: Map<string, ExpandedMaterialRequirement[]>,
    availableStock: Map<string, number>,
  ): Array<{
    materialId: string;
    name: string;
    itemId: number | null;
    needed: number;
    available: number;
    missing: number;
  }> {
    const rawNeeds = new Map<string, { mat: BaseMaterial; needed: number }>();
    const partNeeds = new Map<
      string,
      { part: SubmarinePart; needed: number }
    >();

    const addRaw = (mat: BaseMaterial, qty: number) => {
      const entry = rawNeeds.get(mat.id) ?? { mat, needed: 0 };
      entry.needed = Math.max(0, entry.needed + qty);
      rawNeeds.set(mat.id, entry);
    };

    for (const item of order.items ?? []) {
      const part = partsById.get(item.part?.id ?? '') ?? item.part;
      if (!part) continue;
      const toCraft = Math.max(0, item.quantity - part.stock);
      if (toCraft <= 0) continue;

      for (const req of expanded.get(part.id) ?? []) {
        const mat = matById.get(req.materialId);
        if (mat) addRaw(mat, toCraft * req.quantity);
      }

      for (const pm of part.materials ?? []) {
        if (!pm.material) continue;
        const nested = partsByName.get(pm.material.name.toLowerCase());
        if (!nested || nested.id === part.id) continue;
        const entry = partNeeds.get(nested.id) ?? {
          part: nested,
          needed: 0,
        };
        entry.needed += toCraft * pm.quantity;
        partNeeds.set(nested.id, entry);
      }
    }

    const missing: Array<{
      materialId: string;
      name: string;
      itemId: number | null;
      needed: number;
      available: number;
      missing: number;
    }> = [];

    for (const { part: nested, needed } of partNeeds.values()) {
      const covered = Math.min(needed, nested.stock);
      if (covered > 0) {
        for (const req of expanded.get(nested.id) ?? []) {
          const rawMat = matById.get(req.materialId);
          if (rawMat) addRaw(rawMat, -covered * req.quantity);
        }
      }
    }

    for (const { mat, needed } of rawNeeds.values()) {
      const available = availableStock.get(mat.id) ?? mat.currentStock;
      const used = Math.min(needed, available);
      availableStock.set(mat.id, available - used);
      if (needed - used > 0) {
        missing.push({
          materialId: mat.id,
          name: mat.name,
          itemId: mat.itemId,
          needed,
          available: used,
          missing: needed - used,
        });
      }
    }

    missing.sort((a, b) => b.missing - a.missing);
    return missing;
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'items.part'],
    });
    if (!order) throw new NotFoundException(`Order "${id}" not found`);
    return order;
  }

  async findByCode(code: string, unmask = false): Promise<Order> {
    const normalized = code.trim().toUpperCase();
    const order = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.part', 'part')
      .where('UPPER(o.order_code) = :code', { code: normalized })
      .getOne();

    if (!order) throw new NotFoundException(`Order with code "${code}" not found`);
    return unmask ? order : this.toPublicOrder(order);
  }

  private toPublicOrder(order: Order): Order {
    return {
      ...order,
      clientName: this.publicClientName(order),
      contactInfo: null,
      notes: null,
    };
  }

  private computePricing(
    preparedItems: Array<{ part: SubmarinePart; quantity: number; unitPrice: number }>,
    discounts: BulkDiscount[],
  ): { subtotal: number; discountPct: number; discountAmt: number; total: number } {
    const subtotal = preparedItems.reduce(
      (acc, i) => acc + i.unitPrice * i.quantity,
      0,
    );
    const totalPartsCount = preparedItems.reduce(
      (acc, i) =>
        acc +
          (OrdersService.CRAFTABLE_PART_TYPES.has(i.part.partType.toLowerCase())
          ? i.quantity
          : 0),
      0,
    );
    const matchingTier = discounts.find((d) => totalPartsCount >= d.threshold);
    const discountPct = matchingTier ? Number(matchingTier.discountPercent) : 0;
    const discountAmt = Math.round(subtotal * (discountPct / 100));
    return { subtotal, discountPct, discountAmt, total: subtotal - discountAmt };
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    if (!dto.items?.length) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const partIds = [...new Set(dto.items.map((i) => i.partId))];
    const parts = await this.partRepo.find({ where: { id: In(partIds) } });
    const partMap = new Map<string, SubmarinePart>(parts.map((p) => [p.id, p]));

    for (const itemDto of dto.items) {
      if (!partMap.has(itemDto.partId)) {
        throw new NotFoundException(`Submarine part "${itemDto.partId}" not found`);
      }
    }

    const preparedItems: Array<{
      part: SubmarinePart;
      quantity: number;
      buildName: string | null;
      unitPrice: number;
    }> = [];

    for (const itemDto of dto.items) {
      const part = partMap.get(itemDto.partId)!;
      preparedItems.push({
        part,
        quantity: itemDto.quantity,
        buildName: itemDto.buildName ?? null,
        unitPrice: part.price,
      });
    }

    const discounts = await this.discountRepo.find({
      order: { threshold: 'DESC' },
    });
    const { subtotal, discountPct, discountAmt, total } = this.computePricing(
      preparedItems,
      discounts,
    );
    const orderCode = await this.generateUniqueOrderCode();

    const savedOrder = await this.ds.transaction(async (em) => {
      const order = em.create(Order, {
        orderCode,
        clientName: dto.clientName,
        isAnonymous: dto.isAnonymous ?? false,
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
          lineTotal: pi.unitPrice * pi.quantity,
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

  async confirmByCode(code: string): Promise<Order> {
    const order = await this.findByCode(code, true);
    return this.activateOrder(order);
  }

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

  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    if (!OrdersService.EDITABLE_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `Order "${order.orderCode}" is "${order.status}" — only active orders (confirmed or in progress) can be edited`,
      );
    }

    if (dto.clientName !== undefined) order.clientName = dto.clientName;
    if (dto.isAnonymous !== undefined) order.isAnonymous = dto.isAnonymous;
    if (dto.contactInfo !== undefined) order.contactInfo = dto.contactInfo;
    if (dto.notes !== undefined) order.notes = dto.notes;
    if (dto.fulfillmentDt !== undefined) order.fulfillmentDt = dto.fulfillmentDt;

    if (dto.items !== undefined) {
      if (!dto.items.length) {
        throw new BadRequestException('Order must contain at least one item');
      }

      const partIds = [...new Set(dto.items.map((i) => i.partId))];
      const parts = await this.partRepo.find({ where: { id: In(partIds) } });
      const partMap = new Map<string, SubmarinePart>(parts.map((p) => [p.id, p]));
      for (const itemDto of dto.items) {
        if (!partMap.has(itemDto.partId)) {
          throw new NotFoundException(`Submarine part "${itemDto.partId}" not found`);
        }
      }

      const preparedItems = dto.items.map((itemDto) => {
        const part = partMap.get(itemDto.partId)!;
        return {
          part,
          quantity: itemDto.quantity,
          buildName: itemDto.buildName ?? null,
          unitPrice: part.price,
        };
      });
      const discounts = await this.discountRepo.find({
        order: { threshold: 'DESC' },
      });
      const pricing = this.computePricing(preparedItems, discounts);

      await this.ds.transaction(async (em) => {
        if (order.items?.length) {
          await em.delete(
            OrderItem,
            order.items.map((i) => i.id),
          );
        }
        order.items = preparedItems.map((pi) =>
          em.create(OrderItem, {
            order,
            part: pi.part,
            partName: pi.part.name,
            partType: pi.part.partType,
            quantity: pi.quantity,
            unitPrice: pi.unitPrice,
            lineTotal: pi.unitPrice * pi.quantity,
            buildName: pi.buildName,
          }),
        );
        order.subtotal = pricing.subtotal;
        order.discountPct = pricing.discountPct;
        order.discountAmt = pricing.discountAmt;
        order.total = pricing.total;
        await em.save(order);
      });
    } else {
      await this.orderRepo.save(order);
    }

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
