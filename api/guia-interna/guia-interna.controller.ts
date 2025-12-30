import { Body, Controller, Post } from '@nestjs/common';
import { GuiaInternaService } from './guia-interna.service';
import { CreateGuiaInternaDto } from './dto/create-guia-interna.dto';

@Controller('guia-interna')
export class GuiaInternaController {
  constructor(private readonly service: GuiaInternaService) {}

  @Post('from-order')
  createFromOrder(@Body() dto: CreateGuiaInternaDto) {
    return this.service.createFromOrder(dto);
  }
}
