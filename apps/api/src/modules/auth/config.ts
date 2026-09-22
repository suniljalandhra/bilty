import { z } from 'zod';
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const c = z
    .object({
      DATABASE_URL: z.string().startsWith('postgres'),
      GOOGLE_CLIENT_ID: z.string().default(''),
      GOOGLE_CLIENT_SECRET: z.string().default(''),
      GOOGLE_CALLBACK_URL: z.url(),
      FRONTEND_URL: z.url(),
      PUBLIC_API_URL: z.url().optional(),
      JWT_SECRET: z.string().min(32),
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    })
    .parse(env);
  const front = new URL(c.FRONTEND_URL);
  const callback = new URL(c.GOOGLE_CALLBACK_URL);
  if (
    front.origin !== c.FRONTEND_URL ||
    front.username ||
    front.password ||
    callback.username ||
    callback.password ||
    !['http:', 'https:'].includes(front.protocol) ||
    !['http:', 'https:'].includes(callback.protocol)
  )
    throw new Error('Configure a frontend origin and HTTP(S) callback URL without credentials');
  if (
    c.NODE_ENV === 'production' &&
    (front.protocol !== 'https:' || callback.protocol !== 'https:')
  )
    throw new Error('Production requires HTTPS');
  if (c.PUBLIC_API_URL) {
    const u = new URL(c.PUBLIC_API_URL);
    if (
      u.origin !== c.PUBLIC_API_URL ||
      !['http:', 'https:'].includes(u.protocol) ||
      (c.NODE_ENV === 'production' && u.protocol !== 'https:')
    )
      throw new Error('Invalid public API origin');
  }
  if (c.NODE_ENV === 'production' && (!c.GOOGLE_CLIENT_ID || !c.GOOGLE_CLIENT_SECRET))
    throw new Error('Google OAuth credentials required in production');
  return c;
}
export type AuthConfig = ReturnType<typeof readConfig>;
