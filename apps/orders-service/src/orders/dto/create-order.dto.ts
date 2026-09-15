import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  partId: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  buildName?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientName: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  rawText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fulfillmentDt?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
