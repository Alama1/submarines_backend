import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseMaterial, SubmarinePart } from '@ff14/entities';
import { IngestConsumer } from './ingest.consumer';
import { ReserveConsumer } from './reserve.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([BaseMaterial, SubmarinePart])],
  controllers: [IngestConsumer, ReserveConsumer],
  providers: [IngestConsumer, ReserveConsumer],
})
export class ConsumersModule {}

