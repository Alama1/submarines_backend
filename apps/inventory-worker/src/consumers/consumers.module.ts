import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BaseMaterial,
  CharacterInventory,
  RetainerInventory,
  SubmarinePart,
} from '@ff14/entities';
import { IngestConsumer } from './ingest.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BaseMaterial,
      SubmarinePart,
      CharacterInventory,
      RetainerInventory,
    ]),
  ],
  controllers: [IngestConsumer],
  providers: [IngestConsumer],
})
export class ConsumersModule {}
