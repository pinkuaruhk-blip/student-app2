import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Simply pass through - locale is handled by cookie in i18n/request.ts
  return NextResponse.next();
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
