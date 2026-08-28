import { IsIn } from 'class-validator';
import { OrderStatus } from '@ff14/entities';

export class UpdateOrderStatusDto {
  @IsIn(['pending', 'processing', 'fulfilled', 'cancelled'])
  status: OrderStatus;
}
