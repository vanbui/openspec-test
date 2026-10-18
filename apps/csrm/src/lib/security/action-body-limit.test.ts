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

import nextConfig from '../../../next.config';
import { config, proxy } from '../../../proxy';
import {
  ATTACHMENT_ACTION_BODY_LIMIT,
  ATTACHMENT_ACTION_PATHS,
  DEFAULT_ACTION_BODY_LIMIT_BYTES,
  exceedsActionBodyLimit,
} from './action-body-limit';

/*
 * D-25 (14-RESEARCH Settled 6, Pitfall 1): a file of up to 25 MB reaches its Server Action whole, but only on the pages
 * that add files. Next's two limits are global, so they are raised together to 26 MB, and the proxy answers 413 to every
 * other POST over the 6 MB ceiling every other page keeps, or one that does not say how long it is, before Next reads
 * its body. Next treats any POST as a possible Server Action, with or without `Next-Action` (a multipart or urlencoded
 * body is enough), so the gate holds every POST (CR-401, WR-601); on the four attachment pages only a
 * `multipart/form-data` post may be larger (IN-401). Each case runs through the gate, through `config.matcher` (Next's
 * own matcher says the proxy runs for the request as it arrives) and through `proxy()`, because a request the matcher
 * skips never meets the gate (CR-402).
 */

const MB = 1024 * 1024;
const OVER_THE_CEILING = String(7 * MB);
const ATTACHMENT_PAGES = ['/app/requests/new', '/app/requests/abc', '/app/requests/abc/edit', '/app/review/requests/abc'];
const OUTSIDE_PAGES = ['/app/requests', '/app/risks/abc', '/sign-in', '/'];
const MULTIPART = 'multipart/form-data; boundary=----csrm-evidence';
const URLENCODED = 'application/x-www-form-urlencoded';
const TEXT_ACTION = { 'next-action': '7f00c0ffee', 'content-type': 'text/plain;charset=UTF-8' };

type HeaderMap = Record<string, string>;

function request(path: string, headers: HeaderMap, method = 'POST'): NextRequest {
  return new NextRequest(`http://127.0.0.1:3000${path}`, { method, headers });
}

/** Next's own matcher, on the headers as they arrive: true when the proxy, and so the gate, runs. */
function proxyRuns(path: string, headers: HeaderMap): boolean {
  return unstable_doesMiddlewareMatch({ config, url: path, headers });
}

async function expectRefusedUnread(path: string, headers: HeaderMap): Promise<void> {
  expect(exceedsActionBodyLimit(request(path, headers)), `the gate refuses the POST to ${path}`).toBe(true);
  expect(proxyRuns(path, headers), `the proxy runs for the POST to ${path}`).toBe(true);
  const response = await proxy(request(path, headers));
  expect(response.status, `the proxy answers the POST to ${path}`).toBe(413);
  expect(response.headers.get('content-security-policy'), 'a refusal does no policy work').toBeNull();
}

async function expectAdmitted(path: string, headers: HeaderMap): Promise<Response> {
  expect(exceedsActionBodyLimit(request(path, headers)), `the gate admits the POST to ${path}`).toBe(false);
  expect(proxyRuns(path, headers), `the proxy runs for the POST to ${path}`).toBe(true);
  const response = await proxy(request(path, headers));
  expect(response.status, `the proxy passes the POST to ${path} on`).toBe(200);
  expect(response.headers.get('content-security-policy'), 'an admitted request gets its policy').toContain("default-src 'self'");
  return response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  refreshMocks.refreshedSessionCookies.mockReset();
});

