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
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

@Controller('news')
export class NewsController {
  constructor(private readonly svc: NewsService) {}

  /** Public: only active announcements, for the client-side news banner. */
  @Get()
  findActive() {
    return this.svc.findActive();
  }

  /** Admin (auth required at the gateway): every item incl. unpublished. */
  @Get('all')
  findAll() {
    return this.svc.findAll();
  }

  @Post()
  create(@Body() dto: CreateNewsDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNewsDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.svc.remove(id);
  }
}
