import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  if (!process.env.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL env var is required');
  }
  if (!process.env.INTERNAL_TOKEN) {
    throw new Error('INTERNAL_TOKEN env var is required');
  }

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL],
        queue: 'universalis_price_refresh',
        queueOptions: { durable: true },
        noAck: false,
        prefetchCount: 1,
      },
    },
  );

  await app.listen();
  console.log('[price-worker] Listening on queue: universalis_price_refresh');
}

bootstrap();
