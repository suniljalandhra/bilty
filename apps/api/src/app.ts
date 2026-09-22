import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DataSource } from 'typeorm';
import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './modules/auth/auth.service';
import type { AuthConfig } from './modules/auth/config';
import { GoogleOAuthProvider, type GoogleProvider } from './modules/auth/google';
import { CompanyService } from './modules/company/company.service';
import { PartyService } from './modules/party/party.service';
import { BiltyService } from './modules/bilty/bilty.service';
import {
  AuthController,
  CompanyController,
  InviteController,
  PartyController,
  BiltyController,
  CONFIG,
} from './http/controllers';
import { AuthGuard, ApiErrorFilter, Public } from './http/security';
import { ShareService } from './modules/print/share.service';
import { PrintController } from './http/print.controller';

export async function createApp(
  db: DataSource,
  config: AuthConfig,
  google: GoogleProvider = new GoogleOAuthProvider(config),
) {
  const auth = new AuthService(db, config, google);
  @Controller('health')
  class HealthController {
    @Public() @Get() async health() {
      await db.query('SELECT 1');
      return {
        status: 'ok',
        googleConfigured: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
      };
    }
  }
  @Module({
    controllers: [
      HealthController,
      AuthController,
      CompanyController,
      InviteController,
      PartyController,
      BiltyController,
      PrintController,
    ],
    providers: [
      { provide: ShareService, useValue: new ShareService(db, config) },
      { provide: CONFIG, useValue: config },
      { provide: AuthService, useValue: auth },
      { provide: CompanyService, useValue: new CompanyService(db, config) },
      { provide: PartyService, useValue: new PartyService(db) },
      { provide: BiltyService, useValue: new BiltyService(db) },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: config.NODE_ENV === 'test' ? false : ['error', 'warn', 'log'],
    bodyParser: false,
  });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.useBodyParser('json', { limit: '256kb' });
  app.enableCors({
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const attempts = new Map<string, { count: number; until: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (
      req.path.startsWith('/auth/') ||
      req.path.startsWith('/invites/verify/') ||
      req.path.startsWith('/shared/')
    ) {
      const now = Date.now();
      for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
      const key = req.socket.remoteAddress ?? 'unknown';
      let item = attempts.get(key);
      if (!item) {
        if (attempts.size >= 10000) {
          res.status(429).json({ message: 'Try again later' });
          return;
        }
        item = { count: 0, until: now + 60000 };
        attempts.set(key, item);
      }
      if (++item.count > 120) {
        res.setHeader('Retry-After', String(Math.ceil((item.until - now) / 1000)));
        res.status(429).json({ message: 'Too many authentication requests' });
        return;
      }
    }
    next();
  });
  app.useGlobalGuards(new AuthGuard(auth));
  app.useGlobalFilters(new ApiErrorFilter());
  await app.init();
  return app;
}
