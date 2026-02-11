import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../database/entities/marcacion.entity';
import { User } from '../database/entities/user.entity';

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
            where: { id: userId }, // Se debe usar `where` para proporcionar la condición de búsqueda
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

        const attendance = this.attendanceRepository.create({
            user,
            fecha: new Date(),
            tipo: type,
            ubicacion,
        });

        if (type === 'entrada') {
            attendance.hora_entrada = new Date();
        } else if (type === 'salida' && lastAttendance) {
            lastAttendance.hora_salida = new Date();
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
