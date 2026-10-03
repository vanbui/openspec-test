import type { NextConfig } from 'next';

/*
 * The static security headers of every response, static assets included (D-19, D-42; recorded in
 * docs/security/web-headers.md). The Content-Security-Policy is not here: proxy.ts issues it per
 * request because it carries a fresh nonce. HSTS is sent only by a production build (the list is
 * read when Next loads this file) and never under `next dev`. Browsers ignore it over plain HTTP,
 * so it takes effect behind the TLS-terminating proxy a deployment is assumed to have.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // frame-ancestors 'none' in the policy says the same to CSP-aware browsers.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  /*
   * An isolated build (a Playwright run, or a spec's own spawned server) points
   * Next's TypeScript setup at an extends-only configuration. Next bails out of
   * its automatic tsconfig setup when the configured file extends another, so
   * the run never appends its throwaway dist directory to the tracked
   * `tsconfig.json`; type coverage is unchanged because `tsconfig.e2e.json`
   * inherits everything from the base file.
   */
  typescript: {
    tsconfigPath: process.env.CSRM_NEXT_DIST_DIR ? 'tsconfig.e2e.json' : 'tsconfig.json',
  },
  ...(process.env.CSRM_NEXT_DIST_DIR ? { distDir: process.env.CSRM_NEXT_DIST_DIR } : {}),
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  /*
   * The analyst dashboard is Home now (D-16, D-17), so its old address answers a temporary 307 to
   * /app, keeping any query, before the proxy or any rendering. The source is the exact path and the
   * destination is fixed, so nothing in the request chooses the target (T-11-13). The review queues
   * under /app/review/ are separate routes and are unaffected.
   */
  async redirects() {
    return [{ source: '/app/review', destination: '/app', permanent: false }];
  },
};
export default nextConfig;
