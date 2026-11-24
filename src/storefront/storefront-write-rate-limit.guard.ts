import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type Counter = { count: number; resetAt: number };

@Injectable()
export class StorefrontWriteRateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const isClaim = request.path.includes('/claims');
    const windowMs = isClaim ? 60 * 60 * 1000 : 10 * 60 * 1000;
    const maximum = isClaim ? 5 : 20;
    const key = `${request.ip}:${isClaim ? 'claim' : 'order'}`;
    const now = Date.now();
    const current = this.counters.get(key);

    if (!current || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    current.count += 1;
    if (current.count > maximum) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      throw new HttpException(
        { statusCode: 429, message: 'Has realizado demasiadas solicitudes. Intenta nuevamente más tarde.', retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
