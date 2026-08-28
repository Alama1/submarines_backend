import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  /** Slug ID of the SubmarinePart, e.g. 'shark_hull' */
  @IsString()
  @IsNotEmpty()
  partId: string;

  /** Quantity of this submarine part to order */
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  /** Optional submarine build name, e.g. 'Shark + Whale' */
  @IsOptional()
  @IsString()
  buildName?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  clientName: string;

  /** Optional Discord tag or character name for client contact */
  @IsOptional()
  @IsString()
  contactInfo?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Target fulfillment date string */
  @IsOptional()
  @IsString()
  fulfillmentDt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
