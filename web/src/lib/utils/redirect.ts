export function safeRelativeRedirect(next: string | undefined, fallback: string) {
  if (!next) return fallback;

  let decoded = next;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//')) {
    return fallback;
  }

  return next;
}
