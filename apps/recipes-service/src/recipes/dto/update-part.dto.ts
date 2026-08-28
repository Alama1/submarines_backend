import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePartDto } from './create-part.dto';

/**
 * On update, ''id'' comes from the URL param — it is excluded from the body.
 * All other fields are optional.
 */
export class UpdatePartDto extends PartialType(OmitType(CreatePartDto, ['id'] as const)) {}
