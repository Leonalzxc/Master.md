import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { supportFaqs, SUPPORT_TELEGRAM } from '@/lib/pilot-copy';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Поддержка — MASTER Moldova' : 'Suport — MASTER Moldova' };
}

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  const ru = locale === 'ru';

  const faqs = supportFaqs(locale);
  const channels = [{ icon: '💬', title: 'Telegram', value: SUPPORT_TELEGRAM.label, href: SUPPORT_TELEGRAM.href,
    desc: ru ? 'Вопросы, жалобы и запросы о данных' : 'Întrebări, reclamații și solicitări despre date' }];

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {ru ? 'Поддержка' : 'Suport'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {ru ? 'Поддержка бесплатного пилота в Бельцах' : 'Suport pentru pilotul gratuit din Bălți'}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Contact channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {channels.map((c) => (
              <a
                key={c.title}
                href={c.href}
                className="card p-5 flex items-center gap-4 hover-lift"
                style={{ textDecoration: 'none' }}
              >
                <span style={{ fontSize: 32, flexShrink: 0 }}>{c.icon}</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{c.title}</p>
                  <p className="text-sm" style={{ color: 'var(--accent)' }}>{c.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.desc}</p>
                </div>
              </a>
            ))}
          </div>

          {/* FAQ */}
          <div>
            <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {ru ? 'Частые вопросы' : 'Întrebări frecvente'}
            </h2>
            <div className="flex flex-col gap-3">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="card p-5"
                  style={{ cursor: 'pointer' }}
                >
                  <summary className="font-semibold text-sm list-none flex items-center justify-between" style={{ color: 'var(--text)' }}>
                    {f.q}
                    <span style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0, marginLeft: 8 }}>+</span>
                  </summary>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.65, marginTop: 10 }}>
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>

          {/* Links to other docs */}
          <div className="card p-5">
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              {ru ? 'Полезные ссылки' : 'Linkuri utile'}
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { href: `/${locale}/legal/terms`, label: ru ? 'Условия использования' : 'Termeni de utilizare' },
                { href: `/${locale}/legal/privacy`, label: ru ? 'Конфиденциальность' : 'Confidențialitate' },
                { href: `/${locale}/legal/moderation`, label: ru ? 'Правила модерации' : 'Moderare' },
                { href: `/${locale}/pricing`, label: ru ? 'Условия бесплатного пилота' : 'Condițiile pilotului gratuit' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--bg-deep)', color: 'var(--accent)', textDecoration: 'none', border: '1px solid var(--glass-border)' }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
