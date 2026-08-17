import {
  Injectable,
  InternalServerErrorException,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';

import { HttpModule, HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../database/entities/lead.entity';
import { Mensaje } from 'src/database/entities/mensaje.entity';

@Injectable()
export class WhatsAppService {


  constructor(
    private readonly httpService: HttpService,

    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,

    @InjectRepository(Mensaje)
    private readonly mensajeRepo: Repository<Mensaje>,
  ) { }

  async enviarMensaje(
    leadId: number,
    mensaje: string
  ) {

    const leadEncontrado =
      await this.leadRepo.findOne({
        where: {
          id: leadId
        }
      });


    if (!leadEncontrado) {
      throw new InternalServerErrorException(
        'Lead no encontrado'
      );
    }


    const lead = leadEncontrado;

    const token =
      process.env.META_WHATSAPP_ACCESS_TOKEN;

    const version =
      process.env.META_GRAPH_API_VERSION;
    const phoneNumberId =
      process.env.META_PHONE_NUMBER_ID;

    if (
      !token ||
      !version ||
      !phoneNumberId
    ) {

      throw new InternalServerErrorException(
        'Configuración Meta incompleta'
      );

    }
    const url =
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
    try {


      const response =
        await firstValueFrom(

          this.httpService.post(

            url,

            {
              messaging_product: 'whatsapp',

              recipient_type: 'individual',

              to: lead.telefono,

              type: 'text',

              text: {
                body: mensaje
              }
            },

            {
              headers: {

                Authorization:
                  `Bearer ${token}`,
                'Content-Type':
                  'application/json'

              }

            }

          )

        );

      const mensajeGuardado =
        this.mensajeRepo.create({

          lead_id: lead.id,

          direccion: 'SALIENTE',

          tipo: 'text',

          contenido: mensaje,

          meta_message_id:
            response.data.messages[0].id

        });


      await this.mensajeRepo.save(
        mensajeGuardado
      );
      return response.data;


    }
    catch (error: any) {


      console.log(
        error.response?.data
      );
      throw new ServiceUnavailableException(
        'Error enviando mensaje WhatsApp'
      );

    }
  }
}