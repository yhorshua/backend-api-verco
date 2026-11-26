import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  EcommerceOrder,
  EcommerceOrderStatus,
} from '../database/entities/ecommerce-order.entity';
import { EcommerceOrderDetail } from '../database/entities/ecommerce-order-detail.entity';
import { Storefront } from '../database/entities/storefront.entity';
import { CreateEcommerceOrderDto } from './dto/create-ecommerce-order.dto';
import { StorefrontCacheService } from './storefront-cache.service';
import { Product } from '../database/entities/product.entity';
import { ProductImage } from '../database/entities/productImage.entity';
import {
  CreateProductImageDto,
  RegisterProductImagesDto,
  UpdateEcommerceProductDto,
} from './dto/catalog-admin.dto';
import { CatalogAdminQueryDto } from './dto/catalog-admin-query.dto';
import { CreateSoominProductDto } from './dto/create-soomin-product.dto';
import { ProductSize } from '../database/entities/product-size.entity';
import { Stock } from '../database/entities/stock.entity';
import { Category } from '../database/entities/categories.entity';
import { Series } from '../database/entities/series.entity';
import { EcommerceClaim } from '../database/entities/ecommerce-claim.entity';
import { CreateEcommerceClaimDto } from './dto/create-ecommerce-claim.dto';
import { RespondEcommerceClaimDto } from './dto/respond-ecommerce-claim.dto';
import { UpdateEcommerceOrderStatusDto } from './dto/update-ecommerce-order-status.dto';
import { StorefrontEmailService } from './storefront-email.service';

type CatalogRow = {
  product_id: number;
  article_code: string;
  category_id: number;
  category_name: string;
  article_series: string;
  product_type_id: number | null;
  product_type_name: string | null;
  product_type_slug: string | null;
  garment_position: string | null;
  group_code: string | null;
  color_code: string | null;
  color_name: string | null;
  name: string;
  description: string | null;
  price: string;
  original_price: string | null;
  shipping_cost: string;
  discount_percent: number;
  is_new: number | Buffer;
  is_featured: number | Buffer;
  image_id: number | null;
  image_url: string | null;
  image_alt: string | null;
  image_primary: number | Buffer | null;
  image_order: number | null;
  size_id: number;
  size: string;
  stock: string;
};

type LockedStockRow = {
  stock_id: number;
  quantity: string;
  product_id: number;
  product_size_id: number;
  size: string;
  article_code: string;
  product_name: string;
  color_name: string | null;
  price: string;
  shipping_cost: string;
  image_url: string | null;
};

type CatalogImage = {
  id: number | string;
  url: string;
  alt: string;
  is_primary: boolean;
  sort_order: number | null;
};

type CatalogSize = { id: number; size: string; stock: number };

type CatalogVariant = {
  id: number;
  article_code: string;
  color_code: string;
  color_name: string;
  price: string;
  original_price: string | null;
  shipping_cost: string;
  discount_percent: number;
  images: CatalogImage[];
  sizes: CatalogSize[];
};

type CatalogGroup = {
  group_code: string;
  name: string;
  description: string | null;
  category_id: number;
  category_name: string;
  article_series: string;
  product_type_id: number | null;
  product_type_name: string | null;
  product_type_slug: string | null;
  garment_position: string | null;
  is_new: boolean;
  is_featured: boolean;
  variants: CatalogVariant[];
};

export function deriveVariantCodes(articleCode: string): {
  groupCode: string;
  colorCode: string;
} {
  const normalized = articleCode.trim().toUpperCase();
  const match = normalized.match(/^(.+?)([A-Z]{2})$/);
  return match
    ? { groupCode: match[1], colorCode: match[2] }
    : { groupCode: normalized, colorCode: normalized };
}

function bitToBoolean(value: number | Buffer | null): boolean {
  if (Buffer.isBuffer(value)) return value.length > 0 && value[0] === 1;
  return Number(value ?? 0) === 1;
}

const BUNDLE_DISCOUNT_PERCENT = 5;
const TOP_PRODUCT_WORDS = [
  'POLO',
  'BLUSA',
  'CAMISA',
  'POLERA',
  'CHOMPA',
  'CASACA',
  'TOP',
];
const BOTTOM_PRODUCT_WORDS = ['SHORT', 'JEAN', 'PANTALON', 'FALDA', 'LEGGING'];

function normalizeProductText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function bundleProductKind(
  productName: string,
): 'TOP' | 'BOTTOM' | 'OTHER' {
  const normalized = normalizeProductText(productName);
  if (TOP_PRODUCT_WORDS.some((word) => normalized.includes(word))) return 'TOP';
  if (BOTTOM_PRODUCT_WORDS.some((word) => normalized.includes(word)))
    return 'BOTTOM';
  return 'OTHER';
}

export function calculateBundleDiscountCents(
  subtotalCents: number,
  productNames: string[],
): number {
  const kinds = new Set(productNames.map(bundleProductKind));
  return kinds.has('TOP') && kinds.has('BOTTOM')
    ? Math.round((subtotalCents * BUNDLE_DISCOUNT_PERCENT) / 100)
    : 0;
}

export function moneyToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new BadRequestException('Precio inválido en el catálogo');
  const [whole, decimals = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents))
    throw new BadRequestException('Precio fuera de rango');
  return cents;
}

