import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { AttendanceService } from './markAttendance.service';
import { Attendance } from '../database/entities/marcacion.entity';
import { JwtAuthGuard } from 'api/auth/jwt-auth.guard';

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

  // Ruta para obtener las asistencias de un empleado
  @UseGuards(JwtAuthGuard)
  @Get(':userId')
  async getAttendanceByUser(@Param('userId') userId: number): Promise<Attendance[]> {
    return this.attendanceService.getAttendanceByUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('has-entered-today/:userId')
  async hasUserEnteredToday(@Param('userId') userId: number) {
    const result = await this.attendanceService.hasUserEnteredToday(userId);

    if (!result) {
      return {
        message: 'El usuario no ha registrado su entrada hoy.',
        hasEntered: false,
      };
    }

    return {
      message: 'El usuario ha registrado su entrada hoy.',
      hasEntered: true,
      userId: result.userId,
      tipo: result.tipo, // tipo 'entrada'
    };
  }

}
