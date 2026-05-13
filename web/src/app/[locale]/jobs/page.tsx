import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import EmptyState from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/server';
import { CITIES, CATEGORY_LABELS_RU, CATEGORY_ICONS, type Category } from '@/lib/mock/data';
import Badge from '@/components/ui/Badge';
import type { Job } from '@/lib/supabase/types';

type JobWithBids = Job & { bid_count: { count: number }[] };

const PAGE_SIZE = 20;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ city?: string; category?: string; q?: string; sort?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Заявки на работу' : 'Cereri de lucru' };
}

export default async function JobsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { city, category, q, sort, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE; // fetch PAGE_SIZE+1 to detect if next page exists

  const supabase = await createClient();

  let query = supabase
    .from('jobs')
    .select('*, bid_count:bids(count)')
    .eq('status', 'active');

  if (city) query = query.eq('city', city);
  if (category) query = query.eq('category', category);
  if (q) query = (query as any).ilike('description', `%${q}%`);
  if (sort === 'urgent') query = (query as any).order('urgent', { ascending: false }).order('created_at', { ascending: false });
  else if (sort === 'budget') query = (query as any).order('budget_max', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  query = (query as any).range(from, to);

  const { data: rawJobs, error } = await query;
  const allFetched = (rawJobs as JobWithBids[] | null) ?? [];
  const hasNextPage = allFetched.length > PAGE_SIZE;
  const jobs = allFetched.slice(0, PAGE_SIZE) as JobWithBids[];

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                {locale === 'ru' ? 'Заявки на работу' : 'Cereri de lucru'}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {locale === 'ru'
                  ? `Стр. ${page}${hasNextPage ? '+' : ''} · ${jobs.length} ${jobs.length === 1 ? 'заявка' : jobs.length < 5 ? 'заявки' : 'заявок'}`
                  : `Pag. ${page}${hasNextPage ? '+' : ''} · ${jobs.length} cereri`}
              </p>
            </div>
            <Link href={`/${locale}/request/new`} className="btn-primary" style={{ fontSize: 14 }}>
              + {locale === 'ru' ? 'Создать заявку' : 'Creează cerere'}
            </Link>
          </div>
        </div>

        {/* Search + Sort bar */}
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '12px 0' }}>
          <div className="container">
            <form method="GET" className="flex flex-wrap gap-2 items-center">
              {/* preserve city/category filters */}
              {city && <input type="hidden" name="city" value={city} />}
              {category && <input type="hidden" name="category" value={category} />}

              <div className="flex-1 min-w-[180px] relative">
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
                <input
                  type="text"
                  name="q"
                  defaultValue={q ?? ''}
                  placeholder={locale === 'ru' ? 'Поиск по описанию…' : 'Caută după descriere…'}
                  className="field-input w-full"
                  style={{ paddingLeft: 32, height: 38, fontSize: 13 }}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {(['newest', 'urgent', 'budget'] as const).map((s) => {
                  const label = s === 'newest'
                    ? (locale === 'ru' ? 'Новые' : 'Noi')
                    : s === 'urgent'
                    ? (locale === 'ru' ? '⚡ Срочные' : '⚡ Urgente')
                    : (locale === 'ru' ? '💰 По бюджету' : '💰 După buget');
                  const active = (sort ?? 'newest') === s;
                  return (
                    <button
                      key={s}
                      type="submit"
                      name="sort"
                      value={s}
                      style={{
                        height: 38, padding: '0 12px', fontSize: 12, fontWeight: active ? 700 : 500,
                        background: active ? 'var(--accent-dim)' : 'var(--surface-2)',
                        border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--glass-border)',
                        borderRadius: 'var(--radius-sm)', color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 150ms',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {(q || sort) && (
                <a
                  href={`/${locale}/jobs${city || category ? `?${city ? `city=${encodeURIComponent(city)}` : ''}${city && category ? '&' : ''}${category ? `category=${category}` : ''}` : ''}`}
                  style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', whiteSpace: 'nowrap', alignSelf: 'center' }}
                >
                  ✕ {locale === 'ru' ? 'Сброс' : 'Reset'}
                </a>
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
                    🔍 {locale === 'ru' ? 'Фильтры' : 'Filtre'}
                    {(city || category) ? ' ●' : ''}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>▼</span>
                </summary>
                <div className="mt-2">
                  <FilterPanel locale={locale} selectedCity={city} selectedCategory={category as Category | undefined} q={q} sort={sort} />
                </div>
              </details>
              {/* Desktop: always visible */}
              <div className="hidden md:block">
                <FilterPanel locale={locale} selectedCity={city} selectedCategory={category as Category | undefined} q={q} sort={sort} />
              </div>
            </aside>
            <div className="flex-1">
              {!jobs || jobs.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title={locale === 'ru' ? 'Заявок не найдено' : 'Nu s-au găsit cereri'}
                  description={locale === 'ru' ? 'Попробуйте изменить фильтры' : 'Încearcă să modifici filtrele'}
                  action={
                    <Link href={`/${locale}/jobs`} className="btn-secondary" style={{ fontSize: 14 }}>
                      {locale === 'ru' ? 'Сбросить фильтры' : 'Resetează filtrele'}
                    </Link>
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobs.map((job) => (
                      <JobCard key={job.id} job={job} locale={locale} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {(page > 1 || hasNextPage) && (
                    <div className="flex items-center justify-center gap-3 mt-6">
                      {page > 1 ? (
                        <Link
                          href={buildHref(locale, { city, category, q, sort, page: String(page - 1) })}
                          className="btn-secondary"
                          style={{ height: 38, padding: '0 16px', fontSize: 13 }}
                        >
                          ← {locale === 'ru' ? 'Назад' : 'Înapoi'}
                        </Link>
                      ) : <div style={{ width: 90 }} />}

                      <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {locale === 'ru' ? `Стр. ${page}` : `Pag. ${page}`}
                      </span>

                      {hasNextPage ? (
                        <Link
                          href={buildHref(locale, { city, category, q, sort, page: String(page + 1) })}
                          className="btn-secondary"
                          style={{ height: 38, padding: '0 16px', fontSize: 13 }}
                        >
                          {locale === 'ru' ? 'Далее' : 'Următor'} →
                        </Link>
                      ) : <div style={{ width: 90 }} />}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function JobCard({ job, locale }: { job: JobWithBids; locale: string }) {
  const cat = job.category as Category;
  const icon = CATEGORY_ICONS[cat] ?? '🔧';
  const label = CATEGORY_LABELS_RU[cat] ?? cat;
  const bidsCount = Array.isArray(job.bid_count) ? (job.bid_count[0] as { count: number })?.count ?? 0 : 0;

  const ago = (() => {
    const diff = Date.now() - new Date(job.created_at).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return locale === 'ru' ? 'только что' : 'acum';
    if (h < 24) return `${h} ${locale === 'ru' ? 'ч назад' : 'ore în urmă'}`;
    return `${Math.floor(h / 24)} ${locale === 'ru' ? 'д назад' : 'zile în urmă'}`;
  })();

  return (
    <div className="card p-5 flex flex-col gap-3 hover-lift">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="category">{icon} {label}</Badge>
          {job.urgent && <Badge variant="urgent">⚡ {locale === 'ru' ? 'Срочно' : 'Urgent'}</Badge>}
          {job.needs_quote && <Badge variant="muted">📋 {locale === 'ru' ? 'Смета' : 'Deviz'}</Badge>}
        </div>
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{ago}</span>
      </div>

      <p className="text-sm line-clamp-2" style={{ color: 'var(--text)', lineHeight: 1.6 }}>
        {job.description}
      </p>

      <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>📍 {job.city}, {job.area}</span>
        {(job.budget_min || job.budget_max) && (
          <span>💰 {job.budget_min && job.budget_max
            ? `${job.budget_min}–${job.budget_max} MDL`
            : job.budget_min
              ? `${locale === 'ru' ? 'от' : 'de la'} ${job.budget_min} MDL`
              : `${locale === 'ru' ? 'до' : 'până la'} ${job.budget_max} MDL`}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {bidsCount > 0
            ? locale === 'ru'
              ? `${bidsCount} отклик${bidsCount === 1 ? '' : bidsCount < 5 ? 'а' : 'ов'}`
              : `${bidsCount} ofert${bidsCount === 1 ? 'ă' : 'e'}`
            : locale === 'ru' ? 'Нет откликов' : 'Nicio ofertă'}
        </span>
        <Link href={`/${locale}/jobs/${job.id}`} className="btn-primary" style={{ height: 34, padding: '0 16px', fontSize: 13 }}>
          {locale === 'ru' ? 'Откликнуться →' : 'Răspunde →'}
        </Link>
      </div>
    </div>
  );
}

function buildHref(locale: string, params: { city?: string; category?: string; q?: string; sort?: string; page?: string }) {
  const parts: string[] = [];
  if (params.city) parts.push(`city=${encodeURIComponent(params.city)}`);
  if (params.category) parts.push(`category=${params.category}`);
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.sort && params.sort !== 'newest') parts.push(`sort=${params.sort}`);
  if (params.page && params.page !== '1') parts.push(`page=${params.page}`);
  return `/${locale}/jobs${parts.length ? '?' + parts.join('&') : ''}`;
}

function FilterPanel({ locale, selectedCity, selectedCategory, q, sort }: {
  locale: string; selectedCity?: string; selectedCategory?: Category; q?: string; sort?: string;
}) {
  const categories = Object.entries(CATEGORY_LABELS_RU) as [Category, string][];
  return (
    <div className="card p-4 flex flex-col gap-5 sticky top-24">
      <div>
        <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>
          {locale === 'ru' ? 'Город' : 'Oraș'}
        </div>
        <div className="flex flex-col gap-1">
          <FilterLink href={buildHref(locale, { category: selectedCategory, q, sort })} active={!selectedCity}>
            {locale === 'ru' ? 'Все города' : 'Toate orașele'}
          </FilterLink>
          {CITIES.map((c) => (
            <FilterLink key={c} href={buildHref(locale, { city: c, category: selectedCategory, q, sort })} active={selectedCity === c}>{c}</FilterLink>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>
          {locale === 'ru' ? 'Категория' : 'Categorie'}
        </div>
        <div className="flex flex-col gap-1">
          <FilterLink href={buildHref(locale, { city: selectedCity, q, sort })} active={!selectedCategory}>
            {locale === 'ru' ? 'Все категории' : 'Toate categoriile'}
          </FilterLink>
          {categories.map(([slug, label]) => (
            <FilterLink key={slug} href={buildHref(locale, { city: selectedCity, category: slug, q, sort })} active={selectedCategory === slug}>{label}</FilterLink>
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
