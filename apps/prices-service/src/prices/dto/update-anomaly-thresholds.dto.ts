import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Both fields are optional so callers can update one at a time.
 * Explicit null disables that check; a non-negative int enables it.
 */
export class UpdateAnomalyThresholdsDto {
  @IsOptional()
  @ValidateIf((o) => o.thresholdPct !== null)
  @IsInt()
  @Min(0)
  @Type(() => Number)
  thresholdPct?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.thresholdGil !== null)
  @IsInt()
  @Min(0)
  @Type(() => Number)
  thresholdGil?: number | null;
}
