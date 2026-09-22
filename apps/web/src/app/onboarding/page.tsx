'use client';
import { useRouter } from 'next/navigation';
import { api, json } from '@/lib/api';
import { blankCompany } from '@/lib/model';
import { AuthGate, useSession } from '@/components/session';
import { Brand, PageHeader } from '@/components/ui';
import { CompanyForm } from '@/components/company-form';
export default function OnboardingPage() {
  const router = useRouter(),
    { reload } = useSession();
  return (
    <AuthGate onboarding>
      <main className="onboarding">
        <Brand />
        <PageHeader
          eyebrow="LET’S GET YOU SET UP"
          title="A home for your company’s biltys"
          description="Add your company details now. You can update them in settings any time."
        />
        <CompanyForm
          onboarding
          company={{ id: '', profile: blankCompany(), numberPrefix: 'BL/', nextNumber: '1' }}
          onSave={async (profile, numberPrefix) => {
            await api('/auth/onboard', json('POST', { profile, numberPrefix }));
            await reload();
            router.replace('/biltys');
          }}
        />
      </main>
    </AuthGate>
  );
}
