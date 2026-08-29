import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Reject unknown fields rather than silently ignoring them, so a typo in a
  // request body fails loudly instead of writing a half-empty record.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
  app.enableCors({ origin: origins.length > 0 ? origins : true, credentials: false });

  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port);
  console.log(`NightShift NestJS Backend running on http://localhost:${port}`);
}

void bootstrap();
