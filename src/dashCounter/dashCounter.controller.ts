import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardCountersService } from './dashCounter.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Jefe Ventas')
export class DashboardCountersController {
    constructor(
        private readonly service: DashboardCountersService,
    ) { }

    @Get('counters')
    async getCounters(@Req() req: any) {
        return this.service.getNewCounters(req.user);
    }
}
