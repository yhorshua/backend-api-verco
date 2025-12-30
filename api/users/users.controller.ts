import { Controller, Get, Post, Put, Body, Param, UseGuards, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellersByWarehouseQueryDto } from './dto/sellers-by-warehouse.query.dto';
import { CreateUserDto } from './create-user.dto';


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }


  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }
  // GET /users/by-warehouse?warehouseId=1
  @Get('by-warehouse')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getByWarehouse(@Query() dto: SellersByWarehouseQueryDto) {
    return this.usersService.getUsersByWarehouse(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: number, @Body() userData: any) {
    return this.usersService.update(id, userData);
  }


}
