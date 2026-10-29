import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  BaseMaterial,
  CharacterInventory,
  CraftClaim,
  CrafterBulkDiscount,
  RetainerInventory,
  SubmarinePart,
} from '@ff14/entities';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BaseMaterial,
      CraftClaim,
      SubmarinePart,
      CharacterInventory,
      RetainerInventory,
      CrafterBulkDiscount,
    ]),
    ClientsModule.registerAsync([
      {
        name: 'INVENTORY_RMQ_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cfg: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              cfg.get<string>('RABBITMQ_URL', 'amqp://ff14:ff14local@localhost:5672'),
            ],
            queue: 'inventory_ingest',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [ClaimsController, InventoryController],
  providers: [ClaimsService, InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
