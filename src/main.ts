import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Cloud Run pasa el puerto en process.env.PORT
  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 App running on port ${port}`);
}
bootstrap();
