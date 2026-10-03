import { PartialType } from '@nestjs/mapped-types';
import { CreateCrafterDiscountDto } from './create-crafter-discount.dto';

export class UpdateCrafterDiscountDto extends PartialType(CreateCrafterDiscountDto) {}
