import { NextRequest, NextResponse } from "next/server";
import { SITE_ORIGIN } from "@/lib/site-config";

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  // Les reverse proxies de production renseignent x-forwarded-proto.
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const host = request.headers.get("host") || request.nextUrl.host;
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  if (localHost) return NextResponse.next();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "");
  if (protocol !== "http") return NextResponse.next();
  const target = new URL(SITE_ORIGIN);
  target.pathname = request.nextUrl.pathname;
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 308);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
