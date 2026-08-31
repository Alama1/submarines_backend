import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppSetting, BaseMaterial } from '@ff14/entities';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BaseMaterial, AppSetting]),
    ClientsModule.registerAsync([
      {
        name: 'PRICE_RMQ_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cfg: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              cfg.get<string>('RABBITMQ_URL', 'amqp://ff14:ff14local@localhost:5672'),
            ],
            queue: 'universalis_price_refresh',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
