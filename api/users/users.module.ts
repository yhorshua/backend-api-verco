import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../database/entities/user.entity';
import { Role } from '../database/entities/role.entity';
import { Warehouse } from 'api/database/entities/warehouse.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Warehouse])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, TypeOrmModule], // <-- importante exportar
})
export class UsersModule {}
