import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
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
}
