import { IsInt, IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDiscountDto {
  /** Minimum order subtotal in gil to qualify */
  @IsInt()
  @Min(0)
  @Type(() => Number)
  threshold: number;

  /** Discount percentage (e.g. 5.0 for 5%) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPercent: number;
}
