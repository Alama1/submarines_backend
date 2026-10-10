import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkDiscount, Order, OrderItem, SubmarinePart } from '@ff14/entities';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, SubmarinePart, BulkDiscount]),
    PromoCodesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
