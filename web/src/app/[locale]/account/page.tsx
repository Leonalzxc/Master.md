import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/supabase/types';
import LogoutButton from '@/components/features/LogoutButton';

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

  if (profile?.role === 'worker') redirect(`/${locale}/account/worker`);
  if (profile?.role === 'client') redirect(`/${locale}/account/client`);

  const initials = profile?.name
    ? profile.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : (profile?.phone ?? '?').slice(-2);

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center rounded-full font-bold text-white text-lg"
                style={{ width: 56, height: 56, background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))' }}
              >
                {initials}
              </div>
              <div>
                <h1 className="font-bold text-xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                  {profile?.name ?? (locale === 'ru' ? 'Мой аккаунт' : 'Contul meu')}
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {profile?.phone ?? user.phone}
                </p>
              </div>
            </div>
            <LogoutButton locale={locale} />
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            <Link href={`/${locale}/request/new`} className="card p-6 flex flex-col gap-3 hover-lift" style={{ textDecoration: 'none' }}>
              <div className="text-3xl">📋</div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--text)' }}>
                  {locale === 'ru' ? 'Создать заявку' : 'Creează cerere'}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {locale === 'ru' ? 'Опишите задачу, мастера откликнутся' : 'Descrieți sarcina, meșterii vor răspunde'}
                </div>
              </div>
            </Link>

            <Link href={`/${locale}/jobs`} className="card p-6 flex flex-col gap-3 hover-lift" style={{ textDecoration: 'none' }}>
              <div className="text-3xl">🔨</div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--text)' }}>
                  {locale === 'ru' ? 'Все заявки' : 'Toate cererile'}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {locale === 'ru' ? 'Найдите заказы и оставьте отклик' : 'Găsiți comenzi și trimiteți oferte'}
                </div>
              </div>
            </Link>

            <Link href={`/${locale}/workers`} className="card p-6 flex flex-col gap-3 hover-lift" style={{ textDecoration: 'none' }}>
              <div className="text-3xl">👷</div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--text)' }}>
                  {locale === 'ru' ? 'Мастера' : 'Meșteri'}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {locale === 'ru' ? 'Найдите проверенного специалиста' : 'Găsiți un specialist verificat'}
                </div>
              </div>
            </Link>
          </div>

          {/* Role info */}
          <div className="card p-6 mt-6">
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>
              {locale === 'ru' ? 'Информация об аккаунте' : 'Informații cont'}
            </h2>
            <div className="flex flex-col gap-3">
              <Row label={locale === 'ru' ? 'Телефон' : 'Telefon'} value={profile?.phone ?? user.phone ?? '—'} />
              <Row label={locale === 'ru' ? 'Имя' : 'Nume'} value={profile?.name ?? '—'} />
              <Row label={locale === 'ru' ? 'Роль' : 'Rol'} value={
                profile?.role === 'admin' ? 'Admin' : (locale === 'ru' ? 'Не задана' : 'Nedefinit')
              } />
              <Row label={locale === 'ru' ? 'Город' : 'Oraș'} value={profile?.city ?? '—'} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-2 border-b" style={{ borderColor: 'var(--glass-border)' }}>
      <span className="text-sm w-32 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}
