import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureMyProfile } from '@/lib/supabase/ensure-profile';
import { CATEGORY_LABELS_RU, type Category } from '@/lib/mock/data';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import RequestWizard from '@/components/features/RequestWizard';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Создать заявку' : 'Creează cerere' };
}

export default async function NewRequestPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { category } = await searchParams;
  const initialCategory = category && Object.keys(CATEGORY_LABELS_RU).includes(category) ? category as Category : undefined;
  const destination = `/${locale}/request/new${initialCategory ? `?category=${initialCategory}` : ''}`;
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth?next=${encodeURIComponent(destination)}`);
  const profile = await ensureMyProfile(supabase,user);
  if (!profile.name) redirect(`/${locale}/onboarding`);
  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', padding: '32px 0 80px' }}>
        <div className="container">
          <div className="mb-6">
            <h1
              className="font-bold text-2xl"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
            >
              {locale === 'ru' ? 'Создать заявку' : 'Creează cerere'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {locale === 'ru' ? 'Бесплатный пилот · Бельцы' : 'Pilot gratuit · Bălți'}
            </p>
          </div>
          <RequestWizard locale={locale} initialCategory={initialCategory} />
        </div>
      </main>
      <Footer />
    </>
  );
}
