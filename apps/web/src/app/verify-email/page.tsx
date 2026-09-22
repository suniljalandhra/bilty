'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brand, ErrorNotice, Loading } from '@/components/ui';
import { errorMessage, json, publicApi, refreshSession } from '@/lib/api';
import { useSession } from '@/components/session';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { reload } = useSession();
  const [error, setError] = useState('');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) {
      setError('This verification link is incomplete.');
      return;
    }
    void publicApi('/auth/verify-email', json('POST', { token }))
      .then(async () => {
        await refreshSession(true);
        const session = await reload();
        router.replace(session?.onboardingRequired ? '/onboarding' : '/biltys');
      })
      .catch((failure) => setError(errorMessage(failure)));
  }, [reload, router]);
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <Brand />
        <div className="auth-card">
          <div className="eyebrow">VERIFY YOUR EMAIL</div>
          <h1>{error ? 'We couldn’t verify this link.' : 'Confirming your account…'}</h1>
          {error ? (
            <>
              <ErrorNotice message={error} />
              <div className="auth-links auth-links-single">
                <Link href="/login">Back to sign in</Link>
              </div>
            </>
          ) : (
            <Loading text="Verifying your email…" />
          )}
        </div>
      </div>
    </div>
  );
}
