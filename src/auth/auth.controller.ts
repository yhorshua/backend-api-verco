import { Controller, Post, Body, UnauthorizedException, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

 @Post('login')
 @UseGuards(LoginRateLimitGuard)
async login(@Body() body: LoginDto) {
  const user = await this.authService.validateUser(body.email, body.password);
  if (!user) {
    throw new UnauthorizedException('Correo o contraseña incorrecta');
  }
  // Aquí llamamos al método login que genera el JWT
  return this.authService.login(user);
}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  me(@Req() request: { user: { userId: number; email: string; role: string; warehouseId: number | null } }) {
    return {
      id: request.user.userId,
      email: request.user.email,
      role: request.user.role,
      warehouse_id: request.user.warehouseId,
    };
  }

}
