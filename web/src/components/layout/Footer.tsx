import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

export default function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto"
      style={{
        background: 'var(--text)',
        color: 'rgba(255,255,255,0.7)',
        paddingTop: 48,
        paddingBottom: 32,
      }}
    >
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div
              className="flex items-center gap-2 mb-3 font-bold text-xl text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span
                className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold"
                style={{ background: 'var(--accent)' }}
              >
                M
              </span>
              MASTER
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {t('tagline')}
            </p>
          </div>

          {/* Cities */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">{t('cities')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href={`/${locale}/workers?city=chisinau`}
                  className="hover:text-white transition-colors"
                >
                  {t('chisinau')}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/workers?city=balti`}
                  className="hover:text-white transition-colors"
                >
                  {t('balti')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">{t('legal')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/legal/terms`} className="hover:text-white transition-colors">
                  {t('terms')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/legal/privacy`} className="hover:text-white transition-colors">
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/legal/moderation`} className="hover:text-white transition-colors">
                  {t('moderation')}
                </Link>
              </li>
            </ul>
          </div>

          {/* For workers */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">{t('forWorkers')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/for-workers`} className="hover:text-white transition-colors">
                  {t('forWorkers')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/pricing`} className="hover:text-white transition-colors">
                  {t('pricing')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/support`} className="hover:text-white transition-colors">
                  {t('support')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          <span>© {year} MASTER Moldova. {t('rights')}.</span>
          <div className="flex gap-4">
            <Link href="/ru" className="hover:text-white transition-colors">RU</Link>
            <Link href="/ro" className="hover:text-white transition-colors">RO</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
