import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import CancelJobButton from '@/components/features/CancelJobButton';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_LABELS_RU, CATEGORY_ICONS, type Category } from '@/lib/mock/data';
import type { Job } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ reviewed?: string }> };

type JobRow = Job & { bid_count: { count: number }[] };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Мои заявки' : 'Cererile mele' };
}

const STATUS_LABEL: Record<string, { ru: string; ro: string; color: string }> = {
  active:      { ru: 'Активна',      ro: 'Activă',       color: 'var(--success)' },
  in_progress: { ru: 'В работе',     ro: 'În lucru',     color: 'var(--accent)' },
  done:        { ru: 'Завершена',    ro: 'Finalizată',   color: 'var(--text-muted)' },
  cancelled:   { ru: 'Отменена',     ro: 'Anulată',      color: 'var(--danger)' },
  blocked:     { ru: 'Заблокирована',ro: 'Blocată',      color: 'var(--danger)' },
};

export default async function ClientDashboard({ params, searchParams }: Props) {
  const { locale } = await params;
  const { reviewed } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  const { data: rawJobs } = await supabase
    .from('jobs')
    .select('*, bid_count:bids(count)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });

  const jobs = (rawJobs ?? []) as JobRow[];
  const activeCount = jobs.filter((j) => j.status === 'active').length;

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href={`/${locale}/account/profile`} className="text-sm" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  👤 {locale === 'ru' ? 'Мой профиль' : 'Profilul meu'}
                </Link>
              </div>
              <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                {locale === 'ru' ? 'Мои заявки' : 'Cererile mele'}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {jobs.length} {locale === 'ru' ? 'всего' : 'total'}{activeCount > 0 ? ` · ${activeCount} ${locale === 'ru' ? 'активных' : 'active'}` : ''}
              </p>
            </div>
            <Link href={`/${locale}/request/new`} className="btn-primary" style={{ fontSize: 14 }}>
              + {locale === 'ru' ? 'Новая заявка' : 'Cerere nouă'}
            </Link>
          </div>
        </div>

        {reviewed === '1' && (
          <div style={{ background: 'var(--success-dim)', borderBottom: '1px solid rgba(22,163,74,.2)', padding: '12px 0' }}>
            <div className="container flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--success)' }}>
              🎉 {locale === 'ru' ? 'Отзыв отправлен! Заявка завершена.' : 'Recenzia a fost trimisă! Cererea a fost finalizată.'}
            </div>
          </div>
        )}

        <div className="container" style={{ paddingTop: 24 }}>
          {jobs.length === 0 ? (
            <EmptyState
              icon="📋"
              title={locale === 'ru' ? 'Заявок пока нет' : 'Nu există cereri'}
              description={locale === 'ru' ? 'Создайте первую заявку и получите отклики мастеров' : 'Creați prima cerere și primiți oferte de la meșteri'}
              action={
                <Link href={`/${locale}/request/new`} className="btn-primary" style={{ fontSize: 14 }}>
                  {locale === 'ru' ? 'Создать заявку' : 'Creează cerere'}
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {jobs.map((job) => {
                const cat = job.category as Category;
                const bidCount = Array.isArray(job.bid_count) ? (job.bid_count[0] as { count: number })?.count ?? 0 : 0;
                const st = STATUS_LABEL[job.status] ?? STATUS_LABEL.active;
                const ago = (() => {
                  const h = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 3_600_000);
                  if (h < 1) return locale === 'ru' ? 'только что' : 'acum';
                  if (h < 24) return `${h} ${locale === 'ru' ? 'ч назад' : 'ore în urmă'}`;
                  return `${Math.floor(h / 24)} ${locale === 'ru' ? 'д назад' : 'zile în urmă'}`;
                })();

                return (
                  <div key={job.id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left */}
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="category">{CATEGORY_ICONS[cat]} {CATEGORY_LABELS_RU[cat]}</Badge>
                        {job.urgent && <Badge variant="urgent">⚡</Badge>}
                        <span className="text-xs font-semibold" style={{ color: st.color }}>● {locale === 'ru' ? st.ru : st.ro}</span>
                      </div>
                      <p className="text-sm line-clamp-2" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                        {job.description}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>📍 {job.city}, {job.area}</span>
                        <span>🕐 {ago}</span>
                        {bidCount > 0 && (
                          <span style={{ color: job.status === 'active' ? 'var(--accent)' : undefined }}>
                            💬 {bidCount} {locale === 'ru'
                              ? `отклик${bidCount === 1 ? '' : bidCount < 5 ? 'а' : 'ов'}`
                              : `ofert${bidCount === 1 ? 'ă' : 'e'}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {job.status === 'active' && bidCount > 0 && (
                        <Link
                          href={`/${locale}/jobs/${job.id}`}
                          className="btn-primary"
                          style={{ height: 38, padding: '0 16px', fontSize: 13 }}
                        >
                          {locale === 'ru' ? `Отклики (${bidCount})` : `Oferte (${bidCount})`} →
                        </Link>
                      )}
                      {job.status === 'active' && bidCount === 0 && (
                        <>
                          <Link
                            href={`/${locale}/jobs/${job.id}`}
                            className="btn-secondary"
                            style={{ height: 38, padding: '0 14px', fontSize: 13 }}
                          >
                            {locale === 'ru' ? 'Открыть' : 'Deschide'}
                          </Link>
                          <CancelJobButton jobId={job.id} locale={locale} />
                        </>
                      )}
                      {job.status === 'in_progress' && (
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/${locale}/jobs/${job.id}/review`}
                            className="btn-primary"
                            style={{ height: 38, padding: '0 14px', fontSize: 13 }}
                          >
                            ✅ {locale === 'ru' ? 'Завершить' : 'Finalizează'}
                          </Link>
                          <Link
                            href={`/${locale}/jobs/${job.id}`}
                            className="btn-secondary"
                            style={{ height: 38, padding: '0 12px', fontSize: 13 }}
                          >
                            →
                          </Link>
                        </div>
                      )}
                      {(job.status === 'done' || job.status === 'cancelled') && (
                        <Link
                          href={`/${locale}/jobs/${job.id}`}
                          className="text-xs"
                          style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                        >
                          {locale === 'ru' ? 'Открыть' : 'Deschide'}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
