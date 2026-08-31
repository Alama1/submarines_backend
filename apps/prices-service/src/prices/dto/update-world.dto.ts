import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateWorldDto {
  /** In-game world name for Universalis market sync (e.g. Louisoix) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  world: string;
}
