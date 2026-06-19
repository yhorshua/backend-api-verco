import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { DashboardGateway } from './dashboard.gateway';
import { DashboardCountersService } from './dashCounter.service';
import { DASHBOARD_EVENTS } from './dto/dashboard-events.constants';

@Injectable()
export class DashboardEventsListener {
  constructor(
    private readonly gateway: DashboardGateway,
    private readonly countersService: DashboardCountersService,
  ) {}

  // 🔥 NUEVA VENTA WEB
  @OnEvent(DASHBOARD_EVENTS.WEBSALE_CREATED)
  async handleWebSaleCreated(payload: any) {
    const counters = await this.countersService.getSalesManagerCounters();

    this.gateway.emitWebSaleToSalesManager({
      message: 'Nueva venta registrada',
      ticket: payload.ticket,
      customerName: payload.customerName,
    });

    this.gateway.emitCountersToSalesManager(counters);
  }

  // 🔥 NUEVO PEDIDO
  @OnEvent(DASHBOARD_EVENTS.ORDER_CREATED)
  async handleOrderCreated(payload: any) {
    const counters = await this.countersService.getSalesManagerCounters();

    this.gateway.emitOrderToSalesManager({
      message: 'Nuevo pedido registrado',
      proforma: payload.proforma,
      customerName: payload.customerName,
    });

    this.gateway.emitCountersToSalesManager(counters);
  }
}