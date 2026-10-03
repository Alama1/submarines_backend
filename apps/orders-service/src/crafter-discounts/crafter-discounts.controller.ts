import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CrafterDiscountsService } from './crafter-discounts.service';
import { CreateCrafterDiscountDto } from './dto/create-crafter-discount.dto';
import { UpdateCrafterDiscountDto } from './dto/update-crafter-discount.dto';

@Controller('crafter-discounts')
export class CrafterDiscountsController {
  constructor(private readonly svc: CrafterDiscountsService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCrafterDiscountDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCrafterDiscountDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.svc.remove(id);
  }
}
