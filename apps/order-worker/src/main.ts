import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [
          process.env.RABBITMQ_URL ?? 'amqp://ff14:ff14local@localhost:5672',
        ],
        queue: 'order_processing',
        queueOptions: { durable: true },
        noAck: false,
        prefetchCount: 1,
      },
    },
  );

  await app.listen();
  console.log('[order-worker] Listening on queue: order_processing');
}

bootstrap();
