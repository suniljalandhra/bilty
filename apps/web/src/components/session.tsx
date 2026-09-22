'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiError, errorMessage, onSessionEnded, signOut } from '@/lib/api';
import type { Session } from '@/lib/model';
import { ErrorNotice, Loading } from './ui';
const SessionContext = createContext<{
  user: Session | null;
  loading: boolean;
  error: string;
  reload: () => Promise<Session | null>;
  logout: (all?: boolean) => Promise<void>;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const reload = useCallback(async () => {
    setError('');
    try {
      const result = await api<Session>('/auth/me');
      setUser(result);
      return result;
    } catch (failure) {
      setUser(null);
      if (!(failure instanceof ApiError && failure.status === 401)) setError(errorMessage(failure));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const remove = onSessionEnded(() => {
      setUser(null);
      setLoading(false);
    });
    void reload();
    return remove;
  }, [reload]);
  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        error,
        reload,
        logout: async (all) => {
          await signOut(all);
          setUser(null);
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Session provider missing');
  return session;
}
export function AuthGate({
  children,
  onboarding = false,
}: {
  children: ReactNode;
  onboarding?: boolean;
}) {
  const { user, loading, error, reload } = useSession(),
    router = useRouter(),
    pathname = usePathname();
  useEffect(() => {
    if (loading || error) return;
    if (!user) router.replace('/login');
    else if (user.onboardingRequired && !onboarding) router.replace('/onboarding');
    else if (!user.onboardingRequired && onboarding) router.replace('/biltys');
  }, [loading, error, user, onboarding, router, pathname]);
  if (loading) return <Loading text="Checking your session…" />;
  if (error)
    return (
      <div className="center-state">
        <ErrorNotice message={error} />
        <button onClick={() => void reload()}>Try again</button>
        <a href="/login">Back to sign in</a>
      </div>
    );
  if (!user || user.onboardingRequired !== onboarding)
    return <Loading text="Opening your workspace…" />;
  return children;
}
