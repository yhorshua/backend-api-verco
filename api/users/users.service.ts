import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './create-user.dto';
import {SellersByWarehouseQueryDto} from './dto/sellers-by-warehouse.query.dto'
import { Role } from 'api/database/entities/role.entity';
import { Warehouse } from 'api/database/entities/warehouse.entity';

export type WarehouseUserOption = {
  id: number;
  full_name: string;
};

@Injectable()
export class UsersService {
    constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
  ) {}

    async findAll(): Promise<User[]> {
        return this.userRepo.find({ relations: ['role'] });
    }

    async findOne(id: number): Promise<User | null> {
        return this.userRepo.findOne({ where: { id }, relations: ['role'] });
    }

    async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();

    const exists = await this.userRepo.findOne({ where: { email } as any });
    if (exists) throw new BadRequestException('Ese email ya está registrado');

    const role = await this.roleRepo.findOne({ where: { id: dto.rol_id } as any });
    if (!role) throw new NotFoundException('Rol no existe');

    const wh = await this.warehouseRepo.findOne({ where: { id: dto.warehouse_id } as any });
    if (!wh) throw new NotFoundException('Warehouse no existe');

    const password_hash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      full_name: dto.full_name.trim(),
      email,
      password_hash,
      cellphone: dto.cellphone?.trim() ?? null,
      address_home: dto.address_home?.trim() ?? null,
      id_cedula: dto.id_cedula?.trim() ?? null,

      rol_id: dto.rol_id,
      warehouse_id: dto.warehouse_id,

      state_user: true, // o el default que uses
      date_register: new Date(),
    } as any);

    const saved = await this.userRepo.save(user);

    // nunca devuelvas el hash
    const { password_hash: _, ...safe } = saved as any;
    return safe;
  }
    async update(id: number, userData: any): Promise<User | null> {
        if (userData.password) {
            userData.password_hash = await bcrypt.hash(userData.password, 10);
            delete userData.password;
        }

        await this.userRepo.update(id, userData);
        return this.findOne(id); // devuelve User | null
    }

     async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email }, relations: ['role'] });
  }

  async getUsersByWarehouse(dto: SellersByWarehouseQueryDto) {
  const { warehouseId } = dto;

  if (!Number.isInteger(warehouseId) || warehouseId < 1) {
    throw new BadRequestException('warehouseId inválido');
  }

  const users = await this.userRepo.find({
    select: { id: true, full_name: true },
    where: {
      warehouse_id: warehouseId,
      state_user: true,
    },
    order: { full_name: 'ASC' },
  });

  return users.map((u) => ({ id: u.id, full_name: u.full_name }));
}
}
