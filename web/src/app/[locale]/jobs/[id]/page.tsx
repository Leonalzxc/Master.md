import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Badge from '@/components/ui/Badge';
import RatingStars from '@/components/ui/RatingStars';
import BidForm from '@/components/features/BidForm';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_LABELS_RU, CATEGORY_ICONS, type Category } from '@/lib/mock/data';
import type { Job, Bid, Profile, ProfileWorker } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string; id: string }> };

type WorkerWithProfile = Pick<Profile, 'id' | 'name'> & {
  profiles_worker: Pick<ProfileWorker, 'is_pro' | 'verified' | 'rating_avg' | 'rating_count'> | null;
};

type BidRow = Bid & {
  worker: WorkerWithProfile | null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('jobs').select('*').eq('id', id).single();
  const job = data as Job | null;
  if (!job) return { title: 'Заявка не найдена' };
  return { title: `${CATEGORY_LABELS_RU[job.category as Category]} — ${job.city}, ${job.area}` };
}

export default async function JobDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: rawJob, error: jobError } = await supabase
    .from('jobs').select('*').eq('id', id).single();
  const job = rawJob as Job | null;
  if (jobError || !job) notFound();

  const { data: rawBids } = await supabase
    .from('bids')
    .select('*, worker:profiles(id, name, profiles_worker(is_pro, verified, rating_avg, rating_count))')
    .eq('job_id', id)
    .order('created_at', { ascending: true });

  const bids = ((rawBids ?? []) as BidRow[]).sort((a, b) => {
    if (a.status === 'selected') return -1;
    if (b.status === 'selected') return 1;
    return 0;
  });

  const publishedDate = new Date(job.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <Link
              href={`/${locale}/jobs`}
              className="inline-flex items-center gap-1 text-sm mb-4"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              ← {locale === 'ru' ? 'Все заявки' : 'Toate cererile'}
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="category">
                    {CATEGORY_ICONS[job.category as Category]} {CATEGORY_LABELS_RU[job.category as Category]}
                  </Badge>
                  {job.urgent && <Badge variant="urgent">⚡ Срочно</Badge>}
                  {job.needs_quote && <Badge variant="muted">📋 Нужна смета</Badge>}
                </div>
                <h1
                  className="font-bold text-xl"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
                >
                  {job.description.length > 80 ? job.description.slice(0, 80) + '…' : job.description}
                </h1>
                <div className="flex flex-wrap gap-4 mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <span>📍 {job.city}, {job.area}</span>
                  <span>📅 {publishedDate}</span>
                  <span>💬 {bids.length} {bidsLabel(bids.length)}</span>
                </div>
              </div>

              {(job.budget_min || job.budget_max) ? (
                <div className="card px-5 py-3 text-center">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    {locale === 'ru' ? 'Бюджет' : 'Buget'}
                  </div>
                  <div className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                    {job.budget_min && job.budget_max
                      ? `${job.budget_min}–${job.budget_max} MDL`
                      : job.budget_min ? `от ${job.budget_min} MDL` : `до ${job.budget_max} MDL`}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 28 }}>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 flex flex-col gap-6">
              <div className="card p-6">
                <h2 className="font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>
                  {locale === 'ru' ? 'Описание задачи' : 'Descrierea sarcinii'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: 15 }}>
                  {job.description}
                </p>
              </div>

              <div className="card p-6">
                <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--text)' }}>
                  {locale === 'ru' ? 'Отклики мастеров' : 'Oferte meșteri'}{bids.length > 0 && ` (${bids.length})`}
                </h2>

                {bids.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-2">⏳</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                      {locale === 'ru'
                        ? 'Откликов пока нет. Обычно первые появляются в течение 15–30 минут.'
                        : 'Nu există oferte încă. De obicei primele apar în 15–30 de minute.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {bids.map((bid) => (
                      <BidCard key={bid.id} bid={bid} locale={locale} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside style={{ width: '100%', maxWidth: 300, flexShrink: 0 }}>
              <div className="card p-5 flex flex-col gap-4 sticky top-24">
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  {locale === 'ru' ? 'Вы мастер?' : 'Ești meșter?'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {locale === 'ru'
                    ? 'Войдите и отправьте свой отклик с ценой и сроками.'
                    : 'Autentifică-te și trimite oferta ta cu preț și termene.'}
                </p>
                <BidForm jobId={id} locale={locale} />
                <div
                  className="rounded-xl p-3 text-xs text-center"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  🔒 {locale === 'ru' ? 'Контакты заказчика открываются только при выборе мастера' : 'Contactele clientului se deschid doar la selectarea meșterului'}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function BidCard({ bid, locale }: { bid: BidRow; locale: string }) {
  const isSelected = bid.status === 'selected';
  const workerName = bid.worker?.name ?? 'Мастер';
  const initials = workerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const startDate = bid.start_date
    ? new Date(bid.start_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : null;
  const pw = bid.worker?.profiles_worker ?? null;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        border: `1.5px solid ${isSelected ? 'var(--success)' : 'var(--glass-border)'}`,
        background: isSelected ? 'rgba(22,163,74,.04)' : 'var(--surface-2)',
        position: 'relative',
      }}
    >
      {isSelected && (
        <div className="absolute top-3 right-3">
          <Badge variant="active">✓ Выбран</Badge>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-full font-bold text-white text-sm"
          style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/${locale}/workers/${bid.worker?.id ?? ''}`}
              className="font-semibold text-sm hover:underline"
              style={{ color: 'var(--text)', textDecoration: 'none' }}
            >
              {workerName}
            </Link>
            {pw?.is_pro && <Badge variant="pro">PRO</Badge>}
            {pw?.verified && <Badge variant="verified">✓</Badge>}
          </div>
          {pw && <RatingStars value={pw.rating_avg} count={pw.rating_count} size={13} />}
        </div>

        <div className="text-right shrink-0">
          <div className="font-bold text-lg" style={{ color: 'var(--text)' }}>
            {bid.price_max ? `${bid.price}–${bid.price_max}` : bid.price} MDL
          </div>
          {startDate && (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>с {startDate}</div>
          )}
        </div>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {bid.comment}
      </p>

      {!isSelected && (
        <div className="flex justify-end">
          <Link
            href={`/${locale}/workers/${bid.worker?.id ?? ''}`}
            className="btn-secondary"
            style={{ height: 32, padding: '0 14px', fontSize: 13 }}
          >
            {locale === 'ru' ? 'Профиль мастера' : 'Profilul meșterului'}
          </Link>
        </div>
      )}

      {isSelected && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'rgba(22,163,74,.08)', color: 'var(--success)' }}
        >
          🎉 {locale === 'ru' ? 'Мастер выбран! Контакты доступны в личном кабинете.' : 'Meșter selectat! Contactele sunt disponibile în contul personal.'}
        </div>
      )}
    </div>
  );
}

function bidsLabel(n: number): string {
  if (n === 0) return 'откликов';
  if (n === 1) return 'отклик';
  if (n < 5) return 'отклика';
  return 'откликов';
}
