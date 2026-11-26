import { NextResponse, type NextRequest } from "next/server";

/**
 * Password protection for the online version: when APP_PASSWORD is set, the
 * browser asks for it (any user name). Media files stay public because
 * Instagram and Facebook must download them to publish.
 */
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (safeEqual(given, password)) return NextResponse.next();
  }
  return new NextResponse("Password richiesta", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Social Studio", charset="UTF-8"' },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  matcher: ["/((?!api/media/|api/health|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
