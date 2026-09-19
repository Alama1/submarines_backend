import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialCategory, MaterialSource } from '@ff14/entities';

export class MaterialIngredientInputDto {
  @IsString()
  @IsNotEmpty()
  ingredientMaterialId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @ValidateIf((o) => o.itemId !== null)
  @IsInt()
  @Min(1)
  @Type(() => Number)
  itemId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  desiredQuantity?: number;

  @IsOptional()
  @ValidateIf((o) => o.myPrice !== null)
  @IsInt()
  @Min(0)
  @Type(() => Number)
  myPrice?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.npcPrice !== null)
  @IsInt()
  @Min(0)
  @Type(() => Number)
  npcPrice?: number | null;

  @IsOptional()
  @IsEnum(MaterialSource)
  whereToBuy?: MaterialSource;

  @IsOptional()
  @IsEnum(MaterialCategory)
  category?: MaterialCategory;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialIngredientInputDto)
  ingredients?: MaterialIngredientInputDto[];
}