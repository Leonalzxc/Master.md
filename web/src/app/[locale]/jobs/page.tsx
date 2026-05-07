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

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ city?: string; category?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Заявки на работу' : 'Cereri de lucru' };
}

export default async function JobsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { city, category } = await searchParams;

  const supabase = await createClient();

  let query = supabase
    .from('jobs')
    .select('*, bid_count:bids(count)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50);

  if (city) query = query.eq('city', city);
  if (category) query = query.eq('category', category);

  const { data: rawJobs, error } = await query;
  const jobs = rawJobs as JobWithBids[] | null;

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
                {jobs?.length ?? 0} {locale === 'ru' ? 'активных заявок' : 'cereri active'}
              </p>
            </div>
            <Link href={`/${locale}/request/new`} className="btn-primary" style={{ fontSize: 14 }}>
              + {locale === 'ru' ? 'Создать заявку' : 'Creează cerere'}
            </Link>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 24 }}>
          {error && (
            <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
              Ошибка загрузки: {error.message}
            </div>
          )}
          <div className="flex gap-6 flex-col lg:flex-row">
            <aside style={{ width: '100%', maxWidth: 240, flexShrink: 0 }}>
              <FilterPanel locale={locale} selectedCity={city} selectedCategory={category as Category | undefined} />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} locale={locale} />
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

function JobCard({ job, locale }: { job: JobWithBids; locale: string }) {
  const cat = job.category as Category;
  const icon = CATEGORY_ICONS[cat] ?? '🔧';
  const label = CATEGORY_LABELS_RU[cat] ?? cat;
  const bidsCount = Array.isArray(job.bid_count) ? (job.bid_count[0] as { count: number })?.count ?? 0 : 0;

  const ago = (() => {
    const diff = Date.now() - new Date(job.created_at).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return 'только что';
    if (h < 24) return `${h} ч назад`;
    return `${Math.floor(h / 24)} д назад`;
  })();

  return (
    <div className="card p-5 flex flex-col gap-3 hover-lift">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="category">{icon} {label}</Badge>
          {job.urgent && <Badge variant="urgent">⚡ Срочно</Badge>}
          {job.needs_quote && <Badge variant="muted">📋 Смета</Badge>}
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
            : job.budget_min ? `от ${job.budget_min} MDL` : `до ${job.budget_max} MDL`}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {bidsCount > 0 ? `${bidsCount} отклик${bidsCount === 1 ? '' : bidsCount < 5 ? 'а' : 'ов'}` : 'Нет откликов'}
        </span>
        <Link href={`/${locale}/jobs/${job.id}`} className="btn-primary" style={{ height: 34, padding: '0 16px', fontSize: 13 }}>
          Откликнуться →
        </Link>
      </div>
    </div>
  );
}

function FilterPanel({ locale, selectedCity, selectedCategory }: { locale: string; selectedCity?: string; selectedCategory?: Category }) {
  const categories = Object.entries(CATEGORY_LABELS_RU) as [Category, string][];
  return (
    <div className="card p-4 flex flex-col gap-5 sticky top-24">
      <div>
        <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Город</div>
        <div className="flex flex-col gap-1">
          <FilterLink href={`/${locale}/jobs${selectedCategory ? `?category=${selectedCategory}` : ''}`} active={!selectedCity}>Все города</FilterLink>
          {CITIES.map((c) => (
            <FilterLink key={c} href={`/${locale}/jobs?city=${encodeURIComponent(c)}${selectedCategory ? `&category=${selectedCategory}` : ''}`} active={selectedCity === c}>{c}</FilterLink>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Категория</div>
        <div className="flex flex-col gap-1">
          <FilterLink href={`/${locale}/jobs${selectedCity ? `?city=${encodeURIComponent(selectedCity)}` : ''}`} active={!selectedCategory}>Все категории</FilterLink>
          {categories.map(([slug, label]) => (
            <FilterLink key={slug} href={`/${locale}/jobs?category=${slug}${selectedCity ? `&city=${encodeURIComponent(selectedCity)}` : ''}`} active={selectedCategory === slug}>{label}</FilterLink>
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
