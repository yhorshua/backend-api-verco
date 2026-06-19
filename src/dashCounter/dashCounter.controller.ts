import { Controller, Get, Req } from '@nestjs/common';
import { DashboardCountersService } from './dashCounter.service';

@Controller('dashboard')
export class DashboardCountersController {
    constructor(
        private readonly service: DashboardCountersService,
    ) { }

    @Get('counters')
    async getCounters(@Req() req: any) {
        return this.service.getNewCounters(req.user);
    }
}