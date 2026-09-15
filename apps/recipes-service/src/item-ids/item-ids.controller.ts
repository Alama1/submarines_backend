import { Controller, Post } from '@nestjs/common';
import { ItemIdsService } from './item-ids.service';

@Controller('xivapi')
export class ItemIdsController {
  constructor(private readonly svc: ItemIdsService) {}

  @Post('resolve-missing-ids')
  resolveMissingIds() {
    return this.svc.resolveMissingIds();
  }
}
