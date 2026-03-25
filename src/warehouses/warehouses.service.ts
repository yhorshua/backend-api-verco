import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from '../database/entities/warehouse.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
  ) {}

  async create(dto: CreateWarehouseDto) {
    const warehouse_name = dto.warehouse_name.trim();

    const exists = await this.warehouseRepo.findOne({
      where: { warehouse_name } as any,
    });
    if (exists) throw new BadRequestException('Ese warehouse ya existe');

    const wh = this.warehouseRepo.create({
      warehouse_name,
      type: dto.type?.trim() ?? null,
      location: dto.location?.trim() ?? null,
      status: true,
    } as any);

    return this.warehouseRepo.save(wh);
  }

  async findAll() {
    // ✅ ordenar por el campo correcto
    return this.warehouseRepo.find({ order: { warehouse_name: 'ASC' } as any });
  }
}
