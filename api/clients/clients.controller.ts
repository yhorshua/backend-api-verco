import { Controller, Post, Body, UseGuards, Request, UsePipes, ValidationPipe, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) { }

  @Get('mine')
  async mine(@Request() req) {
    return this.clientsService.findForUser(req.user.userId, req.user.role);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() dto: CreateClientDto, @Request() req) {
    const sellerId = req.user.userId; // ✅ viene de JwtStrategy validate()
    return this.clientsService.createOrClaim(dto, sellerId);
  }
}
