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
import { DashboardCountersService } from './dashCounter.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@WebSocketGateway({
    cors: {
        origin: [
            'http://localhost:3000',
            'https://verco.store',
            'https://www.verco.store',
            'https://verco.online',
            'https://www.verco.online',
            'https://verco-system-xdke.vercel.app',
        ],
        credentials: true,
    },
})
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly salesManagerRoom = 'role:jefe-ventas';

    constructor(
        private readonly countersService: DashboardCountersService,
        private readonly jwtService: JwtService,
        private readonly usersService: UsersService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            const rawToken = String(client.handshake.auth?.token || '');
            const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
            if (!token) throw new Error('Token ausente');
            const payload = await this.jwtService.verifyAsync(token);
            const user = await this.usersService.findOne(Number(payload.sub));
            const roleName = user?.role?.name_role;
            if (!user || !user.state_user || !this.canUseOrderNotifications(roleName)) {
                throw new Error('Usuario no autorizado');
            }
            client.data.userId = user.id;
            client.data.roleName = roleName;
            await client.join(`user:${user.id}`);
            if (this.isSalesManager(roleName)) {
                await client.join(this.salesManagerRoom);
                await this.emitCountersToSalesManager();
            }
        } catch {
            client.emit('dashboard:error', { message: 'Sesión no autorizada' });
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        console.log(`Cliente desconectado: ${client.id}`);
    }

    @SubscribeMessage('dashboard:join')
    handleJoinDashboard(
        @ConnectedSocket() client: Socket,
        @MessageBody() _body: unknown,
    ) {
        const roleName = client.data?.roleName;

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

    async emitCountersToSalesManager() {
        const counters = await this.countersService.getSalesManagerCounters();

        this.server
            .to(this.salesManagerRoom)
            .emit('dashboard:counters', counters);
    }
    emitWebSaleToSalesManager(data: any) {
        this.server
            .to(this.salesManagerRoom)
            .emit('websale:new', data);
            this.emitCountersToSalesManager();
    }

    emitOrderToSalesManager(data: any) {
        this.server
            .to(this.salesManagerRoom)
            .emit('order:new', data);
        void this.emitCountersToSalesManager();
    }

    emitOrderUpdateToSalesManager(data: any) {
        let target = this.server.to(this.salesManagerRoom);
        if (data.sellerId) target = target.to(`user:${data.sellerId}`);
        target
            .emit('order:updated', data);
        void this.emitCountersToSalesManager();
    }

    private isSalesManager(roleName?: string): boolean {
        return roleName === 'Jefe Ventas' || roleName === 'Administrador';
    }

    private canUseOrderNotifications(roleName?: string): boolean {
        return this.isSalesManager(roleName) || roleName === 'Vendedor' || roleName === 'Vendedor Web';
    }

}
