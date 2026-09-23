import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { submitVerification } from '@/app/actions/submitVerification';
import type { Profile, ProfileWorker } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Верификация мастера' : 'Verificare meșter' };
}

export default async function VerifyPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth?next=/${locale}/account/verify`);

  const { data: rawProfile } = await supabase.from('profiles').select('id,name,role').eq('id', user.id).single();
  const profile = rawProfile as Profile | null;
  if (profile?.role !== 'worker') redirect(`/${locale}/account`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawWorker } = await (supabase.from('profiles_worker') as any)
    .select('bid_credits, verified, categories, verification_submitted_at')
    .eq('id', user.id)
    .single();
  const worker = rawWorker as (Pick<ProfileWorker, 'bid_credits' | 'verified' | 'categories'> & { verification_submitted_at?: string | null }) | null;

  const isVerified = worker?.verified ?? false;
  const submitted = !!(worker as { verification_submitted_at?: string | null } | null)?.verification_submitted_at;
  const hasCategories = ((worker?.categories ?? []) as string[]).length > 0;
  const hasName = !!(profile?.name?.trim());

  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <Link href={`/${locale}/account/worker`} className="inline-flex items-center gap-1 text-sm mb-4"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← {t('Назад', 'Înapoi')}
            </Link>
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              🛡️ {t('Верификация профиля', 'Verificarea profilului')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('Получите значок ✓ Проверен и больше доверия от клиентов', 'Obțineți insigna ✓ Verificat și mai multă încredere de la clienți')}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 28, maxWidth: 680 }}>

          {/* Already verified */}
          {isVerified && (
            <div className="card p-6 text-center flex flex-col items-center gap-4">
              <div style={{ fontSize: 56 }}>✅</div>
              <h2 className="font-bold text-xl" style={{ color: 'var(--text)' }}>
                {t('Вы уже верифицированы!', 'Ești deja verificat!')}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                {t('Ваш профиль имеет значок ✓ Проверен. Клиенты видят вас как надёжного мастера.', 'Profilul dvs. are insigna ✓ Verificat. Clienții vă văd ca un meșter de încredere.')}
              </p>
              <Link href={`/${locale}/workers/${user.id}`} className="btn-primary" style={{ fontSize: 14 }}>
                {t('Посмотреть профиль', 'Vezi profilul')}
              </Link>
            </div>
          )}

          {/* Submitted, waiting */}
          {!isVerified && submitted && (
            <div className="flex flex-col gap-5">
              <div
                className="card p-6 text-center flex flex-col items-center gap-4"
                style={{ border: '2px solid rgba(234,179,8,.4)' }}
              >
                <div style={{ fontSize: 48 }}>⏳</div>
                <h2 className="font-bold text-xl" style={{ color: 'var(--text)' }}>
                  {t('Заявка отправлена!', 'Cerere trimisă!')}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, textAlign: 'center', lineHeight: 1.7 }}>
                  {t(
                    'Мы проверяем ваш профиль. Обычно это занимает 1–2 рабочих дня. Как только верификация будет выполнена, на вашем профиле появится значок ✓ Проверен.',
                    'Verificăm profilul dvs. De obicei durează 1-2 zile lucrătoare. Odată verificarea finalizată, profilul dvs. va afișa insigna ✓ Verificat.'
                  )}
                </p>
              </div>
              <div className="card p-5 flex flex-col gap-3">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {t('Что происходит дальше?', 'Ce urmează?')}
                </h3>
                {[
                  t('Наша команда проверяет ваш профиль и указанные данные', 'Echipa noastră verifică profilul și datele indicate'),
                  t('При необходимости свяжемся с вами по номеру телефона', 'Dacă este necesar, vă vom contacta la numărul de telefon'),
                  t('После одобрения значок ✓ Проверен появится в вашем профиле', 'După aprobare, insigna ✓ Verificat va apărea în profilul dvs.'),
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span
                      className="shrink-0 flex items-center justify-center rounded-full font-bold text-white text-xs"
                      style={{ width: 22, height: 22, background: 'var(--accent)', marginTop: 1 }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not yet submitted */}
          {!isVerified && !submitted && (
            <div className="flex flex-col gap-5">

              {/* Benefits */}
              <div className="card p-6">
                <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--text)' }}>
                  {t('Что даёт верификация?', 'Ce oferă verificarea?')}
                </h2>
                <div className="flex flex-col gap-3">
                  {[
                    { icon: '🛡️', text: t('Значок ✓ Проверен в поиске и на профиле — сразу виден клиентам', 'Insigna ✓ Verificat în căutare și pe profil — vizibilă imediat pentru clienți') },
                    { icon: '📈', text: t('Верифицированные мастера получают на 40% больше откликов', 'Meșterii verificați primesc cu 40% mai multe oferte') },
                    { icon: '🤝', text: t('Клиенты охотнее доверяют проверенным мастерам свои заявки', 'Clienții au mai multă încredere în meșterii verificați') },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-start gap-3">
                      <span className="text-xl shrink-0">{icon}</span>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requirements */}
              <div className="card p-6">
                <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--text)' }}>
                  {t('Требования', 'Cerințe')}
                </h2>
                <div className="flex flex-col gap-3">
                  <Requirement
                    met={hasName}
                    label={t('Указано имя в профиле', 'Nume indicat în profil')}
                    fixHref={!hasName ? `/${locale}/account/profile` : undefined}
                    fixLabel={t('Заполнить профиль', 'Completează profilul')}
                    locale={locale}
                  />
                  <Requirement
                    met={hasCategories}
                    label={t('Выбрана хотя бы одна специальность', 'Cel puțin o specialitate selectată')}
                    fixHref={!hasCategories ? `/${locale}/account/profile` : undefined}
                    fixLabel={t('Заполнить профиль', 'Completează profilul')}
                    locale={locale}
                  />
                  <Requirement
                    met={true}
                    label={t('Телефон подтверждён при регистрации', 'Telefon confirmat la înregistrare')}
                    locale={locale}
                  />
                </div>
              </div>

              {/* Submit form */}
              {hasName && hasCategories ? (
                <div className="card p-6 flex flex-col gap-4">
                  <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
                    {t('Всё готово — подать заявку', 'Totul e gata — trimiteți cererea')}
                  </h2>
                  <div
                    className="rounded-xl p-4 text-sm"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent)', lineHeight: 1.7 }}
                  >
                    {t(
                      'Нажимая кнопку ниже, вы подтверждаете, что все данные в профиле актуальны и достоверны. Наша команда проверит информацию в течение 1–2 рабочих дней.',
                      'Apăsând butonul de mai jos, confirmați că toate datele din profil sunt actuale și corecte. Echipa noastră va verifica informațiile în termen de 1-2 zile lucrătoare.'
                    )}
                  </div>
                  <form action={submitVerification}>
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="btn-primary w-full"
                      style={{ fontSize: 15, height: 48, justifyContent: 'center' }}
                    >
                      🛡️ {t('Отправить заявку на верификацию', 'Trimite cererea de verificare')}
                    </button>
                  </form>
                </div>
              ) : (
                <div
                  className="rounded-2xl p-4 text-sm"
                  style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', lineHeight: 1.7 }}
                >
                  {t(
                    'Сначала заполните обязательные данные профиля (имя и специальность), затем вернитесь сюда.',
                    'Mai întâi completați datele obligatorii ale profilului (nume și specialitate), apoi reveniți aici.'
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Requirement({ met, label, fixHref, fixLabel, locale }: {
  met: boolean; label: string; fixHref?: string; fixLabel?: string; locale?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 18, lineHeight: 1 }}>{met ? '✅' : '❌'}</span>
        <span className="text-sm" style={{ color: met ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
      </div>
      {!met && fixHref && fixLabel && (
        <Link
          href={fixHref}
          className="text-xs px-3 py-1 rounded-full font-semibold shrink-0"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', textDecoration: 'none' }}
        >
          {fixLabel}
        </Link>
      )}
    </div>
  );
}
