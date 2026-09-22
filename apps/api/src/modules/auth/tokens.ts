import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import type { AuthConfig } from './config';
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const claims = z.object({ sub: z.uuid(), sid: z.uuid() });
export class TokenService {
  constructor(private readonly config: AuthConfig) {}
  sign(userId: string, sessionId: string) {
    return jwt.sign({ sid: sessionId }, this.config.JWT_SECRET, {
      algorithm: 'HS256',
      subject: userId,
      issuer: 'bilty-api',
      audience: 'bilty-web',
      expiresIn: 900,
    });
  }
  verify(token: string) {
    try {
      return claims.parse(
        jwt.verify(token, this.config.JWT_SECRET, {
          algorithms: ['HS256'],
          issuer: 'bilty-api',
          audience: 'bilty-web',
        }),
      );
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
