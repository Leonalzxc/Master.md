import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_LABELS_RU, CATEGORY_ICONS, type Category } from '@/lib/mock/data';
import type { Bid, Job, ProfileWorker } from '@/lib/supabase/types';

type BidRow = Bid & { job: Pick<Job, 'id' | 'description' | 'category' | 'city' | 'area' | 'status' | 'budget_min' | 'budget_max' | 'created_at'> | null };

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Мои заказы' : 'Comenzile mele' };
}

export default async function WorkerDashboard({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  const [{ data: rawBids }, { data: rawWorker }] = await Promise.all([
    supabase
      .from('bids')
      .select('*, job:jobs(id, description, category, city, area, status, budget_min, budget_max, created_at)')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('profiles_worker').select('*').eq('id', user.id).single(),
  ]);

  const bids = (rawBids ?? []) as unknown as BidRow[];
  const worker = rawWorker as ProfileWorker | null;

  const pendingBids    = bids.filter((b) => b.status === 'sent');
  const activeBids     = bids.filter((b) => b.status === 'selected' && b.job?.status === 'in_progress');
  const completedBids  = bids.filter((b) => b.status === 'selected' && b.job?.status === 'done');
  const rejectedBids   = bids.filter((b) => b.status === 'rejected');

  // Stats
  const totalEarned = completedBids.reduce((sum, b) => sum + (b.price ?? 0), 0);

  const isVerified = worker?.verified ?? false;
  const verificationSubmitted = !!(worker as unknown as { verification_submitted_at?: string })?.verification_submitted_at;

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
                {locale === 'ru' ? 'Мои заказы' : 'Comenzile mele'}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {activeBids.length > 0
                  ? `${activeBids.length} ${locale === 'ru' ? 'активных' : 'active'} · `
                  : ''}
                {completedBids.length} {locale === 'ru' ? 'завершённых' : 'finalizate'}
                {totalEarned > 0 ? ` · ${totalEarned} MDL` : ''}
              </p>
            </div>
            <Link href={`/${locale}/jobs`} className="btn-primary" style={{ fontSize: 14 }}>
              {locale === 'ru' ? 'Найти заявки →' : 'Găsește cereri →'}
            </Link>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Verification banner */}
          {!isVerified && (
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{
                background: verificationSubmitted ? 'rgba(234,179,8,.06)' : 'var(--accent-dim)',
                border: `1px solid ${verificationSubmitted ? 'rgba(234,179,8,.3)' : 'var(--accent)'}`,
              }}
            >
              <span className="text-xl mt-0.5">{verificationSubmitted ? '⏳' : '🛡️'}</span>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {verificationSubmitted
                    ? (locale === 'ru' ? 'Верификация на рассмотрении' : 'Verificare în curs de examinare')
                    : (locale === 'ru' ? 'Пройдите верификацию' : 'Treceți prin verificare')}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {verificationSubmitted
                    ? (locale === 'ru' ? 'Обычно занимает 1–2 рабочих дня. После проверки появится значок ✓ Проверен.' : 'Durează de obicei 1-2 zile lucrătoare.')
                    : (locale === 'ru' ? 'Верифицированные мастера получают значок и больше доверия от заказчиков.' : 'Meșterii verificați primesc mai multă încredere.')}
                </p>
              </div>
              {!verificationSubmitted && (
                <Link href={`/${locale}/workers/${user.id}`} className="btn-secondary shrink-0" style={{ height: 34, fontSize: 13, padding: '0 12px' }}>
                  {locale === 'ru' ? 'Пройти' : 'Verifică'}
                </Link>
              )}
            </div>
          )}

          {/* Stats strip (shown once there's history) */}
          {(completedBids.length > 0 || activeBids.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: '✅', label: locale === 'ru' ? 'Завершено' : 'Finalizate', value: completedBids.length },
                { icon: '🔨', label: locale === 'ru' ? 'В работе' : 'În lucru', value: activeBids.length },
                { icon: '⏳', label: locale === 'ru' ? 'Ожидают' : 'Așteptate', value: pendingBids.length },
                { icon: '⭐', label: locale === 'ru' ? 'Рейтинг' : 'Rating', value: worker?.rating_avg ? `${worker.rating_avg.toFixed(1)}/5` : '—' },
              ].map(({ icon, label, value }) => (
                <div key={label} className="card p-4 text-center">
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="font-bold text-xl" style={{ color: 'var(--text)' }}>{value}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Active jobs (in_progress) */}
          {activeBids.length > 0 && (
            <section>
              <h2 className="font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>
                🔨 {locale === 'ru' ? 'В работе сейчас' : 'În lucru acum'} ({activeBids.length})
              </h2>
              <div className="flex flex-col gap-3">
                {activeBids.map((bid) => (
                  <BidCard key={bid.id} bid={bid} locale={locale} highlight />
                ))}
              </div>
            </section>
          )}

          {/* Pending bids */}
          {pendingBids.length > 0 && (
            <section>
              <h2 className="font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>
                ⏳ {locale === 'ru' ? 'Ожидают ответа' : 'Așteaptă răspuns'} ({pendingBids.length})
              </h2>
              <div className="flex flex-col gap-3">
                {pendingBids.map((bid) => (
                  <BidCard key={bid.id} bid={bid} locale={locale} />
                ))}
              </div>
            </section>
          )}

          {/* Completed jobs */}
          {completedBids.length > 0 && (
            <section>
              <h2 className="font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>
                ✅ {locale === 'ru' ? 'Завершённые заказы' : 'Comenzi finalizate'} ({completedBids.length})
                {totalEarned > 0 && (
                  <span className="ml-2 text-sm font-normal" style={{ color: 'var(--success)' }}>
                    · {totalEarned} MDL
                  </span>
                )}
              </h2>
              <div className="flex flex-col gap-3">
                {completedBids.map((bid) => (
                  <BidCard key={bid.id} bid={bid} locale={locale} done />
                ))}
              </div>
            </section>
          )}

          {/* Rejected */}
          {rejectedBids.length > 0 && (
            <section>
              <details>
                <summary
                  className="font-semibold text-sm cursor-pointer select-none mb-2"
                  style={{ color: 'var(--text-muted)', listStyle: 'none' }}
                >
                  ▸ {locale === 'ru' ? 'Отклонённые' : 'Respinse'} ({rejectedBids.length})
                </summary>
                <div className="flex flex-col gap-3 mt-2">
                  {rejectedBids.map((bid) => (
                    <BidCard key={bid.id} bid={bid} locale={locale} muted />
                  ))}
                </div>
              </details>
            </section>
          )}

          {/* Empty */}
          {bids.length === 0 && (
            <EmptyState
              icon="🔨"
              title={locale === 'ru' ? 'Откликов пока нет' : 'Nu există oferte'}
              description={locale === 'ru' ? 'Найдите заявки и оставьте первый отклик' : 'Găsiți cereri și trimiteți prima ofertă'}
              action={
                <Link href={`/${locale}/jobs`} className="btn-primary" style={{ fontSize: 14 }}>
                  {locale === 'ru' ? 'Смотреть заявки →' : 'Vezi cereri →'}
                </Link>
              }
            />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function BidCard({ bid, locale, highlight, muted, done }: {
  bid: BidRow; locale: string; highlight?: boolean; muted?: boolean; done?: boolean;
}) {
  const job = bid.job;
  if (!job) return null;
  const cat = job.category as Category;

  const completedDate = done && job.created_at
    ? new Date(job.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div
      className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4"
      style={{
        opacity: muted ? 0.55 : 1,
        borderColor: highlight ? 'var(--accent)' : done ? 'var(--success)' : undefined,
        background: done ? 'rgba(22,163,74,.03)' : undefined,
      }}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="category">{CATEGORY_ICONS[cat]} {CATEGORY_LABELS_RU[cat]}</Badge>
          {highlight && <Badge variant="active">🔨 {locale === 'ru' ? 'В работе' : 'În lucru'}</Badge>}
          {done && <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>✅ {locale === 'ru' ? 'Завершён' : 'Finalizat'}</span>}
          {muted && <span className="text-xs" style={{ color: 'var(--danger)' }}>{locale === 'ru' ? 'Отклонён' : 'Respins'}</span>}
        </div>
        <p className="text-sm line-clamp-2" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
          {job.description}
        </p>
        <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>📍 {job.city}, {job.area}</span>
          {bid.price && <span>💰 {locale === 'ru' ? 'Цена:' : 'Preț:'} {bid.price_max ? `${bid.price}–${bid.price_max}` : bid.price} MDL</span>}
          {completedDate && <span>📅 {completedDate}</span>}
        </div>
      </div>
      <Link
        href={`/${locale}/jobs/${job.id}`}
        className={done ? 'text-xs shrink-0' : 'btn-secondary shrink-0'}
        style={done
          ? { color: 'var(--text-muted)', textDecoration: 'none' }
          : { height: 38, padding: '0 14px', fontSize: 13 }}
      >
        {locale === 'ru' ? 'Открыть' : 'Deschide'}
      </Link>
    </div>
  );
}
