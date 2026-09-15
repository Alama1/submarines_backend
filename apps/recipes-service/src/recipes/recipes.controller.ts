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
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { RecipesService } from './recipes.service';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { UpdateTargetDto } from './dto/update-target.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly svc: RecipesService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(86_400)
  findAll() {
    return this.svc.findAll();
  }

  @Post('recalculate-targets')
  recalculateTargets() {
    return this.svc.recalculateMaterialTargets();
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(86_400)
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePartDto) {
    return this.svc.create(dto);
  }

  @Put(':id/target')
  updateTarget(@Param('id') id: string, @Body() dto: UpdateTargetDto) {
    return this.svc.updateTarget(id, dto.desiredStock);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePartDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.svc.remove(id);
  }
}
