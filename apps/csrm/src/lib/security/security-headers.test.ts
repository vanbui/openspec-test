import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * The static security headers from next.config.ts (D-19, D-42, T-08-10-02 to T-08-10-04). One rule
 * covers every path, static assets included; the per-request Content-Security-Policy comes from
 * proxy.ts instead, because it carries a fresh nonce. The header list is read once, when Next loads
 * the configuration, so each case loads a fresh copy under the NODE_ENV it describes.
 */

const staticHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];
const strictTransportSecurity = { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' };

async function loadConfig(nodeEnv: string) {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.resetModules();
  return (await import('../../../next.config')).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('the static security headers', () => {
  it('apply to every path in production, with HSTS', async () => {
    const config = await loadConfig('production');

    expect(await config.headers?.()).toEqual([{ source: '/(.*)', headers: [...staticHeaders, strictTransportSecurity] }]);
  });

  it('leave HSTS out of next dev and change nothing else', async () => {
    const config = await loadConfig('development');

    expect(await config.headers?.()).toEqual([{ source: '/(.*)', headers: staticHeaders }]);
  });

  it('send HSTS for two years with subdomains and never ask to be listed in browsers', async () => {
    const config = await loadConfig('production');
    const hsts = (await config.headers?.())?.[0]?.headers.find((header) => header.key === 'Strict-Transport-Security');

    expect(hsts?.value).toBe('max-age=63072000; includeSubDomains');
    expect(hsts?.value.toLowerCase()).not.toContain('preload');
  });

  it('never set a Content-Security-Policy statically, since the proxy issues one per request', async () => {
    for (const nodeEnv of ['production', 'development']) {
      const config = await loadConfig(nodeEnv);
      const keys = (await config.headers?.())?.flatMap((rule) => rule.headers.map((header) => header.key.toLowerCase()));

      expect(keys).not.toContain('content-security-policy');
    }
  });

  it('turn off X-Powered-By', async () => {
    for (const nodeEnv of ['production', 'development']) {
      expect((await loadConfig(nodeEnv)).poweredByHeader).toBe(false);
    }
  });
});
