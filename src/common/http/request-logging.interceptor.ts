import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startedAt = Date.now();
    const base = {
      correlationId: request.correlationId || request.headers?.['x-correlation-id'],
      method: request.method,
      endpoint: request.originalUrl || request.url,
    };
    request.requestLoggingHandled = true;

    return next.handle().pipe(tap({
      next: () => this.logger.log(JSON.stringify({
        event: 'request.end',
        ...base,
        userId: request.user?.userId ?? null,
        warehouseId: request.user?.warehouseId ?? null,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        result: 'success',
      })),
      error: (error) => this.logger.error(JSON.stringify({
        event: 'request.end',
        ...base,
        userId: request.user?.userId ?? null,
        warehouseId: request.user?.warehouseId ?? null,
        statusCode: error?.status ?? 500,
        errorCode: error?.response?.code ?? error?.code ?? error?.name ?? 'ERROR',
        durationMs: Date.now() - startedAt,
        result: 'error',
      })),
    }));
  }
}
