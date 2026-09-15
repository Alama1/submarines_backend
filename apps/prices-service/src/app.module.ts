import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { InternalTokenGuard } from '@ff14/internal-auth';
import { AppSetting, BaseMaterial, PartMaterial, PartSet, PartSetItem, SubmarinePart } from '@ff14/entities';
import { HealthController } from './health/health.controller';
import { PricesModule } from './prices/prices.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const password = cfg.get<string>('POSTGRES_PASSWORD');
        if (!password) {
          throw new Error('POSTGRES_PASSWORD env var is required');
        }
        return {
          type: 'postgres',
          host:     cfg.get<string>('POSTGRES_HOST', 'localhost'),
          port:     cfg.get<number>('POSTGRES_PORT', 5432),
          database: cfg.get<string>('POSTGRES_DB', 'ff14_db'),
          username: cfg.get<string>('POSTGRES_USER', 'ff14'),
          password,
          entities: [AppSetting, BaseMaterial, PartMaterial, SubmarinePart, PartSet, PartSetItem],
          migrations: [join(__dirname, '../../..', 'packages/entities/dist/migrations/*.js')],
          migrationsRun: true,
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: false,
          logging: process.env.NODE_ENV !== 'production',
        };
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async () => ({ ttl: 300 }),
    }),

    PricesModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalTokenGuard,
    },
  ],
})
export class AppModule {}
