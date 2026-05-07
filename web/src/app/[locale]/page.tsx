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
  { slug: 'electric',     icon: '⚡', color: '#fbbf24' },
  { slug: 'plumbing',     icon: '🔧', color: '#38bdf8' },
  { slug: 'finishing',    icon: '🏠', color: '#a78bfa' },
  { slug: 'roofing',      icon: '🏚️', color: '#fb923c' },
  { slug: 'tiling',       icon: '🟫', color: '#86efac' },
  { slug: 'minorRepairs', icon: '🔨', color: '#f87171' },
  { slug: 'furniture',    icon: '🪑', color: '#67e8f9' },
  { slug: 'painting',     icon: '🖌️', color: '#c4b5fd' },
] as const;

const STATS = [
  { value: '500+', labelRu: 'мастеров', labelRo: 'meșteri' },
  { value: '15 мин', labelRu: 'до первого отклика', labelRo: 'primul răspuns' },
  { value: '4.9★', labelRu: 'средний рейтинг', labelRo: 'rating mediu' },
];

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  return (
    <>
      <Header />
      <main className="flex-1">
        <HeroSection locale={locale} />
        <StatsBar locale={locale} />
        <HowItWorksSection />
        <CategoriesSection locale={locale} />
        <TrustSection />
        <CtaBanner locale={locale} />
      </main>
      <Footer />
    </>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────── */
function HeroSection({ locale }: { locale: string }) {
  const t = useTranslations('home');

  return (
    <section
      style={{
        background: 'linear-gradient(135deg, #0b1628 0%, #0f2548 55%, #0c3060 100%)',
        padding: 'clamp(72px, 10vw, 112px) 0 clamp(80px, 12vw, 128px)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Glow blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: 480, height: 480, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14,165,233,.18) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-8%',
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,.1) 0%, transparent 70%)',
        }} />
      </div>

      <div className="container relative">
        <div style={{ maxWidth: 660 }}>
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 mb-5 fade-in"
            style={{
              background: 'rgba(14,165,233,.15)',
              border: '1px solid rgba(14,165,233,.3)',
              borderRadius: 100,
              padding: '6px 14px',
              fontSize: 13,
              color: '#7dd3fc',
              fontWeight: 600,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
            {locale === 'ru' ? 'Молдова · Кишинёв · Бельцы' : 'Moldova · Chișinău · Bălți'}
          </div>

          <h1
            className="font-bold mb-5 text-white fade-in stagger-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.1rem, 5.5vw, 3.5rem)',
              lineHeight: 1.12,
              letterSpacing: '-.02em',
            }}
          >
            {t('heroTitle')}{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('heroHighlight')}
            </span>
          </h1>

          <p
            className="mb-8 fade-in stagger-2"
            style={{
              color: 'rgba(255,255,255,.65)',
              fontSize: 'clamp(16px, 2vw, 18px)',
              lineHeight: 1.7,
              maxWidth: 520,
            }}
          >
            {t('heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 fade-in stagger-3">
            <Link
              href={`/${locale}/request/new`}
              className="btn-primary"
              style={{ fontSize: 16, height: 52, padding: '0 28px' }}
            >
              {t('ctaClient')}
            </Link>
            <Link href={`/${locale}/jobs`} className="hero-btn-outline">
              {locale === 'ru' ? 'Найти заказ →' : 'Găsește cerere →'}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Stats bar ───────────────────────────────────────────────────── */
function StatsBar({ locale }: { locale: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--glass-border)',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${STATS.length}, 1fr)`,
            gap: 0,
          }}
        >
          {STATS.map((s, i) => (
            <div
              key={i}
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                borderRight: i < STATS.length - 1 ? '1px solid var(--glass-border)' : 'none',
              }}
            >
              <div
                className="font-bold"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)',
                  color: 'var(--accent)',
                  lineHeight: 1.2,
                }}
              >
                {s.value}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {locale === 'ru' ? s.labelRu : s.labelRo}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── How it works ────────────────────────────────────────────────── */
function HowItWorksSection() {
  const t = useTranslations('home');

  const steps = [
    { num: '01', title: t('step1Title'), desc: t('step1Desc'), icon: '📝' },
    { num: '02', title: t('step2Title'), desc: t('step2Desc'), icon: '💬' },
    { num: '03', title: t('step3Title'), desc: t('step3Desc'), icon: '✅' },
  ];

  return (
    <section style={{ padding: 'clamp(56px, 8vw, 88px) 0', background: 'var(--bg-deep)' }}>
      <div className="container">
        <div className="text-center mb-12">
          <h2
            className="font-bold"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.6rem, 3vw, 2.1rem)',
              color: 'var(--text)',
              letterSpacing: '-.01em',
            }}
          >
            {t('howItWorks')}
          </h2>
          <p className="mt-2" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
            {/* short sub-text */}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <div
              key={i}
              className="card p-7 flex flex-col gap-4 slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-2xl text-2xl shrink-0"
                  style={{
                    width: 52, height: 52,
                    background: 'linear-gradient(135deg, var(--accent-dim), rgba(14,165,233,.06))',
                  }}
                >
                  {step.icon}
                </div>
                <span
                  className="font-bold text-sm"
                  style={{ color: 'var(--accent)', letterSpacing: '.12em', fontFamily: 'var(--font-display)' }}
                >
                  {step.num}
                </span>
              </div>
              <div>
                <h3 className="font-semibold mb-1.5" style={{ fontSize: 17, color: 'var(--text)' }}>
                  {step.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.65 }}>
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

