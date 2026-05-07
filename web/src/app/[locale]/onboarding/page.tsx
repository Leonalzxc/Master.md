import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import OnboardingWizard from '@/components/features/OnboardingWizard';
import type { Profile } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Регистрация' : 'Înregistrare' };
}

export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  // Already completed onboarding → go to account
  const { data: rawProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const profile = rawProfile as Profile | null;
  if (profile?.name) redirect(`/${locale}/account`);

  return (
    <>
      <Header />
      <main
        className="flex-1 flex items-start justify-center"
        style={{ background: 'var(--bg-deep)', padding: '40px 16px 64px' }}
      >
        <OnboardingWizard locale={locale} userId={user.id} />
      </main>
    </>
  );
}
