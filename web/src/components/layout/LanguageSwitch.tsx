'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { localePath } from '@/lib/locale-path';

export function LanguageLink({ href, locale }: { href: string; locale: 'ru' | 'ro' }) {
  return (
    <Link href={href} hrefLang={locale}
      aria-label={locale === 'ro' ? 'Română' : 'Русский'}
      className="text-xs font-semibold px-2 py-1 rounded-md transition-colors"
      style={{ color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}>
      {locale.toUpperCase()}
    </Link>
  );
}

export default function LanguageSwitch({ pathname, locale }: { pathname: string; locale: 'ru' | 'ro' }) {
  const search = useSearchParams();
  return <LanguageLink href={localePath(pathname, search.toString(), locale)} locale={locale} />;
}
