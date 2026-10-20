import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { PILOT_BID_LIMIT, PILOT_JOB_LIMIT } from '@/lib/pilot';
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Бесплатный пилот в Бельцах' : 'Pilot gratuit în Bălți' };
}
export default async function PilotPage({ params }: Props) {
  const { locale } = await params;
  const ru = locale === 'ru';
  return <><Header /><main className="container flex-1 py-12" style={{ maxWidth: 640 }}>
    <div className="card p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{ru ? 'Бесплатный пилот в Бельцах' : 'Pilot gratuit în Bălți'}</h1>
      <p>{ru ? 'Публикация заявок и отклики бесплатны. Мы не принимаем оплату и не списываем кредиты.' : 'Publicarea cererilor și ofertele sunt gratuite. Nu acceptăm plăți și nu deducem credite.'}</p>
      <p style={{ color: 'var(--text-muted)' }}>{ru
        ? `Для защиты от спама: до ${PILOT_JOB_LIMIT} новых заявок и ${PILOT_BID_LIMIT} новых откликов за 24 часа. Повтор публикации из той же формы или уже отправленного отклика не расходует лимит. Оплату самой работы согласуйте с исполнителем напрямую.`
        : `Pentru protecție împotriva spamului: până la ${PILOT_JOB_LIMIT} cereri noi și ${PILOT_BID_LIMIT} oferte noi în 24 de ore. Reîncercarea unei oferte trimise nu consumă limita. Stabiliți plata lucrării direct cu meșterul.`}</p>
      <Link href={`/${locale}/jobs`} className="btn-primary">{ru ? 'Смотреть заявки' : 'Vezi cererile'}</Link>
      <Link href={`/${locale}/support`} className="btn-secondary">{ru ? 'Поддержка' : 'Asistență'}</Link>
    </div>
  </main><Footer /></>;
}
