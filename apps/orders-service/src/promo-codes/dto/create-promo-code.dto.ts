import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountCodeType } from '@ff14/entities';

export class CreatePromoCodeDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  code?: string;

  @IsIn(['flat', 'percent'])
  discountType: DiscountCodeType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(999_999_999)
  @Type(() => Number)
  discountValue: number;

  @IsInt()
  @Min(1)
  @Max(999)
  @Type(() => Number)
  maxUses: number;

  @IsOptional()
  @IsDateString()
  activeFrom?: string | null;

  @IsOptional()
  @IsDateString()
  activeUntil?: string | null;
}
