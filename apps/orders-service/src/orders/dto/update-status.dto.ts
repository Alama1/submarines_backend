import { IsIn } from 'class-validator';
import { OrderStatus } from '@ff14/entities';

export class UpdateOrderStatusDto {
  @IsIn(['pending', 'confirmed', 'in_progress', 'finished', 'fulfilled', 'cancelled'])
  status: OrderStatus;
}
