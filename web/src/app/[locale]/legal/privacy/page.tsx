import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { privacySections, LEGAL_DRAFT, SUPPORT_TELEGRAM } from '@/lib/pilot-copy';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Политика конфиденциальности' : 'Politica de confidențialitate' };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const ru = locale === 'ru';

  const sections = privacySections(locale);

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              <Link href={`/${locale}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                {ru ? 'Главная' : 'Acasă'}
              </Link>
              <span>→</span>
              <span>{ru ? 'Правовые документы' : 'Documente legale'}</span>
            </div>
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {ru ? 'Политика конфиденциальности' : 'Politica de confidențialitate'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {ru ? 'Черновик · 4 октября 2026' : 'Proiect · 4 octombrie 2026'}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 720 }}>
          <div className="card p-8 flex flex-col gap-8">
            <p className="rounded-xl p-4 text-sm" style={{ background: 'var(--accent-dim)', color: 'var(--text)', lineHeight: 1.7 }}>
              {LEGAL_DRAFT[ru ? 'ru' : 'ro']}
            </p>
            {sections.map((s) => (
              <div key={s.title}>
                <h2 className="font-semibold text-base mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {s.title}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.7 }}>
                  {s.text}
                </p>
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 24 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {ru ? 'Запросы и поддержка: ' : 'Solicitări și suport: '}
                <a href={SUPPORT_TELEGRAM.href} style={{ color: 'var(--accent)' }}>{SUPPORT_TELEGRAM.label}</a>
              </p>
              <div className="flex gap-4 mt-4 text-sm">
                <Link href={`/${locale}/legal/terms`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  {ru ? 'Условия использования →' : 'Termeni de utilizare →'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
