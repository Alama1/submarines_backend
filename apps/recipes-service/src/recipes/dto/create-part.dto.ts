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
  /** UUID of the BaseMaterial */
  @IsString()
  @IsNotEmpty()
  materialId: string;

  /** Units of this material required to craft 1 part */
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class CreatePartDto {
  /** Stable slug identifier, e.g. 'shark_hull', 'whale_modified_stern' */
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  /** FF14 in-game item ID for retainer inventory matching */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  itemId?: number;

  /** hull | stern | bow | bridge */
  @IsString()
  @IsNotEmpty()
  partType: string;

  /** e.g. "Shark", "Whale", "Coelacanth" */
  @IsString()
  @IsNotEmpty()
  className: string;

  /** e.g. "shark", "whale" — used for grouping */
  @IsString()
  @IsNotEmpty()
  classKey: string;

  /** True for the mk2 (modified) version of the part */
  @IsOptional()
  @IsBoolean()
  isModified?: boolean;

  /** Gil sale price for one crafted part */
  @IsInt()
  @Min(0)
  @Type(() => Number)
  price: number;

  /** Completed units in stock (defaults to 0) */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock?: number;

  /** Target quantity of this part desired in workshop inventory */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  desiredStock?: number;

  /** List of material requirements for crafting this part */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartMaterialInputDto)
  materials?: PartMaterialInputDto[];
}