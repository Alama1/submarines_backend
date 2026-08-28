import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import {
  BaseMaterial,
  PartMaterial,
  SubmarinePart,
  Order,
  OrderItem,
  BulkDiscount,
} from '@ff14/entities';
import { ConsumersModule } from './consumers/consumers.module';

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
        entities: [BaseMaterial, PartMaterial, SubmarinePart, Order, OrderItem, BulkDiscount],
        migrations: ['dist/migrations/*.js'],
        migrationsRun: false,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),

    ConsumersModule,
  ],
})
export class AppModule {}


