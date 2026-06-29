import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WhatsappService {

  private readonly logger = new Logger(WhatsappService.name);

  private readonly token = process.env.WHATSAPP_TOKEN;

  private readonly phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID;


  async sendMessage(to: string, message: string) {

    try {

      await axios.post(

        `https://graph.facebook.com/v23.0/${this.phoneNumberId}/messages`,

        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: {
            body: message,
          },
        },

        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

    } catch (e: any) {

      this.logger.error(e.response?.data || e.message);

    }
  }
}