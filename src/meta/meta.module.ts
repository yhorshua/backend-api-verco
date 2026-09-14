import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MetaWebhookController } from './meta.controller';
import { MetaWebhookService } from './meta.service';

// Cambia estas rutas por las de tu proyecto.
import { Asesor } from 'src/database/entities/asesor.entity';
import { Lead } from 'src/database/entities/lead.entity';
import { NotificacionGateway } from 'src/meta/notificacion.gateway';
import { Mensaje } from 'src/database/entities/mensaje.entity';
import { User } from 'src/database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asesor,
      Lead,
      Mensaje,
      User,
    ]),

    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [MetaWebhookController],
  providers: [
    MetaWebhookService,
    NotificacionGateway
  ],
  exports: [MetaWebhookService],
})
export class MetaWebhookModule { }
