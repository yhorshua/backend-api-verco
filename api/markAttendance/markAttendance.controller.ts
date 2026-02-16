import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { AttendanceService } from './markAttendance.service';
import { Attendance } from '../database/entities/marcacion.entity';
import { JwtAuthGuard } from 'api/auth/jwt-auth.guard';
import { HasUserEnteredTodayResponseDto } from './hasUserEnteredTodayResponse.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) { }

  // Ruta para marcar la entrada o salida
  @UseGuards(JwtAuthGuard)
  @Post('mark')
  async markAttendance(
    @Body('userId') userId: number,
    @Body('type') type: 'entrada' | 'salida',
    @Body('ubicacion') ubicacion: string,
  ): Promise<Attendance> {
    return this.attendanceService.markAttendance(userId, type, ubicacion);
  }



  @UseGuards(JwtAuthGuard)
  @Get('has-entered-today/:userId')
  async hasUserEnteredToday(@Param('userId') userId: number): Promise<HasUserEnteredTodayResponseDto> {
    const result = await this.attendanceService.hasUserEnteredToday(userId);

    if (!result) {
      return {
        message: 'El usuario no ha registrado su entrada hoy.',
        hasEntered: false,
      };
    }

    return result;  // Devolvemos el DTO que ya contiene la respuesta
  }
}
