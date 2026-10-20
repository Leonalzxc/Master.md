import { safeAuthNext } from './auth-path';

/** Preserve filters and move an authenticated return destination to the new locale. */
export function localePath(pathname: string, search: string, locale: 'ru' | 'ro'): string {
  const path = pathname.replace(/^\/(ru|ro)(?=\/|$)/, `/${locale}`);
  const params = new URLSearchParams(search);
  if (params.has('next')) {
    const next = safeAuthNext(params.get('next') ?? undefined, locale);
    params.set('next', next.replace(/^\/(ru|ro)(?=\/|$)/, `/${locale}`));
  }
  const query = params.toString();
  return path + (query ? `?${query}` : '');
}
