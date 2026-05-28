const INTERNAL_URL_BASE = 'https://master.md';

export function safeInternalPath(next: string | null | undefined, fallback: string) {
  if (!next || !next.startsWith('/')) {
    return fallback;
  }

  try {
    const parsed = new URL(next, INTERNAL_URL_BASE);
    if (parsed.origin !== INTERNAL_URL_BASE) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
