import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { BaseMaterial } from './base-material.entity';
import { PartMaterial } from './part-material.entity';
import { SubmarinePart } from './submarine-part.entity';
import { MaterialClaim } from './material-claim.entity';
import { AppSetting } from './app-setting.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { BulkDiscount } from './bulk-discount.entity';
import { PartSet } from './part-set.entity';
import { PartSetItem } from './part-set-item.entity';

dotenv.config({ path: '../../.env' });
dotenv.config({ path: '.env.local' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host:     process.env.POSTGRES_HOST ?? 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  database: process.env.POSTGRES_DB ?? 'ff14_db',
  username: process.env.POSTGRES_USER ?? 'ff14',
  password: process.env.POSTGRES_PASSWORD ?? 'ff14local',
  entities: [BaseMaterial, PartMaterial, SubmarinePart, MaterialClaim, AppSetting, Order, OrderItem, BulkDiscount, PartSet, PartSetItem],
  migrations: ['src/migrations/*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: true,
});
