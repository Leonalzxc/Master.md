import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import RatingStars from '@/components/ui/RatingStars';
import { createClient } from '@/lib/supabase/server';
import { CITIES, CATEGORY_LABELS_RU, CATEGORY_ICONS, type Category } from '@/lib/mock/data';
import type { Profile, ProfileWorker } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ city?: string; category?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Мастера' : 'Meșteri' };
}

type WorkerRow = Profile & { profiles_worker: ProfileWorker | null };

export default async function WorkersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { city, category } = await searchParams;

  const supabase = await createClient();

  const { data: rawWorkers, error } = await supabase
    .from('profiles')
    .select('*, profiles_worker(*)')
    .eq('role', 'worker')
    .order('name');

  const workers = ((rawWorkers ?? []) as WorkerRow[])
    .filter((w) => w.profiles_worker !== null)
    .filter((w) => !city || w.city === city)
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
          <div className="container flex items-center justify-between gap-4 flex-wrap">
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
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS_RU[cat]}
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

function FilterPanel({ locale, selectedCity, selectedCategory }: { locale: string; selectedCity?: string; selectedCategory?: Category }) {
  const categories = Object.entries(CATEGORY_LABELS_RU) as [Category, string][];
  return (
    <div className="card p-4 flex flex-col gap-5 sticky top-24">
      <div>
        <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>
          {locale === 'ru' ? 'Город' : 'Oraș'}
        </div>
        <div className="flex flex-col gap-1">
          <FilterLink href={`/${locale}/workers${selectedCategory ? `?category=${selectedCategory}` : ''}`} active={!selectedCity}>
            {locale === 'ru' ? 'Все города' : 'Toate orașele'}
          </FilterLink>
          {CITIES.map((c) => (
            <FilterLink key={c} href={`/${locale}/workers?city=${encodeURIComponent(c)}${selectedCategory ? `&category=${selectedCategory}` : ''}`} active={selectedCity === c}>
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
          <FilterLink href={`/${locale}/workers${selectedCity ? `?city=${encodeURIComponent(selectedCity)}` : ''}`} active={!selectedCategory}>
            {locale === 'ru' ? 'Все специальности' : 'Toate specialitățile'}
          </FilterLink>
          {categories.map(([slug, label]) => (
            <FilterLink key={slug} href={`/${locale}/workers?category=${slug}${selectedCity ? `&city=${encodeURIComponent(selectedCity)}` : ''}`} active={selectedCategory === slug}>
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
