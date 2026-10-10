import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidatePromoCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999_999_999)
  @Type(() => Number)
  subtotal?: number;
}
