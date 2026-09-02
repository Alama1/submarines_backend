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
  expandAllPartMaterials,
  ExpandedMaterialRequirement,
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

  /**
   * Public display name for an order: anonymous orders fully replace the
   * name with "Anonymous" (not masked), everything else gets masked.
   */
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
      // Unconfirmed (pending) orders are hidden everywhere — spam protection.
      // They only become visible once activated with their confirmation code.
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

  async findInProgress(): Promise<{
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
        isPart: boolean;
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
        isPart: boolean;
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
    const matById = new Map<string, BaseMaterial>();
    for (const p of allParts) {
      for (const pm of p.materials ?? []) {
        if (pm.material) matById.set(pm.material.id, pm.material);
      }
    }
    const expanded = expandAllPartMaterials(allParts);

    // Live crafting cost for one unit of every part, using each material's
    // effective price (manual override > market > NPC)
    const costPerPart = new Map<string, number>();
    for (const p of allParts) {
      let cost = 0;
      for (const req of expanded.get(p.id) ?? []) {
        const mat = matById.get(req.materialId);
        const unit = mat ? (mat.myPrice ?? mat.marketPrice ?? mat.npcPrice ?? 0) : 0;
        cost += unit * req.quantity;
      }
      costPerPart.set(p.id, cost);
    }

    // Stock is shared across simultaneous builds: earlier orders (by confirmedAt,
    // the same order the feed is displayed in) claim materials first, and later
    // orders only get what's left — so their missing lists reflect reality.
    const availableStock = new Map<string, number>();

    const mapped = orders.map((o) => {
      let materialCost = 0;
      const items = (o.items ?? []).map((item) => {
        const part = partsById.get(item.part?.id ?? '') ?? item.part;
        if (part) materialCost += (costPerPart.get(part.id) ?? 0) * item.quantity;
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

      return {
        id: o.id,
        orderCode: o.orderCode,
        clientName: this.publicClientName(o),
        isAnonymous: o.isAnonymous,
        contactInfo: o.contactInfo,
        notes: o.notes,
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
          revenue: o.total,
          materialCost,
          profit: o.total - materialCost,
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

  /**
   * Aggregates the raw material and part requirements of every in-progress
   * order into a single shopping list, then reports the shortfall against
   * current stock — so big simultaneous orders that together eat the whole
   * stock are visible in one place (unlike the per-order lists, which
   * allocate shared stock sequentially).
   */
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
      isPart: boolean;
    }>;
  } {
    // Units still to craft per part across all in-progress orders
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

    // Nested part stock covers part-as-material needs; covered units remove
    // their own raw requirements (they are already crafted)
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
      isPart: boolean;
    }> = [];

    for (const [nestedId, needed] of partNeeds) {
      const nested = partsById.get(nestedId);
      if (!nested) continue;
      const covered = coveredByPart.get(nestedId) ?? 0;
      materials.push({
        materialId: nested.id,
        name: nested.name,
        itemId: nested.itemId,
        needed,
        available: covered,
        missing: needed - covered,
        isPart: true,
      });
    }

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
        isPart: false,
      });
    }

    materials.sort(
      (a, b) =>
        Number(b.isPart) - Number(a.isPart) ||
        b.missing - a.missing ||
        a.name.localeCompare(b.name),
    );

    return { materials };
  }

  /**
   * Computes what materials an in-progress order is still short of, using the
   * recipes (PartMaterial rows) of every part that still needs crafting.
   *
   * Follows the same convention as RecipesService.recalculateMaterialTargets:
   * part-as-material rows (modified parts requiring their base part) are listed
   * directly with the nested part's stock as coverage, while raw materials come
   * from the fully expanded recipe chain. Units covered by existing intermediate
   * part stock are subtracted from the raw requirements so the shopping list
   * stays accurate.
   */
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
    isPart: boolean;
  }> {
    const rawNeeds = new Map<string, { mat: BaseMaterial; needed: number }>();
    const partNeeds = new Map<
      string,
      { mat: BaseMaterial; part: SubmarinePart; needed: number }
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
        const entry = partNeeds.get(pm.material.id) ?? {
          mat: pm.material,
          part: nested,
          needed: 0,
        };
        entry.needed += toCraft * pm.quantity;
        partNeeds.set(pm.material.id, entry);
      }
    }

    const missing: Array<{
      materialId: string;
      name: string;
      itemId: number | null;
      needed: number;
      available: number;
      missing: number;
      isPart: boolean;
    }> = [];

    for (const { mat, part: nested, needed } of partNeeds.values()) {
      const covered = Math.min(needed, nested.stock);
      if (needed - covered > 0) {
        missing.push({
          materialId: mat.id,
          name: mat.name,
          itemId: mat.itemId,
          needed,
          available: covered,
          missing: needed - covered,
          isPart: true,
        });
      }
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
          isPart: false,
        });
      }
    }

    missing.sort(
      (a, b) => Number(b.isPart) - Number(a.isPart) || b.missing - a.missing,
    );
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
    return {
      ...order,
      clientName: this.publicClientName(order),
    };
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
