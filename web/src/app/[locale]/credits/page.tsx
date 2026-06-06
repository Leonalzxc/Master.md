import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import type { Profile, ProfileWorker } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Купить кредиты' : 'Cumpără credite' };
}

const PACKAGES = [
  { id: 'p10',  credits: 10,  price: 50,  popular: false },
  { id: 'p25',  credits: 25,  price: 100, popular: true  },
  { id: 'p60',  credits: 60,  price: 200, popular: false },
];

const IBAN = process.env.NEXT_PUBLIC_IBAN ?? 'MD00MOBL000000000000000000';
const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Master Moldova SRL';

export default async function CreditsPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth?next=/${locale}/credits`);

  const { data: rawProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const profile = rawProfile as Profile | null;
  if (profile?.role !== 'worker') redirect(`/${locale}/account`);

  const { data: rawWorker } = await supabase.from('profiles_worker').select('bid_credits').eq('id', user.id).single();
  const worker = rawWorker as Pick<ProfileWorker, 'bid_credits'> | null;
  const currentCredits = worker?.bid_credits ?? 0;

  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        {/* Hero */}
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <Link href={`/${locale}/account/worker`} className="inline-flex items-center gap-1 text-sm mb-4"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← {t('Назад', 'Înapoi')}
            </Link>
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              💳 {t('Купить кредиты', 'Cumpără credite')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('1 кредит = 1 отклик на заявку клиента', '1 credit = 1 ofertă la cererea unui client')}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 28 }}>
          <div className="flex flex-col md:flex-row gap-8 items-start">

            {/* Left — packages */}
            <div className="flex-1">
              {/* Current balance */}
              <div className="card p-5 mb-6 flex items-center gap-4">
                <span style={{ fontSize: 36 }}>💎</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    {t('Ваш баланс', 'Soldul dvs.')}
                  </p>
                  <p className="font-bold text-2xl" style={{ color: currentCredits > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                    {currentCredits} {t('кредитов', 'credite')}
                  </p>
                </div>
              </div>

              {/* Packages */}
              <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--text)' }}>
                {t('Выберите пакет', 'Alegeți pachetul')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {PACKAGES.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="card p-5 flex flex-col items-center gap-2 text-center"
                    style={{
                      border: pkg.popular ? '2px solid var(--accent)' : '1.5px solid var(--glass-border)',
                      position: 'relative',
                    }}
                  >
                    {pkg.popular && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-0.5 rounded-full"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                      >
                        {t('Популярный', 'Popular')}
                      </div>
                    )}
                    <div className="font-bold text-3xl" style={{ color: 'var(--text)' }}>
                      {pkg.credits}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('кредитов', 'credite')}
                    </div>
                    <div className="font-bold text-xl mt-1" style={{ color: 'var(--accent)' }}>
                      {pkg.price} MDL
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {(pkg.price / pkg.credits).toFixed(1)} MDL / {t('кредит', 'credit')}
                    </div>
                  </div>
                ))}
              </div>

              {/* How to pay */}
              <div className="card p-6">
                <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--text)' }}>
                  📋 {t('Как оплатить', 'Cum să plătiți')}
                </h2>
                <ol className="flex flex-col gap-3">
                  {[
                    t('Выберите нужный пакет выше', 'Alegeți pachetul dorit de mai sus'),
                    t(
                      `Переведите оплату по реквизитам ниже, в назначении платежа укажите: "Кредиты Master.md — ${profile?.name ?? ''}"`,
                      `Transferați plata conform detaliilor de mai jos, în nota de plată indicați: "Credite Master.md — ${profile?.name ?? ''}"`
                    ),
                    t(
                      'Отправьте скриншот оплаты через Telegram или WhatsApp нашей поддержке',
                      'Trimiteți un screenshot al plății prin Telegram sau WhatsApp suportului nostru'
                    ),
                    t('Кредиты будут зачислены в течение 1 рабочего дня', 'Creditele vor fi acordate în termen de 1 zi lucrătoare'),
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="shrink-0 flex items-center justify-center rounded-full font-bold text-white text-xs"
                        style={{ width: 24, height: 24, background: 'var(--accent)', marginTop: 1 }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {step}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Right — payment details */}
            <aside style={{ width: '100%', flexShrink: 0 }} className="md:w-[300px] md:max-w-[300px]">
              <div className="card p-5 flex flex-col gap-4 sticky top-24">
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  🏦 {t('Реквизиты', 'Date bancare')}
                </h3>

                <BankField label={t('Получатель', 'Beneficiar')} value={COMPANY} />
                <BankField label="IBAN" value={IBAN} monospace />
                <BankField label={t('Назначение', 'Destinație')} value={`Credite Master.md — ${profile?.name ?? user.id.slice(0, 8)}`} />

                <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)' }} />

                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  💬 {t('Поддержка', 'Suport')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {t('После оплаты напишите нам скриншот:', 'După plată, trimiteți-ne un screenshot:')}
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href="https://t.me/kentukaa"
                    target="_blank" rel="noopener noreferrer"
                    className="btn-secondary text-center"
                    style={{ fontSize: 13, height: 38 }}
                  >
                    ✈️ Telegram
                  </a>
                  <a
                    href="https://wa.me/373779922006"
                    target="_blank" rel="noopener noreferrer"
                    className="btn-secondary text-center"
                    style={{ fontSize: 13, height: 38 }}
                  >
                    💬 WhatsApp
                  </a>
                </div>

                <div
                  className="rounded-xl p-3 text-xs text-center"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  {t(
                    '⚡ Кредиты зачисляются в течение 1 рабочего дня после подтверждения оплаты',
                    '⚡ Creditele sunt acordate în termen de 1 zi lucrătoare după confirmarea plății'
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function BankField({ label, value, monospace }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <div
        className="rounded-lg px-3 py-2 text-sm font-medium select-all"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text)',
          fontFamily: monospace ? 'monospace' : undefined,
          wordBreak: 'break-all',
          cursor: 'text',
        }}
      >
        {value}
      </div>
    </div>
  );
}
