import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  async create(@Body() userData: any) {
    return this.usersService.create(userData);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() userData: any) {
    return this.usersService.update(id, userData);
  }
}
