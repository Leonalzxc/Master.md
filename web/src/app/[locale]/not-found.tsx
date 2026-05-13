'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function NotFound() {
  const pathname = usePathname();
  const locale = pathname?.split('/')[1] === 'ro' ? 'ro' : 'ru';
  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  return (
    <>
      <Header />
      <main
        className="flex-1 flex items-center justify-center"
        style={{ background: 'var(--bg-deep)', minHeight: '60vh', padding: '64px 16px' }}
      >
        <div className="text-center" style={{ maxWidth: 480 }}>
          <div
            className="font-bold mb-4"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(5rem, 18vw, 8rem)',
              lineHeight: 1,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            404
          </div>
          <h1
            className="font-bold text-2xl mb-3"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
          >
            {t('Страница не найдена', 'Pagina nu a fost găsită')}
          </h1>
          <p className="text-base mb-8" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {t(
              'Возможно, ссылка устарела или страница была удалена.',
              'Linkul poate fi expirat sau pagina a fost ștearsă.',
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/${locale}`} className="btn-primary" style={{ fontSize: 15 }}>
              {t('На главную', 'Pagina principală')}
            </Link>
            <Link href={`/${locale}/jobs`} className="btn-secondary" style={{ fontSize: 15 }}>
              {t('Смотреть заявки', 'Vezi cereri')}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
