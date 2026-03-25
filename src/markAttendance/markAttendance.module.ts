import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './markAttendance.controller';
import { AttendanceService } from './markAttendance.service';
import { Attendance } from '../database/entities/marcacion.entity';
import { User } from '../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance, User])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
