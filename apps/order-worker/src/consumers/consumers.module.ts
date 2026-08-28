import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Order, OrderItem, SubmarinePart, PartMaterial, BaseMaterial } from '@ff14/entities';
import { OrderProcessingConsumer } from './order-processing.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, SubmarinePart, PartMaterial, BaseMaterial]),
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
  controllers: [OrderProcessingConsumer],
  providers: [OrderProcessingConsumer],
})
export class ConsumersModule {}
