import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    if (info?.name === 'TokenExpiredError') {
      throw new UnauthorizedException('El token ha expirado. Por favor, inicie sesión nuevamente.');
    }

    if (err || !user) {
      throw err || new UnauthorizedException('No se ha proporcionado un token válido.');
    }

    return user;
  }
}
