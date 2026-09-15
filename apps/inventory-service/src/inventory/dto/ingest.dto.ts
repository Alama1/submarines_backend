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
}
