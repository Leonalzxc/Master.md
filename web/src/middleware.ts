import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Collect any Supabase session cookie updates
  const updatedCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          updatedCookies.push(...cookiesToSet);
        },
      },
    }
  );

  // Refresh session — do NOT remove, required to keep tokens fresh
  const { data: { user } } = await supabase.auth.getUser();

  // Protect /account and /onboarding routes (require auth)
  const pathname = request.nextUrl.pathname;
  const locale = pathname.match(/^\/(ru|ro)/)?.[1] ?? 'ru';
  if (/^\/(ru|ro)\/(account|onboarding)/.test(pathname) && !user) {
    const url = new URL(`/${locale}/auth`, request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Run intl middleware for locale routing
  const response = intlMiddleware(request);

  // Copy refreshed Supabase auth cookies to the response
  updatedCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  return response;
}

export const config = {
  matcher: ['/', '/(ru|ro)/:path*', '/((?!_next|_vercel|api|.*\\..*).*)'],
};
