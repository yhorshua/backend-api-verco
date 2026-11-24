import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { correlationIdMiddleware } from './common/http/correlation-id.middleware';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (process.env.NODE_ENV === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use(correlationIdMiddleware);
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://verco.store',
      'https://www.verco.store',
      'https://vercosystem-production.up.railway.app',
      'https://verco-system-xdke.vercel.app',
      'https://verco-system-xdke-9j17ywjsu-yhorshuas-projects.vercel.app',
      'https://verco.online',
      'https://www.verco.online',
      'https://verco-web-ecommerce-production.up.railway.app',
      ...configuredOrigins,
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = Number(process.env.PORT) || 8080;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Nest corriendo en http://localhost:${port}`);
}
bootstrap();

