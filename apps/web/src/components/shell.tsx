'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ChevronUp,
  ContactRound,
  FileText,
  HelpCircle,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Company } from '@/lib/model';
import { AuthGate, useSession } from './session';
import { Brand, ErrorNotice } from './ui';
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession(),
    pathname = usePathname();
  const [company, setCompany] = useState<Company | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [mobileNavOpen, setMobileNavOpen] = useState(false),
    [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    if (user?.companyId)
      void api<Company>('/company')
        .then(setCompany)
        .catch(() => {});
  }, [user?.companyId, pathname]);
  useEffect(() => {
    setMobileNavOpen(false);
    setProfileOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!profileOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.profile-dropdown')) setProfileOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [profileOpen]);
  return (
    <AuthGate>
      <div className="app-shell">
        {mobileNavOpen && (
          <button
            className="mobile-nav-backdrop"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <aside id="workspace-navigation" className="sidebar">
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
            <div className="nav-label">Workspace</div>
            <Link
              href="/biltys"
              className={pathname.startsWith('/biltys') ? 'active' : ''}
              onClick={() => setMobileNavOpen(false)}
            >
              <FileText aria-hidden="true" />
              <span>Bilty book</span>
            </Link>
            <Link
              href="/parties"
              className={pathname === '/parties' ? 'active' : ''}
              onClick={() => setMobileNavOpen(false)}
            >
              <ContactRound aria-hidden="true" />
              <span>Address book</span>
            </Link>
            <div className="nav-label nav-label-spaced">Administration</div>
            <Link
              href="/settings"
              className={pathname === '/settings' ? 'active' : ''}
              onClick={() => setMobileNavOpen(false)}
            >
              <Settings aria-hidden="true" />
              <span>Company settings</span>
            </Link>
            {user?.role === 'admin' && (
              <Link
                href="/team"
                className={pathname === '/team' ? 'active' : ''}
                onClick={() => setMobileNavOpen(false)}
              >
                <ShieldCheck aria-hidden="true" />
                <span>Team & access</span>
              </Link>
            )}
          </nav>
          <div className="sidebar-bottom">
            <div className={`profile-dropdown ${profileOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="profile-trigger"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                onClick={() => setProfileOpen((open) => !open)}
              >
                <span className="user-avatar">{user?.name?.slice(0, 1) || 'U'}</span>
                <span className="profile-name">{user?.name || 'User'}</span>
                <ChevronUp className="profile-chevron" aria-hidden="true" />
              </button>
              {profileOpen && (
                <div className="profile-menu" role="menu">
                  <div className="profile-menu-header">
                    <span className="user-avatar">{user?.name?.slice(0, 1) || 'U'}</span>
                    <div className="profile-menu-user">
                      <strong>{user?.name || 'User'}</strong>
                      <span>{user?.email}</span>
                    </div>
                  </div>
                  <div className="profile-menu-divider" />
                  <Link
                    href="/settings"
                    className="profile-menu-item"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                  >
                    <User aria-hidden="true" />
                    <span>Profile & settings</span>
                  </Link>
                  <a
                    href="mailto:support@biltybook.com"
                    className="profile-menu-item"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                  >
                    <HelpCircle aria-hidden="true" />
                    <span>Help & support</span>
                  </a>
                  <div className="profile-menu-divider" />
                  <button
                    type="button"
                    className="profile-menu-item"
                    role="menuitem"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setProfileOpen(false);
                      try {
                        await logout();
                      } catch (failure) {
                        setError(errorMessage(failure));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <LogOut aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
        <div className="main-column">
          <div className="topbar">
            <button
              className="mobile-nav-toggle icon-button"
              type="button"
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
            <div className="topbar-spacer" />
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
            <span className="brand-logo">
              <span className="brand-bilty">Bilty</span>
              <span className="brand-book">Book</span>
            </span>
          </footer>
        </div>
      </div>
    </AuthGate>
  );
}
