import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTargetDto {
  @IsInt()
  @Min(0)
  @Max(100_000)
  @Type(() => Number)
  desiredStock: number;
}
