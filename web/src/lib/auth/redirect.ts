const LOCAL_PATH_PATTERN = /^\/(?![\\/])/;
const UNSAFE_PATH_CHARS = /[\\\u0000-\u001F\u007F]/;

export function getSafeRedirectPath(next: string | null | undefined, fallback: string): string {
  if (!next || next.trim() !== next) return fallback;
  if (!LOCAL_PATH_PATTERN.test(next)) return fallback;
  if (UNSAFE_PATH_CHARS.test(next)) return fallback;

  try {
    const decoded = decodeURIComponent(next);
    if (!LOCAL_PATH_PATTERN.test(decoded) || UNSAFE_PATH_CHARS.test(decoded)) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return next;
}
