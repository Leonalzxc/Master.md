import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ pack?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Купить кредиты' : 'Cumpără credite' };
}

const PLANS = [
  { credits: 5,   price: 50  },
  { credits: 15,  price: 120 },
  { credits: 30,  price: 200 },
  { credits: 100, price: 550 },
];

export default async function CreditsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { pack } = await searchParams;
  const ru = locale === 'ru';

  const selected = PLANS.find((p) => p.credits === Number(pack)) ?? PLANS[1];

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              <Link href={`/${locale}/pricing`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                {ru ? '← Назад к ценам' : '← Înapoi la prețuri'}
              </Link>
            </div>
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {ru ? 'Пополнение кредитов' : 'Reîncărcare credite'}
            </h1>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 560 }}>

          {/* Package picker */}
          <div className="card p-6 mb-5">
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {ru ? 'Выберите пакет' : 'Alegeți pachetul'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PLANS.map((plan) => {
                const isSelected = plan.credits === selected.credits;
                return (
                  <Link
                    key={plan.credits}
                    href={`/${locale}/credits?pack=${plan.credits}`}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl text-center"
                    style={{
                      textDecoration: 'none',
                      background: isSelected ? 'var(--accent-dim)' : 'var(--bg-deep)',
                      border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--glass-border)'}`,
                    }}
                  >
                    <span className="font-bold text-lg" style={{ color: isSelected ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-display)' }}>
                      {plan.credits}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ru ? 'кред.' : 'cred.'}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {plan.price} MDL
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="card p-6 mb-5">
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {ru ? 'Итого' : 'Total'}
            </h2>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                {selected.credits} {ru ? 'кредитов' : 'credite'}
              </span>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>{selected.price} MDL</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {ru ? 'Цена за кредит' : 'Preț pe credit'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {(selected.price / selected.credits).toFixed(0)} MDL
              </span>
            </div>
          </div>

          {/* Payment — coming soon placeholder */}
          <div className="card p-6 text-center">
            <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
            <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text)' }}>
              {ru ? 'Оплата скоро появится' : 'Plata vine curând'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>
              {ru
                ? 'Мы подключаем платёжную систему. Пока что обратитесь в поддержку — мы добавим кредиты вручную.'
                : 'Integrăm sistemul de plată. Deocamdată contactați suportul — vom adăuga creditele manual.'}
            </p>
            <a
              href="mailto:support@master.md"
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px', textDecoration: 'none' }}
            >
              📧 {ru ? 'Написать в поддержку' : 'Contactați suportul'}
            </a>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