describe('the Server Action body gate (D-25)', () => {
  it('keeps the ceiling every other page had: 6 MB', () => {
    expect(DEFAULT_ACTION_BODY_LIMIT_BYTES).toBe(6_291_456);
    expect(ATTACHMENT_ACTION_BODY_LIMIT).toBe('26mb');
  });

  it.each(ATTACHMENT_PAGES)('admits a 27 MB multipart upload on the attachment page %s, with or without Next-Action', async (path) => {
    expect(ATTACHMENT_ACTION_PATHS.some((pattern) => pattern.test(path))).toBe(true);
    await expectAdmitted(path, { 'next-action': '7f00c0ffee', 'content-type': MULTIPART, 'content-length': String(27 * MB) });
    await expectAdmitted(path, { 'content-type': MULTIPART, 'content-length': String(27 * MB) });
  });

  it('reads the multipart media type without regard to its case or its parameters, and admits no other type above 6 MB', () => {
    const upload = (contentType: string) => request('/app/requests/abc', { 'next-action': '7f00c0ffee', 'content-type': contentType, 'content-length': String(25 * MB) });
    expect(exceedsActionBodyLimit(upload('Multipart/Form-Data; boundary=abc'))).toBe(false);
    expect(exceedsActionBodyLimit(upload('multipart/form-data;boundary="a b"'))).toBe(false);
    expect(exceedsActionBodyLimit(upload('multipart/mixed; boundary=abc'))).toBe(true);
    expect(exceedsActionBodyLimit(upload('multipart/form-data-x; boundary=abc'))).toBe(true);
    expect(exceedsActionBodyLimit(upload('application/octet-stream'))).toBe(true);
  });

  it.each(ATTACHMENT_PAGES)('holds every other POST on the attachment page %s to 6 MB (IN-401)', async (path) => {
    await expectRefusedUnread(path, { ...TEXT_ACTION, 'content-length': OVER_THE_CEILING });
    await expectRefusedUnread(path, { 'next-action': '7f00c0ffee', 'content-type': URLENCODED, 'content-length': OVER_THE_CEILING });
    await expectRefusedUnread(path, { 'content-type': URLENCODED, 'content-length': OVER_THE_CEILING });
    await expectRefusedUnread(path, TEXT_ACTION);
    await expectAdmitted(path, { ...TEXT_ACTION, 'content-length': String(DEFAULT_ACTION_BODY_LIMIT_BYTES) });
  });

  it.each(['/app/requests', '/app/review/questionnaires/abc', '/app/requests/abc/edit/more', '/app', '/app/risks/abc'])('refuses an action post over 6 MB on %s', (path) => {
    expect(exceedsActionBodyLimit(request(path, { ...TEXT_ACTION, 'content-length': '6291457' }))).toBe(true);
  });

  it('admits an action post of exactly 6 MB elsewhere', () => {
    expect(exceedsActionBodyLimit(request('/app/requests', { ...TEXT_ACTION, 'content-length': '6291456' }))).toBe(false);
  });

  it('refuses a POST elsewhere that does not say how long it is, or says it in other than a decimal number', () => {
    expect(exceedsActionBodyLimit(request('/app/requests', TEXT_ACTION))).toBe(true);
    expect(exceedsActionBodyLimit(request('/app/requests', {}))).toBe(true);
    for (const declared of ['', ' ', 'abc', '-1', '1.5', '1e3', '0x10', '+5']) {
      expect(exceedsActionBodyLimit(request('/app/review/questionnaires/abc', { ...TEXT_ACTION, 'content-length': declared })), `Content-Length: "${declared}"`).toBe(true);
    }
  });

  it('leaves a GET to the rest of the proxy, and holds a POST that carries no Next-Action to the same ceiling (CR-401, WR-601)', () => {
    expect(exceedsActionBodyLimit(request('/app/requests', { ...TEXT_ACTION, 'content-length': String(27 * MB) }, 'GET'))).toBe(false);
    expect(exceedsActionBodyLimit(request('/app/requests', { 'content-length': String(27 * MB) }))).toBe(true);
  });

  /*
   * CR-401: Next parses a multipart POST with no Next-Action as a possible progressive-enhancement action, buffering it
   * up to the global 26 MB, and lets an urlencoded POST into its action handler too. CR-402: a request carrying either
   * prefetch header used to skip the proxy, and the gate with it.
   */
  const bypasses: [string, HeaderMap][] = [
    ['a multipart post with no Next-Action (CR-401)', { 'content-type': MULTIPART }],
    ['an urlencoded post (CR-401)', { 'content-type': URLENCODED }],
    ['an action post carrying purpose: prefetch (CR-402)', { ...TEXT_ACTION, purpose: 'prefetch' }],
    ['an action post carrying next-router-prefetch: 1 (CR-402)', { ...TEXT_ACTION, 'next-router-prefetch': '1' }],
    ['a multipart post carrying next-router-prefetch: 1 and rsc: 1 (CR-401, CR-402)', { 'content-type': MULTIPART, 'next-router-prefetch': '1', rsc: '1' }],
  ];
  describe.each(OUTSIDE_PAGES)('outside the attachment pages, on %s', (path) => {
    it.each(bypasses)('answers 413 to %s over 6 MB, before any policy work', async (_, headers) => {
      await expectRefusedUnread(path, { ...headers, 'content-length': OVER_THE_CEILING });
    });
  });

  it('runs the gate for a prefetch-headed POST that streams its body without saying how long it is (CR-402)', async () => {
    await expectRefusedUnread('/app/requests', { ...TEXT_ACTION, 'next-router-prefetch': '1', 'transfer-encoding': 'chunked' });
    await expectRefusedUnread('/app/requests', { 'content-type': MULTIPART, purpose: 'prefetch', 'transfer-encoding': 'chunked' });
  });

  it('answers 413 through Next’s own proxy wrapper, which strips the router’s prefetch header before the proxy reads the request (CR-401, CR-402)', async () => {
    for (const headers of [
      { 'content-type': MULTIPART, 'next-router-prefetch': '1', rsc: '1', 'content-length': OVER_THE_CEILING },
      { ...TEXT_ACTION, 'next-router-prefetch': '1', 'content-length': OVER_THE_CEILING },
    ]) {
      const { response } = await adapter({
        handler: proxy,
        page: 'middleware',
        request: { headers, method: 'POST', url: 'http://127.0.0.1:3000/app/risks/abc', signal: new AbortController().signal },
      });
      expect(response.status, JSON.stringify(headers)).toBe(413);
    }
  });
});

