import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderNotesDto {
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fulfillmentDt?: string;
}
