/** Only local product destinations. Reject protocol-relative URLs and auth loops. */
export function safeAuthNext(value: string | undefined, locale: string): string {
  const fallback = `/${locale === 'ro' ? 'ro' : 'ru'}/account`;
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value,'https://internal.invalid');
    let path = url.pathname;
    for (let i=0;i<3;i++) path=decodeURIComponent(path);
    if (/[\\%\u0000-\u0020\u007f]/.test(path) || path.includes('//') ||
      !/^\/(ru|ro)\/(account|jobs|request|workers)(\/|$)/.test(path)) return fallback;
    return url.pathname+url.search+url.hash;
  } catch { return fallback; }
}
