// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adapter } from 'next/dist/server/web/adapter';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const refreshMocks = vi.hoisted(() => ({ refreshedSessionCookies: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/oidc-session-refresh', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/oidc-session-refresh')>()),
  refreshedSessionCookies: refreshMocks.refreshedSessionCookies,
}));

import { config, proxy } from '../../../proxy';

/*
 * proxy.ts issues the per-request nonce and Content-Security-Policy (D-19, D-42). Next reads the
 * nonce from the request's Content-Security-Policy header while it renders, so the policy must reach
 * the request as well as the response. NextResponse.next({ request: { headers } }) forwards request
 * headers to the render as x-middleware-request-<name>, listed in x-middleware-override-headers.
 */

const forwardedRequestHeader = (response: Response, name: string) => response.headers.get(`x-middleware-request-${name}`);

async function run(url: string) {
  const response = await proxy(new NextRequest(url));
  const policy = response.headers.get('content-security-policy') ?? '';
  const nonce = forwardedRequestHeader(response, 'x-nonce') ?? '';
  return { response, policy, nonce };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the proxy', () => {
  it('sets one nonce on the request, as x-nonce and inside the policy Next reads, and the same policy on the response', async () => {
    const { response, policy, nonce } = await run('http://127.0.0.1:3000/sign-in');

    expect(nonce).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
    expect(policy).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(forwardedRequestHeader(response, 'content-security-policy')).toBe(policy);
    expect(response.headers.get('x-middleware-override-headers')?.split(',')).toEqual(
      expect.arrayContaining(['x-nonce', 'content-security-policy']),
    );
    // The nonce reaches the browser only inside the policy, never as a response header of its own.
    expect(response.headers.get('x-nonce')).toBeNull();
  });

  it('keeps the incoming request headers', async () => {
    const response = await proxy(new NextRequest('http://127.0.0.1:3000/app', { headers: { 'x-forwarded-proto': 'http', cookie: 'a=b' } }));

    expect(forwardedRequestHeader(response, 'cookie')).toBe('a=b');
    expect(forwardedRequestHeader(response, 'x-forwarded-proto')).toBe('http');
  });

  it('issues a fresh nonce for every request', async () => {
    const runs = await Promise.all(Array.from({ length: 20 }, () => run('http://127.0.0.1:3000/app')));
    const nonces = new Set(runs.map(({ nonce }) => nonce));
    expect(nonces.size).toBe(20);
  });

  it('adds upgrade-insecure-requests only to a request that arrived over HTTPS', async () => {
    expect((await run('http://127.0.0.1:3000/app')).policy).not.toContain('upgrade-insecure-requests');
    expect((await run('https://csrm.example/app')).policy).toMatch(/; upgrade-insecure-requests$/);
  });

  it("allows 'unsafe-eval' only under next dev", async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await run('http://127.0.0.1:3000/app')).policy).not.toContain('unsafe-eval');
    vi.stubEnv('NODE_ENV', 'test');
    expect((await run('http://127.0.0.1:3000/app')).policy).not.toContain('unsafe-eval');
    vi.stubEnv('NODE_ENV', 'development');
    expect((await run('http://127.0.0.1:3000/app')).policy).toContain("'strict-dynamic' 'unsafe-eval'");
  });
});

describe('the proxy in OIDC mode (docs/adr/0004)', () => {
  function stubOidcMode() {
    vi.stubEnv('CSRM_AUTH_OIDC_ENABLED', 'true');
    vi.stubEnv('NODE_ENV', 'development');
  }

  afterEach(() => {
    refreshMocks.refreshedSessionCookies.mockReset();
  });

  it('sends a refreshed session cookie to the browser and forwards it on this request', async () => {
    stubOidcMode();
    refreshMocks.refreshedSessionCookies.mockResolvedValueOnce([
      'authjs.session-token=refreshed; Path=/; HttpOnly; SameSite=Lax',
      'authjs.session-token.1=; Path=/; Max-Age=0',
    ]);

    const response = await proxy(new NextRequest('http://localhost:3000/app', {
      headers: { cookie: 'authjs.session-token=stale; authjs.session-token.1=stale-chunk; other=kept' },
    }));

    expect(response.headers.getSetCookie()).toEqual([
      'authjs.session-token=refreshed; Path=/; HttpOnly; SameSite=Lax',
      'authjs.session-token.1=; Path=/; Max-Age=0',
    ]);
    expect(forwardedRequestHeader(response, 'cookie')).toBe('authjs.session-token=refreshed; other=kept');
    expect(response.headers.get('content-security-policy')).toContain("'strict-dynamic'");
  });

  it('leaves the request cookie and the response alone when nothing was refreshed', async () => {
    stubOidcMode();
    refreshMocks.refreshedSessionCookies.mockResolvedValueOnce([]);

    const response = await proxy(new NextRequest('http://localhost:3000/app', { headers: { cookie: 'authjs.session-token=current' } }));

    expect(response.headers.getSetCookie()).toEqual([]);
    expect(forwardedRequestHeader(response, 'cookie')).toBe('authjs.session-token=current');
  });

  it('never runs the refresh outside OIDC mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    await proxy(new NextRequest('http://localhost:3000/app'));

    expect(refreshMocks.refreshedSessionCookies).not.toHaveBeenCalled();
  });
});

