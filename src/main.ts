import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Validación global (usa class-validator en tus DTOs)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina propiedades no definidas en DTO
      forbidNonWhitelisted: true, // lanza error si hay propiedades extra
      transform: true, // transforma payloads al tipo esperado
    }),
  );

  // 🔒 Habilita CORS (para conexión con tu frontend)
  app.enableCors({
    origin: [
      'http://localhost:3000', // entorno local de Next.js
      'https://verco-system-xdke.vercel.app', // tu frontend desplegado
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 🚀 Puerto dinámico (requerido para Google Cloud Run)
  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 App running on port ${port}`);
}

bootstrap();
