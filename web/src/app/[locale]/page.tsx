import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    title: `${t('heroTitle')} ${t('heroHighlight')}`,
    description: t('heroSubtitle'),
  };
}

const CATEGORIES = [
  { slug: 'electric', icon: '⚡' },
  { slug: 'plumbing', icon: '🔧' },
  { slug: 'finishing', icon: '🏠' },
  { slug: 'roofing', icon: '🏚️' },
  { slug: 'tiling', icon: '🟫' },
  { slug: 'minorRepairs', icon: '🔨' },
  { slug: 'furniture', icon: '🪑' },
  { slug: 'painting', icon: '🖌️' },
] as const;

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  return (
    <>
      <Header />
      <main className="flex-1">
        <HeroSection locale={locale} />
        <HowItWorksSection />
        <CategoriesSection locale={locale} />
        <TrustSection />
      </main>
      <Footer />
    </>
  );
}

function HeroSection({ locale }: { locale: string }) {
  const t = useTranslations('home');

  return (
    <section
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0e4272 100%)',
        padding: '80px 0 96px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute', top: -80, right: -80,
          width: 320, height: 320, borderRadius: '50%',
          background: 'rgba(14,165,233,.15)', filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div className="container relative">
        <div style={{ maxWidth: 640 }}>
          <h1
            className="font-bold mb-4 text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
              lineHeight: 1.15,
            }}
          >
            {t('heroTitle')}{' '}
            <span style={{ color: 'var(--accent)' }}>{t('heroHighlight')}</span>
          </h1>
          <p className="mb-8 text-lg" style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 520 }}>
            {t('heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/${locale}/request/new`}
              className="btn-primary"
              style={{ fontSize: 16, height: 52, padding: '0 28px' }}
            >
              {t('ctaClient')}
            </Link>
            <Link
              href={`/${locale}/for-workers`}
              className="hero-btn-outline"
            >
              {t('ctaWorker')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const t = useTranslations('home');

  const steps = [
    { num: '01', title: t('step1Title'), desc: t('step1Desc'), icon: '📝' },
    { num: '02', title: t('step2Title'), desc: t('step2Desc'), icon: '💬' },
    { num: '03', title: t('step3Title'), desc: t('step3Desc'), icon: '✅' },
  ];

  return (
    <section style={{ padding: '72px 0', background: 'var(--bg-elevated)' }}>
      <div className="container">
        <h2
          className="font-bold text-center mb-12"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            color: 'var(--text)',
          }}
        >
          {t('howItWorks')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-start gap-4">
              <div
                className="flex items-center justify-center rounded-2xl text-2xl"
                style={{ width: 56, height: 56, background: 'var(--accent-dim)' }}
              >
                {step.icon}
              </div>
              <div>
                <div
                  className="text-xs font-bold mb-1"
                  style={{ color: 'var(--accent)', letterSpacing: '0.1em' }}
                >
                  {step.num}
                </div>
                <h3 className="font-semibold mb-2" style={{ fontSize: 18, color: 'var(--text)' }}>
                  {step.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoriesSection({ locale }: { locale: string }) {
  const t = useTranslations('home');
  const tCat = useTranslations('categories');

  return (
    <section style={{ padding: '72px 0', background: 'var(--bg-deep)' }}>
      <div className="container">
        <h2
          className="font-bold text-center mb-10"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            color: 'var(--text)',
          }}
        >
          {t('categories')}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {CATEGORIES.map(({ slug, icon }) => (
            <Link
              key={slug}
              href={`/${locale}/request/new?category=${slug}`}
              className="category-card card flex flex-col items-center gap-3 p-5 text-center"
              style={{ textDecoration: 'none' }}
            >
              <span className="text-3xl">{icon}</span>
              <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                {tCat(slug)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const t = useTranslations('home');

  const items = [
    { title: t('trust1Title'), desc: t('trust1Desc'), icon: '⭐' },
    { title: t('trust2Title'), desc: t('trust2Desc'), icon: '⚡' },
    { title: t('trust3Title'), desc: t('trust3Desc'), icon: '🔒' },
  ];

  return (
    <section style={{ padding: '72px 0', background: 'var(--bg-elevated)' }}>
      <div className="container">
        <h2
          className="font-bold text-center mb-10"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            color: 'var(--text)',
          }}
        >
          {t('trustTitle')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i} className="card p-6 flex flex-col gap-3">
              <span className="text-2xl">{item.icon}</span>
              <h3 className="font-semibold" style={{ fontSize: 17, color: 'var(--text)' }}>
                {item.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
