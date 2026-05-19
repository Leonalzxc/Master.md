import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import RequestWizard from '@/components/features/RequestWizard';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Создать заявку' : 'Creează cerere' };
}

export default async function NewRequestPage({ params }: Props) {
  const { locale } = await params;
  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', padding: '32px 0 80px' }}>
        <div className="container">
          <div className="mb-6">
            <h1
              className="font-bold text-2xl"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
            >
              {locale === 'ru' ? 'Создать заявку' : 'Creează cerere'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {locale === 'ru' ? 'Бесплатно · Отклики от мастеров за 15–30 мин' : 'Gratuit · Oferte de la meșteri în 15–30 min'}
            </p>
          </div>
          <RequestWizard locale={locale} />
        </div>
      </main>
      <Footer />
    </>
  );
}
