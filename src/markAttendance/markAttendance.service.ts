import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Attendance } from '../database/entities/marcacion.entity';
import { User } from '../database/entities/user.entity';
import moment from 'moment-timezone'; // Importa moment-timezone
import { HasUserEnteredTodayResponseDto } from './hasUserEnteredTodayResponse.dto';
import { nowInPeru, startOfDayPeru, toPeruTime } from 'src/utils/timezone.util';
import { AttendanceResponseDto } from './dto/attendanceDto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) { }

  // Método para marcar la entrada o salida
  async markAttendance(
  userId: number,
  type: 'entrada' | 'salida',
  ubicacion: string,
): Promise<AttendanceResponseDto> {

  const user = await this.userRepository.findOne({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  const now = nowInPeru();

  // ✅ SOLUCIÓN: usar DeepPartial correctamente
  const attendanceData: Partial<Attendance> = {
    user_id: user.id,
    fecha: now,
    tipo: type,
    ubicacion,
    hora_entrada: type === 'entrada' ? now : null,
    hora_salida: type === 'salida' ? now : null,
  };

  const attendance = this.attendanceRepository.create(attendanceData);

  const saved = await this.attendanceRepository.save(attendance);

  return {
    userId: user.id,
    tipo: saved.tipo,
    ubicacion: saved.ubicacion,
    fecha: toPeruTime(saved.fecha)!,
    hora_entrada: toPeruTime(saved.hora_entrada),
    hora_salida: toPeruTime(saved.hora_salida),
  };
}

  // Método para obtener las asistencias de un empleado
  async getAttendanceByUser(userId: number): Promise<Attendance[]> {
    return await this.attendanceRepository.find({ where: { user: { id: userId } }, order: { fecha: 'DESC' } });
  }

  async hasUserEnteredToday(userId: number): Promise<HasUserEnteredTodayResponseDto | null> {
    const today = moment().tz('America/Lima').startOf('day').toDate();

    // Buscar si ya hay un registro de entrada para este usuario en el día de hoy
    const attendance = await this.attendanceRepository.findOne({
      where: {
        user: { id: userId },
        tipo: 'entrada',
        fecha: MoreThanOrEqual(today),
      },
      relations: ['user'],  // Asegúrate de cargar la relación 'user'
      order: { fecha: 'DESC' },
    });

    if (!attendance || !attendance.user) {  // Verifica que attendance.user no sea undefined
      return {
        message: 'El usuario no ha registrado su entrada hoy.',
        hasEntered: false,
      };
    }

    return {
      message: 'El usuario ha registrado su entrada hoy.',
      hasEntered: true,
      userId: attendance.user.id,  // Ahora puedes acceder a attendance.user.id sin problemas
      tipo: attendance.tipo, // Devolvemos el tipo de entrada (entrada o salida)
    };
  }

}
