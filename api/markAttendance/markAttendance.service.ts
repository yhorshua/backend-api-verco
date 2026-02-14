import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

        // Verificar si ya existe un registro de entrada para este usuario
        const lastAttendance = await this.attendanceRepository.findOne({
            where: { user: { id: userId }, tipo: 'entrada' },
            order: { fecha: 'DESC' },
        });

        if (type === 'entrada' && lastAttendance) {
            throw new Error('El usuario ya ha registrado su entrada');
        }

        // Utiliza moment-timezone para obtener la fecha y hora en la zona horaria de Lima
        const fechaLima = moment().tz('America/Lima').toDate(); // Obtiene la fecha como objeto Date

        const attendance = this.attendanceRepository.create({
            user,
            fecha: fechaLima, // Asigna la fecha con la zona horaria de Lima
            tipo: type,
            ubicacion,
        });

        if (type === 'entrada') {
            attendance.hora_entrada = fechaLima; // Asigna hora de entrada en Lima
        } else if (type === 'salida' && lastAttendance) {
            lastAttendance.hora_salida = fechaLima; // Asigna hora de salida en Lima
            await this.attendanceRepository.save(lastAttendance);
            return lastAttendance; // Devolver el registro actualizado
        }

        return await this.attendanceRepository.save(attendance);
    }

    // Método para obtener las asistencias de un empleado
    async getAttendanceByUser(userId: number): Promise<Attendance[]> {
        return await this.attendanceRepository.find({ where: { user: { id: userId } } });
    }
}
