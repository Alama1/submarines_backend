import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CraftClaimStatus } from '@ff14/entities';
import { ClaimsService } from './claims.service';
import { CreateCraftClaimDto } from './dto/create-craft-claim.dto';
import { CreateTrustedCodeDto } from './dto/create-trusted-code.dto';
import { UpdateClaimStatusDto } from './dto/update-claim-status.dto';

@Controller('inventory/claims')
export class ClaimsController {
  constructor(private readonly svc: ClaimsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCraftClaimDto) {
    return this.svc.create(dto);
  }

  @Get('lookup/:code')
  findByCode(@Param('code') code: string) {
    return this.svc.findByCode(code);
  }

  @Post(':code/cancel')
  cancelByCode(@Param('code') code: string) {
    return this.svc.cancelByCode(code);
  }

  @Post(':code/complete')
  completeByCode(@Param('code') code: string) {
    return this.svc.completeByCode(code);
  }

  @Get('admin')
  findAll(@Query('status') status?: string) {
    const statuses = status
      ? (status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean) as CraftClaimStatus[])
      : undefined;
    return this.svc.findAll(statuses?.length ? statuses : undefined);
  }

  /** Public lookup of a trusted access code's attached crafter name. */
  @Get('trusted/:code')
  lookupTrustedCode(@Param('code') code: string) {
    return this.svc.lookupTrustedName(code).then((name) => ({ name }));
  }

  @Get('admin/trusted-codes')
  listTrustedCodes() {
    return this.svc.listTrustedCodes();
  }

  @Post('admin/trusted-codes')
  createTrustedCode(@Body() dto: CreateTrustedCodeDto) {
    return this.svc.createTrustedCode(dto.name);
  }

  @Delete('admin/trusted-codes/:id')
  revokeTrustedCode(@Param('id') id: string) {
    return this.svc.revokeTrustedCode(id);
  }

  @Patch('admin/:id/confirm')
  confirm(@Param('id') id: string) {
    return this.svc.confirmById(id);
  }

  @Patch('admin/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateClaimStatusDto) {
    return this.svc.updateStatus(id, dto);
  }

  @Delete('admin/:id')
  cancelByAdmin(@Param('id') id: string) {
    return this.svc.cancelByAdmin(id);
  }
}
