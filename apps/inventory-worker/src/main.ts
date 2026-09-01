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
        queue: 'inventory_ingest',
        queueOptions: { durable: true },
        // Nest's ServerRMQ never acks event-pattern messages (emit() sends no
        // packet id, so the event path skips acking entirely). With noAck:false
        // + prefetchCount:1 the first message stays unacked forever and the
        // consumer silently stalls after processing exactly one ingest.
        // Snapshots are idempotent full-inventory sends every ~60s, so
        // at-most-once delivery is safe.
        noAck: true,
        prefetchCount: 1,
      },
    },
  );

  await app.listen();
  console.log('[inventory-worker] Listening on queue: inventory_ingest');
}

bootstrap();
