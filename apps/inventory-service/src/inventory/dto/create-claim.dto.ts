import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClaimDto {
  /** Name of the person claiming the material */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  claimedFor: string;

  /** Amount the person commits to deliver */
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}
