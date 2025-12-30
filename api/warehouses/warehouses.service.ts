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
    const name = dto.name.trim();

    const exists = await this.warehouseRepo.findOne({ where: { name } as any });
    if (exists) throw new BadRequestException('Ese warehouse ya existe');

    const wh = this.warehouseRepo.create({
      name,
      address: dto.address?.trim() ?? null,
      phone: dto.phone?.trim() ?? null,
    } as any);

    return this.warehouseRepo.save(wh);
  }

  async findAll() {
    return this.warehouseRepo.find({ order: { name: 'ASC' } as any });
  }
}