describe('the proxy matcher', () => {
  const matches = (url: string, headers?: Record<string, string>) => unstable_doesMiddlewareMatch({ config, url, headers });

  it.each(['/', '/sign-in', '/sign-in?returnTo=%2Fapp', '/app', '/app/requests/abc123', '/app/admin/risk-types/import', '/app/this-route-does-not-exist', '/bproton-logo.png'])(
    'runs for the page or public file %s',
    (url) => {
      expect(matches(url)).toBe(true);
    },
  );

  it.each(['/_next/static/chunks/main.js', '/_next/static/media/font.woff2', '/_next/image?url=%2Fbproton-logo.png&w=64&q=75', '/icon.png'])(
    'leaves the static asset %s to the static headers',
    (url) => {
      expect(matches(url)).toBe(false);
    },
  );

  // SR-05: each exclusion names one real path, so a URL that only resembles it renders a document
  // (the not-found page) and must get the policy like any other.
  it.each(['/iconXpng', '/icon.png-x', '/icon.png/x', '/icon.pngx', '/_next/staticfoo', '/_next/static', '/_next/imagery', '/_next/image/x'])(
    'runs for %s, which only resembles a static exclusion',
    (url) => {
      expect(matches(url)).toBe(true);
    },
  );

  // CR-402: a prefetch keeps its old treatment (no policy work, no session refresh) only while it declares no body; a
  // request that declares one (a length, or a streamed body) runs the proxy, so the body gate sees it whatever it carries.
  it('leaves out a bodiless prefetch, which renders no document, and runs for any prefetch-headed request that declares a body', () => {
    expect(matches('/app/requests', { 'next-router-prefetch': '1', rsc: '1' })).toBe(false);
    expect(matches('/app/requests', { purpose: 'prefetch' })).toBe(false);
    expect(matches('/app/requests', { rsc: '1' })).toBe(true);
    expect(matches('/app/requests', { 'next-router-prefetch': '1', rsc: '1', 'content-length': '7340032' })).toBe(true);
    expect(matches('/app/requests', { purpose: 'prefetch', 'content-length': '0' })).toBe(true);
    expect(matches('/sign-in', { 'next-router-prefetch': '1', 'transfer-encoding': 'chunked' })).toBe(true);
    expect(matches('/_next/static/chunks/main.js', { 'next-router-prefetch': '1', 'content-length': '7340032' })).toBe(false);
  });

  /*
   * Why the matcher, not proxy(), tells a router prefetch apart: Next removes its Flight headers (rsc,
   * next-router-prefetch and the router's state headers) from the request before the proxy reads it, so inside proxy()
   * a router prefetch looks like any other GET. `purpose` and `next-action` are not Flight headers and do arrive.
   */
  it('cannot see a router prefetch inside proxy(), because Next strips its headers first', async () => {
    let seen: Headers | undefined;
    await adapter({
      handler: async (request) => {
        seen = new Headers(request.headers);
        return new Response(null);
      },
      page: 'middleware',
      request: {
        headers: { 'next-router-prefetch': '1', rsc: '1', purpose: 'prefetch', 'next-action': '7f00c0ffee', 'content-length': '12' },
        method: 'GET',
        url: 'http://127.0.0.1:3000/app/requests',
        signal: new AbortController().signal,
      },
    });

    expect(seen?.get('next-router-prefetch')).toBeNull();
    expect(seen?.get('rsc')).toBeNull();
    expect(seen?.get('purpose')).toBe('prefetch');
    expect(seen?.get('next-action')).toBe('7f00c0ffee');
    expect(seen?.get('content-length')).toBe('12');
  });
});

describe('per-request rendering', () => {
  /*
   * Next applies the nonce while it renders a request, so a page prerendered at build time ships its
   * scripts without one and the policy blocks them. The build prerendered the unmatched-URL page
   * (/_not-found) that way until the root layout made every page render per request.
   */
  it('renders every page per request, so every page can carry the nonce', () => {
    const rootLayout = readFileSync(resolve(process.cwd(), 'app', 'layout.tsx'), 'utf8');

    expect(rootLayout).toMatch(/^export const dynamic = 'force-dynamic';$/m);
  });
});
