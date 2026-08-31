import { Controller, Post } from '@nestjs/common';
import { ItemIdsService } from './item-ids.service';

@Controller('xivapi')
export class ItemIdsController {
  constructor(private readonly svc: ItemIdsService) {}

  /**
   * Resolves missing FF14 item IDs for all materials and submarine parts
   * via the XIVAPI search endpoint. Only entries without an itemId are
   * touched — existing IDs are never overwritten.
   */
  @Post('resolve-missing-ids')
  resolveMissingIds() {
    return this.svc.resolveMissingIds();
  }
}
