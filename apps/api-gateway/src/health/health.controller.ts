import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Public()
  @Get()
  async check(): Promise<{ status: string; db: string; uptime: number }> {
    let db = 'ok';
    try {
      await this.ds.query('SELECT 1');
    } catch {
      db = 'error';
    }
    return { status: 'ok', db, uptime: Math.floor(process.uptime()) };
  }
}
