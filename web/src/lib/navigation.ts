export function getSafeRedirectPath(next: string | undefined, fallback: string) {
  if (!next) return fallback;

  // Only allow same-origin absolute paths. Protocol-relative URLs (`//host`)
  // would otherwise send authenticated users to an attacker-controlled site.
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;

  return next;
}
