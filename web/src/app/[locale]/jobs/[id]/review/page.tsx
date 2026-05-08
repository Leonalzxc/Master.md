import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ReviewForm from '@/components/features/ReviewForm';
import { createClient } from '@/lib/supabase/server';
import type { Job, Profile } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Оставить отзыв' : 'Lasă o recenzie' };
}

export default async function ReviewPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth?next=/${locale}/jobs/${id}/review`);

  const { data: rawJob, error } = await supabase
    .from('jobs').select('*').eq('id', id).single();
  const job = rawJob as Job | null;
  if (error || !job) notFound();

  // Only the job owner can review
  if ((job as unknown as { client_id: string }).client_id !== user.id) {
    redirect(`/${locale}/jobs/${id}`);
  }

  // Must be in_progress to review
  if (job.status !== 'in_progress') {
    redirect(`/${locale}/jobs/${id}`);
  }

  const workerId = (job as unknown as { selected_worker_id: string | null }).selected_worker_id;
  if (!workerId) redirect(`/${locale}/jobs/${id}`);

  // Check already reviewed
  const { data: existing } = await supabase
    .from('reviews').select('id').eq('job_id', id).single();
  if (existing) redirect(`/${locale}/account/client`);

  // Load worker name
  const { data: rawWorker } = await supabase
    .from('profiles').select('name').eq('id', workerId!).single();
  const workerName = (rawWorker as Pick<Profile, 'name'> | null)?.name ?? (locale === 'ru' ? 'Мастер' : 'Meșter');

  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <Link
              href={`/${locale}/jobs/${id}`}
              className="inline-flex items-center gap-1 text-sm mb-4"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              ← {t('Назад к заявке', 'Înapoi la cerere')}
            </Link>
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {t('Оставить отзыв', 'Lasă o recenzie')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {t(
                'Ваш отзыв помогает другим заказчикам выбрать хорошего мастера',
                'Recenzia dvs. ajută alți clienți să aleagă un meșter bun',
              )}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 560 }}>
          <div className="card p-6 md:p-8">
            {/* Worker badge */}
            <div
              className="flex items-center gap-3 mb-6 rounded-xl p-4"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--glass-border)' }}
            >
              <div
                className="shrink-0 flex items-center justify-center rounded-full font-bold text-white"
                style={{ width: 44, height: 44, background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))', fontSize: 16 }}
              >
                {workerName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{workerName}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('Выбранный мастер', 'Meșter selectat')}
                </p>
              </div>
            </div>

            <ReviewForm jobId={id} workerName={workerName} locale={locale} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
