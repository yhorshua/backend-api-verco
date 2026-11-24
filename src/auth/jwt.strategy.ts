import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { isUserActive } from './user-status';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly usersService: UsersService, configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
        });

    }

    async validate(payload: any) {
        const user = await this.usersService.findOne(Number(payload.sub));
        if (!user || !isUserActive(user.state_user) || !user.role) {
            throw new UnauthorizedException('Usuario inactivo o inexistente');
        }

        return {
            userId: user.id,
            email: user.email,
            role: user.role.name_role,
            warehouseId: user.warehouse_id,
        };
    }
}
