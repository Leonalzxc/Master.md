import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Run next-intl middleware first (locale detection/redirect)
  const intlResponse = intlMiddleware(request);

  // Create a response we can attach cookies to
  const response = intlResponse ?? NextResponse.next({ request });

  // Refresh Supabase session so Server Components can read it
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — required for Server Components to see auth state
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // next-intl: all paths except static files and api
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
