import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { Attendance } from '../database/entities/marcacion.entity';
import { User } from '../database/entities/user.entity';
import moment from 'moment-timezone'; // Importa moment-timezone
import { HasUserEnteredTodayResponseDto } from './hasUserEnteredTodayResponse.dto';
import { nowInPeru, startOfDayPeru, toPeruTime } from 'src/utils/timezone.util';
import { AttendanceResponseDto } from './dto/attendanceDto';
import { SalaryDetailDto, SalaryReportDto } from './dto/salaryAttendanceResponseDto';

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

  async generateSalaryReport(userId: number, month: number, year: number): Promise<SalaryReportDto> {

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('Usuario no encontrado');

    if (!user.hora_ingreso || !user.hora_salida) {
      throw new Error('El usuario no tiene horario definido');
    }

    const salarioMensual = Number(user.salario);
    const salarioPorDia = salarioMensual / 30;

    // ✅ FORMATO CORRECTO
  const monthStr = String(month).padStart(2, '0');

    // 🔹 Rango correcto (basado en Perú)
    const startDate = moment.tz(
      `${year}-${monthStr}-01 00:00:00`,
      'YYYY-MM-DD HH:mm:ss',
      'America/Lima'
    ).utc().toDate();
    // ✅ FORMATO CORRECTO
  const endOfMonth = moment(`${year}-${monthStr}`, 'YYYY-MM').daysInMonth();

    const endDate = moment.tz(
    `${year}-${monthStr}-${String(endOfMonth).padStart(2, '0')} 23:59:59`,
    'YYYY-MM-DD HH:mm:ss',
    'America/Lima'
  ).utc().toDate();

    const attendances = await this.attendanceRepository.find({
      where: {
        user: { id: userId },
        fecha: Between(startDate, endDate),
      },
      order: { fecha: 'ASC' },
    });

    // 🔥 Convertir TODO a hora Perú
    const registros = attendances.map(a => ({
      tipo: a.tipo,
      fecha: moment.utc(a.fecha).tz('America/Lima')
    }));

    registros.sort((a, b) => a.fecha.valueOf() - b.fecha.valueOf());

    let entradaActual: moment.Moment | null = null;
    let totalHorasTrabajadas = 0;

    const resumenPorDia = new Map<string, {
      horas: number;
      primeraEntrada: moment.Moment | null;
      ultimaSalida: moment.Moment | null;
    }>();

    for (const r of registros) {

      if (r.tipo === 'entrada') {
        entradaActual = r.fecha;
        continue;
      }

      if (r.tipo === 'salida' && entradaActual) {

        const salida = r.fecha;

        let horas = salida.diff(entradaActual, 'hours', true);

        // 🔒 Validación real
        if (horas <= 0 || horas > 16) {
          entradaActual = null;
          continue;
        }

        totalHorasTrabajadas += horas;

        // 🔥 CLAVE: usar fecha REAL de Perú
        const fechaLaboral = entradaActual.format('YYYY-MM-DD');

        if (!resumenPorDia.has(fechaLaboral)) {
          resumenPorDia.set(fechaLaboral, {
            horas: 0,
            primeraEntrada: entradaActual,
            ultimaSalida: salida,
          });
        }

        const dia = resumenPorDia.get(fechaLaboral)!;

        dia.horas += horas;

        if (!dia.primeraEntrada || entradaActual.isBefore(dia.primeraEntrada)) {
          dia.primeraEntrada = entradaActual;
        }

        if (!dia.ultimaSalida || salida.isAfter(dia.ultimaSalida)) {
          dia.ultimaSalida = salida;
        }

        entradaActual = null;
      }
    }

    const detalles: SalaryDetailDto[] = [];

    for (const [fecha, data] of resumenPorDia.entries()) {

      const horasTrabajadas = data.horas;

      const ingresoEsperado = moment.tz(
        `${fecha} ${user.hora_ingreso}`,
        'YYYY-MM-DD HH:mm:ss',
        'America/Lima'
      );
      const salidaEsperada = moment.tz(
        `${fecha} ${user.hora_salida}`,
        'YYYY-MM-DD HH:mm:ss',
        'America/Lima'
      );

      const horasEsperadas = salidaEsperada.diff(ingresoEsperado, 'hours', true);

      const entradaReal = data.primeraEntrada;
      const salidaReal = data.ultimaSalida;

      let tardanza = 0;

      if (entradaReal && entradaReal.isAfter(ingresoEsperado)) {
        tardanza = entradaReal.diff(ingresoEsperado, 'minutes');
      }

      // 🔥 HORAS EXTRAS CORRECTAS
      const horasExtras = Math.max(0, horasTrabajadas - horasEsperadas);

      // 🔥 PAGO CORRECTO
      let pagoDia = 0;

      if (horasTrabajadas > 0) {
        pagoDia = salarioPorDia * (horasTrabajadas / horasEsperadas);
      }

      detalles.push({
        fecha,
        hora_entrada: entradaReal ? entradaReal.format('YYYY-MM-DD HH:mm:ss') : null,
        hora_salida: salidaReal ? salidaReal.format('YYYY-MM-DD HH:mm:ss') : null,
        horas_trabajadas: Number(horasTrabajadas.toFixed(2)),
        salario_por_dia: Number(pagoDia.toFixed(2)),
        tardanza_minutos: tardanza,
        horas_extras: Number(horasExtras.toFixed(2)),
        horas_esperadas: Number(horasEsperadas.toFixed(2)),
      });
    }

    // 🔥 FALTAS
    const diasDelMes = moment(
      `${year}-${String(month).padStart(2, '0')}`,
      'YYYY-MM'
    ).daysInMonth();

    for (let d = 1; d <= diasDelMes; d++) {

      const fecha = moment(`${year}-${month}-${d}`, 'YYYY-MM-DD').format('YYYY-MM-DD');

      if (!resumenPorDia.has(fecha)) {

        detalles.push({
          fecha,
          hora_entrada: null,
          hora_salida: null,
          horas_trabajadas: 0,
          salario_por_dia: 0,
          tardanza_minutos: 0,
          horas_extras: 0,
          horas_esperadas: 9,
        });
      }
    }

    detalles.sort((a, b) => a.fecha.localeCompare(b.fecha));

    const totalSalario = Number(
      detalles.reduce((acc, d) => acc + d.salario_por_dia, 0).toFixed(2)
    );

    return {
      userId,
      month,
      year,
      totalHoras: Number(totalHorasTrabajadas.toFixed(2)),
      totalSalario,
      detalles,
    };
  }
}
