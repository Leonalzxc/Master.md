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

  const [{ data: rawBids }, { data: rawWorker }, { data: rawReviews }] = await Promise.all([
    supabase
      .from('bids')
      .select('*, job:jobs(id, description, category, city, area, status, budget_min, budget_max, created_at)')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('profiles_worker').select('*').eq('id', user.id).single(),
    supabase
      .from('reviews')
      .select('*, author:profiles!reviews_author_id_fkey(name)')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const bids = (rawBids ?? []) as unknown as BidRow[];
  const worker = rawWorker as ProfileWorker | null;

  // Fetch matching jobs (worker's categories + city, not yet bid on)
  const workerCategories = (worker?.categories ?? []) as string[];
  const workerAreas = (worker?.areas ?? []) as string[];
  const bidJobIds = new Set(bids.map((b) => b.job?.id).filter(Boolean) as string[]);

  let matchingJobs: Job[] = [];
  if (workerCategories.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from('jobs') as any)
      .select('id, description, category, city, area, budget_min, budget_max, urgent, created_at')
      .eq('status', 'active')
      .in('category', workerCategories)
      .order('created_at', { ascending: false })
      .limit(6);
    if (workerAreas.length > 0) q = q.in('city', workerAreas);
    const { data: rawMatching } = await q;
    matchingJobs = ((rawMatching ?? []) as Job[]).filter((j) => !bidJobIds.has(j.id));
  }
  const reviews = (rawReviews ?? []) as unknown as Array<{
    id: string; rating: number; text: string | null; created_at: string;
    author: { name: string | null } | null;
  }>;

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

          {/* Stats strip */}
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

          {/* Bid credits card */}
          <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 28 }}>💳</span>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {locale === 'ru' ? 'Кредиты для откликов' : 'Credite pentru oferte'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {locale === 'ru' ? '1 кредит = 1 отклик на заявку' : '1 credit = 1 ofertă pe cerere'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div
                  className="font-bold text-2xl"
                  style={{ color: (worker?.bid_credits ?? 0) > 0 ? 'var(--accent)' : 'var(--danger)' }}
                >
                  {worker?.bid_credits ?? 0}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {locale === 'ru' ? 'кредитов' : 'credite'}
                </div>
              </div>
              <Link
                href={`/${locale}/credits`}
                className="text-xs px-3 py-1.5 rounded-full font-semibold"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', textDecoration: 'none' }}
              >
                + {locale === 'ru' ? 'Купить' : 'Cumpără'}
              </Link>
              {(worker?.bid_credits ?? 0) === 0 && (
                <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{ background: 'rgba(239,68,68,.1)', color: 'var(--danger)' }}>
                  {locale === 'ru' ? 'Нет кредитов' : 'Fără credite'}
                </span>
              )}
            </div>
          </div>

          {/* Matching jobs — relevant new jobs for this worker */}
          {matchingJobs.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
                  📌 {locale === 'ru' ? 'Подходящие заявки' : 'Cereri potrivite'} ({matchingJobs.length})
                </h2>
                <Link
                  href={`/${locale}/jobs`}
                  className="text-xs font-semibold"
                  style={{ color: 'var(--accent)', textDecoration: 'none' }}
                >
                  {locale === 'ru' ? 'Все заявки →' : 'Toate →'}
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {matchingJobs.map((job) => {
                  const cat = job.category as Category;
                  const ago = (() => {
                    const h = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 3_600_000);
                    if (h < 1) return locale === 'ru' ? 'только что' : 'acum';
                    if (h < 24) return `${h} ${locale === 'ru' ? 'ч' : 'ore'}`;
                    return `${Math.floor(h / 24)} ${locale === 'ru' ? 'дн' : 'zile'}`;
                  })();
                  return (
                    <div key={job.id} className="card p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-2 items-center mb-1.5">
                          <Badge variant="category">{CATEGORY_ICONS[cat]} {CATEGORY_LABELS_RU[cat]}</Badge>
                          {(job as unknown as { urgent?: boolean }).urgent && (
                            <Badge variant="urgent">⚡ {locale === 'ru' ? 'Срочно' : 'Urgent'}</Badge>
                          )}
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ago} {locale === 'ru' ? 'назад' : 'în urmă'}</span>
                        </div>
                        <p className="text-sm line-clamp-2" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                          {job.description}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                          <span>📍 {job.city}{job.area ? `, ${job.area}` : ''}</span>
                          {(job.budget_min || job.budget_max) && (
                            <span>💰 {job.budget_min && job.budget_max
                              ? `${job.budget_min}–${job.budget_max} MDL`
                              : job.budget_min ? `${locale === 'ru' ? 'от' : 'de la'} ${job.budget_min} MDL`
                              : `${locale === 'ru' ? 'до' : 'până la'} ${job.budget_max} MDL`}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/${locale}/jobs/${job.id}`}
                        className="btn-primary shrink-0"
                        style={{ height: 36, padding: '0 14px', fontSize: 13 }}
                      >
                        {locale === 'ru' ? 'Откликнуться' : 'Ofertă'} →
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
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

          {/* My reviews */}
          {reviews.length > 0 && (
            <section>
              <h2 className="font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>
                ⭐ {locale === 'ru' ? 'Мои отзывы' : 'Recenziile mele'} ({reviews.length})
              </h2>
              <div className="flex flex-col gap-3">
                {reviews.map((r) => (
                  <div key={r.id} className="card p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                        {r.author?.name ?? (locale === 'ru' ? 'Клиент' : 'Client')}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(r.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} style={{ color: i < r.rating ? '#f59e0b' : 'var(--glass-border)', fontSize: 16 }}>★</span>
                      ))}
                    </div>
                    {r.text && (
                      <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.text}</p>
                    )}
                  </div>
                ))}
              </div>
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
