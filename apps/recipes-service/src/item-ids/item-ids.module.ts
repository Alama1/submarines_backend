import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseMaterial, SubmarinePart } from '@ff14/entities';
import { XivApiClient } from '../xivapi/xivapi.client';
import { ItemIdsController } from './item-ids.controller';
import { ItemIdsService } from './item-ids.service';

@Module({
  imports: [TypeOrmModule.forFeature([BaseMaterial, SubmarinePart])],
  controllers: [ItemIdsController],
  providers: [XivApiClient, ItemIdsService],
  exports: [ItemIdsService],
})
export class ItemIdsModule {}
