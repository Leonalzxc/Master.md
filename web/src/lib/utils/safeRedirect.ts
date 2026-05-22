export function safeLocalRedirectPath(next: string | null | undefined, fallback: string) {
  if (
    !next ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.includes('\\') ||
    next.includes('://')
  ) {
    return fallback;
  }

  return next;
}
