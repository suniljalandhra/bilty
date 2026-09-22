import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { z } from 'zod';
import type { AuthConfig } from './config';
import type { GoogleProvider } from './google';
import { hashToken, opaqueToken, tokenPattern, TokenService } from './tokens';
import { hashPassword, verifyPassword } from './password';
import type { Principal } from './access';
import { parseCompany } from '../bilty/validation';
export const numberPrefix = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9/._-]+$/);
const onboarding = z.strictObject({ profile: z.unknown(), numberPrefix });
export class AuthService {
  readonly tokens: TokenService;
  constructor(
    private readonly db: DataSource,
    private readonly config: AuthConfig,
    private readonly google: GoogleProvider,
  ) {
    this.tokens = new TokenService(config);
  }
  async beginLogin(invite?: string) {
    if (invite && !tokenPattern.test(invite)) throw new BadRequestException('Invalid invitation');
    const state = opaqueToken(),
      browserToken = opaqueToken(),
      nonce = opaqueToken(),
      verifier = opaqueToken();
    await this.db.query('DELETE FROM oauth_states WHERE expires_at<=now()');
    await this.db.query(
      "INSERT INTO oauth_states(state_hash,browser_hash,nonce_hash,code_verifier,invite_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')",
      [
        hashToken(state),
        hashToken(browserToken),
        hashToken(nonce),
        verifier,
        invite ? hashToken(invite) : null,
      ],
    );
    return { url: this.google.authorizationUrl(state, nonce, verifier), browserToken };
  }
  async discardLogin(state: string, browser: string): Promise<void> {
    if (!tokenPattern.test(state) || !tokenPattern.test(browser)) return;
    await this.db.query('DELETE FROM oauth_states WHERE state_hash=$1 AND browser_hash=$2', [
      hashToken(state),
      hashToken(browser),
    ]);
  }
  async finishLogin(state: string, browser: string, code: string) {
    if (!tokenPattern.test(state) || !tokenPattern.test(browser) || !code || code.length > 8192)
      throw new UnauthorizedException('Invalid OAuth callback');
    const [rows] = await this.db.query(
      'DELETE FROM oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING *',
      [hashToken(state), hashToken(browser)],
    );
    const flow = rows[0];
    if (!flow) throw new UnauthorizedException('OAuth state expired or already used');
    const identity = await this.google.exchange(code, flow.code_verifier, flow.nonce_hash);
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1))', [identity.sub]);
      let [user] = await tx.query('SELECT id FROM users WHERE google_sub=$1 FOR UPDATE', [
        identity.sub,
      ]);
      if (!user) {
        const existing = await tx.query('SELECT id FROM users WHERE email=$1', [identity.email]);
        if (existing.length) throw new ConflictException('Email belongs to another identity');
        user = { id: randomUUID() };
        await tx.query(
          'INSERT INTO users(id,google_sub,email,name,avatar_url) VALUES($1,$2,$3,$4,$5)',
          [user.id, identity.sub, identity.email, identity.name, identity.avatarUrl],
        );
      } else {
        await tx.query(
          'UPDATE users SET email=$2,name=$3,avatar_url=$4,updated_at=now() WHERE id=$1',
          [user.id, identity.email, identity.name, identity.avatarUrl],
        );
      }
      const [member] = await tx.query('SELECT * FROM memberships WHERE user_id=$1 FOR UPDATE', [
        user.id,
      ]);
      if (flow.invite_hash) {
        const [invite] = await tx.query(
          'SELECT * FROM invites WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE',
          [flow.invite_hash],
        );
        if (!invite || invite.email !== identity.email)
          throw new ForbiddenException('Invitation unavailable or email mismatch');
        if (member && (member.company_id !== invite.company_id || member.active))
          throw new ConflictException('User already belongs to a company');
        if (member)
          await tx.query(
            'UPDATE memberships SET active=true,role=$2,revoked_at=NULL,joined_at=now() WHERE user_id=$1',
            [user.id, invite.role],
          );
        else
          await tx.query('INSERT INTO memberships(user_id,company_id,role) VALUES($1,$2,$3)', [
            user.id,
            invite.company_id,
            invite.role,
          ]);
        await tx.query('UPDATE invites SET accepted_at=now() WHERE id=$1', [invite.id]);
      } else if (member && !member.active)
        throw new ForbiddenException('Membership revoked; a new invitation is required');
      return this.createSession(tx, user.id);
    });
  }
  private async createSession(tx: EntityManager, userId: string) {
    const sid = randomUUID();
    const rows = await tx.query(
      "INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '7 days') RETURNING expires_at",
      [sid, userId],
    );
    return this.mint(tx, userId, sid, rows[0].expires_at);
  }
  private async mint(tx: EntityManager, userId: string, sid: string, expiresAt: Date) {
    const refreshToken = opaqueToken();
    await tx.query('INSERT INTO refresh_tokens(token_hash,session_id) VALUES($1,$2)', [
      hashToken(refreshToken),
      sid,
    ]);
    return {
      accessToken: this.tokens.sign(userId, sid),
      refreshToken,
      expiresAt: expiresAt.toISOString(),
    };
  }
  async authenticate(accessToken: string): Promise<Principal> {
    const claims = this.tokens.verify(accessToken);
    const [row] = await this.db.query(
      `SELECT s.user_id,m.company_id,m.role,m.active FROM sessions s LEFT JOIN memberships m ON m.user_id=s.user_id
      WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>now()`,
      [claims.sid, claims.sub],
    );
    if (!row) throw new UnauthorizedException('Session expired or revoked');
    if (row.active === false) throw new ForbiddenException('Membership revoked');
    return {
      userId: row.user_id,
      sessionId: claims.sid,
      companyId: row.company_id ?? null,
      role: row.role ?? null,
    };
  }
  async me(p: Principal) {
    const [user] = await this.db.query(
      'SELECT id,email,name,avatar_url AS "avatarUrl" FROM users WHERE id=$1',
      [p.userId],
    );
    return { ...user, companyId: p.companyId, role: p.role, onboardingRequired: !p.companyId };
  }
  async onboard(p: Principal, raw: unknown) {
    const input = onboarding.parse(raw);
    const profile = parseCompany(input.profile);
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [p.userId]);
      const sessions = await tx.query(
        'SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now() FOR SHARE',
        [p.sessionId, p.userId],
      );
      if (!sessions.length) throw new UnauthorizedException();
      const members = await tx.query('SELECT user_id FROM memberships WHERE user_id=$1', [
        p.userId,
      ]);
      if (members.length) throw new ConflictException('Company membership already exists');
      const companyId = randomUUID();
      await tx.query('INSERT INTO companies(id,profile,number_prefix) VALUES($1,$2,$3)', [
        companyId,
        profile,
        input.numberPrefix,
      ]);
      await tx.query("INSERT INTO memberships(user_id,company_id,role) VALUES($1,$2,'admin')", [
        p.userId,
        companyId,
      ]);
      return { companyId, profile, numberPrefix: input.numberPrefix };
    });
  }
  async refresh(token: string) {
    if (!tokenPattern.test(token)) throw new UnauthorizedException('Invalid refresh token');
    const outcome = await this.db.transaction(async (tx) => {
      const [lookup] = await tx.query(
        'SELECT s.user_id,s.id FROM refresh_tokens r JOIN sessions s ON s.id=r.session_id WHERE r.token_hash=$1',
        [hashToken(token)],
      );
      if (!lookup) return null;
      // Membership locks precede session locks, matching administrative revocation.
      const [member] = await tx.query('SELECT active FROM memberships WHERE user_id=$1 FOR SHARE', [
        lookup.user_id,
      ]);
      const [session] = await tx.query(
        'SELECT *,expires_at>now() AS valid FROM sessions WHERE id=$1 FOR UPDATE',
        [lookup.id],
      );
      if (!session || session.revoked_at || !session.valid || member?.active === false) return null;
      const [stored] = await tx.query('SELECT used_at FROM refresh_tokens WHERE token_hash=$1', [
        hashToken(token),
      ]);
      if (stored.used_at) {
        await tx.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [session.id]);
        return null; // Commit revocation before reporting replay to the caller.
      }
      await tx.query('UPDATE refresh_tokens SET used_at=now() WHERE token_hash=$1', [
        hashToken(token),
      ]);
      return this.mint(tx, session.user_id, session.id, session.expires_at);
    });
    if (!outcome) throw new UnauthorizedException('Refresh expired, revoked or reused');
    return outcome;
  }
  async logout(p: Principal, all: boolean) {
    await this.db.query(
      `UPDATE sessions SET revoked_at=now() WHERE user_id=$1${all ? '' : ' AND id=$2'}`,
      all ? [p.userId] : [p.userId, p.sessionId],
    );
  }

  async register(email: string, password: string, name: string): Promise<void> {
    email = email.toLowerCase().trim();
    const passwordHash = await hashPassword(password);

    const delivery = await this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,2))', [email]);
      const [existing] = await tx.query(
        'SELECT id, password_hash, google_sub FROM users WHERE email=$1',
        [email],
      );
      if (existing) return null;

      const userId = randomUUID();
      await tx.query(
        'INSERT INTO users(id, email, name, password_hash, email_verified_at) VALUES($1, $2, $3, $4, NULL)',
        [userId, email, name, passwordHash],
      );

      const token = opaqueToken();
      await tx.query(
        "INSERT INTO email_tokens(user_id, token_hash, type, expires_at) VALUES($1, $2, 'verification', now() + interval '24 hours')",
        [userId, hashToken(token)],
      );
      return { email, token };
    });
    if (delivery) this.logEmail('verification', delivery.email, delivery.token);
  }

  async verifyEmail(token: string) {
    if (!tokenPattern.test(token)) throw new BadRequestException('Invalid verification token');
    return this.db.transaction(async (tx) => {
      const [rows] = await tx.query(
        "DELETE FROM email_tokens WHERE token_hash=$1 AND type='verification' AND used_at IS NULL AND expires_at>now() RETURNING user_id",
        [hashToken(token)],
      );
      const emailToken = rows[0];
      if (!emailToken) throw new BadRequestException('Invalid or expired verification token');
      await tx.query('UPDATE users SET email_verified_at=now(),updated_at=now() WHERE id=$1', [
        emailToken.user_id,
      ]);
      return this.createSession(tx, emailToken.user_id);
    });
  }

  async loginWithPassword(email: string, password: string) {
    email = email.toLowerCase().trim();
    const [user] = await this.db.query(
      'SELECT id,password_hash,email_verified_at FROM users WHERE email=$1',
      [email],
    );
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash)))
      throw new UnauthorizedException('Invalid email or password');
    if (!user.email_verified_at) throw new ForbiddenException('Please verify your email first');
    return this.db.transaction((tx) => this.createSession(tx, user.id));
  }

  async forgotPassword(email: string): Promise<void> {
    email = email.toLowerCase().trim();
    const delivery = await this.db.transaction(async (tx) => {
      const [user] = await tx.query(
        'SELECT id,email FROM users WHERE email=$1 AND password_hash IS NOT NULL FOR UPDATE',
        [email],
      );
      if (!user) return null;
      await tx.query(
        "DELETE FROM email_tokens WHERE user_id=$1 AND type='reset' AND used_at IS NULL",
        [user.id],
      );
      const token = opaqueToken();
      await tx.query(
        "INSERT INTO email_tokens(user_id,token_hash,type,expires_at) VALUES($1,$2,'reset',now()+interval '1 hour')",
        [user.id, hashToken(token)],
      );
      return { email: user.email, token };
    });
    if (delivery) this.logEmail('reset', delivery.email, delivery.token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!tokenPattern.test(token)) throw new BadRequestException('Invalid reset token');
    const passwordHash = await hashPassword(newPassword);
    await this.db.transaction(async (tx) => {
      const [rows] = await tx.query(
        "DELETE FROM email_tokens WHERE token_hash=$1 AND type='reset' AND used_at IS NULL AND expires_at>now() RETURNING user_id",
        [hashToken(token)],
      );
      const emailToken = rows[0];
      if (!emailToken) throw new BadRequestException('Invalid or expired reset token');
      await tx.query('UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1', [
        emailToken.user_id,
        passwordHash,
      ]);
      await tx.query(
        'UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',
        [emailToken.user_id],
      );
    });
  }

  async addPassword(p: Principal, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await this.db.transaction(async (tx) => {
      const [user] = await tx.query(
        'SELECT password_hash,google_sub FROM users WHERE id=$1 FOR UPDATE',
        [p.userId],
      );
      if (!user) throw new UnauthorizedException();
      if (user.password_hash) throw new ConflictException('Password already set');
      if (!user.google_sub) throw new BadRequestException('Google sign-in is required');
      await tx.query(
        'UPDATE users SET password_hash=$2,email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE id=$1',
        [p.userId, passwordHash],
      );
    });
  }

  async resendVerification(email: string): Promise<void> {
    email = email.toLowerCase().trim();
    const delivery = await this.db.transaction(async (tx) => {
      const [user] = await tx.query(
        'SELECT id,email FROM users WHERE email=$1 AND password_hash IS NOT NULL AND email_verified_at IS NULL FOR UPDATE',
        [email],
      );
      if (!user) return null;
      await tx.query(
        "DELETE FROM email_tokens WHERE user_id=$1 AND type='verification' AND used_at IS NULL",
        [user.id],
      );
      const token = opaqueToken();
      await tx.query(
        "INSERT INTO email_tokens(user_id,token_hash,type,expires_at) VALUES($1,$2,'verification',now()+interval '24 hours')",
        [user.id, hashToken(token)],
      );
      return { email: user.email, token };
    });
    if (delivery) this.logEmail('verification', delivery.email, delivery.token);
  }

  private logEmail(type: 'verification' | 'reset', email: string, token: string) {
    const url =
      type === 'verification'
        ? `${this.config.FRONTEND_URL}/verify-email?token=${token}`
        : `${this.config.FRONTEND_URL}/reset-password?token=${token}`;
    const expiry = type === 'verification' ? '24 hours' : '1 hour';
    const subject =
      type === 'verification' ? 'Verify your Bilty account' : 'Reset your Bilty password';

    console.log(`
========================================
${type.toUpperCase()} EMAIL
To: ${email}
========================================
Subject: ${subject}

Click the link below:
${url}

This link expires in ${expiry}.
========================================
`);
  }
}
