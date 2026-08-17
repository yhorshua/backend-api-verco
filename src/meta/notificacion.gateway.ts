import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';


@WebSocketGateway({
    cors:{
        origin:'*'
    }
})
export class NotificacionGateway 
implements OnGatewayConnection, OnGatewayDisconnect {


    @WebSocketServer()
    server!: Server;



    handleConnection(socket: Socket) {

        console.log(
            `Cliente conectado: ${socket.id}`
        );

    }



    handleDisconnect(socket: Socket) {

        console.log(
            `Cliente desconectado: ${socket.id}`
        );

    }



    @SubscribeMessage('registrar_asesor')
    registrarAsesor(
        @MessageBody() data:any,
        @ConnectedSocket() socket:Socket
    )
    {


        const asesorId =
            data.asesorId;


        socket.join(
            `asesor_${asesorId}`
        );


        socket.emit(
            'conexion_exitosa',
            {
                mensaje:
                'Asesor conectado correctamente',

                asesorId
            }
        );


    }




    notificarNuevoMensaje(
        asesorId:number,
        data:any
    )
    {

        this.server
        .to(
            `asesor_${asesorId}`
        )
        .emit(
            'nuevo_mensaje',
            data
        );

    }
}