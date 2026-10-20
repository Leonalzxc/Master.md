import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master.md';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/ru/account/',
          '/ro/account/',
          '/ru/admin/',
          '/ro/admin/',
          '/ru/auth',
          '/ro/auth',
          '/ru/onboarding',
          '/ro/onboarding',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
