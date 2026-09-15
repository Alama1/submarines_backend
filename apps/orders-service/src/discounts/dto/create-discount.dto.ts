import { IsInt, IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDiscountDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  threshold: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPercent: number;
}
