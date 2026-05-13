import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProfileForm from '@/components/features/ProfileForm';
import { createClient } from '@/lib/supabase/server';
import type { Profile, ProfileWorker } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Мой профиль' : 'Profilul meu' };
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  const { data: rawProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const profile = rawProfile as (Profile & { telegram_chat_id?: number | null }) | null;
  if (!profile) redirect(`/${locale}/auth`);

  const { data: rawWorker } = await supabase.from('profiles_worker').select('*').eq('id', user.id).single();
  const workerProfile = rawWorker as ProfileWorker | null;

  const isWorker = profile.role === 'worker';
  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  const backHref = isWorker ? `/${locale}/account/worker` : `/${locale}/account/client`;
  const backLabel = isWorker ? t('Мои заказы', 'Comenzile mele') : t('Мои заявки', 'Cererile mele');

  const initials = profile.name
    ? profile.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : profile.phone.slice(-2);

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        {/* Hero */}
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <div className="flex items-center gap-2 mb-3">
              <Link href={backHref} className="text-sm" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                ← {backLabel}
              </Link>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div
                className="flex items-center justify-center rounded-full font-bold text-white text-xl shrink-0"
                style={{ width: 64, height: 64, background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))' }}
              >
                {initials}
              </div>
              <div>
                <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                  {profile.name ?? t('Мой профиль', 'Profilul meu')}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {profile.phone}
                  {profile.city && ` · ${profile.city}`}
                  {' · '}
                  <span style={{ color: 'var(--accent)' }}>
                    {isWorker ? t('Мастер', 'Meșter') : t('Заказчик', 'Client')}
                  </span>
                </p>
              </div>
              {isWorker && (
                <Link
                  href={`/${locale}/workers/${user.id}`}
                  className="btn-secondary ml-auto shrink-0"
                  style={{ fontSize: 13, height: 36, padding: '0 14px' }}
                >
                  {t('Публичный профиль →', 'Profil public →')}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 28, maxWidth: 680 }}>
          <ProfileForm
            locale={locale}
            profile={profile}
            workerProfile={workerProfile}
            telegramConnected={!!profile.telegram_chat_id}
            userId={user.id}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
