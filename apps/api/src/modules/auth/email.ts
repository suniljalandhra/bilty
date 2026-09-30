import type { AuthConfig } from './config';
import { hashToken } from './tokens';
export type AuthEmailKind = 'verification' | 'reset';
export interface AuthMailer {
  send(kind: AuthEmailKind, email: string, token: string): Promise<void>;
}

/** Only the development/test console transport emits token-bearing links. */
export class AuthEmailSender implements AuthMailer {
  constructor(
    private readonly config: AuthConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  async send(kind: AuthEmailKind, email: string, token: string): Promise<void> {
    const verification = kind === 'verification';
    const subject = verification ? 'Verify your Bilty account' : 'Reset your Bilty password';
    const url = new URL(
      verification ? '/verify-email' : '/reset-password',
      this.config.FRONTEND_URL,
    );
    url.searchParams.set('token', token);
    const expiry = verification ? '24 hours' : '1 hour';
    const text = `${subject}\n\nOpen this link to continue:\n${url.href}\n\nThis link expires in ${expiry}. If you did not request this email, you can ignore it.`;
    if (this.config.EMAIL_PROVIDER === 'console') {
      if (this.config.NODE_ENV === 'production')
        throw new Error('Console email is disabled in production');
      console.log(`[Development email] To: ${email}\n${text}`);
      return;
    }
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
      );
    try {
      const response = await this.request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `auth-${kind}-${hashToken(token)}`,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          from: `Bilty <${this.config.EMAIL_FROM}>`,
          to: [email],
          subject,
          text,
          html: `<h1>${subject}</h1><p><a href="${escape(url.href)}">${subject}</a></p><p>This link expires in ${expiry}.</p><p>If you did not request this email, you can ignore it.</p>`,
        }),
      });
      if (!response.ok) throw new Error('Provider rejected email');
      const result = (await response.json()) as { id?: unknown };
      if (typeof result?.id !== 'string' || !result.id) throw new Error('Missing delivery ID');
    } catch {
      // Never propagate provider bodies, credentials, email addresses or bearer links.
      throw new Error('Authentication email delivery failed');
    }
  }
}
