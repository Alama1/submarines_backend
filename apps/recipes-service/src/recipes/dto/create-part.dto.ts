import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PartMaterialInputDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class CreatePartDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  itemId?: number;

  @IsString()
  @IsNotEmpty()
  partType: string;

  @IsString()
  @IsNotEmpty()
  className: string;

  @IsString()
  @IsNotEmpty()
  classKey: string;

  @IsOptional()
  @IsBoolean()
  isModified?: boolean;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  desiredStock?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartMaterialInputDto)
  materials?: PartMaterialInputDto[];
}