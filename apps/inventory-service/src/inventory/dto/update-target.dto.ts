import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTargetDto {
  /** Target desired stock quantity */
  @IsInt()
  @Min(0)
  @Type(() => Number)
  desiredQuantity: number;
}
