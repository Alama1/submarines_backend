import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddWhitelistEntryRequest {
  @IsEmail({}, { message: 'must be a valid email address' })
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
