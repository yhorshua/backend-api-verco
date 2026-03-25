import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  constructor(private readonly dataSource: DataSource) {}

  async testConnection() {
    try {
      const result = await this.dataSource.query('SELECT GETDATE() AS fecha');
      return {
        success: true,
        message: '✅ Conexión exitosa a SQL Server',
        fechaServidor: result[0].fecha,
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Error al conectar con SQL Server',
        error: error.message,
      };
    }
  }
}
