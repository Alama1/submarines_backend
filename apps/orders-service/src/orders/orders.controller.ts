import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { OrderStatus } from '@ff14/entities';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-status.dto';
import { UpdateOrderNotesDto } from './dto/update-notes.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const statuses = status
      ? (status.split(',').filter(Boolean) as OrderStatus[])
      : undefined;
    return this.svc.findAll(statuses, p, l);
  }

  @Get('in-progress')
  findInProgress() {
    return this.svc.findInProgress();
  }

  @Get('admin/in-progress')
  findInProgressAdmin() {
    return this.svc.findInProgress(true);
  }

  @Get('lookup/:code')
  findByCode(@Param('code') code: string) {
    return this.svc.findByCode(code);
  }

  @Get('admin/lookup/:code')
  findByCodeAdmin(@Param('code') code: string) {
    return this.svc.findByCode(code, true);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.svc.create(dto);
  }

  @Post('confirm')
  confirmByCode(@Body() dto: ConfirmOrderDto) {
    return this.svc.confirmByCode(dto.code);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/confirm')
  confirmById(@Param('id') id: string) {
    return this.svc.confirmById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.svc.updateStatus(id, dto);
  }

  @Patch(':id/notes')
  updateNotes(
    @Param('id') id: string,
    @Body() dto: UpdateOrderNotesDto,
  ) {
    return this.svc.updateNotes(id, dto);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.svc.cancel(id);
  }
}
