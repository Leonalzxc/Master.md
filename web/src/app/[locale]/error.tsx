'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const locale = pathname?.split('/')[1] === 'ro' ? 'ro' : 'ru';
  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  useEffect(() => {
    // Log to error tracking in production
    console.error('[AppError]', error);
  }, [error]);

  return (
    <main
      className="flex-1 flex items-center justify-center"
      style={{ background: 'var(--bg-deep)', minHeight: '70vh', padding: '64px 16px' }}
    >
      <div className="text-center" style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
        <h1
          className="font-bold text-2xl mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
        >
          {t('Что-то пошло не так', 'Ceva a mers greșit')}
        </h1>
        <p className="text-base mb-2" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {t(
            'Произошла непредвиденная ошибка. Попробуйте ещё раз.',
            'A apărut o eroare neașteptată. Încercați din nou.',
          )}
        </p>
        {error.digest && (
          <p className="text-xs mb-6 font-mono" style={{ color: 'var(--text-muted)' }}>
            ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="btn-primary"
            style={{ fontSize: 15 }}
          >
            {t('Попробовать снова', 'Încearcă din nou')}
          </button>
          <Link href={`/${locale}`} className="btn-secondary" style={{ fontSize: 15 }}>
            {t('На главную', 'Pagina principală')}
          </Link>
        </div>
      </div>
    </main>
  );
}
