import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { AttendanceService } from './markAttendance.service';
import { Attendance } from '../database/entities/marcacion.entity';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Ruta para marcar la entrada o salida
  @Post('mark')
  async markAttendance(
    @Body('userId') userId: number,
    @Body('type') type: 'entrada' | 'salida',
    @Body('ubicacion') ubicacion: string,
  ): Promise<Attendance> {
    return this.attendanceService.markAttendance(userId, type, ubicacion);
  }

  // Ruta para obtener las asistencias de un empleado
  @Get(':userId')
  async getAttendanceByUser(@Param('userId') userId: number): Promise<Attendance[]> {
    return this.attendanceService.getAttendanceByUser(userId);
  }
}
