import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { MetaWebhookController } from './meta.controller';
import { MetaWebhookService } from './meta.service';

// Cambia estas rutas por las de tu proyecto.
import { Asesor } from 'src/database/entities/asesor.entity';
import { Lead } from 'src/database/entities/lead.entity';
import { NotificacionGateway } from 'src/meta/notificacion.gateway';
import { Mensaje } from 'src/database/entities/mensaje.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asesor,
      Lead,
      Mensaje,
    ]),

    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
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