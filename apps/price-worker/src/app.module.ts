import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { BaseMaterial, PartMaterial, SubmarinePart } from '@ff14/entities';
import { UniversalisModule } from './universalis/universalis.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

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
        migrations: ['dist/migrations/*.js'],
        migrationsRun: false,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async () => ({ ttl: 300 }),
    }),

    UniversalisModule,
    JobsModule,
  ],
})
export class AppModule {}


