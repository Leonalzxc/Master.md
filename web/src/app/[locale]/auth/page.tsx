import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AuthForm from '@/components/features/AuthForm';
import { createClient } from '@/lib/supabase/server';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Вход' : 'Autentificare' };
}

export default async function AuthPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { next } = await searchParams;

  // Already logged in → redirect
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(next ?? `/${locale}/account`);

  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-deep)', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="card p-8 flex flex-col gap-6">
            {/* Header */}
            <div className="text-center">
              <div
                className="flex items-center justify-center w-12 h-12 rounded-2xl font-bold text-white text-xl mx-auto mb-4"
                style={{ background: 'var(--accent)', fontFamily: 'var(--font-display)' }}
              >
                M
              </div>
              <h1 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                {locale === 'ru' ? 'Вход в MASTER' : 'Intră în MASTER'}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {locale === 'ru' ? 'Введите номер телефона — отправим код' : 'Introduceți numărul de telefon — vom trimite un cod'}
              </p>
            </div>

            <AuthForm locale={locale} next={next} />

            <p className="text-xs text-center" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {locale === 'ru'
                ? 'Входя, вы соглашаетесь с '
                : 'Prin autentificare, acceptați '}
              <Link href={`/${locale}/legal/terms`} style={{ color: 'var(--accent)' }}>
                {locale === 'ru' ? 'правилами сервиса' : 'termenii serviciului'}
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
