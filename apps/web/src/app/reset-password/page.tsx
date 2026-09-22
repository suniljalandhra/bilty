'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brand, ErrorNotice, TextField } from '@/components/ui';
import { errorMessage, json, publicApi } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') || ''), []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This reset link is incomplete. Request a new one.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await publicApi('/auth/reset-password', json('POST', { token, password }));
      router.replace('/login?password_reset=1');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <Brand />
        <div className="auth-card">
          <div className="eyebrow">CHOOSE A NEW PASSWORD</div>
          <h1>Secure your account.</h1>
          <p>
            This reset link can be used once. Updating your password signs out all existing
            sessions.
          </p>
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <ErrorNotice message={error} />
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="At least 10 characters with uppercase, lowercase, a number, and a special character."
            />
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              maxLength={200}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
          <div className="auth-links auth-links-single">
            <Link href="/forgot-password">Request a new link</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
