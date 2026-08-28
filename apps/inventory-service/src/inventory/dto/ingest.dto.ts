import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Single item inside a bag ──────────────────────────────────────────────

export class PluginItemDto {
  @IsInt()
  itemId: number;

  @IsString()
  itemName: string;

  @IsInt()
  quantity: number;

  @IsBoolean()
  isHQ: boolean;

  @IsOptional()
  @IsNumber()
  condition?: number;
}

// ─── A named bag (Inventory1, Crystals, RetainerInventory, RetainerGil …) ──

export class PluginBagDto {
  @IsString()
  bagName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginItemDto)
  items: PluginItemDto[];
}

// ─── A retainer entry ──────────────────────────────────────────────────────

export class PluginRetainerDto {
  @IsString()
  retainerName: string;

  @IsOptional()
  retainerId?: unknown;

  @IsOptional()
  @IsString()
  lastUpdated?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginBagDto)
  bags: PluginBagDto[];
}

// ─── Top-level payload from the FFXIV plugin ───────────────────────────────

export class IngestDto {
  @IsOptional()
  @IsString()
  characterName?: string;

  @IsOptional()
  @IsString()
  homeWorld?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  /** Player character bags (Inventory1-4, Crystals, etc.) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginBagDto)
  playerInventory?: PluginBagDto[];

  /** All retainer inventories */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginRetainerDto)
  retainers?: PluginRetainerDto[];
}
