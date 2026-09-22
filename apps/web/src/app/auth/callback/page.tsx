'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/session';
import { ErrorNotice, Loading } from '@/components/ui';
export default function CallbackPage() {
  const { user, loading, error, reload } = useSession(),
    router = useRouter();
  useEffect(() => {
    if (!loading && user) router.replace(user.onboardingRequired ? '/onboarding' : '/biltys');
  }, [user, loading, router]);
  if (loading || user) return <Loading text="Completing your sign in…" />;
  return (
    <div className="center-state">
      <h1>Sign in could not be completed</h1>
      <ErrorNotice message={error || 'Your sign-in session has expired. Please sign in again.'} />
      <button onClick={() => void reload()}>Try again</button>
      <Link href="/login">Back to sign in</Link>
    </div>
  );
}
