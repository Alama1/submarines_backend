import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { ApiKey } from './api-key.entity';

dotenv.config({ path: '../../.env' });
dotenv.config({ path: '.env.local' });

export const GatewayDataSource = new DataSource({
  type: 'postgres',
  host:     process.env.POSTGRES_HOST ?? 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  database: process.env.POSTGRES_GATEWAY_DB ?? 'ff14_gateway',
  username: process.env.POSTGRES_USER ?? 'ff14',
  password: process.env.POSTGRES_PASSWORD ?? 'ff14local',
  entities: [ApiKey],
  migrations: ['src/gateway-migrations/*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: true,
});
