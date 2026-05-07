import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import RequestWizard from '@/components/features/RequestWizard';

export const metadata: Metadata = { title: 'Создать заявку' };

type Props = { params: Promise<{ locale: string }> };

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
              Создать заявку
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Бесплатно · Отклики от мастеров за 15–30 мин
            </p>
          </div>
          <RequestWizard locale={locale} />
        </div>
      </main>
      <Footer />
    </>
  );
}
