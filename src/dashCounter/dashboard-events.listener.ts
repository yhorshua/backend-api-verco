import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { DashboardGateway } from './dashboard.gateway';
import { DASHBOARD_EVENTS } from './dto/dashboard-events.constants';

@Injectable()
export class DashboardEventsListener {
  constructor(
    private readonly gateway: DashboardGateway,
  ) {}

  // 🔥 NUEVA VENTA WEB
  @OnEvent(DASHBOARD_EVENTS.WEBSALE_CREATED)
  async handleWebSaleCreated(payload: any) {
    this.gateway.emitWebSaleToSalesManager({
      message: 'Nueva venta registrada',
      ticket: payload.ticket,
      customerName: payload.customerName,
    });
  }

  // 🔥 NUEVO PEDIDO
  @OnEvent(DASHBOARD_EVENTS.ORDER_CREATED)
  async handleOrderCreated(payload: any) {
    this.gateway.emitOrderToSalesManager({
      message: 'Nuevo pedido registrado',
      proforma: payload.proforma,
      customerName: payload.customerName,
    });

  }

  @OnEvent(DASHBOARD_EVENTS.ORDER_UPDATED)
  handleOrderUpdated(payload: any) {
    this.gateway.emitOrderUpdateToSalesManager({
      message: payload.message,
      proforma: payload.proforma,
      status: payload.status,
      sellerId: payload.sellerId,
    });
  }
}
