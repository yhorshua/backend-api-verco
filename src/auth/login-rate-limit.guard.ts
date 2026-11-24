import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type Attempt = { count: number; resetAt: number };

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, Attempt>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maximum = 10;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const email = String((request.body as { email?: unknown })?.email ?? '')
      .trim()
      .toLowerCase()
      .slice(0, 160);
    const key = `${request.ip}:${email}`;
    const now = Date.now();
    const current = this.attempts.get(key);

    if (!current || current.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      this.cleanup(now);
      return true;
    }

    current.count += 1;
    if (current.count > this.maximum) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      throw new HttpException(
        { statusCode: 429, message: 'Demasiados intentos. Intenta nuevamente más tarde.', retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private cleanup(now: number) {
    if (this.attempts.size < 2_000) return;
    for (const [key, value] of this.attempts) {
      if (value.resetAt <= now) this.attempts.delete(key);
    }
  }
}
