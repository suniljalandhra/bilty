'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_URL, errorMessage, json, publicApi, refreshSession } from '@/lib/api';
import { useSession } from '@/components/session';
import { Brand, ErrorNotice, Notice, TextField } from '@/components/ui';
export default function LoginPage() {
  const { user, error, reload } = useSession(),
    router = useRouter();
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('error') === 'sign_in_failed')
      setLoginError(
        'Sign-in expired or was cancelled, or your invitation is unavailable. Try signing in again, or open the correct invitation link.',
      );
    if (query.get('password_reset') === '1')
      setNotice('Password updated. Sign in with your new password.');
  }, []);
  useEffect(() => {
    void publicApi<{ googleConfigured: boolean }>('/health')
      .then((health) => setGoogleConfigured(health.googleConfigured))
      .catch(() => setGoogleConfigured(null));
  }, []);
  useEffect(() => {
    if (user) router.replace(user.onboardingRequired ? '/onboarding' : '/biltys');
  }, [user, router]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError('');
    try {
      await publicApi('/auth/login', json('POST', { email, password }));
      await refreshSession(true);
      const session = await reload();
      router.replace(session?.onboardingRequired ? '/onboarding' : '/biltys');
    } catch (failure) {
      setLoginError(errorMessage(failure));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <Brand />
        <div className="auth-card">
          <div className="eyebrow">WELCOME TO YOUR WORKSPACE</div>
          <h1>
            Your bilty book.
            <br />
            Ready for the road.
          </h1>
          <p>
            Create, manage, and share transport documents with your team. One clear record for every
            journey.
          </p>
          {notice && <Notice>{notice}</Notice>}
          <ErrorNotice message={loginError || error} />
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="auth-links">
            <Link href="/register">Create an account</Link>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <div className="auth-links auth-links-single">
            <Link href="/resend-verification">Resend verification email</Link>
          </div>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <a
            className={`button google-button ${googleConfigured === false ? 'disabled' : ''}`}
            aria-disabled={googleConfigured === false}
            href={googleConfigured === false ? undefined : `${API_URL}/auth/google`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                fill="#4285F4"
                d="M22 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.6a4.8 4.8 0 0 1-2.1 3.2v2.6h3.4C20.9 18.1 22 15.5 22 12.2Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.9-4.3H2.6v2.7A10.4 10.4 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.1 13.6a6.4 6.4 0 0 1 0-3.2V7.7H2.6a10 10 0 0 0 0 8.6l3.5-2.7Z"
              />
              <path
                fill="#EA4335"
                d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2a10.4 10.4 0 0 0-9.4 5.7l3.5 2.7C7 7.9 9.3 6.1 12 6.1Z"
              />
            </svg>
            Continue with Google
          </a>
          {googleConfigured === false && (
            <ErrorNotice message="Google sign-in is not configured yet. Ask your administrator." />
          )}
          <p className="auth-hint">
            Joining a team? Sign in with the email address that received the invitation.
          </p>
        </div>
        <div className="auth-footer">
          <span>Private to your company</span>
          <span>Simple. Organized. On the move.</span>
        </div>
      </div>
    </div>
  );
}
