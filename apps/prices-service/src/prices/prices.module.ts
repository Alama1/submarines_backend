import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseMaterial } from '@ff14/entities';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

@Module({
  imports: [TypeOrmModule.forFeature([BaseMaterial])],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
