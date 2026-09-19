import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { PricesService } from './prices.service';
import { UpdatePriceDto } from './dto/update-price.dto';
import { UpdateWorldDto } from './dto/update-world.dto';
import { UpdateAnomalyThresholdsDto } from './dto/update-anomaly-thresholds.dto';
import { CreatePartSetDto } from './dto/create-set.dto';
import { UpdatePartSetDto } from './dto/update-set.dto';

@Controller('prices')
export class PricesController {
  constructor(private readonly svc: PricesService) {}

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

  @Post('refresh')
  refresh() {
    return this.svc.triggerRefresh();
  }

  @Get('settings')
  getUniversalisSettings() {
    return this.svc.getUniversalisSettings();
  }

  @Put('settings/world')
  updateUniversalisWorld(@Body() dto: UpdateWorldDto) {
    return this.svc.updateUniversalisWorld(dto);
  }

  @Get('sets')
  findSets() {
    return this.svc.findSets();
  }

  @Post('sets')
  @HttpCode(HttpStatus.CREATED)
  createSet(@Body() dto: CreatePartSetDto) {
    return this.svc.createSet(dto);
  }

  @Put('sets/:id')
  updateSet(@Param('id') id: string, @Body() dto: UpdatePartSetDto) {
    return this.svc.updateSet(id, dto);
  }

  @Delete('sets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSet(@Param('id') id: string) {
    return this.svc.deleteSet(id);
  }

  @Get('anomalies/settings')
  getAnomalyThresholds() {
    return this.svc.getAnomalyThresholds();
  }

  @Put('anomalies/settings')
  updateAnomalyThresholds(@Body() dto: UpdateAnomalyThresholdsDto) {
    return this.svc.updateAnomalyThresholds(dto);
  }

  @Get('anomalies')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  findAnomalies() {
    return this.svc.findAnomalies();
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
