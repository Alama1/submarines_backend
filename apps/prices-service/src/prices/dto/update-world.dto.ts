import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateWorldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  world: string;
}
