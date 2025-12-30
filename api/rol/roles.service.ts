import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../database/entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async create(dto: CreateRoleDto) {
    const name = dto.name_role.trim();

    const exists = await this.roleRepo.findOne({ where: { name_role: name } as any });
    if (exists) throw new BadRequestException('Ese rol ya existe');

    const role = this.roleRepo.create({ name_role: name } as any);
    return this.roleRepo.save(role);
  }

  async findAll() {
    return this.roleRepo.find({ order: { name_role: 'ASC' } as any });
  }
}
