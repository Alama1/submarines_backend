import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseMaterial, PartMaterial, SubmarinePart } from '@ff14/entities';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [TypeOrmModule.forFeature([SubmarinePart, PartMaterial, BaseMaterial])],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
