import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Both fields are optional so callers can update one at a time.
 * Explicit null for desiredDiff disables flagging; a non-negative int sets it.
 * desiredDiffOffset nulls are stored as 0 (no tolerance).
 */
export class UpdateAnomalyThresholdsDto {
  @IsOptional()
  @ValidateIf((o) => o.desiredDiff !== null)
  @IsInt()
  @Min(0)
  @Type(() => Number)
  desiredDiff?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.desiredDiffOffset !== null)
  @IsInt()
  @Min(0)
  @Type(() => Number)
  desiredDiffOffset?: number | null;
}
