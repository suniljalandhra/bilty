import { OAuth2Client } from 'google-auth-library';
import { createHash } from 'node:crypto';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import type { AuthConfig } from './config';
import { hashToken } from './tokens';
export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  avatarUrl: string;
}
export interface GoogleProvider {
  authorizationUrl(state: string, nonce: string, verifier: string): string;
  exchange(code: string, verifier: string, nonceHash: string): Promise<GoogleIdentity>;
}
export function verifiedIdentity(raw: unknown, nonceHash: string): GoogleIdentity {
  const parsed = z
    .object({
      sub: z.string().min(1).max(255),
      email: z.string().trim().toLowerCase().pipe(z.email()),
      email_verified: z.literal(true),
      nonce: z.string(),
      name: z.string().max(2000).default(''),
      picture: z.string().max(2000).default(''),
    })
    .safeParse(raw);
  if (!parsed.success || hashToken(parsed.data.nonce) !== nonceHash)
    throw new UnauthorizedException('Invalid Google identity');
  return {
    sub: parsed.data.sub,
    email: parsed.data.email,
    name: parsed.data.name,
    avatarUrl: parsed.data.picture,
  };
}
export class GoogleOAuthProvider implements GoogleProvider {
  private readonly client: OAuth2Client;
  constructor(private readonly config: AuthConfig) {
    this.client = new OAuth2Client(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      config.GOOGLE_CALLBACK_URL,
    );
  }
  authorizationUrl(state: string, nonce: string, verifier: string) {
    if (!this.config.GOOGLE_CLIENT_ID || !this.config.GOOGLE_CLIENT_SECRET)
      throw new ServiceUnavailableException(
        'Google sign-in is not configured. Ask your administrator.',
      );
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: this.config.GOOGLE_CLIENT_ID,
      redirect_uri: this.config.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }
  async exchange(code: string, verifier: string, nonceHash: string) {
    try {
      const { tokens } = await this.client.getToken({
        code,
        codeVerifier: verifier,
        redirect_uri: this.config.GOOGLE_CALLBACK_URL,
      });
      if (!tokens.id_token) throw new Error('Missing identity');
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.config.GOOGLE_CLIENT_ID,
      });
      return verifiedIdentity(ticket.getPayload(), nonceHash);
    } catch {
      throw new UnauthorizedException('Google sign-in failed');
    }
  }
}
