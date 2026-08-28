import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseMaterial } from '@ff14/entities';
import { UniversalisModule } from '../universalis/universalis.module';
import { PriceRefreshJob } from './price-refresh.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([BaseMaterial]),
    UniversalisModule,
  ],
  controllers: [PriceRefreshJob],
  providers: [PriceRefreshJob],
  exports: [PriceRefreshJob],
})
export class JobsModule {}
