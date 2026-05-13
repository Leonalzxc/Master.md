import type { Metadata } from 'next';
import { DM_Sans, Outfit } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import NavigationProgress from '@/components/layout/NavigationProgress';
import '../globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master.md';

export const metadata: Metadata = {
  title: {
    template: '%s | MASTER Moldova',
    default: 'MASTER — Найдите мастера в Молдове',
  },
  description: 'Биржа мастеров для ремонта и строительства в Бельцах и Молдове. Опубликуйте заявку и получите отклики за 15 минут.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    siteName: 'MASTER Moldova',
    locale: 'ru_MD',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'MASTER — Биржа мастеров Молдовы',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@mastermd',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      'ru': `${SITE_URL}/ru`,
      'ro': `${SITE_URL}/ro`,
    },
  },
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'ru' | 'ro')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${dmSans.variable} ${outfit.variable}`}>
      <head>
        {/* View Transitions API — injected raw to bypass PostCSS */}
        <style dangerouslySetInnerHTML={{ __html: `
          @view-transition { navigation: auto; }
          ::view-transition-old(root) { animation: 150ms ease-in both _vt-out; }
          ::view-transition-new(root) { animation: 280ms cubic-bezier(.22,1,.36,1) both _vt-in; }
          @keyframes _vt-out { to { opacity: 0; transform: translateY(-5px); } }
          @keyframes _vt-in  { from { opacity: 0; transform: translateY(12px); } }
        `}} />
      </head>
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <NavigationProgress />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
