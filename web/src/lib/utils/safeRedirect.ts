export function safeRedirectPath(next: string | undefined, fallback: string) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }

  try {
    const parsed = new URL(next, 'https://master.md');
    if (parsed.origin !== 'https://master.md') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
