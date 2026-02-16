import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Attendance } from '../database/entities/marcacion.entity';
import { User } from '../database/entities/user.entity';
import moment from 'moment-timezone'; // Importa moment-timezone

@Injectable()
export class AttendanceService {
    constructor(
        @InjectRepository(Attendance)
        private attendanceRepository: Repository<Attendance>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    // Método para marcar la entrada o salida
    async markAttendance(userId: number, type: 'entrada' | 'salida', ubicacion: string): Promise<Attendance> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        // Obtiene la fecha y hora actual en la zona horaria de Lima
        const fechaLima = moment().tz('America/Lima').toDate(); // Obtiene la fecha como objeto Date

        // Crear un nuevo registro de asistencia cada vez que se registre entrada o salida
        const attendance = this.attendanceRepository.create({
            user,
            fecha: fechaLima, // Asigna la fecha con la zona horaria de Lima
            tipo: type,
            ubicacion,
        });

        if (type === 'entrada') {
            attendance.hora_entrada = fechaLima; // Asigna hora de entrada en Lima
        } else if (type === 'salida') {
            attendance.hora_salida = fechaLima; // Asigna hora de salida en Lima
        }

        // Guardar el nuevo registro de asistencia
        return await this.attendanceRepository.save(attendance);
    }

    // Método para obtener las asistencias de un empleado
    async getAttendanceByUser(userId: number): Promise<Attendance[]> {
        return await this.attendanceRepository.find({ where: { user: { id: userId } }, order: { fecha: 'DESC' } });
    }

    async hasUserEnteredToday(userId: number): Promise<{ userId: number, tipo: string } | null> {
        // Obtiene la fecha actual en Lima
        const today = moment().tz('America/Lima').startOf('day').toDate();

        // Buscar si ya hay un registro de entrada para este usuario en el día de hoy
        const attendance = await this.attendanceRepository.findOne({
            where: {
                user: { id: userId },
                tipo: 'entrada',
                fecha: MoreThanOrEqual(today),  // Usa MoreThanOrEqual para comparar con la fecha de hoy
            },
            order: { fecha: 'DESC' }, // Si hay varios, obtenemos el último
        });

        // Si se encuentra un registro de entrada, devolvemos la información del usuario y tipo de entrada
        if (attendance) {
            return {
                userId: attendance.user.id,
                tipo: attendance.tipo,
            };
        }

        // Si no hay un registro, devolvemos null
        return null;
    }

}
