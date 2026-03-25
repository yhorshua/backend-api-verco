import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PackingService } from './packing.service';
import { ScanItemDto } from './dto/scan-item.dto';
import { ClosePackingDto } from './dto/close-packing.dto';

@Controller('packing')
export class PackingController {
  constructor(private readonly service: PackingService) {}

   @Get('scan-status/:orderId')
  async getScanStatus(@Param('orderId') orderId: string) {
    return this.service.getScanStatus(Number(orderId));
  }

  @Get(':orderId')
  getPacking(@Param('orderId') orderId: string) {
    return this.service.getPacking(Number(orderId));
  }

  @Post('scan')
  scan(@Body() dto: ScanItemDto) {
    return this.service.scanItem(dto);
  }

  @Post('close')
  close(@Body() dto: ClosePackingDto) {
    return this.service.closePacking(dto.order_id, dto.user_id);
  }
}
