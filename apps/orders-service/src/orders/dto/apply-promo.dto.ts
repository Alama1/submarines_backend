import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApplyPromoCodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  promoCode?: string;
}
