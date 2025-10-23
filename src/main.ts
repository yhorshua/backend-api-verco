import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔒 Habilita CORS (necesario para permitir solicitudes desde tu frontend)
  app.enableCors({
    origin: [
      'http://localhost:3000', // 👉 tu entorno local de Next.js
      'https://verco-system-xdke.vercel.app', // 👉 si tienes deploy de tu frontend (Firebase, Vercel, etc.)
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // habilita cookies o headers personalizados si los usas
  });

  // Cloud Run usa PORT desde las variables de entorno
  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 App running on port ${port}`);
}
bootstrap();
