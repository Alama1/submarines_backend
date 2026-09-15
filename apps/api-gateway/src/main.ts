import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';

function isTrustedProxy(address: string): boolean {
  if (!address) return false;
  if (address.startsWith('::ffff:')) address = address.slice(7);
  if (address === '::1' || address.startsWith('fc') || address.startsWith('fd')) return true;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 127 && b === 0 && parts[2] === 0 && parts[3] === 1) ||
    (a === 169 && b === 254)
  );
}

async function bootstrap(): Promise<void> {
  if (!process.env.ADMIN_API_KEY) {
    throw new Error('ADMIN_API_KEY env var is required');
  }
  if (!process.env.INTERNAL_TOKEN) {
    throw new Error('INTERNAL_TOKEN env var is required');
  }
  if (!process.env.ALLOWED_EMAILS?.trim()) {
    console.warn('[api-gateway] ALLOWED_EMAILS is not set — Firebase logins will be denied');
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, trustProxy: isTrustedProxy }),
  );

  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-API-Key'],
    credentials: false,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription(
      'Gateway for the FF14 submarine backend. Business endpoints are proxied to downstream services — their full documentation is available on each service /docs page (prices, inventory, orders, recipes).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'X-API-Key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(process.env.PORT ?? process.env.API_GATEWAY_PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[api-gateway] Listening on http://0.0.0.0:${port}`);
  console.log(`[api-gateway] Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
