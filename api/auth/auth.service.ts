import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService, // ✅ inyecta UsersService
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password_hash))) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role.name_role };
    return {
    access_token: this.jwtService.sign(payload),  // Generar el JWT token
    user: {  // Devolvemos la información completa del usuario con las relaciones necesarias
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      cellphone: user.cellphone,
      address_home: user.address_home,
      id_cedula: user.id_cedula,
      rol_id: user.rol_id,
      role: user.role,  // Incluimos la relación 'role'
      date_register: user.date_register,
      state_user: user.state_user,  // Incluimos la relación 'state_user'
      warehouse_id: user.warehouse_id,
      warehouse: user.warehouse,  // Incluimos la relación 'warehouse'
    },
  };
  }
}
