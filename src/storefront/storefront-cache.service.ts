import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class StorefrontCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(StorefrontCacheService.name);
  private client?: RedisClientType;
  private connectionAttempted = false;

  constructor(private readonly config: ConfigService) {}

  private async getClient(): Promise<RedisClientType | undefined> {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) return undefined;

    if (!this.client) {
      this.client = createClient({ url });
      this.client.on('error', (error: Error) =>
        this.logger.warn(
          `Redis no disponible; se continúa sin caché: ${error.message}`,
        ),
      );
    }

    if (!this.client.isOpen && !this.connectionAttempted) {
      this.connectionAttempted = true;
      try {
        await this.client.connect();
      } catch {
        return undefined;
      }
    }

    return this.client.isReady ? this.client : undefined;
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    try {
      const client = await this.getClient();
      const value = await client?.get(key);
      return value ? (JSON.parse(value) as T) : undefined;
    } catch {
      return undefined;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const client = await this.getClient();
      await client?.set(key, JSON.stringify(value), {
        EX: Math.max(10, ttlSeconds),
      });
    } catch {
      // La caché nunca debe impedir una venta.
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit();
  }
}
