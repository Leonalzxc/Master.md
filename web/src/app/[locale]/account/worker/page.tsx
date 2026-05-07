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

type BidRow = Bid & { job: Pick<Job, 'id' | 'description' | 'category' | 'city' | 'area' | 'status' | 'budget_min' | 'budget_max'> | null };

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
      .select('*, job:jobs(id, description, category, city, area, status, budget_min, budget_max)')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('profiles_worker').select('*').eq('id', user.id).single(),
  ]);

  const bids = (rawBids ?? []) as unknown as BidRow[];
  const worker = rawWorker as ProfileWorker | null;

  const activeBids = bids.filter((b) => b.status === 'sent');
  const selectedBids = bids.filter((b) => b.status === 'selected');
  const rejectedBids = bids.filter((b) => b.status === 'rejected');

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
                <Link href={`/${locale}/account`} className="text-sm" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  ← {locale === 'ru' ? 'Аккаунт' : 'Cont'}
                </Link>
              </div>
              <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                {locale === 'ru' ? 'Мои заказы' : 'Comenzile mele'}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {selectedBids.length > 0
                  ? `${selectedBids.length} ${locale === 'ru' ? 'активных заказов' : 'comenzi active'}`
                  : locale === 'ru' ? 'Нет активных заказов' : 'Nicio comandă activă'}
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

          {/* Active jobs */}
          {selectedBids.length > 0 && (
            <section>
              <h2 className="font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>
                🔨 {locale === 'ru' ? 'Активные заказы' : 'Comenzi active'} ({selectedBids.length})
              </h2>
              <div className="flex flex-col gap-3">
                {selectedBids.map((bid) => (
                  <BidCard key={bid.id} bid={bid} locale={locale} highlight />
                ))}
              </div>
            </section>
          )}

          {/* Pending bids */}
          {activeBids.length > 0 && (
            <section>
              <h2 className="font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>
                ⏳ {locale === 'ru' ? 'Ожидают ответа' : 'Așteaptă răspuns'} ({activeBids.length})
              </h2>
              <div className="flex flex-col gap-3">
                {activeBids.map((bid) => (
                  <BidCard key={bid.id} bid={bid} locale={locale} />
                ))}
              </div>
            </section>
          )}

          {/* Rejected */}
          {rejectedBids.length > 0 && (
            <section>
              <h2 className="font-semibold text-base mb-3" style={{ color: 'var(--text-muted)' }}>
                {locale === 'ru' ? 'Отклонённые' : 'Respinse'} ({rejectedBids.length})
              </h2>
              <div className="flex flex-col gap-3">
                {rejectedBids.map((bid) => (
                  <BidCard key={bid.id} bid={bid} locale={locale} muted />
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

function BidCard({ bid, locale, highlight, muted }: { bid: BidRow; locale: string; highlight?: boolean; muted?: boolean }) {
  const job = bid.job;
  if (!job) return null;
  const cat = job.category as Category;

  return (
    <div
      className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ opacity: muted ? 0.6 : 1, borderColor: highlight ? 'var(--success)' : undefined }}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="category">{CATEGORY_ICONS[cat]} {CATEGORY_LABELS_RU[cat]}</Badge>
          {highlight && <Badge variant="active">✓ {locale === 'ru' ? 'Выбран' : 'Selectat'}</Badge>}
          {muted && <span className="text-xs" style={{ color: 'var(--danger)' }}>{locale === 'ru' ? 'Отклонён' : 'Respins'}</span>}
        </div>
        <p className="text-sm line-clamp-2" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
          {job.description}
        </p>
        <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>📍 {job.city}, {job.area}</span>
          {bid.price && <span>💰 {locale === 'ru' ? 'Моя цена:' : 'Prețul meu:'} {bid.price_max ? `${bid.price}–${bid.price_max}` : bid.price} MDL</span>}
        </div>
      </div>
      <Link
        href={`/${locale}/jobs/${job.id}`}
        className="btn-secondary shrink-0"
        style={{ height: 38, padding: '0 14px', fontSize: 13 }}
      >
        {locale === 'ru' ? 'Открыть заявку' : 'Deschide cererea'}
      </Link>
    </div>
  );
}
