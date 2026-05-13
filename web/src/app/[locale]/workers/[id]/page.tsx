import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Badge from '@/components/ui/Badge';
import RatingStars from '@/components/ui/RatingStars';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_LABELS_RU, CATEGORY_ICONS, type Category } from '@/lib/mock/data';
import type { Profile, ProfileWorker, Review, Job } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string; id: string }> };

type WorkerRow = Profile & { profiles_worker: ProfileWorker | null };
type ReviewRow = Review & {
  author: Pick<Profile, 'name'> | null;
  job: Pick<Job, 'category'> | null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data: wr } = await supabase
    .from('profiles').select('*, profiles_worker(bio, categories, rating_avg, rating_count)').eq('id', id).single();
  const w = wr as unknown as { name: string | null; city: string | null; profiles_worker: { bio?: string | null; rating_avg?: number } | null } | null;
  if (!w) return { title: locale === 'ru' ? 'Мастер не найден' : 'Meșter negăsit' };

  const name = w.name ?? (locale === 'ru' ? 'Мастер' : 'Meșter');
  const title = locale === 'ru' ? `${name} — мастер в ${w.city ?? 'Молдове'}` : `${name} — meșter în ${w.city ?? 'Moldova'}`;
  const description = w.profiles_worker?.bio?.slice(0, 155) ??
    (locale === 'ru' ? `Профиль мастера ${name} на MASTER Moldova` : `Profilul meșterului ${name} pe MASTER Moldova`);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master.md';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `${siteUrl}/${locale}/workers/${id}`,
    },
    alternates: {
      canonical: `${siteUrl}/${locale}/workers/${id}`,
      languages: { ru: `${siteUrl}/ru/workers/${id}`, ro: `${siteUrl}/ro/workers/${id}` },
    },
  };
}

export default async function WorkerProfilePage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: wr, error } = await supabase
    .from('profiles').select('*, profiles_worker(*)').eq('id', id).single();
  if (error || !wr) notFound();
  const worker = wr as unknown as WorkerRow;
  const pw = worker.profiles_worker;
  if (!pw) notFound();

  const { data: rr } = await supabase
    .from('reviews')
    .select('*, author:profiles!reviews_author_id_fkey(name), job:jobs(category)')
    .eq('worker_id', id)
    .order('created_at', { ascending: false });
  const reviews = (rr ?? []) as unknown as ReviewRow[];
  const initials = (worker.name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="container" style={{ paddingTop: 32, paddingBottom: 32 }}>
            <Link
              href={`/${locale}/workers`}
              className="inline-flex items-center gap-1 text-sm mb-6"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              ← {locale === 'ru' ? 'Все мастера' : 'Toți meșterii'}
            </Link>

            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div
                className="shrink-0 flex items-center justify-center rounded-2xl font-bold text-white"
                style={{ width: 88, height: 88, fontSize: 28, background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))' }}
              >
                {initials}
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h1
                    className="font-bold text-2xl"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
                  >
                    {worker.name}
                  </h1>
                  {pw.is_pro && <Badge variant="pro">⭐ PRO</Badge>}
                  {pw.verified && <Badge variant="verified">✓ {locale === 'ru' ? 'Проверен' : 'Verificat'}</Badge>}
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-3">
                  <RatingStars value={pw.rating_avg} count={pw.rating_count} size={16} />
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    📍 {worker.city ?? ''}{pw.areas.length > 0 ? ` · ${pw.areas.join(', ')}` : ''}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {(pw.categories as Category[]).map((cat) => (
                    <Badge key={cat} variant="category">
                      {CATEGORY_ICONS[cat]} {CATEGORY_LABELS_RU[cat]}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap gap-6">
                  <Stat label={locale === 'ru' ? 'Отзывов' : 'Recenzii'} value={`${pw.rating_count}`} />
                  <Stat label={locale === 'ru' ? 'Рейтинг' : 'Rating'} value={`${pw.rating_avg} / 5`} />
                  {pw.experience_yrs != null && (
                    <Stat label={locale === 'ru' ? 'Лет опыта' : 'Ani experiență'} value={`${pw.experience_yrs}`} />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 md:items-end w-full md:w-auto">
                <Link
                  href={`/${locale}/request/new?workerHint=${id}`}
                  className="btn-primary w-full md:w-auto"
                  style={{ fontSize: 15, justifyContent: 'center' }}
                >
                  {locale === 'ru' ? 'Создать заявку' : 'Creează cerere'}
                </Link>
                <Link
                  href={`/${locale}/jobs`}
                  className="btn-secondary w-full md:w-auto"
                  style={{ fontSize: 14, justifyContent: 'center' }}
                >
                  {locale === 'ru' ? 'Смотреть заявки' : 'Vezi cereri'}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32 }}>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 flex flex-col gap-6">

              {pw.bio && (
                <Section title={locale === 'ru' ? 'О мастере' : 'Despre meșter'}>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 15 }}>
                    {pw.bio}
                  </p>
                </Section>
              )}

              {pw.photos && pw.photos.length > 0 ? (
                <Section title={locale === 'ru' ? 'Портфолио' : 'Portofoliu'}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {pw.photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="rounded-xl overflow-hidden aspect-square block hover-lift"
                        style={{ border: '1px solid var(--glass-border)' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`${locale === 'ru' ? 'Работа' : 'Lucrare'} ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </Section>
              ) : null}

              <Section title={`${locale === 'ru' ? 'Отзывы' : 'Recenzii'} (${reviews.length})`}>
                {reviews.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    {locale === 'ru' ? 'Отзывов пока нет' : 'Nu există recenzii încă'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {reviews.map((r) => (
                      <ReviewCard key={r.id} review={r} />
                    ))}
                  </div>
                )}
              </Section>
            </div>

            <aside style={{ width: '100%', maxWidth: 280, flexShrink: 0 }}>
              <div className="card p-5 flex flex-col gap-4 sticky top-24">
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  {locale === 'ru' ? 'Связаться с мастером' : 'Contactează meșterul'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {locale === 'ru'
                    ? 'Контакты мастера открываются после того, как вы выберете его в ответ на свою заявку.'
                    : 'Contactele meșterului se deschid după ce îl selectezi pentru cererea ta.'}
                </p>
                <Link
                  href={`/${locale}/request/new`}
                  className="btn-primary"
                  style={{ justifyContent: 'center', fontSize: 14 }}
                >
                  {locale === 'ru' ? 'Создать заявку →' : 'Creează cerere →'}
                </Link>
                <div
                  className="rounded-xl p-3 text-xs"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  🛡️ {locale === 'ru' ? 'Контакты защищены — открываются только после выбора мастера' : 'Contactele sunt protejate — se deschid doar după selectarea meșterului'}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-bold text-lg" style={{ color: 'var(--text)' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewRow }) {
  const date = new Date(review.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const cat = review.job?.category as Category | undefined;
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--glass-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>
          {review.author?.name ?? 'Клиент'}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date}</span>
      </div>
      <RatingStars value={review.rating} size={14} />
      {review.text && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {review.text}
        </p>
      )}
      {cat && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {CATEGORY_ICONS[cat]} {CATEGORY_LABELS_RU[cat]}
        </span>
      )}
    </div>
  );
}
