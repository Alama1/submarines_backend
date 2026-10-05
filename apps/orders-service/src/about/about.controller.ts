import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { AboutService } from './about.service';

@Controller('about')
@UseInterceptors(CacheInterceptor)
@CacheTTL(60)
export class AboutController {
  constructor(private readonly svc: AboutService) {}

  @Get()
  getStats() {
    return this.svc.getStats();
  }
}
