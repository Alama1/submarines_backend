import { Module } from '@nestjs/common';
import { UniversalisClient } from './universalis.client';

@Module({
  providers: [UniversalisClient],
  exports: [UniversalisClient],
})
export class UniversalisModule {}
