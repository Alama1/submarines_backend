import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ApiKey } from '@ff14/entities';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { ProxyModule } from './proxy/proxy.module';

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
          database: cfg.get<string>('POSTGRES_DB', 'ff14_gateway'),
          username: cfg.get<string>('POSTGRES_USER', 'ff14'),
          password,
          entities: [ApiKey],
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
      useFactory: async () => ({ ttl: 60 }),
    }),

    AuthModule,
    ProxyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