export function centsToMoney(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

@Injectable()
export class StorefrontService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Storefront)
    private readonly storefrontRepository: Repository<Storefront>,
    @InjectRepository(EcommerceOrder)
    private readonly orderRepository: Repository<EcommerceOrder>,
    private readonly cache: StorefrontCacheService,
    private readonly email: StorefrontEmailService,
  ) {}

  private async findActiveStorefront(
    slug: string,
    manager?: EntityManager,
  ): Promise<Storefront> {
    const repository =
      manager?.getRepository(Storefront) ?? this.storefrontRepository;
    const store = await repository.findOne({
      where: { slug, status: true },
      relations: { warehouse: true },
    });
    if (!store || !store.warehouse?.status)
      throw new NotFoundException('Tienda no disponible');
    return store;
  }

  async getCatalog(slug: string) {
    const store = await this.findActiveStorefront(slug);
    const cacheKey = `storefront:catalog:schema2:${store.id}:v${store.cache_version}`;
    const cached = await this.cache.getJson<unknown>(cacheKey);
    if (cached) return cached;

    const rows = await this.dataSource.query<CatalogRow[]>(
      `SELECT p.id AS product_id, p.article_code,
              c.id AS category_id, c.name AS category_name, p.article_series,
              ept.id AS product_type_id, ept.name AS product_type_name,
              ept.slug AS product_type_slug, ept.garment_position,
              p.ecommerce_group_code AS group_code, p.color_code,
              p.color AS color_name,
              COALESCE(NULLIF(p.ecommerce_name, ''), p.article_description) AS name,
              COALESCE(p.short_description, p.full_description) AS description,
              CAST(p.selling_price AS CHAR) AS price,
              CAST(p.original_price AS CHAR) AS original_price,
              CAST(p.shipping_cost AS CHAR) AS shipping_cost,
              p.discount_percent, p.is_new, p.is_featured,
              pi.id AS image_id, COALESCE(pi.image_url, p.product_image) AS image_url,
              pi.alt_text AS image_alt,
              pi.is_primary AS image_primary, pi.sort_order AS image_order,
              ps.id AS size_id, ps.size, CAST(s.quantity AS CHAR) AS stock
       FROM Products p
       INNER JOIN Categories c ON c.id = p.category_id
       LEFT JOIN EcommerceProductTypes ept ON ept.id = p.ecommerce_product_type_id
          AND ept.storefront_id = ? AND ept.status = b'1'
       INNER JOIN ProductSize ps ON ps.product_id = p.id
       INNER JOIN Stock s ON s.product_id = p.id
          AND s.product_size_id = ps.id AND s.warehouse_id = ? AND s.quantity > 0
       LEFT JOIN ProductImages pi ON pi.product_id = p.id AND pi.status = b'1'
       WHERE p.status = b'1' AND p.is_published = b'1'
         AND p.selling_price > 0
       ORDER BY p.article_code, pi.is_primary DESC, pi.sort_order,
                CASE WHEN ps.size REGEXP '^[0-9]+([.][0-9]+)?$' THEN 0 ELSE 1 END,
                CAST(ps.size AS DECIMAL(10,2)), ps.size`,
      [store.id, store.warehouse_id],
    );

    const groups = new Map<string, CatalogGroup>();
    for (const row of rows) {
      const derived = deriveVariantCodes(row.article_code);
      const groupCode = row.group_code?.trim() || derived.groupCode;
      const colorCode = row.color_code?.trim() || derived.colorCode;
      let group = groups.get(groupCode);
      if (!group) {
        group = {
          group_code: groupCode,
          name: row.name,
          description: row.description,
          category_id: row.category_id,
          category_name: row.category_name,
          article_series: row.article_series,
          product_type_id: row.product_type_id,
          product_type_name: row.product_type_name,
          product_type_slug: row.product_type_slug,
          garment_position: row.garment_position,
          is_new: bitToBoolean(row.is_new),
          is_featured: bitToBoolean(row.is_featured),
          variants: [],
        };
        groups.set(groupCode, group);
      }
      let variant = group.variants.find((item) => item.id === row.product_id);
      if (!variant) {
        variant = {
          id: row.product_id,
          article_code: row.article_code,
          color_code: colorCode,
          color_name: row.color_name?.trim() || colorCode,
          price: row.price,
          original_price: row.original_price,
          shipping_cost: row.shipping_cost,
          discount_percent: row.discount_percent,
          images: [],
          sizes: [],
        };
        group.variants.push(variant);
      }
      if (
        row.image_url &&
        !variant.images.some((item) => item.url === row.image_url)
      ) {
        variant.images.push({
          id: row.image_id ?? `legacy-${row.product_id}`,
          url: row.image_url,
          alt: row.image_alt || `${row.name} ${variant.color_name}`,
          is_primary: bitToBoolean(row.image_primary),
          sort_order: row.image_order,
        });
      }
      if (!variant.sizes.some((item) => item.id === row.size_id)) {
        variant.sizes.push({
          id: row.size_id,
          size: row.size,
          stock: Number(row.stock),
        });
      }
    }

    const response = {
      store: { slug: store.slug, name: store.name, currency: store.currency },
      products: [...groups.values()],
    };
    await this.cache.setJson(cacheKey, response, store.cache_ttl_seconds);
    return response;
  }

  async createOrder(
    slug: string,
    dto: CreateEcommerceOrderDto,
    customerId: number | null = null,
  ) {
    const isLimaProvince =
      dto.department.trim().toUpperCase() === 'LIMA' &&
      dto.province.trim().toUpperCase() === 'LIMA';
    if (!isLimaProvince && dto.delivery_type !== 'AGENCIA_SHALOM')
      throw new BadRequestException(
        'Los pedidos fuera de Lima deben enviarse por agencia Shalom',
      );
    if (
      dto.delivery_type === 'AGENCIA_SHALOM' &&
      !dto.shalom_agency_name?.trim()
    )
      throw new BadRequestException(
        'Ingresa el nombre de la agencia Shalom de destino',
      );
    const existing = await this.orderRepository.findOne({
      where: { idempotency_key: dto.idempotency_key },
      relations: { details: true, storefront: true },
    });
    if (existing) {
      if (existing.storefront.slug !== slug)
        throw new ConflictException('Clave de operación ya utilizada');
      return this.orderResponse(existing, true);
    }

    try {
      const order = await this.dataSource.transaction(async (manager) => {
        const store = await this.findActiveStorefront(slug, manager);
        const duplicate = await manager.getRepository(EcommerceOrder).findOne({
          where: { idempotency_key: dto.idempotency_key },
          relations: { details: true, storefront: true },
        });
        if (duplicate) {
          if (duplicate.storefront_id !== store.id)
            throw new ConflictException('Clave de operación ya utilizada');
          return duplicate;
        }

        const consolidated = new Map<
          string,
          { product_id: number; product_size_id: number; quantity: number }
        >();
        for (const item of dto.items) {
          const key = `${item.product_id}:${item.product_size_id}`;
          const current = consolidated.get(key);
          consolidated.set(key, {
            ...item,
            quantity: (current?.quantity ?? 0) + item.quantity,
          });
        }

        const validated: Array<{
          row: LockedStockRow;
          quantity: number;
          unitCents: number;
        }> = [];
        let totalCents = 0;
        let shippingCents = 0;
        for (const item of consolidated.values()) {
          const rows = await manager.query<LockedStockRow[]>(
            `SELECT s.id AS stock_id, CAST(s.quantity AS CHAR) AS quantity,
                    p.id AS product_id, ps.id AS product_size_id, ps.size,
                    p.article_code,
                    COALESCE(NULLIF(p.ecommerce_name, ''), p.article_description) AS product_name,
                    p.color AS color_name,
                    CAST(p.selling_price AS CHAR) AS price,
                    CAST(p.shipping_cost AS CHAR) AS shipping_cost,
                    COALESCE((SELECT pi.image_url FROM ProductImages pi WHERE pi.product_id=p.id AND pi.status=b'1' ORDER BY pi.is_primary DESC,pi.sort_order,pi.id LIMIT 1),p.product_image) AS image_url
             FROM Stock s
             INNER JOIN Products p ON p.id = s.product_id
             INNER JOIN ProductSize ps ON ps.id = s.product_size_id AND ps.product_id = p.id
             WHERE s.warehouse_id = ? AND p.id = ? AND ps.id = ?
               AND p.status = b'1' AND p.is_published = b'1' AND p.selling_price > 0
             FOR UPDATE`,
            [store.warehouse_id, item.product_id, item.product_size_id],
          );
          const row = rows[0];
          if (!row)
            throw new BadRequestException(
              'Un producto o talla ya no está disponible',
            );
          if (Number(row.quantity) < item.quantity) {
            throw new ConflictException({
              message: `Stock insuficiente para ${row.article_code}, talla ${row.size}`,
              available_stock: Number(row.quantity),
              requested_quantity: item.quantity,
            });
          }
          const unitCents = moneyToCents(row.price);
          totalCents += unitCents * item.quantity;
          shippingCents = Math.max(
            shippingCents,
            moneyToCents(row.shipping_cost),
          );
          if (!Number.isSafeInteger(totalCents))
            throw new BadRequestException('Total fuera de rango');
          validated.push({ row, quantity: item.quantity, unitCents });
        }

        const discountCents = calculateBundleDiscountCents(
          totalCents,
          validated.map((item) => item.row.product_name),
        );
        const bundleDiscountPercent =
          discountCents > 0 ? BUNDLE_DISCOUNT_PERCENT : 0;

        const clean = (value: string | undefined) => value?.trim() || null;
        const orderRepository = manager.getRepository(EcommerceOrder);
        const saved = await orderRepository.save(
          orderRepository.create({
            idempotency_key: dto.idempotency_key,
            storefront_id: store.id,
            warehouse_id: store.warehouse_id,
            customer_id: customerId,
            customer_name: dto.customer_name.trim(),
            customer_document: dto.customer_document.trim(),
            customer_phone: dto.customer_phone.trim(),
            customer_address: dto.customer_address.trim(),
            department: dto.department.trim(),
            department_code: dto.department_code,
            province: dto.province.trim(),
            province_code: dto.province_code,
            district: dto.district.trim(),
            district_code: dto.district_code,
            reference: clean(dto.reference),
            delivery_type: dto.delivery_type,
            shalom_agency_id: clean(dto.shalom_agency_id),
            shalom_agency_name: clean(dto.shalom_agency_name),
            payment_method: dto.payment_method,
            payment_status: 'PENDIENTE',
            currency: store.currency,
            subtotal_amount: centsToMoney(totalCents),
            discount_amount: centsToMoney(discountCents),
            bundle_discount_percent: bundleDiscountPercent,
            total_amount: centsToMoney(
              totalCents - discountCents + shippingCents,
            ),
            shipping_amount: centsToMoney(shippingCents),
            observations: clean(dto.observations),
            stock_committed_at: new Date(),
          }),
        );
        saved.order_code = `EC-${new Date().getUTCFullYear()}-${String(saved.id).padStart(8, '0')}`;
        await orderRepository.save(saved);

        const detailsRepository = manager.getRepository(EcommerceOrderDetail);
        const details: EcommerceOrderDetail[] = [];
        for (const item of validated) {
          await manager.query(
            `UPDATE Stock SET quantity = quantity - ?, version = version + 1,
                    updated_at_utc = UTC_TIMESTAMP(3)
             WHERE id = ?`,
            [item.quantity, item.row.stock_id],
          );
          details.push(
            detailsRepository.create({
              order_id: saved.id,
              product_id: item.row.product_id,
              product_size_id: item.row.product_size_id,
              quantity: item.quantity,
              unit_price: centsToMoney(item.unitCents),
              subtotal: centsToMoney(item.unitCents * item.quantity),
              article_code_snapshot: item.row.article_code,
              product_name_snapshot: item.row.product_name,
              color_snapshot: item.row.color_name,
              size_snapshot: item.row.size,
              image_url_snapshot: item.row.image_url,
            }),
          );
        }
        saved.details = await detailsRepository.save(details);
        store.cache_version += 1;
        await manager.getRepository(Storefront).save(store);
        return saved;
      });
      return this.orderResponse(order, false);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        const duplicate = await this.orderRepository.findOne({
          where: { idempotency_key: dto.idempotency_key },
          relations: { details: true, storefront: true },
        });
        if (duplicate) {
          if (duplicate.storefront.slug !== slug)
            throw new ConflictException('Clave de operación ya utilizada');
          return this.orderResponse(duplicate, true);
        }
      }
      throw error;
    }
  }

  async createClaim(slug: string, dto: CreateEcommerceClaimDto) {
    const amountCents = moneyToCents(dto.amount);
    const claim = await this.dataSource.transaction(async (manager) => {
      const store = await this.findActiveStorefront(slug, manager);
      const repository = manager.getRepository(EcommerceClaim);
      const saved = await repository.save(
        repository.create({
          storefront_id: store.id,
          claim_type: dto.claim_type,
          consumer_name: dto.consumer_name.trim(),
          document_type: dto.document_type,
          document_number: dto.document_number.trim(),
          consumer_address: dto.consumer_address.trim(),
          consumer_phone: dto.consumer_phone.trim(),
          consumer_email: dto.consumer_email.trim().toLowerCase(),
          is_minor: dto.is_minor,
          representative_name: dto.is_minor
            ? dto.representative_name?.trim() || null
            : null,
          representative_document: dto.is_minor
            ? dto.representative_document?.trim() || null
            : null,
          item_type: dto.item_type,
          item_description: dto.item_description.trim(),
          amount: centsToMoney(amountCents),
          order_code: dto.order_code?.trim() || null,
          detail: dto.detail.trim(),
          consumer_request: dto.consumer_request.trim(),
          response_method: dto.response_method,
        }),
      );
      saved.claim_code = `LR-${new Date().getFullYear()}-${String(saved.id).padStart(6, '0')}`;
      return repository.save(saved);
    });
    const emailNotification = await this.email.sendClaimRegistered(claim);
    return {
      claim_code: claim.claim_code,
      status: claim.status,
      created_at: claim.created_at,
      response_due_business_days: 15,
      email_notification: emailNotification,
      copy: { ...claim, storefront: undefined },
    };
  }

  async listClaims(slug: string, page: number, limit: number) {
    const store = await this.findActiveStorefront(slug);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const [data, total] = await this.dataSource
      .getRepository(EcommerceClaim)
      .findAndCount({
        where: { storefront_id: store.id },
        order: { created_at: 'DESC' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      });
    return { data, total, page: safePage, limit: safeLimit };
  }

  async respondClaim(slug: string, id: number, dto: RespondEcommerceClaimDto) {
    const store = await this.findActiveStorefront(slug);
    const repository = this.dataSource.getRepository(EcommerceClaim);
    const claim = await repository.findOne({
      where: { id, storefront_id: store.id },
    });
    if (!claim)
      throw new NotFoundException('Hoja de reclamación no encontrada');
    claim.provider_actions = dto.provider_actions.trim();
    claim.provider_response = dto.provider_response.trim();
    claim.responded_at = new Date();
    claim.status = 'RESPONDIDO' as EcommerceClaim['status'];
    const saved = await repository.save(claim);
    const emailNotification = await this.email.sendClaimResponse(saved);
    return { ...saved, email_notification: emailNotification };
  }

  async updateCatalogProduct(
    productId: number,
    dto: UpdateEcommerceProductDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Product);
      const product = await repository.findOne({ where: { id: productId } });
      if (!product) throw new NotFoundException('Producto no encontrado');
      if (
        dto.selling_price !== undefined &&
        moneyToCents(dto.selling_price) <= 0
      ) {
        throw new BadRequestException(
          'El precio de venta debe ser mayor a cero',
        );
      }
      const { warehouse_id: warehouseId, ...productInput } = dto;
      const cleaned = Object.fromEntries(
        Object.entries(productInput).map(([key, value]) => [
          key,
          typeof value === 'string' ? value.trim() || null : value,
        ]),
      );
      repository.merge(product, cleaned as Partial<Product>);
      if (dto.is_published === true) {
        await this.validateProductForPublication(product, manager, warehouseId);
      }
      const saved = await repository.save(product);
      await manager.increment(Storefront, { status: true }, 'cache_version', 1);
      return saved;
    });
  }

  async searchCatalogAdminProducts(query: CatalogAdminQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const term = query.query?.trim() ?? '';
    const like = `%${term}%`;
    const searchFilter = term
      ? ' AND (p.article_code LIKE ? OR p.article_description LIKE ? OR p.ecommerce_name LIKE ?)'
      : '';
    const searchParams = term ? [like, like, like] : [];
    const rows = await this.dataSource.query<
      Array<{
        id: number;
        article_code: string;
        article_description: string;
        ecommerce_name: string | null;
        color: string | null;
        selling_price: string | null;
        is_published: number | Buffer;
        image_count: string;
        warehouse_stock: string;
      }>
    >(
      `SELECT p.id, p.article_code, p.article_description, p.ecommerce_name,
              p.color, CAST(p.selling_price AS CHAR) selling_price,
              CAST(p.original_price AS CHAR) original_price,
              CAST(p.shipping_cost AS CHAR) shipping_cost,
              p.discount_percent,
              p.is_published,
              (SELECT COUNT(*) FROM ProductImages pi
                WHERE pi.product_id = p.id AND pi.status = b'1') image_count,
              (SELECT CAST(COALESCE(SUM(s.quantity), 0) AS CHAR) FROM Stock s
                WHERE s.product_id = p.id AND s.warehouse_id = ?) warehouse_stock
       FROM Products p
       WHERE EXISTS (
         SELECT 1 FROM Stock assigned_stock
         WHERE assigned_stock.product_id = p.id
           AND assigned_stock.warehouse_id = ?
       )
       ${searchFilter}
       ORDER BY p.article_code
       LIMIT ? OFFSET ?`,
      [query.warehouse_id, query.warehouse_id, ...searchParams, limit, offset],
    );
    const countRows = await this.dataSource.query<Array<{ total: string }>>(
      `SELECT COUNT(*) total
       FROM Products p
       WHERE EXISTS (
         SELECT 1 FROM Stock assigned_stock
         WHERE assigned_stock.product_id = p.id
           AND assigned_stock.warehouse_id = ?
       )
       ${searchFilter}`,
      [query.warehouse_id, ...searchParams],
    );
    return {
      data: rows.map((row) => ({
        ...row,
        is_published: bitToBoolean(row.is_published),
        image_count: Number(row.image_count),
        warehouse_stock: Number(row.warehouse_stock),
      })),
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total ?? 0),
      },
    };
  }

  async getCatalogAdminProduct(productId: number, warehouseId: number) {
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new BadRequestException('ID de producto inválido');
    }
    if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
      throw new BadRequestException('Debe seleccionar un warehouse válido');
    }
    const warehouseRows = await this.dataSource.query<
      Array<{ id: number; warehouse_name: string }>
    >(
      `SELECT id, warehouse_name FROM Warehouses
       WHERE id = ? AND status = b'1' LIMIT 1`,
      [warehouseId],
    );
    if (!warehouseRows[0])
      throw new NotFoundException('Warehouse no encontrado o inactivo');
    const rows = await this.dataSource.query<Array<Record<string, unknown>>>(
      `SELECT p.id, p.article_code, p.article_description, p.article_series,
              p.brand_name, p.model_code, p.material_type, p.color, p.status,
              p.ecommerce_group_code, p.color_code, p.slug, p.ecommerce_name,
              p.short_description, p.full_description, p.gender,
              CAST(p.unit_price AS CHAR) unit_price,
              CAST(p.factory_price AS CHAR) factory_price,
              CAST(p.wholesale_price AS CHAR) wholesale_price,
              CAST(p.selling_price AS CHAR) selling_price,
              CAST(p.original_price AS CHAR) original_price,
              CAST(p.shipping_cost AS CHAR) shipping_cost,
              p.discount_percent, p.is_new, p.is_featured, p.is_published,
              p.seo_title, p.seo_description
       FROM Products p WHERE p.id = ? LIMIT 1`,
      [productId],
    );
    const product = rows[0];
    if (!product) throw new NotFoundException('Producto no encontrado');
    const images = await this.dataSource.query<
      Array<{
        id: number;
        image_url: string;
        alt_text: string | null;
        sort_order: number;
        is_primary: number | Buffer;
        status: number | Buffer;
      }>
    >(
      `SELECT id, image_url, alt_text, sort_order, is_primary, status
       FROM ProductImages WHERE product_id = ? ORDER BY status DESC, sort_order, id`,
      [productId],
    );
    const sizes = await this.dataSource.query<
      Array<{ id: number; size: string; stock: string }>
    >(
      `SELECT ps.id, ps.size, CAST(COALESCE(s.quantity, 0) AS CHAR) stock
       FROM ProductSize ps
       LEFT JOIN Stock s ON s.product_size_id = ps.id
        AND s.product_id = ps.product_id AND s.warehouse_id = ?
       WHERE ps.product_id = ? ORDER BY CAST(ps.size AS DECIMAL(10,2)), ps.size`,
      [warehouseId, productId],
    );
    const imageCount = images.filter((image) =>
      bitToBoolean(image.status),
    ).length;
    const warehouseStock = sizes.reduce(
      (total, size) => total + Number(size.stock),
      0,
    );
    const storefrontRows = await this.dataSource.query<
      Array<{ id: number; name: string; slug: string }>
    >(
      `SELECT id, name, slug FROM Storefronts
       WHERE warehouse_id = ? AND status = b'1'`,
      [warehouseId],
    );
    const missingRequirements: string[] = [];
    if (!bitToBoolean(product.status as number | Buffer))
      missingRequirements.push('El producto está inactivo');
    if (Number(product.selling_price ?? 0) <= 0)
      missingRequirements.push('Falta el precio de venta ecommerce');
    if (
      typeof product.ecommerce_name !== 'string' ||
      !product.ecommerce_name.trim()
    )
      missingRequirements.push('Falta el nombre ecommerce');
    if (
      typeof product.ecommerce_group_code !== 'string' ||
      !product.ecommerce_group_code.trim()
    )
      missingRequirements.push('Falta el código de agrupación ecommerce');
    if (typeof product.color_code !== 'string' || !product.color_code.trim())
      missingRequirements.push('Falta el código de color');
    if (typeof product.color !== 'string' || !product.color.trim())
      missingRequirements.push('Falta el nombre del color');
    if (imageCount === 0)
      missingRequirements.push('Falta al menos una imagen activa');
    if (warehouseStock <= 0)
      missingRequirements.push(
        `No existe stock disponible en ${warehouseRows[0].warehouse_name}`,
      );
    if (storefrontRows.length === 0)
      missingRequirements.push(
        `El warehouse ${warehouseRows[0].warehouse_name} no está vinculado a un ecommerce activo`,
      );
    return {
      ...product,
      status: bitToBoolean(product.status as number | Buffer),
      is_new: bitToBoolean(product.is_new as number | Buffer),
      is_featured: bitToBoolean(product.is_featured as number | Buffer),
      is_published: bitToBoolean(product.is_published as number | Buffer),
      images: images.map((image) => ({
        ...image,
        is_primary: bitToBoolean(image.is_primary),
        status: bitToBoolean(image.status),
      })),
      sizes: sizes.map((size) => ({
        ...size,
        stock: Number(size.stock),
      })),
      publication_readiness: {
        warehouse: warehouseRows[0],
        image_count: imageCount,
        warehouse_stock: warehouseStock,
        storefronts: storefrontRows,
        ready: missingRequirements.length === 0,
        missing_requirements: missingRequirements,
      },
    };
  }

  private async validateProductForPublication(
    product: Product,
    manager: EntityManager,
    warehouseId?: number,
  ): Promise<void> {
    const errors: string[] = [];
    if (!warehouseId) {
      throw new BadRequestException({
        message: 'El producto no está listo para publicarse',
        errors: ['Debe seleccionar el warehouse del ecommerce'],
      });
    }
    const warehouseRows = await manager.query<
      Array<{ id: number; warehouse_name: string }>
    >(
      `SELECT id, warehouse_name FROM Warehouses
       WHERE id = ? AND status = b'1' LIMIT 1`,
      [warehouseId],
    );
    if (!warehouseRows[0])
      errors.push('El warehouse seleccionado no existe o está inactivo');
    if (!bitToBoolean(product.status as unknown as number | Buffer))
      errors.push('El producto está inactivo');
    if (Number(product.selling_price ?? 0) <= 0)
      errors.push('Debe indicar un precio de venta ecommerce mayor a cero');
    if (!product.ecommerce_name?.trim())
      errors.push('Debe indicar el nombre ecommerce');
    if (!product.ecommerce_group_code?.trim())
      errors.push('Debe indicar el código de agrupación ecommerce');
    if (!product.color_code?.trim())
      errors.push('Debe indicar el código de color');
    if (!product.color?.trim()) errors.push('Debe indicar el nombre del color');
    const imageRows = await manager.query<Array<{ total: string }>>(
      `SELECT COUNT(*) total FROM ProductImages
       WHERE product_id = ? AND status = b'1'`,
      [product.id],
    );
    if (Number(imageRows[0]?.total ?? 0) === 0)
      errors.push('Debe registrar al menos una imagen activa');
    const stockRows = await manager.query<Array<{ total: string }>>(
      `SELECT CAST(COALESCE(SUM(quantity), 0) AS CHAR) total FROM Stock
       WHERE product_id = ? AND warehouse_id = ?`,
      [product.id, warehouseId],
    );
    if (Number(stockRows[0]?.total ?? 0) <= 0)
      errors.push(
        `El producto no tiene stock disponible en ${warehouseRows[0]?.warehouse_name ?? 'el warehouse seleccionado'}`,
      );
    const storefrontRows = await manager.query<Array<{ total: string }>>(
      `SELECT COUNT(*) total FROM Storefronts
       WHERE warehouse_id = ? AND status = b'1'`,
      [warehouseId],
    );
    if (Number(storefrontRows[0]?.total ?? 0) === 0)
      errors.push(
        'El warehouse seleccionado no está vinculado a un ecommerce activo',
      );
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'El producto no está listo para publicarse',
        errors,
      });
    }
  }

  async addProductImage(productId: number, dto: CreateProductImageDto) {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager
        .getRepository(Product)
        .findOne({ where: { id: productId } });
      if (!product) throw new NotFoundException('Producto no encontrado');
      const repository = manager.getRepository(ProductImage);
      const existingCount = await repository.count({
        where: { product_id: productId, status: true },
      });
      const isPrimary = dto.is_primary === true || existingCount === 0;
      if (isPrimary) {
        await repository.update(
          { product_id: productId },
          { is_primary: false },
        );
      }
      const image = await repository.save(
        repository.create({
          product_id: productId,
          image_url: dto.image_url.trim(),
          alt_text: dto.alt_text?.trim() || undefined,
          sort_order: dto.sort_order ?? existingCount + 1,
          is_primary: isPrimary,
          status: true,
        }),
      );
      await manager.increment(Storefront, { status: true }, 'cache_version', 1);
      return image;
    });
  }

  async registerProductImages(
    selector: { productId?: number; articleCode?: string },
    dto: RegisterProductImagesDto,
  ) {
    const normalizedCode = selector.articleCode?.trim().toUpperCase();
    if (!selector.productId && !normalizedCode) {
      throw new BadRequestException('Debe indicar el ID o código del producto');
    }
    const urls = dto.images.map((image) => image.image_url.trim());
    if (new Set(urls).size !== urls.length) {
      throw new BadRequestException('La solicitud contiene URLs duplicadas');
    }
    const requestedPrimary = dto.images.filter(
      (image) => image.is_primary === true,
    );
    if (requestedPrimary.length > 1) {
      throw new BadRequestException('Solo una imagen puede ser la principal');
    }
    for (const imageUrl of urls) {
      const parsed = new URL(imageUrl);
      if (
        parsed.protocol !== 'https:' ||
        parsed.hostname !== 'res.cloudinary.com'
      ) {
        throw new BadRequestException(
          'Todas las imágenes deben ser URLs HTTPS de Cloudinary',
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const productRepository = manager.getRepository(Product);
      const product = await productRepository.findOne({
        where: selector.productId
          ? { id: selector.productId }
          : { article_code: normalizedCode },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Producto no encontrado');

      const imageRepository = manager.getRepository(ProductImage);
      const existing = await imageRepository.find({
        where: { product_id: product.id },
        order: { sort_order: 'ASC' },
      });
      await imageRepository.update(
        { product_id: product.id },
        { is_primary: false },
      );

      const primaryUrl = requestedPrimary[0]?.image_url.trim() ?? urls[0];
      const savedIds = new Set<number>();
      for (const [index, input] of dto.images.entries()) {
        const imageUrl = input.image_url.trim();
        let image = existing.find((current) => current.image_url === imageUrl);
        if (!image) {
          image = imageRepository.create({ product_id: product.id });
        }
        image.image_url = imageUrl;
        image.alt_text =
          input.alt_text?.trim() ||
          `${product.ecommerce_name || product.article_description} - imagen ${index + 1}`;
        image.sort_order = input.sort_order ?? index + 1;
        image.is_primary = imageUrl === primaryUrl;
        image.status = true;
        const saved = await imageRepository.save(image);
        savedIds.add(saved.id);
      }

      if (dto.replace_existing === true) {
        for (const image of existing) {
          if (!savedIds.has(image.id)) {
            image.status = false;
            image.is_primary = false;
            await imageRepository.save(image);
          }
        }
      }

      await manager.increment(Storefront, { status: true }, 'cache_version', 1);
      const gallery = await imageRepository.find({
        where: { product_id: product.id, status: true },
        order: { is_primary: 'DESC', sort_order: 'ASC' },
      });
      return {
        product: {
          id: product.id,
          article_code: product.article_code,
          ecommerce_group_code: product.ecommerce_group_code,
          color_code: product.color_code,
          color: product.color,
        },
        images: gallery,
      };
    });
  }

  async removeProductImage(productId: number, imageId: number) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ProductImage);
      const image = await repository.findOne({
        where: { id: imageId, product_id: productId },
      });
      if (!image) throw new NotFoundException('Imagen no encontrada');
      image.status = false;
      image.is_primary = false;
      await repository.save(image);
      const replacement = await repository.findOne({
        where: { product_id: productId, status: true },
        order: { sort_order: 'ASC' },
      });
      if (replacement) {
        replacement.is_primary = true;
        await repository.save(replacement);
      }
      await manager.increment(Storefront, { status: true }, 'cache_version', 1);
      return { message: 'Imagen retirada del catálogo' };
    });
  }

  async getAdminOverview(slug: string) {
    const store = await this.findActiveStorefront(slug);
    const rows = await this.dataSource.query<Array<Record<string, string>>>(
      `SELECT
        (SELECT COUNT(*) FROM Products p WHERE p.is_published=b'1' AND p.status=b'1'
          AND EXISTS(SELECT 1 FROM Stock s WHERE s.product_id=p.id AND s.warehouse_id=? AND s.quantity>0)) active_products,
        (SELECT COUNT(*) FROM Products p WHERE p.status=b'1' AND p.is_published=b'0'
          AND EXISTS(SELECT 1 FROM Stock s WHERE s.product_id=p.id AND s.warehouse_id=?)) draft_products,
        (SELECT COUNT(*) FROM EcommerceOrders eo WHERE eo.storefront_id=? AND eo.status='PENDIENTE') pending_orders,
        (SELECT COUNT(*) FROM EcommerceOrders eo WHERE eo.storefront_id=?) total_orders,
        (SELECT CAST(COALESCE(SUM(eo.total_amount),0) AS CHAR) FROM EcommerceOrders eo
          WHERE eo.storefront_id=? AND eo.status<>'CANCELADO') sales_total`,
      [store.warehouse_id, store.warehouse_id, store.id, store.id, store.id],
    );
    return {
      storefront: { id: store.id, slug: store.slug, name: store.name },
      warehouse: {
        id: store.warehouse_id,
        name: store.warehouse.warehouse_name,
      },
      active_products: Number(rows[0]?.active_products ?? 0),
      draft_products: Number(rows[0]?.draft_products ?? 0),
      pending_orders: Number(rows[0]?.pending_orders ?? 0),
      total_orders: Number(rows[0]?.total_orders ?? 0),
      sales_total: rows[0]?.sales_total ?? '0.00',
    };
  }

  async getAdminSettings(slug: string) {
    const store = await this.findActiveStorefront(slug);
    const [categories, series, productTypes] = await Promise.all([
      this.dataSource.query<Array<{ id: number; name: string }>>(
        `SELECT id, name FROM Categories WHERE LOWER(TRIM(name)) IN ('ropa para niña','accesorios para niña','calzado para niña') ORDER BY name`,
      ),
      this.dataSource.query<Array<{ code: string; description_serie: string }>>(
        `SELECT code, description_serie FROM Series WHERE status=b'1' AND code IN ('SMR','SMA','SMC') ORDER BY code`,
      ),
      this.dataSource.query<
        Array<{
          id: number;
          name: string;
          slug: string;
          garment_position: string;
        }>
      >(
        `SELECT id,name,slug,garment_position FROM EcommerceProductTypes
         WHERE storefront_id=? AND status=b'1' ORDER BY display_order,id`,
        [store.id],
      ),
    ]);
    return {
      storefront: { id: store.id, slug: store.slug, name: store.name },
      warehouse: {
        id: store.warehouse_id,
        name: store.warehouse.warehouse_name,
      },
      categories,
      series,
      product_types: productTypes,
    };
  }

  async createStorefrontProduct(slug: string, dto: CreateSoominProductDto) {
    const created = await this.dataSource.transaction(async (manager) => {
      const store = await this.findActiveStorefront(slug, manager);
      const code = dto.article_code.trim().toUpperCase();
      const existing = await manager.getRepository(Product).findOne({
        where: { article_code: code },
      });
      if (existing)
        throw new ConflictException('Ya existe un producto con ese código');
      const category = await manager.getRepository(Category).findOne({
        where: { id: dto.category_id },
      });
      if (!category)
        throw new BadRequestException('La categoría seleccionada no existe');
      const productTypeRows = await manager.query<
        Array<{ id: number; garment_position: string }>
      >(
        `SELECT id,garment_position FROM EcommerceProductTypes
         WHERE id=? AND storefront_id=? AND status=b'1'`,
        [dto.ecommerce_product_type_id, store.id],
      );
      if (!productTypeRows[0])
        throw new BadRequestException(
          'El tipo de producto no pertenece a Soomin Store',
        );
      const series = await manager.getRepository(Series).findOne({
        where: { code: dto.article_series },
      });
      if (!series)
        throw new BadRequestException('La serie seleccionada no existe');
      const categoryName = category.name.trim().toLowerCase();
      const expectedSeries: Record<string, string> = {
        'ropa para niña': 'SMR',
        'accesorios para niña': 'SMA',
        'calzado para niña': 'SMC',
      };
      if (
        expectedSeries[categoryName] &&
        dto.article_series !== expectedSeries[categoryName]
      )
        throw new BadRequestException(
          'La serie no corresponde a la categoría seleccionada',
        );
      const sellingCents = moneyToCents(dto.selling_price);
      if (sellingCents <= 0)
        throw new BadRequestException(
          'El precio de venta debe ser mayor a cero',
        );
      const purchaseCents = moneyToCents(dto.purchase_price);
      const shippingCents = dto.shipping_cost
        ? moneyToCents(dto.shipping_cost)
        : 0;
      const originalCents = dto.original_price
        ? moneyToCents(dto.original_price)
        : 0;
      const uniqueSizes = new Set(
        dto.sizes.map((item) => item.size.trim().toUpperCase()),
      );
      if (uniqueSizes.size !== dto.sizes.length)
        throw new BadRequestException('No se permiten tallas duplicadas');
      if (categoryName === 'ropa para niña') {
        const allowedGirlSizes = new Set([
          '2',
          '4',
          '6',
          '8',
          '10',
          '12',
          '14',
          '16',
        ]);
        if (dto.sizes.some((item) => !allowedGirlSizes.has(item.size.trim())))
          throw new BadRequestException(
            'La ropa para niña admite tallas pares del 2 al 16',
          );
      }
      if (
        categoryName === 'accesorios para niña' &&
        dto.sizes.some((item) => item.size.trim().toUpperCase() !== 'ÚNICA')
      )
        throw new BadRequestException(
          'Los accesorios deben registrarse con talla ÚNICA',
        );
      if (
        dto.publish &&
        (!dto.images?.length || !dto.sizes.some((item) => item.stock > 0))
      ) {
        throw new BadRequestException(
          'Para publicar debe registrar imágenes y stock disponible',
        );
      }
      const discount =
        originalCents > sellingCents
          ? Math.round(((originalCents - sellingCents) * 100) / originalCents)
          : 0;
      const productRepository = manager.getRepository(Product);
      const productData: Partial<Product> & Record<string, unknown> = {
        article_code: code,
        article_description: dto.name.trim(),
        article_series: dto.article_series,
        type_origin: 'ECOMMERCE_SOOMIN',
        manufacturing_cost: purchaseCents / 100,
        unit_price: purchaseCents / 100,
        factory_price: 0,
        dropshipping_price: sellingCents / 100,
        wholesale_price: sellingCents / 100,
        selling_price: sellingCents / 100,
        original_price: originalCents > 0 ? originalCents / 100 : undefined,
        shipping_cost: shippingCents / 100,
        brand_name: dto.brand_name?.trim() || 'SOOMIN',
        model_code: dto.group_code.trim(),
        ecommerce_group_code: dto.group_code.trim().toUpperCase(),
        color_code: dto.color_code.trim().toUpperCase(),
        ecommerce_product_type_id: dto.ecommerce_product_type_id,
        color: dto.color.trim(),
        category,
        stock_minimum: 0,
        status: true,
        ecommerce_name: dto.name.trim(),
        short_description: dto.short_description?.trim(),
        full_description: dto.full_description?.trim(),
        gender: dto.gender?.trim() || 'Niña',
        discount_percent: discount,
        is_new: dto.is_new ?? true,
        is_featured: dto.is_featured ?? false,
        is_published: dto.publish ?? false,
      };
      const productEntity = Object.assign(new Product(), productData);
      const product = await productRepository.save(productEntity);
      const sizeRepository = manager.getRepository(ProductSize);
      const stockRepository = manager.getRepository(Stock);
      for (const item of dto.sizes) {
        const sizeEntity = Object.assign(new ProductSize(), {
          product,
          size: item.size.trim().toUpperCase(),
          lot_pair: 1,
        });
        const size = await sizeRepository.save(sizeEntity);
        const stockEntity = Object.assign(new Stock(), {
          warehouse_id: store.warehouse_id,
          product_id: product.id,
          product_size_id: size.id,
          quantity: item.stock,
          unit_of_measure: 'UND',
          updated_at_utc: new Date(),
        });
        await stockRepository.save(stockEntity);
      }
      if (dto.images?.length) {
        const imageRepository = manager.getRepository(ProductImage);
        await imageRepository.save(
          dto.images.map((image, index) =>
            imageRepository.create({
              product_id: product.id,
              image_url: image.url.trim(),
              alt_text: `${dto.name.trim()} ${dto.color.trim()}`,
              sort_order: index + 1,
              is_primary: index === 0,
              status: true,
            }),
          ),
        );
      }
      store.cache_version += 1;
      await manager.getRepository(Storefront).save(store);
      return { productId: product.id, warehouseId: store.warehouse_id };
    });
    return this.getCatalogAdminProduct(created.productId, created.warehouseId);
  }

  async listStorefrontOrders(slug: string, page = 1, limit = 25) {
    const store = await this.findActiveStorefront(slug);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { storefront_id: store.id },
      relations: { details: true },
      order: { created_at: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
    return { data: orders, total, page: safePage, limit: safeLimit };
  }

  async listOrders(page = 1, limit = 25) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [orders, total] = await this.orderRepository.findAndCount({
      relations: { storefront: true, details: true },
      order: { created_at: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
    return { data: orders, total, page: safePage, limit: safeLimit };
  }

  async updateOrderStatus(
    orderId: number,
    dto: UpdateEcommerceOrderStatusDto,
    storefrontSlug?: string,
    actorUserId?: number,
  ) {
    const nextStatus = dto.status;
    const allowed: Record<EcommerceOrderStatus, EcommerceOrderStatus[]> = {
      [EcommerceOrderStatus.PENDING]: [
        EcommerceOrderStatus.CONFIRMED,
        EcommerceOrderStatus.CANCELED,
      ],
      [EcommerceOrderStatus.CONFIRMED]: [
        EcommerceOrderStatus.DISPATCHED,
        EcommerceOrderStatus.CANCELED,
      ],
      [EcommerceOrderStatus.DISPATCHED]: [EcommerceOrderStatus.DELIVERED],
      [EcommerceOrderStatus.DELIVERED]: [],
      [EcommerceOrderStatus.CANCELED]: [],
    };
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(EcommerceOrder);
      const order = await repository.findOne({
        where: { id: orderId },
        relations: { details: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Pedido ecommerce no encontrado');
      if (storefrontSlug) {
        const storefront = await manager
          .getRepository(Storefront)
          .findOne({ where: { slug: storefrontSlug } });
        if (!storefront || order.storefront_id !== storefront.id)
          throw new NotFoundException('Pedido ecommerce no encontrado');
      }
      if (dto.payment_received === true) order.payment_status = 'PAGADO';
      if (dto.shipping_code?.trim())
        order.shipping_code = dto.shipping_code.trim();
      if (
        nextStatus === EcommerceOrderStatus.DISPATCHED &&
        order.delivery_type === 'AGENCIA_SHALOM' &&
        !order.shipping_code
      )
        throw new BadRequestException(
          'Ingresa el código de envío de Shalom antes de despachar',
        );
      if (
        nextStatus === EcommerceOrderStatus.DISPATCHED &&
        ['yape', 'plin'].includes(order.payment_method) &&
        order.payment_status !== 'PAGADO'
      )
        throw new BadRequestException(
          'Confirma el pago antes de despachar un pedido pagado por Yape o Plin',
        );
      if (order.status === nextStatus) return order;
      if (!allowed[order.status]?.includes(nextStatus)) {
        throw new ConflictException(
          `No se permite cambiar de ${order.status} a ${nextStatus}`,
        );
      }
      if (nextStatus === EcommerceOrderStatus.CANCELED) {
        const cancellationReason = dto.cancellation_reason?.trim();
        if (!cancellationReason || cancellationReason.length < 5) {
          throw new BadRequestException(
            'Ingresa un motivo de rechazo de al menos 5 caracteres',
          );
        }
        if (order.stock_released_at)
          throw new ConflictException(
            'El stock de este pedido ya fue devuelto',
          );
        for (const detail of order.details) {
          const stockRows = await manager.query<Array<{ id: number }>>(
            `SELECT id FROM Stock
             WHERE warehouse_id = ? AND product_id = ? AND product_size_id = ?
             FOR UPDATE`,
            [order.warehouse_id, detail.product_id, detail.product_size_id],
          );
          if (!stockRows[0])
            throw new ConflictException(
              'No se encontró el stock que debe restituirse',
            );
          await manager.query(
            `UPDATE Stock SET quantity = quantity + ?, version = version + 1,
                    updated_at_utc = UTC_TIMESTAMP(3) WHERE id = ?`,
            [detail.quantity, stockRows[0].id],
          );
        }
        order.stock_released_at = new Date();
        order.cancellation_reason = cancellationReason;
        order.canceled_by = actorUserId ?? null;
        order.canceled_at_utc = new Date();
        await manager.increment(
          Storefront,
          { id: order.storefront_id },
          'cache_version',
          1,
        );
      }
      order.status = nextStatus;
      return repository.save(order);
    });
  }

  private orderResponse(order: EcommerceOrder, idempotentReplay: boolean) {
    return {
      id: order.id,
      order_code: order.order_code,
      status: order.status,
      currency: order.currency,
      total_amount: order.total_amount,
      subtotal_amount: order.subtotal_amount,
      discount_amount: order.discount_amount,
      bundle_discount_percent: order.bundle_discount_percent,
      shipping_amount: order.shipping_amount,
      created_at: order.created_at,
      idempotent_replay: idempotentReplay,
      items: order.details?.map((detail) => ({
        product_id: detail.product_id,
        product_size_id: detail.product_size_id,
        article_code: detail.article_code_snapshot,
        product_name: detail.product_name_snapshot,
        color: detail.color_snapshot,
        size: detail.size_snapshot,
        quantity: detail.quantity,
        unit_price: detail.unit_price,
        subtotal: detail.subtotal,
        image_url: detail.image_url_snapshot,
      })),
    };
  }
}
