import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import serverless from 'serverless-http';

let cachedServer: any;

async function bootstrap() {
  if (!cachedServer) {
    const app = await NestFactory.create(AppModule);

    app.enableCors({
      origin: '*',
    });

    await app.init();

    const expressApp = app.getHttpAdapter().getInstance();
    cachedServer = serverless(expressApp);
  }

  return cachedServer;
}

export default async function handler(req: any, res: any) {
  const server = await bootstrap();
  return server(req, res);
}