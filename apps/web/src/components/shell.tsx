'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Company } from '@/lib/model';
import { AuthGate, useSession } from './session';
import { Brand, ErrorNotice } from './ui';
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession(),
    pathname = usePathname();
  const [company, setCompany] = useState<Company | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user?.companyId)
      void api<Company>('/company')
        .then(setCompany)
        .catch(() => {});
  }, [user?.companyId, pathname]);
  return (
    <AuthGate>
      <div className="app-shell">
        <aside className="sidebar">
          <Brand />
          <div className="company-switch">
            <span className="company-avatar">
              {company?.profile.name.slice(0, 2).toUpperCase() || 'CO'}
            </span>
            <div>
              <strong>{company?.profile.name || 'Your company'}</strong>
              <span>{user?.role === 'admin' ? 'Administrator' : 'Team member'}</span>
            </div>
          </div>
          <nav aria-label="Main navigation">
            <Link href="/biltys" className={pathname.startsWith('/biltys') ? 'active' : ''}>
              <span aria-hidden>▤</span>Bilty book
            </Link>
            <Link href="/parties" className={pathname === '/parties' ? 'active' : ''}>
              <span aria-hidden>♧</span>Address book
            </Link>
            <Link href="/settings" className={pathname === '/settings' ? 'active' : ''}>
              <span aria-hidden>⚙</span>Company settings
            </Link>
            {user?.role === 'admin' && (
              <Link href="/team" className={pathname === '/team' ? 'active' : ''}>
                <span aria-hidden>♙</span>Team & access
              </Link>
            )}
          </nav>
          <div className="sidebar-bottom">
            <div className="user-info">
              <span className="user-avatar">{user?.name?.slice(0, 1) || 'U'}</span>
              <div>
                <strong>{user?.name || user?.email}</strong>
                <span>{user?.email}</span>
              </div>
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await logout();
                } catch (failure) {
                  setError(errorMessage(failure));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sign out
            </button>
          </div>
        </aside>
        <div className="main-column">
          <div className="topbar">
            <span className="topbar-title">Your digital bilty book</span>
            <span className="workspace-dot" />
            <span className="workspace-label">Private company workspace</span>
            <button
              className="mobile-signout text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await logout();
                } catch (failure) {
                  setError(errorMessage(failure));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sign out
            </button>
          </div>
          <main className="main-content">
            <ErrorNotice message={error} />
            {children}
          </main>
          <footer className="app-footer">
            Bilty <span>Made for the road ahead.</span>
          </footer>
        </div>
      </div>
    </AuthGate>
  );
}
