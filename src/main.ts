import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { correlationIdMiddleware } from './common/http/correlation-id.middleware';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(correlationIdMiddleware);
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = Number(process.env.PORT) || 8080;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Nest corriendo en http://localhost:${port}`);
}
bootstrap();

