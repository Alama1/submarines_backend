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
import { InventoryService } from './inventory.service';
import { IngestDto } from './dto/ingest.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdateTargetDto } from './dto/update-target.dto';
import { CreateClaimDto } from './dto/create-claim.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  findAll(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    return this.svc.findAll(search, p, l);
  }

  @Get('missing')
  findMissing(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    return this.svc.findMissing(search, p, l);
  }

  @Get('repair')
  findRepairs(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    return this.svc.findRepairs(search, p, l);
  }

  @Get('claims')
  findAllClaims() {
    return this.svc.findAllClaims();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/claims')
  findClaims(@Param('id') id: string) {
    return this.svc.findClaims(id);
  }

  @Post(':id/claims')
  @HttpCode(HttpStatus.CREATED)
  createClaim(@Param('id') id: string, @Body() dto: CreateClaimDto) {
    return this.svc.createClaim(id, dto);
  }

  @Delete('claims/:claimId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteClaim(@Param('claimId') claimId: string): Promise<void> {
    return this.svc.deleteClaim(claimId);
  }

  @Post('ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  ingest(@Body() dto: IngestDto) {
    return this.svc.ingest(dto);
  }

  @Put(':id/stock')
  updateStock(
    @Param('id') id: string,
    @Body() dto: UpdateStockDto,
  ) {
    return this.svc.updateStock(id, dto);
  }

  @Put(':id/target')
  updateTarget(
    @Param('id') id: string,
    @Body() dto: UpdateTargetDto,
  ) {
    return this.svc.updateTarget(id, dto);
  }
}
