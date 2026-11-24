import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

@Module({
  imports: [
    UsersModule, // <-- necesario para que AuthService pueda usar UsersService
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET debe existir y contener al menos 32 caracteres');
        }
        return {
          secret,
          signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') || '8h' },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, LoginRateLimitGuard],
  controllers: [AuthController], // <-- CONTROLLER incluido
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

