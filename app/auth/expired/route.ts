import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "@/lib/safe-next";
import { CLEAR_SITE_DATA_HEADER, CLEAR_SITE_DATA_VALUE, clearSessionCookies } from "@/lib/session";

const BLOCKED_FETCH_SITES = new Set(["cross-site", "same-site"]);

export function GET(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site && BLOCKED_FETCH_SITES.has(site)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(
    new URL(loginPath(request.nextUrl.searchParams.get("next")), request.url)
  );
  clearSessionCookies(response.cookies);
  response.headers.set(CLEAR_SITE_DATA_HEADER, CLEAR_SITE_DATA_VALUE);
  return response;
}
