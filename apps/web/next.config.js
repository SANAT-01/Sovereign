/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || "http://localhost:4000";

const nextConfig = {
  async rewrites() {
    return [
      // CSR proxy per APPROACH.md §6: browser-side calls to same-origin
      // /api/:path* and /auth/:path* get forwarded to the internal Express API.
      //
      // Sign-out is deliberately NOT routed through /auth/logout — it's
      // implemented as an explicit Route Handler at
      // app/api/auth/logout/route.ts (served at /api/auth/logout) instead,
      // so it never collides with this catch-all rewrite: a rewrite and a
      // route handler can't both claim the same exact path, and putting the
      // handler under /api/ (rather than /auth/) sidesteps that entirely.
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${API_URL}/auth/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
