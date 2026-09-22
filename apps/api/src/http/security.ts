import {
  Catch,
  ForbiddenException,
  HttpException,
  SetMetadata,
  UnauthorizedException,
  type ArgumentsHost,
  type CanActivate,
  type ExecutionContext,
  type ExceptionFilter,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { BiltyError } from '../modules/bilty/errors';
import type { AuthService } from '../modules/auth/auth.service';
import type { Principal } from '../modules/auth/access';
import type { AuthConfig } from '../modules/auth/config';
export type AuthedRequest = Request & { principal: Principal };
export const Public = () => SetMetadata('public', true);
export class AuthGuard implements CanActivate {
  private readonly reflector = new Reflector();
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride('public', [context.getHandler(), context.getClass()]))
      return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!bearer) throw new UnauthorizedException('Bearer access token required');
    req.principal = await this.auth.authenticate(bearer);
    return true;
  }
}
export function requireOrigin(req: Request, config: AuthConfig) {
  if (req.headers.origin !== config.FRONTEND_URL)
    throw new ForbiddenException('Trusted frontend Origin required');
}
export function cookie(req: Request, name: string): string {
  const raw = req.headers.cookie
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + '='))
    ?.slice(name.length + 1);
  try {
    return raw ? decodeURIComponent(raw) : '';
  } catch {
    return '';
  }
}
export function cookieOptions(config: AuthConfig) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/auth',
  };
}
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500,
      message = 'Internal server error';
    if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.message;
    } else if (error instanceof ZodError) {
      status = 400;
      message =
        'Invalid request: ' +
        error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ');
    } else if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      status = 413;
      message = 'Request body exceeds 256KB';
    } else if (error instanceof BiltyError) {
      status = { VALIDATION: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 }[error.code];
      message = error.message;
    } else if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      ['23505', '40001', '40P01'].includes(String(error.code))
    ) {
      status = 409;
      message = 'Concurrent or conflicting change; reload and retry';
    }
    res.status(status).json({ statusCode: status, message });
  }
}
