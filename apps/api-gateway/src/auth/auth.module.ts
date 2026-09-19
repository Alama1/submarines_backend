import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllowedEmail, ApiKey } from '@ff14/entities';
import { FirebaseService } from './firebase.service';
import { AuthGuard } from './guards/auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { AuthController } from './auth.controller';
import { WhitelistController } from './whitelist.controller';
import { WhitelistService } from './whitelist.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, AllowedEmail])],
  controllers: [AuthController, WhitelistController],
  providers: [
    FirebaseService,
    AuthGuard,
    RateLimitGuard,
    WhitelistService,
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
