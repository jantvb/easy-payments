import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const frontendOrigin = config.get<string>('FRONTEND_ORIGIN')?.trim() || 'http://localhost:4200';
  app.enableCors({
    origin: frontendOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`easy-payments demo server listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`CORS origin: ${frontendOrigin}`);
  // eslint-disable-next-line no-console
  console.log(`Stripe: POST http://localhost:${port}/api/payments/create`);
  // eslint-disable-next-line no-console
  console.log(`PayPal create: POST http://localhost:${port}/api/payments/paypal/create`);
  // eslint-disable-next-line no-console
  console.log(`PayPal capture: POST http://localhost:${port}/api/payments/paypal/capture`);
  // eslint-disable-next-line no-console
  console.log(`Catalog: GET http://localhost:${port}/api/catalog/products/:productId`);
}

void bootstrap();
