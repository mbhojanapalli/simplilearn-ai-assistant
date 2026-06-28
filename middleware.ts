import { NextRequest, NextResponse } from "next/server";

// NOTE: kept as a literal (not imported from lib/auth) so this edge-runtime
// middleware doesn't pull in node:crypto. Real verification happens in the
// admin API routes; this is only a UX redirect based on cookie presence.
const ADMIN_COOKIE = "sl_admin_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminArea =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");

  if (isAdminArea && !req.cookies.has(ADMIN_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
