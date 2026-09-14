import { Controller, Get, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('test-db')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class DatabaseController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async testConnection() {
    await this.dataSource.query('SELECT 1');
    return {
      success: true,
      message: 'Conexión a la base de datos disponible',
    };
  }
}
