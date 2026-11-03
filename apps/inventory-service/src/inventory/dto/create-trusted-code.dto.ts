import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTrustedCodeDto {
  /** Crafter name attached to the new code — auto-filled as the claim nickname. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;
}
