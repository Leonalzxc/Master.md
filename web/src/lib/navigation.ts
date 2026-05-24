const SAFE_BASE_URL = 'https://master.md';

export function safeLocalPath(next: string | undefined, fallback: string) {
  if (!next) return fallback;

  try {
    const url = new URL(next, SAFE_BASE_URL);
    if (url.origin !== SAFE_BASE_URL) return fallback;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
