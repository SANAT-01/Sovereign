import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:4000";

/**
 * CSR-via-proxy Route Handler (fe-dev pattern). Deliberately placed at
 * /api/auth/logout rather than /auth/logout so it never collides with the
 * blanket /auth/:path* rewrite in next.config.js — a rewrite and a route
 * handler can't both claim the same exact path. Pure forwarding only, no
 * business logic (APPROACH.md §6).
 */
export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";

  const apiRes = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });

  const response = new NextResponse(apiRes.body, {
    status: apiRes.status,
    statusText: apiRes.statusText,
  });

  const setCookie = apiRes.headers.get("set-cookie");
  if (setCookie) response.headers.set("set-cookie", setCookie);

  return response;
}
