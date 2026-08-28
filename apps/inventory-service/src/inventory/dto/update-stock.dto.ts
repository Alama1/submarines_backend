import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateStockDto {
  /** Current in-game stock available */
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock: number;
}
