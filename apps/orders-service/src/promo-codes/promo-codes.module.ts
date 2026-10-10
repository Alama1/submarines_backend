import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountCode } from '@ff14/entities';
import { PromoCodesController } from './promo-codes.controller';
import { PromoCodesService } from './promo-codes.service';

@Module({
  imports: [TypeOrmModule.forFeature([DiscountCode])],
  controllers: [PromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
