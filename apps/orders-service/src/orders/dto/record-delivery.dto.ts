import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecordDeliveryItemDto {
  @IsInt()
  itemId: number;

  /** Absolute delivered count (0..item.quantity) — resending corrects a mistake. */
  @IsInt()
  @Min(0)
  deliveredQuantity: number;
}

export class RecordDeliveryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecordDeliveryItemDto)
  items: RecordDeliveryItemDto[];
}
