import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './interface'; // Ajusta la ruta según sea necesario

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService, // ✅ inyecta UsersService
    private readonly jwtService: JwtService,
  ) { }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email,);
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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['authorization']?.replace('Bearer ', ''); // Obtener el token

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      // Verificar el token
      const decoded = await this.jwtService.verifyAsync<JwtPayload>(token); // Verificamos el token con jwtService
      request.user = decoded; // Guardamos el payload decodificado en la solicitud (puedes usar esto para acceder a la información del usuario)
      return true; // Token es válido
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
