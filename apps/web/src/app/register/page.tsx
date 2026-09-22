'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Brand, ErrorNotice, Notice, TextField } from '@/components/ui';
import { errorMessage, json, publicApi } from '@/lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await publicApi('/auth/register', json('POST', { name, email, password }));
      setSent(true);
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
          <div className="eyebrow">CREATE YOUR ACCOUNT</div>
          <h1>Start your digital bilty book.</h1>
          <p>Use your work email. We’ll send a verification link before your first sign-in.</p>
          {sent ? (
            <>
              <Notice>
                Check your inbox for a verification link. For privacy, we show the same message if
                this email is already registered.
              </Notice>
              <div className="auth-links auth-links-single">
                <Link href="/login">Back to sign in</Link>
              </div>
            </>
          ) : (
            <form className="auth-form" onSubmit={(event) => void submit(event)}>
              <ErrorNotice message={error} />
              <TextField
                label="Name"
                autoComplete="name"
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
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
                autoComplete="new-password"
                required
                maxLength={200}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                hint="At least 10 characters with uppercase, lowercase, a number, and a special character."
              />
              <button className="button primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
          {!sent && (
            <div className="auth-links auth-links-single">
              <Link href="/login">Already have an account? Sign in</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
