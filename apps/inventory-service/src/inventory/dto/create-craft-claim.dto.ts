import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCraftClaimItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  materialId: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  @Type(() => Number)
  quantity: number;
}

export class CreateCraftClaimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nickname: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateCraftClaimItemDto)
  items: CreateCraftClaimItemDto[];

  /** Optional trusted-crafter access code — a match creates the claim as confirmed. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accessCode?: string;
}
