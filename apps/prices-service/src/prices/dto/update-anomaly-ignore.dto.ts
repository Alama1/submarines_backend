import { IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAnomalyIgnoreDto {
  @IsBoolean()
  @Type(() => Boolean)
  ignore: boolean;
}
