import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMaterialDto {
  /** In-game item name — must be unique */
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Universalis / XIVAPI item ID — used for automatic price syncing */
  @IsOptional()
  @ValidateIf((o) => o.itemId !== null)
  @IsInt()
  @Min(1)
  @Type(() => Number)
  itemId?: number | null;

  /** Target quantity to keep in stock */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  desiredQuantity?: number;

  /** Custom manual price override (Gil) — null explicitly clears the override */
  @IsOptional()
  @ValidateIf((o) => o.myPrice !== null)
  @IsInt()
  @Min(0)
  @Type(() => Number)
  myPrice?: number | null;

  /** Vendor NPC buy price in gil — null means not sold by vendor */
  @IsOptional()
  @ValidateIf((o) => o.npcPrice !== null)
  @IsInt()
  @Min(0)
  @Type(() => Number)
  npcPrice?: number | null;

  /** Where to obtain this material, e.g. "Market", "Vendor", "Crafted" */
  @IsOptional()
  @IsString()
  whereToBuy?: string;
}