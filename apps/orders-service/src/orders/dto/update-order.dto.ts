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

export class UpdateOrderItemDto {
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

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientName?: string;

  /** When true, the client's name is shown as "Anonymous" on public endpoints instead of masked */
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  /** Optional Discord tag or character name for client contact */
  @IsOptional()
  @IsString()
  contactInfo?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Target fulfillment date string */
  @IsOptional()
  @IsString()
  fulfillmentDt?: string;

  /** Replacement items — line totals and order pricing are recalculated server-side */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items?: UpdateOrderItemDto[];
}
