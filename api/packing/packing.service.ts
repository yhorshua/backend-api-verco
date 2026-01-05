import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { ScanItemDto } from './dto/scan-item.dto';
import { Escaneo } from '../database/entities/escaneo.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Product } from '../database/entities/product.entity';

@Injectable()
export class PackingService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Escaneo)
    private readonly escaneoRepo: Repository<Escaneo>,

    @InjectRepository(OrderDetail)
    private readonly orderDetailRepo: Repository<OrderDetail>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async getPacking(orderId: number) {
    const scans = await this.escaneoRepo.find({
      where: { id_pedido: orderId } as any,
      order: { fecha_escaner: 'ASC' } as any,
    });

    const grouped = new Map<string, { codigo_producto: string; talla: string; cantidad: number }>();
    for (const s of scans as any[]) {
      const key = `${s.codigo_producto}|${s.talla}`;
      if (!grouped.has(key)) {
        grouped.set(key, { codigo_producto: s.codigo_producto, talla: s.talla, cantidad: 0 });
      }
      grouped.get(key)!.cantidad += Number(s.cantidad);
    }

    return { scans, grouped: Array.from(grouped.values()) };
  }

  async scanItem(dto: ScanItemDto) {
    if (!dto.order_id) throw new BadRequestException('order_id es requerido');
    if (!dto.codigo_producto?.trim()) throw new BadRequestException('codigo_producto es requerido');
    if (!dto.talla?.trim()) throw new BadRequestException('talla es requerido');
    if (!Number.isFinite(dto.cantidad) || dto.cantidad <= 0) {
      throw new BadRequestException('cantidad debe ser > 0');
    }

    return this.dataSource.transaction(async (manager) => {
      const escaneoRepo = manager.getRepository(Escaneo);
      const orderDetailRepo = manager.getRepository(OrderDetail);
      const productRepo = manager.getRepository(Product);

      // 1) validar contra Order_Details
      const details = await orderDetailRepo.find({ where: { order_id: dto.order_id } as any });
      if (!details.length) throw new BadRequestException('Pedido sin detalles');

      // 2) convertir codigo_producto -> product_id (sin traer toda la tabla)
      const product = await productRepo.findOne({
        where: { article_code: dto.codigo_producto } as any,
        select: ['id', 'article_code'] as any,
      });
      if (!product) throw new BadRequestException(`Código no existe: ${dto.codigo_producto}`);

      const line = (details as any[]).find(
        (d) => d.product_id === product.id && String(d.size) === String(dto.talla),
      );
      if (!line) {
        throw new BadRequestException(
          `El producto/talla no está en el pedido: ${dto.codigo_producto} ${dto.talla}`,
        );
      }

      // 3) sumar escaneado actual (solo de ese producto/talla)
      const scannedAgg = await escaneoRepo
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.cantidad), 0)', 'qty')
        .where('e.id_pedido = :orderId', { orderId: dto.order_id })
        .andWhere('e.codigo_producto = :code', { code: dto.codigo_producto })
        .andWhere('e.talla = :talla', { talla: dto.talla })
        .getRawOne<{ qty: string | number }>();

      const scannedQty = Number(scannedAgg?.qty ?? 0);
      const orderedQty = Number((line as any).quantity);

      if (scannedQty + Number(dto.cantidad) > orderedQty) {
        throw new BadRequestException(
          `Excede lo pedido. Pedido=${orderedQty} Escaneado=${scannedQty}`,
        );
      }

      // 4) guardar escaneo
      const esc = escaneoRepo.create({
        id_pedido: dto.order_id,
        codigo_producto: dto.codigo_producto,
        talla: dto.talla,
        cantidad: dto.cantidad,
      } as any);

      await escaneoRepo.save(esc);

      return { ok: true };
    });
  }

  async closePacking(orderId: number, userId: number) {
    if (!orderId) throw new BadRequestException('orderId es requerido');

    // 1) traer detalles del pedido
    const details = await this.orderDetailRepo.find({ where: { order_id: orderId } as any });
    if (!details.length) throw new BadRequestException('Pedido sin detalles');

    // 2) traer escaneos del pedido
    const scans = await this.escaneoRepo.find({ where: { id_pedido: orderId } as any });

    // 3) map product_id -> article_code solo para los ids del pedido
    const productIds = Array.from(new Set((details as any[]).map((d) => d.product_id)));
    const products = await this.productRepo.find({
      where: { id: (productIds as any) } as any,
      select: ['id', 'article_code'] as any,
    } as any);
    const codeById = new Map(products.map((p: any) => [p.id, p.article_code]));

    // 4) scan map code|size -> qty
    const scanMap = new Map<string, number>();
    for (const s of scans as any[]) {
      const key = `${s.codigo_producto}|${s.talla}`;
      scanMap.set(key, (scanMap.get(key) ?? 0) + Number(s.cantidad));
    }

    for (const d of details as any[]) {
      const code = codeById.get(d.product_id);
      const key = `${code}|${d.size}`;
      const scanned = scanMap.get(key) ?? 0;
      const ordered = Number(d.quantity);

      if (scanned !== ordered) {
        throw new BadRequestException(
          `Packing incompleto: ${code} ${d.size}. Pedido=${ordered} Escaneado=${scanned}`,
        );
      }
    }

    // ✅ aquí normalmente actualizas estado del pedido a PACKED y guardas historial
    // (lo hacemos después cuando tengas OrderStatus claro)

    return { ok: true, message: 'Packing cerrado y completo' };
  }

  async getScanStatus(orderId: number) {
  const orderDetails = await this.orderDetailRepo.find({ where: { order_id: orderId } });

  // Si no existen detalles en el pedido, se lanza una excepción
  if (!orderDetails.length) {
    throw new BadRequestException('Pedido sin detalles');
  }

  // Mapeamos los escaneos registrados
  const escaneos = await this.escaneoRepo.find({ where: { id_pedido: orderId } });

  const scanMap = new Map<string, number>();
  escaneos.forEach((escaneo) => {
    const key = `${escaneo.codigo_producto}|${escaneo.talla}`;
    // Asegúrate de sumar la cantidad escaneada correctamente
    scanMap.set(key, (scanMap.get(key) || 0) + escaneo.cantidad);
  });

  // Comprobamos la cantidad escaneada y la cantidad solicitada para cada talla del pedido
  const status = orderDetails.map((detail) => {
    const key = `${detail.product_id}|${detail.size}`;
    const escaneado = scanMap.get(key) || 0; // Total de lo escaneado
    const solicitado = detail.quantity; // Cantidad solicitada en el pedido

    return {
      codigo: detail.product_id,
      talla: detail.size,
      escaneado,  // La cantidad escaneada de ese producto/talla
      solicitado, // La cantidad solicitada de ese producto/talla
      completo: escaneado >= solicitado, // Estado de si está completo o no
    };
  });

  return status;
}

}

 
