import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly salesManagerRoom = 'role:jefe-ventas';

  handleConnection(client: Socket) {
    const roleName = client.handshake.auth?.roleName;

    if (this.isSalesManager(roleName)) {
      client.join(this.salesManagerRoom);
      console.log(`Jefe de ventas conectado: ${client.id}`);
    } else {
      console.log(`Cliente conectado: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('dashboard:join')
  handleJoinDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const roleName = body?.roleName;

    if (!this.isSalesManager(roleName)) {
      return {
        ok: false,
        message: 'No autorizado para recibir notificaciones del dashboard',
      };
    }

    client.join(this.salesManagerRoom);

    return {
      ok: true,
      room: this.salesManagerRoom,
    };
  }

  emitCountersToSalesManager(data: any) {
    this.server
      .to(this.salesManagerRoom)
      .emit('dashboard:counters', data);
  }

  emitWebSaleToSalesManager(data: any) {
    this.server
      .to(this.salesManagerRoom)
      .emit('websale:new', data);
  }

  emitOrderToSalesManager(data: any) {
    this.server
      .to(this.salesManagerRoom)
      .emit('order:new', data);
  }

  private isSalesManager(roleName: string): boolean {
    return roleName === 'Jefe Ventas' || roleName === 'Administrador';
  }
}