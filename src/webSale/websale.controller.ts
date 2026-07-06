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
  Res,
  UseGuards
} from '@nestjs/common';

import { WebSaleService } from './websale.service';

import { CreateWebSaleDto } from './dto/createWebSaletDto';
import { FilterWebSaleDto } from './dto/filter-websale.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateWebSaleDto } from './dto/updateWebSaleDto';
import { DeliverSaleDto } from './dto/deliverySaleDto';
import { EfactService } from 'src/efactService/efact.service';
import type { Response } from 'express';

@Controller('websales')
export class WebSaleController {

  constructor(
    private readonly webSaleService: WebSaleService,

    private readonly efactService: EfactService
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

  @Get()
  @UseGuards(JwtAuthGuard)
  async getReport(
    @Req() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
  ) {

    return await this.webSaleService.getWebSalesReport({
      startDate,
      endDate,
      userId: userId ? String(userId) : undefined,
    });
  }


   // @UseGuards(JwtAuthGuard)
  @Post(':id/boleta')
  async generateBoleta(@Param('id') id: string) {
    return this.efactService.generateBoletaFromWebSale(Number(id));
  }

  // @UseGuards(JwtAuthGuard)
  @Get(':id/boleta/pdf')
  async getBoletaPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.efactService.getPdfBySaleId(Number(id));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="boleta-${id}.pdf"`
    );

    return res.send(pdfBuffer);
  }

}