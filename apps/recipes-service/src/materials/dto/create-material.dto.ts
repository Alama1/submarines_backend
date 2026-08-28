import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMaterialDto {
  /** In-game item name — must be unique */
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Universalis / XIVAPI item ID — used for automatic price syncing */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  itemId?: number;

  /** Target quantity to keep in stock */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  desiredQuantity?: number;

  /** Vendor NPC buy price in gil */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  npcPrice?: number;

  /** Where to obtain this material, e.g. "Market", "Vendor", "Crafted" */
  @IsOptional()
  @IsString()
  whereToBuy?: string;
}
