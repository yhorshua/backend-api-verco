import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

 @Post('login')
async login(@Body() body: { email: string; password: string }) {
  const user = await this.authService.validateUser(body.email, body.password);
  if (!user) {
    throw new UnauthorizedException('Correo o contraseña incorrecta');
  }
  // Aquí llamamos al método login que genera el JWT
  return this.authService.login(user);
}

}
