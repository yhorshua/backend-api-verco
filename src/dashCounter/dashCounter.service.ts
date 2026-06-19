import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WebSale, WebSaleStatus } from '../database/entities/webSale.entity';
import { Order } from '../database/entities/orders.entity';
import { OrderStatusEnum } from '../orders/dto/orderStatusEnum';

@Injectable()
export class DashboardCountersService {
  constructor(
    @InjectRepository(WebSale)
    private readonly webSaleRepo: Repository<WebSale>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async getSalesManagerCounters() {
    const webSalesNew = await this.webSaleRepo.count({
      where: {
        status: WebSaleStatus.PENDING,
      } as any,
    });

    const ordersNew = await this.orderRepo.count({
      where: {
        order_status_id: OrderStatusEnum.PENDIENTE,
      } as any,
    });

    return {
      webSalesNew,
      ordersNew,
      totalNew: webSalesNew + ordersNew,
    };
  }

  async getNewCounters(user: any) {
    const roleName = user?.role?.name_role || user?.role;

    if (roleName === 'Jefe Ventas' || roleName === 'Administrador') {
      return this.getSalesManagerCounters();
    }

    return {
      webSalesNew: 0,
      ordersNew: 0,
      totalNew: 0,
    };
  }
}