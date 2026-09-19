import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { WhitelistService } from './whitelist.service';
import { AddWhitelistEntryRequest } from './whitelist.dto';
import { WhitelistEntry, WhitelistResponse } from '@ff14/types';

@Controller('auth/whitelist')
export class WhitelistController {
  constructor(private readonly svc: WhitelistService) {}

  @Get()
  list(): Promise<WhitelistResponse> {
    return this.svc.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body() dto: AddWhitelistEntryRequest): Promise<WhitelistEntry> {
    return this.svc.add(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.svc.remove(id);
  }
}
