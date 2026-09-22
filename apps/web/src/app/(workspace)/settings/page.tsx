'use client';
import { useEffect, useState } from 'react';
import { api, errorMessage, json } from '@/lib/api';
import type { Company } from '@/lib/model';
import { CompanyForm } from '@/components/company-form';
import { useSession } from '@/components/session';
import { ErrorNotice, Loading, PageHeader, Section } from '@/components/ui';
export default function SettingsPage() {
  const { user, logout } = useSession(),
    [company, setCompany] = useState<Company | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<Company>('/company')
      .then(setCompany)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE"
        title="Company settings"
        description="Your company identity, document appearance and numbering."
      />
      <ErrorNotice message={error} />
      {company ? (
        <CompanyForm
          company={company}
          readOnly={user?.role !== 'admin'}
          onSave={async (profile, numberPrefix) => {
            await api('/company', json('PATCH', { profile, numberPrefix }));
          }}
        />
      ) : (
        !error && <Loading />
      )}
      <Section
        title="Account security"
        description="End your sessions on every device, including this one."
      >
        <button
          disabled={busy}
          onClick={async () => {
            if (!window.confirm('Sign out of Bilty on all devices?')) return;
            setBusy(true);
            try {
              await logout(true);
            } catch (failure) {
              setError(errorMessage(failure));
            } finally {
              setBusy(false);
            }
          }}
        >
          Sign out on all devices
        </button>
      </Section>
    </>
  );
}
