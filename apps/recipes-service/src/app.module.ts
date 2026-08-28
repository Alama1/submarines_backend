import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { BaseMaterial, PartMaterial, SubmarinePart } from '@ff14/entities';
import { HealthController } from './health/health.controller';
import { MaterialsModule } from './materials/materials.module';
import { RecipesModule } from './recipes/recipes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host:     cfg.get<string>('POSTGRES_HOST', 'localhost'),
        port:     cfg.get<number>('POSTGRES_PORT', 5432),
        database: cfg.get<string>('POSTGRES_DB', 'ff14_db'),
        username: cfg.get<string>('POSTGRES_USER', 'ff14'),
        password: cfg.get<string>('POSTGRES_PASSWORD', 'ff14local'),
        entities: [BaseMaterial, PartMaterial, SubmarinePart],
        migrations: [join(__dirname, '../../..', 'packages/entities/dist/migrations/*.js')],
        migrationsRun: true,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async () => ({ ttl: 86_400 }),
    }),

    MaterialsModule,
    RecipesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}


