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

export class PluginBagDto {
  @IsString()
  bagName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginItemDto)
  items: PluginItemDto[];
}

export class PluginRetainerDto {
  @IsString()
  retainerName: string;

  /**
   * Game retainer id. Accepted as string (preferred — u64 exceeds JS safe
   * integer range) or number for backwards compatibility with old plugins.
   */
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

/**
 * A single character's report: their own inventory plus the retainers they
 * own. New plugins send one entry per cached character so switching
 * characters (or machines) never loses data.
 */
export class PluginCharacterDto {
  @IsString()
  characterName: string;

  @IsOptional()
  @IsString()
  homeWorld?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginBagDto)
  playerInventory?: PluginBagDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginRetainerDto)
  retainers?: PluginRetainerDto[];
}

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginBagDto)
  playerInventory?: PluginBagDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginRetainerDto)
  retainers?: PluginRetainerDto[];

  /**
   * Multi-character reports: when present (and non-empty), these entries are
   * processed instead of the top-level character/retainer fields, so a single
   * request can update every character known to the plugin.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginCharacterDto)
  characters?: PluginCharacterDto[];
}
