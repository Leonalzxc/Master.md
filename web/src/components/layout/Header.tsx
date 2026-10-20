'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import NotificationBell from './NotificationBell';
import LanguageSwitch, { LanguageLink } from './LanguageSwitch';

interface ProfileMini { name: string | null; role: string | null }

function initials(name: string | null, phone: string): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

export default function Header() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileMini | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    let generation = 0;

    function loadUser(u: User | null) {
      if (!alive) return;
      const request = ++generation;
      setUser(u);
      setProfile(null);
      if (!u) return;
      // Keep Supabase queries outside its synchronous auth callback/lock.
      setTimeout(async () => {
        if (!alive || request !== generation) return;
        try {
          const { data } = await supabase.from('profiles').select('name, role').eq('id', u.id).single();
          if (alive && request === generation) setProfile((data as ProfileMini | null) ?? null);
        } catch {
          // The account remains usable even when its display name cannot be loaded.
        }
      }, 0);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (alive && generation === 0) loadUser(data.user);
    }).catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      loadUser(session?.user ?? null);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    function keyboard(e: KeyboardEvent) {
      if (e.key === 'Escape') { setDropOpen(false); setMenuOpen(false); }
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyboard);
    };
  }, []);

  const otherLocale = locale === 'ru' ? 'ro' : 'ru';
  const switchLangPath = pathname.replace(/^\/(ru|ro)(?=\/|$)/, `/${otherLocale}`);

  const isWorker = profile?.role === 'worker';
  const dashboardHref = isWorker ? `/${locale}/account/worker` : `/${locale}/account/client`;
  const dashboardLabel = isWorker
    ? (locale === 'ru' ? 'Мои заказы' : 'Comenzile mele')
    : (locale === 'ru' ? 'Мои заявки' : 'Cererile mele');

  async function logout() {
    setDropOpen(false);
    setMenuOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  const avatarEl = user ? (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setDropOpen((v) => !v)}
        className="flex items-center justify-center rounded-full font-bold text-white text-sm transition-opacity hover:opacity-80"
        style={{
          width: 36, height: 36,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
          flexShrink: 0, border: dropOpen ? '2px solid var(--accent)' : '2px solid transparent',
        }}
        title={profile?.name ?? user.phone ?? ''}
        aria-label={locale === 'ru' ? 'Меню аккаунта' : 'Meniul contului'}
        aria-expanded={dropOpen}
        aria-controls={dropOpen ? 'account-dropdown' : undefined}
      >
        {initials(profile?.name ?? null, user.phone ?? '??')}
      </button>

      {dropOpen && (
        <div
          id="account-dropdown"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)',
            borderRadius: 14, padding: '8px 0', minWidth: 200,
            boxShadow: '0 8px 32px rgba(0,0,0,.25)', zIndex: 200,
          }}
        >
          <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid var(--glass-border)' }}>
            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              {profile?.name ?? (locale === 'ru' ? 'Аккаунт' : 'Cont')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {user.phone}
            </p>
          </div>
          <DropItem href={dashboardHref} onClick={() => setDropOpen(false)}>
            📋 {dashboardLabel}
          </DropItem>
          <DropItem href={`/${locale}/account/profile`} onClick={() => setDropOpen(false)}>
            👤 {locale === 'ru' ? 'Мой профиль' : 'Profilul meu'}
          </DropItem>
          <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: 4, paddingTop: 4 }}>
            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8 }}
            >
              {locale === 'ru' ? '← Выйти' : '← Ieșire'}
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <header
      style={{
        height: 'var(--header-h)',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--glass-border)',
        position: 'sticky', top: 0, zIndex: 60,
      }}
    >
      <div className="container flex items-center justify-between h-full gap-3">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 font-bold text-xl shrink-0"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
        >
          <span
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold"
            style={{ background: 'var(--accent)' }}
          >M</span>
          MASTER
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 flex-1 justify-center">
          <Link
            href={`/${locale}/workers`}
            className="text-sm font-medium hover:text-[var(--accent)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >{t('findWorker')}</Link>
          <Link
            href={`/${locale}/jobs`}
            className="text-sm font-medium hover:text-[var(--accent)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >{t('forWorkers')}</Link>
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Lang */}
          <Suspense fallback={<LanguageLink href={switchLangPath} locale={otherLocale} />}>
            <LanguageSwitch pathname={pathname} locale={otherLocale} />
          </Suspense>

          {/* Notifications (logged-in only) */}
          {user && <NotificationBell />}

          {/* Avatar (all screen sizes) */}
          {avatarEl}

          {/* Desktop-only: login + CTA */}
          <div className="hidden md:flex items-center gap-2">
            {!user && (
              <Link
                href={`/${locale}/auth`}
                className="btn-secondary text-sm"
                style={{ height: 36, padding: '0 16px', fontSize: 14 }}
              >{t('login')}</Link>
            )}
            {user && (
              <Link
                href={`/${locale}/account`}
                className="btn-secondary text-sm"
                style={{ height: 36, padding: '0 14px', fontSize: 13 }}
              >
                {locale === 'ru' ? 'Мой аккаунт' : 'Contul meu'}
              </Link>
            )}
            <Link
              href={`/${locale}/request/new`}
              className="btn-primary text-sm"
              style={{ height: 36, padding: '0 14px', fontSize: 13 }}
            >
              {t('createRequest')}
            </Link>
          </div>

          {/* Burger */}
          <button
            className="md:hidden p-2 ml-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={locale === 'ru' ? 'Меню навигации' : 'Meniul de navigare'}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? 'mobile-navigation' : undefined}
          >
            {[0,1,2].map((i) => (
              <span
                key={i}
                className="block w-5 h-0.5 transition-all"
                style={{
                  background: 'var(--text)',
                  marginBottom: i < 2 ? 4 : 0,
                  transform: menuOpen
                    ? i === 0 ? 'rotate(45deg) translateY(6px)'
                    : i === 2 ? 'rotate(-45deg) translateY(-6px)'
                    : 'scaleX(0)'
                    : 'none',
                  opacity: menuOpen && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          id="mobile-navigation"
          className="md:hidden border-t py-3"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--glass-border)' }}
        >
          <div className="container flex flex-col gap-1">
            <MobileLink href={`/${locale}/workers`} onClick={() => setMenuOpen(false)}>{t('findWorker')}</MobileLink>
            <MobileLink href={`/${locale}/jobs`} onClick={() => setMenuOpen(false)}>{t('forWorkers')}</MobileLink>

            <div style={{ height: 1, background: 'var(--glass-border)', margin: '6px 0' }} />

            {user ? (
              <>
                <MobileLink href={dashboardHref} onClick={() => setMenuOpen(false)}>
                  📋 {dashboardLabel}
                </MobileLink>
                <MobileLink href={`/${locale}/account/profile`} onClick={() => setMenuOpen(false)}>
                  👤 {locale === 'ru' ? 'Мой профиль' : 'Profilul meu'}
                </MobileLink>
                <MobileLink href={isWorker ? `/${locale}/jobs` : `/${locale}/request/new`} onClick={() => setMenuOpen(false)}>
                  {isWorker
                    ? (locale === 'ru' ? '🔨 Найти заявки' : '🔨 Găsește cereri')
                    : `+ ${locale === 'ru' ? 'Создать заявку' : 'Cerere nouă'}`}
                </MobileLink>
                <button
                  onClick={logout}
                  className="py-2.5 px-1 text-sm font-medium text-left"
                  style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {locale === 'ru' ? '← Выйти' : '← Ieșire'}
                </button>
              </>
            ) : (
              <>
                <MobileLink href={`/${locale}/auth`} onClick={() => setMenuOpen(false)}>
                  {t('login')}
                </MobileLink>
                <MobileLink href={`/${locale}/request/new`} onClick={() => setMenuOpen(false)}>
                  + {locale === 'ru' ? 'Создать заявку' : 'Cerere nouă'}
                </MobileLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function DropItem({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
      style={{ color: 'var(--text)', textDecoration: 'none', borderRadius: 8, margin: '0 4px' }}
    >
      {children}
    </Link>
  );
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="py-2.5 px-1 text-sm font-medium"
      style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
    >
      {children}
    </Link>
  );
}
