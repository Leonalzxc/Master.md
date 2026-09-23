import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import RatingStars from '@/components/ui/RatingStars';
import { createClient } from '@/lib/supabase/server';
import { PUBLIC_PROFILE_COLUMNS, type PublicProfile } from '@/lib/supabase/profiles';
import { CITIES, CATEGORY_LABELS_RU, CATEGORY_LABELS_RO, CATEGORY_ICONS, type Category } from '@/lib/mock/data';
import type { ProfileWorker } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ city?: string; category?: string; q?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Мастера' : 'Meșteri' };
}

type WorkerRow = PublicProfile & { profiles_worker: ProfileWorker | null };

export default async function WorkersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { city, category, q } = await searchParams;

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('profiles')
    .select(`${PUBLIC_PROFILE_COLUMNS},profiles_worker(*)`)
    .eq('role', 'worker')
    .order('name');
  // Apply city filter at DB level for efficiency
  if (city) query = query.eq('city', city);
  // Name search via ilike
  if (q) query = query.ilike('name', `%${q}%`);

  const { data: rawWorkers, error } = await query;

  const workers = ((rawWorkers ?? []) as WorkerRow[])
    .filter((w) => w.profiles_worker !== null)
    // Category filter stays in-memory (array column, harder to push to Supabase JS client)
    .filter((w) => !category || (w.profiles_worker!.categories as string[]).includes(category))
    .sort((a, b) => {
      const aPro = a.profiles_worker!.is_pro;
      const bPro = b.profiles_worker!.is_pro;
      if (aPro !== bPro) return aPro ? -1 : 1;
      return b.profiles_worker!.rating_avg - a.profiles_worker!.rating_avg;
    });

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                  {locale === 'ru' ? 'Мастера' : 'Meșteri'}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {workers.length} {locale === 'ru' ? 'мастеров в Молдове' : 'meșteri în Moldova'}
                </p>
              </div>
              <Link href={`/${locale}/request/new`} className="btn-primary" style={{ fontSize: 14 }}>
                {locale === 'ru' ? '+ Создать заявку' : '+ Creează cerere'}
              </Link>
            </div>
            {/* Name search */}
            <form method="GET" action={`/${locale}/workers`} className="flex gap-2" style={{ maxWidth: 480 }}>
              {city && <input type="hidden" name="city" value={city} />}
              {category && <input type="hidden" name="category" value={category} />}
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder={locale === 'ru' ? '🔍 Поиск по имени...' : '🔍 Caută după nume...'}
                className="field-input flex-1"
                style={{ height: 40, fontSize: 14 }}
              />
              <button type="submit" className="btn-secondary" style={{ height: 40, padding: '0 16px', fontSize: 14, whiteSpace: 'nowrap' }}>
                {locale === 'ru' ? 'Найти' : 'Caută'}
              </button>
              {q && (
                <Link href={`/${locale}/workers${city ? `?city=${encodeURIComponent(city)}` : ''}${category ? `${city ? '&' : '?'}category=${category}` : ''}`} className="btn-secondary" style={{ height: 40, padding: '0 12px', fontSize: 14 }}>
                  ✕
                </Link>
              )}
            </form>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 24 }}>
          {error && (
            <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
              Ошибка загрузки: {error.message}
            </div>
          )}
          <div className="flex gap-6 items-start flex-col md:flex-row">
            <aside style={{ width: '100%', flexShrink: 0 }} className="md:w-[220px] md:max-w-[220px]">
              {/* Mobile: collapsible */}
              <details className="md:hidden">
                <summary
                  className="field-input flex items-center justify-between cursor-pointer select-none"
                  style={{ listStyle: 'none' }}
                >
                  <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                    🗂 {locale === 'ru' ? 'Фильтры' : 'Filtre'}
                    {(city || category) ? ' ●' : ''}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>▼</span>
                </summary>
                <div className="mt-2">
                  <FilterPanel locale={locale} selectedCity={city} selectedCategory={category as Category | undefined} q={q} />
                </div>
              </details>
              {/* Desktop: always visible */}
              <div className="hidden md:block">
                <FilterPanel locale={locale} selectedCity={city} selectedCategory={category as Category | undefined} q={q} />
              </div>
            </aside>
            <div className="flex-1">
              {workers.length === 0 ? (
                <EmptyState
                  icon="👷"
                  title={locale === 'ru' ? 'Мастера не найдены' : 'Nu s-au găsit meșteri'}
                  description={locale === 'ru' ? 'Попробуйте изменить фильтры' : 'Încearcă să modifici filtrele'}
                  action={
                    <Link href={`/${locale}/workers`} className="btn-secondary" style={{ fontSize: 14 }}>
                      {locale === 'ru' ? 'Сбросить фильтры' : 'Resetează filtrele'}
                    </Link>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workers.map((w) => (
                    <WorkerCard key={w.id} worker={w} locale={locale} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function WorkerCard({ worker, locale }: { worker: WorkerRow; locale: string }) {
  const pw = worker.profiles_worker!;
  const initials = (worker.name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="card p-5 flex flex-col gap-4 hover-lift">
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-full font-bold text-lg text-white"
          style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))', fontSize: 18 }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{worker.name}</span>
            {pw.is_pro && <Badge variant="pro">PRO</Badge>}
            {pw.verified && <Badge variant="verified">✓ Проверен</Badge>}
          </div>
          <RatingStars value={pw.rating_avg} count={pw.rating_count} size={14} />
        </div>
      </div>

      {pw.bio && (
        <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {pw.bio}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(pw.categories as Category[]).map((cat) => (
          <Badge key={cat} variant="category">
            {CATEGORY_ICONS[cat]} {(locale === 'ro' ? CATEGORY_LABELS_RO : CATEGORY_LABELS_RU)[cat]}
          </Badge>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>📍 {worker.city}</span>
          {pw.rating_count > 0 && <span className="ml-3">✅ {pw.rating_count} отзывов</span>}
        </div>
        <Link href={`/${locale}/workers/${worker.id}`} className="btn-secondary" style={{ height: 34, padding: '0 14px', fontSize: 13 }}>
          Профиль
        </Link>
      </div>
    </div>
  );
}

function buildFilterUrl(locale: string, params: { city?: string; category?: string; q?: string }): string {
  const parts: string[] = [];
  if (params.city) parts.push(`city=${encodeURIComponent(params.city)}`);
  if (params.category) parts.push(`category=${params.category}`);
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  return `/${locale}/workers${parts.length ? `?${parts.join('&')}` : ''}`;
}

function FilterPanel({ locale, selectedCity, selectedCategory, q }: { locale: string; selectedCity?: string; selectedCategory?: Category; q?: string }) {
  const categories = Object.entries(locale === 'ro' ? CATEGORY_LABELS_RO : CATEGORY_LABELS_RU) as [Category, string][];
  return (
    <div className="card p-4 flex flex-col gap-5 sticky top-24">
      <div>
        <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>
          {locale === 'ru' ? 'Город' : 'Oraș'}
        </div>
        <div className="flex flex-col gap-1">
          <FilterLink href={buildFilterUrl(locale, { category: selectedCategory, q })} active={!selectedCity}>
            {locale === 'ru' ? 'Все города' : 'Toate orașele'}
          </FilterLink>
          {CITIES.map((c) => (
            <FilterLink key={c} href={buildFilterUrl(locale, { city: c, category: selectedCategory, q })} active={selectedCity === c}>
              {c}
            </FilterLink>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>
          {locale === 'ru' ? 'Специализация' : 'Specializare'}
        </div>
        <div className="flex flex-col gap-1">
          <FilterLink href={buildFilterUrl(locale, { city: selectedCity, q })} active={!selectedCategory}>
            {locale === 'ru' ? 'Все специальности' : 'Toate specialitățile'}
          </FilterLink>
          {categories.map(([slug, label]) => (
            <FilterLink key={slug} href={buildFilterUrl(locale, { city: selectedCity, category: slug, q })} active={selectedCategory === slug}>
              {label}
            </FilterLink>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-3 py-1.5 rounded-lg text-sm transition-colors" style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)', background: active ? 'var(--accent-dim)' : 'transparent', fontWeight: active ? 600 : 400, textDecoration: 'none' }}>
      {children}
    </Link>
  );
}
