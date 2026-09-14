import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';

import { Asesor } from '../database/entities/asesor.entity';
import { User } from '../database/entities/user.entity';

const CRM_ORIGINS = [
  'http://localhost:3000',
  'https://verco.store',
  'https://www.verco.store',
  'https://verco.online',
  'https://www.verco.online',
  'https://verco-system-xdke.vercel.app',
];

@WebSocketGateway({
  cors: { origin: CRM_ORIGINS, credentials: true },
})
export class NotificacionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificacionGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Asesor)
    private readonly advisorRepository: Repository<Asesor>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const authorization = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authorization?.startsWith('Bearer ')
          ? authorization.slice('Bearer '.length)
          : null);
      if (!token) throw new Error('Token ausente');

      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        role: string;
      }>(token);

      const user = await this.userRepository.findOne({
        where: { id: payload.sub, state_user: true },
        relations: { role: true },
      });
      if (!user?.role) throw new Error('Usuario inactivo o inexistente');
      const currentRole = user.role.name_role;

      if (currentRole === 'Administrador' || currentRole === 'Jefe Ventas') {
        await socket.join('crm_managers');
        socket.data.crmUser = { userId: user.id, role: currentRole };
        return;
      }

      if (currentRole !== 'Vendedor Web') {
        throw new Error('Rol sin acceso al CRM');
      }

      const advisor = await this.advisorRepository.findOne({
        where: { user_id: payload.sub, activo: true },
      });
      if (!advisor) throw new Error('Asesor no configurado');

      await socket.join(`asesor_${advisor.id}`);
      socket.data.crmUser = {
        userId: user.id,
        role: currentRole,
        advisorId: advisor.id,
      };
    } catch {
      this.logger.warn('Conexión CRM rechazada por autenticación o alcance');
      socket.disconnect(true);
    }
  }

  handleDisconnect(_socket: Socket) {
    // Socket.IO elimina automáticamente sus salas al desconectarse.
  }

  notificarNuevoMensaje(advisorId: number, data: unknown) {
    this.server
      .to(`asesor_${advisorId}`)
      .to('crm_managers')
      .emit('nuevo_mensaje', data);
  }

  notificarEstadoMensaje(advisorId: number, data: unknown) {
    this.server
      .to(`asesor_${advisorId}`)
      .to('crm_managers')
      .emit('estado_mensaje', data);
  }
}
