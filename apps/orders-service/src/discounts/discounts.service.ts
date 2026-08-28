import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkDiscount } from '@ff14/entities';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(BulkDiscount)
    private readonly repo: Repository<BulkDiscount>,
  ) {}

  findAll(): Promise<BulkDiscount[]> {
    return this.repo.find({ order: { threshold: 'ASC' } });
  }

  async findOne(id: string): Promise<BulkDiscount> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Discount tier "${id}" not found`);
    return d;
  }

  create(dto: CreateDiscountDto): Promise<BulkDiscount> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateDiscountDto): Promise<BulkDiscount> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const d = await this.findOne(id);
    await this.repo.remove(d);
  }
}
