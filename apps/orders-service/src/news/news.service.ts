import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsItem } from '@ff14/entities';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(NewsItem)
    private readonly repo: Repository<NewsItem>,
  ) {}

  findActive(): Promise<NewsItem[]> {
    return this.repo.find({
      where: { active: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  findAll(): Promise<NewsItem[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } });
  }

  create(dto: CreateNewsDto): Promise<NewsItem> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateNewsDto): Promise<NewsItem> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }

  private async findOne(id: string): Promise<NewsItem> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`News item "${id}" not found`);
    return item;
  }
}
