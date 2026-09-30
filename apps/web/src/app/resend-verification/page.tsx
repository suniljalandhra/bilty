'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Brand, ErrorNotice, Notice, TextField } from '@/components/ui';
import { errorMessage, json, publicApi } from '@/lib/api';

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await publicApi('/auth/resend-verification', json('POST', { email }));
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
          <div className="eyebrow">VERIFY YOUR EMAIL</div>
          <h1>Send a fresh verification link.</h1>
          <p>Enter the email address you used to create your Bilty account.</p>
          {sent ? (
            <Notice>
              If eligible, you will receive a verification link. Check your spam folder too. If no
              email arrives, try again later.
            </Notice>
          ) : (
            <form className="auth-form" onSubmit={(event) => void submit(event)}>
              <ErrorNotice message={error} />
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button className="button primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send verification link'}
              </button>
            </form>
          )}
          <div className="auth-links auth-links-single">
            <Link href="/login">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
