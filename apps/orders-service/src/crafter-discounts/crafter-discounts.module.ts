import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrafterBulkDiscount } from '@ff14/entities';
import { CrafterDiscountsController } from './crafter-discounts.controller';
import { CrafterDiscountsService } from './crafter-discounts.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrafterBulkDiscount])],
  controllers: [CrafterDiscountsController],
  providers: [CrafterDiscountsService],
  exports: [CrafterDiscountsService],
})
export class CrafterDiscountsModule {}
