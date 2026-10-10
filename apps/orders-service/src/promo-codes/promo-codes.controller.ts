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
import { PromoCodesService } from './promo-codes.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';

@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly svc: PromoCodesService) {}

  /** Public: checks a code while the customer is filling in the order form. */
  @Post('validate')
  validate(@Body() dto: ValidatePromoCodeDto) {
    return this.svc.validate(dto.code, dto.subtotal);
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePromoCodeDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.svc.remove(id);
  }
}
