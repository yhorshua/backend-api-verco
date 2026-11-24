import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        service: 'backend-api-verco',
        database: 'connected',
      };
    } catch {
      throw new ServiceUnavailableException('Base de datos no disponible');
    }
  }
}
