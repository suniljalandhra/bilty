'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_URL, errorMessage, publicApi } from '@/lib/api';
import { Brand, ErrorNotice, Loading } from '@/components/ui';
function Invitation() {
  const token = useSearchParams().get('token') || '';
  const [invite, setInvite] = useState<{ email: string; role: string } | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!token) {
      setError('This invitation link is incomplete. Ask your administrator for a new link.');
      setLoading(false);
      return;
    }
    publicApi<{ email: string; role: string }>(`/invites/verify/${encodeURIComponent(token)}`)
      .then((value) => {
        if (active) setInvite(value);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <Brand />
        <div className="auth-card">
          <div className="eyebrow">YOU’RE INVITED</div>
          <h1>Join your team</h1>
          {loading ? (
            <Loading text="Checking your invitation…" />
          ) : error ? (
            <>
              <ErrorNotice message={error} />
              <p>
                Expired, used, or revoked invitations need to be replaced by your administrator.
              </p>
              <Link href="/login">Back to sign in</Link>
            </>
          ) : (
            invite && (
              <>
                <p>
                  An invitation is ready for <strong>{invite.email}</strong> to join as{' '}
                  {invite.role === 'admin' ? 'an administrator' : 'a team member'}.
                </p>
                <a
                  className="button primary full-width"
                  href={`${API_URL}/auth/google?invite=${encodeURIComponent(token)}`}
                >
                  Accept with Google
                </a>
                <p className="auth-hint">
                  Choose the Google account matching the invited email address.
                </p>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
export default function InvitePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Invitation />
    </Suspense>
  );
}
