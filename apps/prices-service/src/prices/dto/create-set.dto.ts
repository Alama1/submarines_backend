import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PartSetItemDto {
  @IsString()
  @IsNotEmpty()
  partId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class CreatePartSetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PartSetItemDto)
  items: PartSetItemDto[];
}
