import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { PricesService } from './prices.service';
import { UpdatePriceDto } from './dto/update-price.dto';

@Controller('prices')
export class PricesController {
  constructor(private readonly svc: PricesService) {}

  /** Returns all materials with prices. Cached in Redis for 5 minutes. */
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  findAll(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    return this.svc.findAll(search, p, l);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id/my-price')
  updateMyPrice(
    @Param('id') id: string,
    @Body() dto: UpdatePriceDto,
  ) {
    return this.svc.updateMyPrice(id, dto);
  }

  @Delete(':id/my-price')
  clearMyPrice(@Param('id') id: string) {
    return this.svc.clearMyPrice(id);
  }
}
