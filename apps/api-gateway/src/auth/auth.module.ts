import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '@ff14/entities';
import { FirebaseService } from './firebase.service';
import { AuthGuard } from './guards/auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { AuthController } from './auth.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  controllers: [AuthController],
  providers: [
    FirebaseService,
    AuthGuard,
    RateLimitGuard,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [FirebaseService],
})
export class AuthModule {}
