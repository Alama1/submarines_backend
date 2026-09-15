import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePartDto } from './create-part.dto';

export class UpdatePartDto extends PartialType(OmitType(CreatePartDto, ['id'] as const)) {}
