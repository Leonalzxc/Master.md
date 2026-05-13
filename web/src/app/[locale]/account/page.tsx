import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Аккаунт' : 'Cont' };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  const { data: rawProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const profile = rawProfile as Profile | null;

  if (!profile?.name) redirect(`/${locale}/auth`);

  const isWorker = profile.role === 'worker';
  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  const initials = profile.name
    ? profile.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : (profile.phone ?? '?').slice(-2);

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        {/* Hero */}
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center rounded-full font-bold text-white text-lg shrink-0"
                style={{ width: 56, height: 56, background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))' }}
              >
                {initials}
              </div>
              <div>
                <h1 className="font-bold text-xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                  {profile.name}
                </h1>
                <p className="text-sm flex items-center gap-2 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {profile.phone}
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: isWorker ? 'rgba(14,165,233,.12)' : 'rgba(22,163,74,.1)',
                      color: isWorker ? 'var(--accent)' : 'var(--success)',
                    }}
                  >
                    {isWorker ? `🔧 ${t('Мастер', 'Meșter')}` : `🏠 ${t('Заказчик', 'Client')}`}
                  </span>
                </p>
              </div>
            </div>
            <Link href={`/${locale}/account/profile`} className="btn-secondary" style={{ fontSize: 13, height: 36, padding: '0 14px' }}>
              ⚙️ {t('Настройки', 'Setări')}
            </Link>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 28 }}>

          {/* Main actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Link href={`/${locale}/account/client`} className="card p-6 flex items-start gap-4 hover-lift" style={{ textDecoration: 'none' }}>
              <div className="text-3xl shrink-0">📋</div>
              <div>
                <div className="font-semibold text-base" style={{ color: 'var(--text)' }}>
                  {t('Мои заявки', 'Cererile mele')}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('Создавайте заявки и получайте отклики мастеров', 'Creați cereri și primiți oferte de la meșteri')}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold mt-2" style={{ color: 'var(--accent)' }}>
                  {t('Открыть', 'Deschide')} →
                </span>
              </div>
            </Link>

            <Link href={`/${locale}/account/worker`} className="card p-6 flex items-start gap-4 hover-lift" style={{ textDecoration: 'none' }}>
              <div className="text-3xl shrink-0">🔨</div>
              <div>
                <div className="font-semibold text-base" style={{ color: 'var(--text)' }}>
                  {t('Мои заказы', 'Comenzile mele')}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('Откликайтесь на заявки и выполняйте заказы', 'Trimiteți oferte și executați comenzi')}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold mt-2" style={{ color: 'var(--accent)' }}>
                  {t('Открыть', 'Deschide')} →
                </span>
              </div>
            </Link>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: `/${locale}/request/new`,  icon: '➕', label: t('Новая заявка', 'Cerere nouă') },
              { href: `/${locale}/jobs`,          icon: '📌', label: t('Все заявки', 'Toate cererile') },
              { href: `/${locale}/workers`,       icon: '👷', label: t('Мастера', 'Meșteri') },
              { href: `/${locale}/account/profile`, icon: '👤', label: t('Профиль', 'Profil') },
            ].map(({ href, icon, label }) => (
              <Link
                key={href}
                href={href}
                className="card p-4 flex flex-col items-center gap-2 text-center hover-lift"
                style={{ textDecoration: 'none' }}
              >
                <span style={{ fontSize: 24 }}>{icon}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
