import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrafterBulkDiscount } from '@ff14/entities';
import { CreateCrafterDiscountDto } from './dto/create-crafter-discount.dto';
import { UpdateCrafterDiscountDto } from './dto/update-crafter-discount.dto';

@Injectable()
export class CrafterDiscountsService {
  constructor(
    @InjectRepository(CrafterBulkDiscount)
    private readonly repo: Repository<CrafterBulkDiscount>,
  ) {}

  findAll(): Promise<CrafterBulkDiscount[]> {
    return this.repo.find({ order: { threshold: 'ASC' } });
  }

  async findOne(id: string): Promise<CrafterBulkDiscount> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Crafter discount tier "${id}" not found`);
    return d;
  }

  create(dto: CreateCrafterDiscountDto): Promise<CrafterBulkDiscount> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateCrafterDiscountDto): Promise<CrafterBulkDiscount> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const d = await this.findOne(id);
    await this.repo.remove(d);
  }
}