/* ── Categories ──────────────────────────────────────────────────── */
function CategoriesSection({ locale }: { locale: string }) {
  const t = useTranslations('home');
  const tCat = useTranslations('categories');

  return (
    <section style={{ padding: 'clamp(56px, 8vw, 88px) 0', background: 'var(--bg-elevated)' }}>
      <div className="container">
        <div className="text-center mb-10">
          <h2
            className="font-bold"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.6rem, 3vw, 2.1rem)',
              color: 'var(--text)',
              letterSpacing: '-.01em',
            }}
          >
            {t('categories')}
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {CATEGORIES.map(({ slug, icon, color }, i) => (
            <Link
              key={slug}
              href={`/${locale}/request/new?category=${slug}`}
              className="category-card card flex flex-col items-center gap-3 p-5 text-center slide-up"
              style={{ textDecoration: 'none', animationDelay: `${i * 40}ms` }}
            >
              <div
                style={{
                  width: 52, height: 52,
                  borderRadius: 16,
                  background: `${color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                  transition: 'transform 200ms var(--ease-spring)',
                }}
              >
                {icon}
              </div>
              <span className="font-medium text-sm" style={{ color: 'var(--text)', lineHeight: 1.3 }}>
                {tCat(slug)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Trust ───────────────────────────────────────────────────────── */
function TrustSection() {
  const t = useTranslations('home');

  const items = [
    { title: t('trust1Title'), desc: t('trust1Desc'), icon: '⭐', color: '#fbbf24' },
    { title: t('trust2Title'), desc: t('trust2Desc'), icon: '⚡', color: '#38bdf8' },
    { title: t('trust3Title'), desc: t('trust3Desc'), icon: '🔒', color: '#86efac' },
  ];

  return (
    <section style={{ padding: 'clamp(56px, 8vw, 88px) 0', background: 'var(--bg-deep)' }}>
      <div className="container">
        <h2
          className="font-bold text-center mb-10"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.6rem, 3vw, 2.1rem)',
            color: 'var(--text)',
            letterSpacing: '-.01em',
          }}
        >
          {t('trustTitle')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <div
              key={i}
              className="card p-7 flex flex-col gap-3 slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: `${item.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                {item.icon}
              </div>
              <h3 className="font-semibold" style={{ fontSize: 16.5, color: 'var(--text)' }}>
                {item.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.65 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA Banner ──────────────────────────────────────────────────── */
function CtaBanner({ locale }: { locale: string }) {
  return (
    <section style={{ padding: 'clamp(48px, 7vw, 80px) 0', background: 'var(--bg-elevated)' }}>
      <div className="container">
        <div
          style={{
            background: 'linear-gradient(135deg, #0b1628 0%, #0c3060 100%)',
            borderRadius: 'var(--radius-xl)',
            padding: 'clamp(40px, 6vw, 64px) clamp(24px, 5vw, 56px)',
            position: 'relative',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <div style={{
            position: 'absolute', top: '-30%', right: '-5%',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(14,165,233,.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <h2
            className="font-bold text-white mb-3 relative"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.6rem, 3.5vw, 2.25rem)',
              letterSpacing: '-.02em',
            }}
          >
            {locale === 'ru' ? 'Готовы начать?' : 'Gata să începeți?'}
          </h2>
          <p
            className="mb-7 relative"
            style={{ color: 'rgba(255,255,255,.6)', fontSize: 16, maxWidth: 460, margin: '0 auto 28px' }}
          >
            {locale === 'ru'
              ? 'Опубликуйте заявку бесплатно — первые отклики придут уже через 15 минут.'
              : 'Publicați cererea gratuit — primele oferte vor veni în 15 minute.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center relative">
            <Link
              href={`/${locale}/request/new`}
              className="btn-primary"
              style={{ fontSize: 16, height: 52, padding: '0 32px' }}
            >
              {locale === 'ru' ? '📋 Создать заявку' : '📋 Creează cerere'}
            </Link>
            <Link
              href={`/${locale}/workers`}
              className="hero-btn-outline"
            >
              {locale === 'ru' ? 'Смотреть мастеров →' : 'Vezi meșteri →'}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
