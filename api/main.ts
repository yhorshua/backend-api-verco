import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';  // ExpressAdapter
import express from 'express';  // Cambiar a default import para Express

let cachedServer: any = null;

async function bootstrap() {
  const server = express();  // Crear una instancia de Express
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));  // Usar ExpressAdapter correctamente

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
      'https://verco-system-xdke.vercel.app',
      'https://verco-system-xdke-9j17ywjsu-yhorshuas-projects.vercel.app',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 🚀 Puerto dinámico (requerido para Google Cloud Run)
  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 App running on port ${port}`);
  return server;  // Devuelve el servidor Express
}

// Para evitar la creación de un nuevo servidor en cada invocación, cacheamos el servidor
export const handler = async (req, res) => {
  if (!cachedServer) {
    cachedServer = await bootstrap(); // Inicializamos NestJS solo una vez
  }
  cachedServer(req, res);  // Usamos la misma instancia del servidor para manejar la solicitud
};
