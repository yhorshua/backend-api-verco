import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post
} from '@nestjs/common';

import { WebSaleService } from './websale.service';

import { CreateWebSaleDto } from './dto/createWebSaletDto';

@Controller('websales')
export class WebSaleController {

  constructor(
    private readonly webSaleService: WebSaleService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateWebSaleDto
  ) {
    return await this.webSaleService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.webSaleService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id') id: number
  ) {
    return await this.webSaleService.findOne(id);
  }
/*
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: number,
    @Body() dto: UpdateWebSaleStatusDto
  ) {
    return await this.statusService.updateStatus(
      id,
      dto.status
    );
  }
    */
}