describe('ordinary traffic still passes the gate (CR-401)', () => {
  it('admits the development sign-in, posted as a Server Action and as the form before hydration', async () => {
    await expectAdmitted('/sign-in', { 'next-action': '40a1b2c3d4', 'content-type': MULTIPART, 'content-length': '612' });
    await expectAdmitted('/sign-in', { 'content-type': MULTIPART, 'content-length': '748' });
  });

  it.each(['/app/requests', '/app/risks/abc', '/app/review/questionnaires/abc'])('admits an ordinary Server Action of a few KB on %s', async (path) => {
    await expectAdmitted(path, { ...TEXT_ACTION, 'content-length': String(4 * 1024) });
  });

  it('admits a POST with no body, which a browser sends with Content-Length: 0', async () => {
    await expectAdmitted('/app/requests', { 'next-action': '7f00c0ffee', 'content-length': '0' });
  });

  describe('in OIDC mode (docs/adr/0004; unit level only)', () => {
    function stubOidcMode() {
      vi.stubEnv('CSRM_AUTH_OIDC_ENABLED', 'true');
      vi.stubEnv('NODE_ENV', 'development');
      refreshMocks.refreshedSessionCookies.mockResolvedValue([]);
    }

    it.each([
      ['the sign-out post', '/api/auth/signout', '163'],
      ['the Keycloak sign-in post', '/api/auth/signin/keycloak', '149'],
      ['the Keycloak callback post', '/api/auth/callback/keycloak', '1874'],
    ])('admits %s and gives it its normal treatment', async (_, path, length) => {
      stubOidcMode();
      await expectAdmitted(path, { 'content-type': URLENCODED, 'content-length': length, cookie: 'authjs.csrf-token=abc' });
      expect(refreshMocks.refreshedSessionCookies).toHaveBeenCalledTimes(1);
    });

    it('admits an ordinary Server Action and gives it its normal treatment', async () => {
      stubOidcMode();
      await expectAdmitted('/app/requests', { ...TEXT_ACTION, 'content-length': String(4 * 1024) });
      expect(refreshMocks.refreshedSessionCookies).toHaveBeenCalledTimes(1);
    });

    it('answers an oversized or unmeasured POST 413 before the session is read: the refresh never runs (IN-604)', async () => {
      stubOidcMode();
      await expectRefusedUnread('/app/requests', { ...TEXT_ACTION, 'content-length': OVER_THE_CEILING });
      await expectRefusedUnread('/app/risks/abc', { 'content-type': MULTIPART, 'content-length': OVER_THE_CEILING });
      await expectRefusedUnread('/api/auth/signout', { 'content-type': URLENCODED });
      expect(refreshMocks.refreshedSessionCookies).not.toHaveBeenCalled();
    });
  });
});

describe('Next’s two body limits (Pitfall 1)', () => {
  it('raises the Server Action limit and the proxy’s body clone together, so a large upload is never cut short', () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe(ATTACHMENT_ACTION_BODY_LIMIT);
    expect(nextConfig.experimental?.proxyClientMaxBodySize).toBe(ATTACHMENT_ACTION_BODY_LIMIT);
  });

  it('names no other limit in the configuration', () => {
    const source = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8');
    expect(source).not.toMatch(/'6mb'/);
    expect(source).toContain('proxyClientMaxBodySize');
  });
});
