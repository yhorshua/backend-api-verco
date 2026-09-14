import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { QueryWhatsAppLeadsDto } from './dto/query-whatsapp-leads.dto';
import { QueryWhatsAppMessagesDto } from './dto/query-whatsapp-messages.dto';
import { SendWhatsAppMessageDto } from './dto/SendWhatsAppMessageDto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { CrmUser, WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Jefe Ventas', 'Vendedor Web')
export class WhatsAppController {
  constructor(private readonly service: WhatsAppService) {}

  @Get('leads')
  listarLeads(
    @Query() query: QueryWhatsAppLeadsDto,
    @Req() request: { user: CrmUser },
  ) {
    return this.service.listarLeads(query, request.user);
  }

  @Get('leads/:leadId/messages')
  listarMensajes(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Query() query: QueryWhatsAppMessagesDto,
    @Req() request: { user: CrmUser },
  ) {
    return this.service.listarMensajes(leadId, query, request.user);
  }

  @Get('leads/:leadId/history')
  listarHistorial(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Query() query: QueryWhatsAppMessagesDto,
    @Req() request: { user: CrmUser },
  ) {
    return this.service.listarHistorial(leadId, query, request.user);
  }

  @Patch('leads/:leadId/read')
  marcarComoLeido(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Req() request: { user: CrmUser },
  ) {
    return this.service.marcarComoLeido(leadId, request.user);
  }

  @Patch('leads/:leadId/status')
  actualizarEstado(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: UpdateLeadStatusDto,
    @Req() request: { user: CrmUser },
  ) {
    return this.service.actualizarEstado(leadId, dto, request.user);
  }

  @Post('send')
  enviarMensaje(
    @Body() dto: SendWhatsAppMessageDto,
    @Req() request: { user: CrmUser },
  ) {
    return this.service.enviarMensaje(dto.leadId, dto.mensaje, request.user);
  }
}
