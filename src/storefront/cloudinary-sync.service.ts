import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { ProductImage } from '../database/entities/productImage.entity';
import {
  SyncCloudinaryFolderDto,
  SyncCloudinaryImagesDto,
} from './dto/sync-cloudinary-images.dto';
import { StorefrontService } from './storefront.service';

type CloudinaryResource = {
  public_id: string;
  secure_url: string;
  resource_type?: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
};

type CloudinaryResourcesResponse = {
  resources: CloudinaryResource[];
  next_cursor?: string;
};

type ProductSyncResult = {
  product: { id: number; article_code: string };
  source: string;
  dry_run: boolean;
  cloudinary_found: number;
  already_registered: number;
  missing_in_database: number;
  registered: number;
  warnings: string[];
  images: Array<{
    public_id: string;
    secure_url: string;
    sort_order: number;
    is_primary: boolean;
    database_status: 'REGISTERED' | 'MISSING';
    bytes?: number;
    width?: number;
    height?: number;
  }>;
};

export function imageOrderFromPublicId(publicId: string): number {
  const match = publicId.match(/[_-](\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function productCodeFromPublicId(publicId: string): string | null {
  const basename = publicId.split('/').pop() ?? '';
  const match = basename.match(/^([a-z0-9-]{2,80})[_-](\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}

@Injectable()
export class CloudinarySyncService {

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly imageRepository: Repository<ProductImage>,
    private readonly storefrontService: StorefrontService,
  ) {}

  async syncProductImages(
    articleCodeValue: string,
    dto: SyncCloudinaryImagesDto,
  ): Promise<ProductSyncResult> {
    const dryRun = dto.dry_run !== false;
    const articleCode = this.normalizeArticleCode(articleCodeValue);
    const product = await this.findProduct(articleCode);
    const prefix = dto.prefix?.trim() || articleCode.toLowerCase();
    const resources = await this.findResourcesByPrefix(prefix);
    return this.syncProductResources(
      product,
      resources,
      `prefix:${prefix}`,
      dryRun,
      dto.replace_existing === true,
    );
  }

  async syncAssetFolder(dto: SyncCloudinaryFolderDto) {
    const dryRun = dto.dry_run !== false;
    const assetFolder =
      dto.asset_folder?.trim() ||
      this.config.get<string>('CLOUDINARY_ASSET_FOLDER')?.trim() ||
      'verco';
    if (!/^[a-zA-Z0-9/_-]{1,120}$/.test(assetFolder)) {
      throw new BadRequestException('Carpeta de Cloudinary inválida');
    }

    const resources = (await this.findResourcesByAssetFolder(assetFolder))
      .filter((resource) => resource.resource_type !== 'video')
      .filter((resource) =>
        resource.secure_url?.startsWith('https://res.cloudinary.com/'),
      );
    const groups = new Map<string, CloudinaryResource[]>();
    const invalid_names: string[] = [];
    for (const resource of resources) {
      const code = productCodeFromPublicId(resource.public_id);
      if (!code) {
        invalid_names.push(resource.public_id);
        continue;
      }
      const current = groups.get(code) ?? [];
      current.push(resource);
      groups.set(code, current);
    }

    const codes = [...groups.keys()];
    const products = codes.length
      ? await this.productRepository
          .createQueryBuilder('product')
          .where('UPPER(product.article_code) IN (:...codes)', { codes })
          .getMany()
      : [];
    const productsByCode = new Map(
      products.map((product) => [product.article_code.toUpperCase(), product]),
    );
    const unknown_product_codes = codes.filter(
      (code) => !productsByCode.has(code),
    );
    const results: ProductSyncResult[] = [];
    for (const [code, productResources] of groups) {
      const product = productsByCode.get(code);
      if (!product) continue;
      results.push(
        await this.syncProductResources(
          product,
          productResources,
          `asset_folder:${assetFolder}`,
          dryRun,
          dto.replace_existing === true,
        ),
      );
    }

    return {
      asset_folder: assetFolder,
      dry_run: dryRun,
      cloudinary_assets: resources.length,
      products_detected: groups.size,
      products_found: products.length,
      products_missing: unknown_product_codes.length,
      images_missing_in_database: results.reduce(
        (total, result) => total + result.missing_in_database,
        0,
      ),
      images_registered: results.reduce(
        (total, result) => total + result.registered,
        0,
      ),
      invalid_names,
      unknown_product_codes,
      results,
    };
  }

  private async syncProductResources(
    product: Product,
    resources: CloudinaryResource[],
    source: string,
    dryRun: boolean,
    replaceExisting: boolean,
  ): Promise<ProductSyncResult> {
    const articleCode = product.article_code.toUpperCase();
    const exactPattern = new RegExp(
      `(^|/)${this.escapeRegex(articleCode)}(?:[_-][0-9]+)$`,
      'i',
    );
    const matching = resources
      .filter((resource) => exactPattern.test(resource.public_id))
      .filter((resource) =>
        resource.secure_url?.startsWith('https://res.cloudinary.com/'),
      )
      .sort((a, b) => {
        const order =
          imageOrderFromPublicId(a.public_id) -
          imageOrderFromPublicId(b.public_id);
        return order || a.public_id.localeCompare(b.public_id);
      });
    const existing = await this.imageRepository.find({
      where: { product_id: product.id },
    });
    const activeUrls = new Set(
      existing
        .filter((image) => this.isDatabaseBitEnabled(image.status))
        .map((image) => image.image_url),
    );
    const pendingRegistration = matching.filter(
      (resource) => !activeUrls.has(resource.secure_url),
    );
    const warnings = matching.flatMap((resource) => {
      const messages: string[] = [];
      if ((resource.bytes ?? 0) > 2_000_000)
        messages.push(`${resource.public_id}: pesa más de 2 MB`);
      if ((resource.width ?? 0) < 800 || (resource.height ?? 0) < 800) {
        messages.push(`${resource.public_id}: resolución menor a 800 × 800`);
      }
      return messages;
    });

    if (!dryRun && pendingRegistration.length > 0) {
      await this.storefrontService.registerProductImages(
        { productId: product.id },
        {
          replace_existing: replaceExisting,
          images: matching.map((resource, index) => ({
            image_url: resource.secure_url,
            alt_text: `${product.ecommerce_name || product.article_description} - imagen ${index + 1}`,
            sort_order: index + 1,
            is_primary: index === 0,
          })),
        },
      );
    }

    return {
      product: { id: product.id, article_code: product.article_code },
      source,
      dry_run: dryRun,
      cloudinary_found: matching.length,
      already_registered: matching.length - pendingRegistration.length,
      missing_in_database: pendingRegistration.length,
      registered: dryRun ? 0 : pendingRegistration.length,
      warnings,
      images: matching.map((resource, index) => ({
        public_id: resource.public_id,
        secure_url: resource.secure_url,
        sort_order: index + 1,
        is_primary: index === 0,
        database_status:
          activeUrls.has(resource.secure_url) || !dryRun
            ? 'REGISTERED'
            : 'MISSING',
        bytes: resource.bytes,
        width: resource.width,
        height: resource.height,
      })),
    };
  }

  private async findProduct(articleCode: string): Promise<Product> {
    const product = await this.productRepository
      .createQueryBuilder('product')
      .where('UPPER(product.article_code) = :articleCode', { articleCode })
      .getOne();
    if (!product) {
      throw new NotFoundException(
        `No existe un producto con código ${articleCode}`,
      );
    }
    return product;
  }

  private normalizeArticleCode(value: string): string {
    const articleCode = value.trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,80}$/.test(articleCode)) {
      throw new BadRequestException('Código de producto inválido');
    }
    return articleCode;
  }

  private findResourcesByPrefix(prefix: string): Promise<CloudinaryResource[]> {
    return this.findResources('/resources/image/upload', { prefix });
  }

  private findResourcesByAssetFolder(
    assetFolder: string,
  ): Promise<CloudinaryResource[]> {
    return this.findResources('/resources/by_asset_folder', {
      asset_folder: assetFolder,
    });
  }

  private async findResources(
    path: string,
    query: Record<string, string>,
  ): Promise<CloudinaryResource[]> {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary no está configurado: faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY o CLOUDINARY_API_SECRET',
      );
    }

    const resources: CloudinaryResource[] = [];
    let cursor: string | undefined;
    try {
      do {
        const response = await axios.get<CloudinaryResourcesResponse>(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}${path}`,
          {
            auth: { username: apiKey, password: apiSecret },
            params: {
              ...query,
              max_results: 500,
              next_cursor: cursor,
              fields:
                'public_id,secure_url,resource_type,format,bytes,width,height',
            },
            timeout: 15_000,
          },
        );
        resources.push(...response.data.resources);
        cursor = response.data.next_cursor;
      } while (cursor);
      return resources;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new ServiceUnavailableException(
          'Las credenciales de Cloudinary no son válidas',
        );
      }
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new BadRequestException(
          'La carpeta no existe o Cloudinary usa el modo de carpetas fijas',
        );
      }
      throw new BadGatewayException('No se pudo consultar Cloudinary');
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isDatabaseBitEnabled(value: unknown): boolean {
    if (value === true || value === 1) return true;
    return Buffer.isBuffer(value) && value.length > 0 && value[0] === 1;
  }
}
