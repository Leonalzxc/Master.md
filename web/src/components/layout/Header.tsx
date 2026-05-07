'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

export default function Header() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const otherLocale = locale === 'ru' ? 'ro' : 'ru';
  const switchLangPath = pathname.replace(`/${locale}`, `/${otherLocale}`);

  return (
    <header
      style={{
        height: 'var(--header-h)',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--glass-border)',
        position: 'sticky',
        top: 0,
        zIndex: 60,
      }}
    >
      <div className="container flex items-center justify-between h-full">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 font-bold text-xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
        >
          <span
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold"
            style={{ background: 'var(--accent)' }}
          >
            M
          </span>
          MASTER
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href={`/${locale}/workers`}
            className="text-sm font-medium hover:text-[var(--accent)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('findWorker')}
          </Link>
          <Link
            href={`/${locale}/jobs`}
            className="text-sm font-medium hover:text-[var(--accent)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('forWorkers')}
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Lang switcher */}
          <Link
            href={switchLangPath}
            className="text-xs font-semibold px-2 py-1 rounded-md transition-colors"
            style={{
              color: 'var(--text-muted)',
              border: '1px solid var(--glass-border)',
            }}
          >
            {otherLocale.toUpperCase()}
          </Link>

          {/* Login */}
          <Link
            href={`/${locale}/auth`}
            className="hidden md:flex btn-secondary text-sm"
            style={{ height: 36, padding: '0 16px', fontSize: 14 }}
          >
            {t('login')}
          </Link>

          {/* CTA */}
          <Link
            href={`/${locale}/request/new`}
            className="btn-primary text-sm"
            style={{ height: 36, padding: '0 16px', fontSize: 14 }}
          >
            {t('createRequest')}
          </Link>

          {/* Burger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span
              className={cn(
                'block w-5 h-0.5 mb-1 transition-all',
                menuOpen && 'rotate-45 translate-y-1.5'
              )}
              style={{ background: 'var(--text)' }}
            />
            <span
              className={cn('block w-5 h-0.5 mb-1 transition-all', menuOpen && 'opacity-0')}
              style={{ background: 'var(--text)' }}
            />
            <span
              className={cn(
                'block w-5 h-0.5 transition-all',
                menuOpen && '-rotate-45 -translate-y-1.5'
              )}
              style={{ background: 'var(--text)' }}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden border-t py-4"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--glass-border)',
          }}
        >
          <div className="container flex flex-col gap-3">
            <Link
              href={`/${locale}/workers`}
              className="py-2 text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => setMenuOpen(false)}
            >
              {t('findWorker')}
            </Link>
            <Link
              href={`/${locale}/jobs`}
              className="py-2 text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => setMenuOpen(false)}
            >
              {t('forWorkers')}
            </Link>
            <Link
              href={`/${locale}/auth`}
              className="py-2 text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => setMenuOpen(false)}
            >
              {t('login')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
