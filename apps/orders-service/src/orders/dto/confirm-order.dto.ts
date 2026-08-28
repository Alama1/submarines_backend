import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmOrderDto {
  /** Confirmation code provided by the client (e.g. SUB-7K9P) */
  @IsString()
  @IsNotEmpty()
  code: string;
}
