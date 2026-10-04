import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master-md.vercel.app';
const LOCALES = ['ru', 'ro'] as const;

function url(path: string): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Sitemap is public data; it must never bypass RLS or require the admin key.
  const supabase = await createClient();

  // Static pages per locale
  const staticPages: MetadataRoute.Sitemap = LOCALES.flatMap((locale) => [
    { url: `${SITE_URL}/${locale}`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1.0 },
    url(`/${locale}/workers`),
    url(`/${locale}/jobs`),
  ]);

  // Dynamic: active jobs
  const { data: rawJobs } = await supabase
    .from('jobs')
    .select('id, created_at')
.eq('status', 'active').eq('city','Бельцы').gt('expires_at',new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);
  const jobs = (rawJobs ?? []) as { id: string; created_at: string }[];

  const jobPages: MetadataRoute.Sitemap = jobs.flatMap((job) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}/${locale}/jobs/${job.id}`,
      lastModified: new Date(job.created_at),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }))
  );

  // Dynamic: worker profiles
  const { data: rawWorkers } = await supabase
    .from('profiles')
    .select('id').eq('role','worker').eq('city','Бельцы').is('blocked_at',null)
    .limit(500);
  const workers = (rawWorkers ?? []) as { id: string }[];

  const workerPages: MetadataRoute.Sitemap = workers.flatMap((w) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}/${locale}/workers/${w.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  );

  return [...staticPages, ...jobPages, ...workerPages];
}
