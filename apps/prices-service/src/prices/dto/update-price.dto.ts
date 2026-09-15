import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePriceDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  myPrice: number;
}
