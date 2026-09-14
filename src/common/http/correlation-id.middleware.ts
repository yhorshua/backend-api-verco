import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

const httpLogger = new Logger('HTTP');

export function correlationIdMiddleware(
  request: Request & { correlationId?: string },
  response: Response,
  next: NextFunction,
) {
  const incoming = Array.isArray(request.headers['x-correlation-id'])
    ? request.headers['x-correlation-id'][0]
    : request.headers['x-correlation-id'];
  const safeIncoming = incoming
    ?.trim()
    .replace(/[^a-zA-Z0-9._:-]/g, '')
    .slice(0, 64);
  const correlationId = safeIncoming || randomUUID();
  request.correlationId = correlationId;
  request.headers['x-correlation-id'] = correlationId;
  response.setHeader('x-correlation-id', correlationId);
  const startedAt = Date.now();
  httpLogger.log(JSON.stringify({
    event: 'request.start',
    correlationId,
    method: request.method,
    endpoint: request.originalUrl || request.url,
  }));
  response.on('finish', () => {
    const trackedRequest = request as Request & {
      requestLoggingHandled?: boolean;
      user?: { userId?: number; warehouseId?: number };
    };
    if (trackedRequest.requestLoggingHandled) return;
    httpLogger.log(JSON.stringify({
      event: 'request.end',
      correlationId,
      method: request.method,
      endpoint: request.originalUrl || request.url,
      userId: trackedRequest.user?.userId ?? null,
      warehouseId: trackedRequest.user?.warehouseId ?? null,
      statusCode: response.statusCode,
      errorCode: response.statusCode >= 400 ? `HTTP_${response.statusCode}` : null,
      durationMs: Date.now() - startedAt,
      result: response.statusCode >= 400 ? 'error' : 'success',
    }));
  });
  next();
}
