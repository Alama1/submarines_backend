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

  /** Returns all materials with stock counts. Cached in Redis for 30 seconds. */
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

  /** Materials where currentStock < desiredQuantity */
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

  /** Repair/utility supplies (e.g. Magitek Repair Materials), kept out of the crafting inventory */
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

  /** All claims across every material (claims overview window) — must be declared before :id */
  @Get('claims')
  findAllClaims() {
    return this.svc.findAllClaims();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  // ── Claims (person pledges to deliver part of a missing material) ──────

  /** All claims for a material + deficit summary */
  @Get(':id/claims')
  findClaims(@Param('id') id: string) {
    return this.svc.findClaims(id);
  }

  /** Claim a quantity of the material for a person */
  @Post(':id/claims')
  @HttpCode(HttpStatus.CREATED)
  createClaim(@Param('id') id: string, @Body() dto: CreateClaimDto) {
    return this.svc.createClaim(id, dto);
  }

  /** Remove a claim */
  @Delete('claims/:claimId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteClaim(@Param('claimId') claimId: string): Promise<void> {
    return this.svc.deleteClaim(claimId);
  }

  /** Browser extension ingest payload -> RabbitMQ -> 202 Accepted */
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
