import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClaimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  claimedFor: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}
