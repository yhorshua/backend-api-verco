import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module'; // 👈 AÑADE ESTO
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

// Leer todas las entidades dinámicamente de la carpeta `src/database/entities`
const entitiesPath = path.join(__dirname, 'database', 'entities', '**', '*.entity.ts');

let entities: Function[] = [];

glob.sync(entitiesPath).forEach((file) => {
  const entity = require(file).default;  // Cargar la entidad
  entities.push(entity);
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'mssql',
      host: process.env.DB_HOST || 'server-system-verco.database.windows.net',
      username: process.env.DB_USER || 'server-verco',
      password: process.env.DB_PASS || 'Ventas@123',
      database: process.env.DB_NAME || 'bd_verco',
      synchronize: true,
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
      retryAttempts: 10,
      retryDelay: 5000,
      connectionTimeout: 30000,
    }),  // Elimina la coma extra aquí

    ProductsModule,
    DatabaseModule,
    UsersModule, // 👈 AGREGA AQUÍ
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
