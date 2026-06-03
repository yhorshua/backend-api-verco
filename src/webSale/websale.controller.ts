import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';

import { WebSaleService } from './websale.service';

import { CreateWebSaleDto } from './dto/createWebSaletDto';
import { FilterWebSaleDto } from './dto/filter-websale.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateWebSaleDto } from './dto/updateWebSaleDto';
import { DeliverSaleDto } from './dto/deliverySaleDto';

@Controller('websales')
export class WebSaleController {

  constructor(
    private readonly webSaleService: WebSaleService,
  ) { }

  @Post()
  async create(
    @Body() dto: CreateWebSaleDto
  ) {
    return await this.webSaleService.create(dto);
  }


  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWebSaleDto, @Req() req) {
    return await this.webSaleService.updateStatus(id, dto, req.user);
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async findFilteredSales(
    @Req() req,
    @Query() filters: FilterWebSaleDto) {
    return await this.webSaleService.findFilteredSales(req.user, filters);
  }

  @Post(':id/deliver')
  @UseGuards(JwtAuthGuard)
  async deliverSale(
    @Param('id') id: number,
    @Body() dto: DeliverSaleDto
  ) {

    return this.webSaleService
      .deliverSale(id, dto);

  }

}