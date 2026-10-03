import { spawn, type ChildProcess } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type APIResponse, type BrowserContext, type Page } from '@playwright/test';

import { harnessPort } from '../src/lib/testing/e2e-harness-ports';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { expectPortFree } from './helpers/ports';
import { expectSettled } from './helpers/settle';

/*
 * The production-build proofs of D-11, D-19, D-22 and D-48. The suite's own web server is a
 * production build inside the attested E2E runtime; the second test starts the same build again
 * without the attestation and shows that the development sign-in does not exist there, however the
 * two development variables are set, and the third starts it once more with NODE_ENV=development
 * (SR-01): a production build keys the session on the NODE_ENV it was compiled with, never on the
 * one it is started with. The rest prove the security headers and the nonce-based
 * Content-Security-Policy on every route for every actor, that no server-only name or value reached
 * a client chunk, and that a cross-origin Server Action request is refused before any action runs.
 */

const attestationGateMessage = 'ATTESTED_PRODUCTION_SIGN_IN_UNAVAILABLE: the D-11 gates did not hold';
const unavailableHeading = 'Sign-in unavailable';
const unavailableTitle = 'Sign-in unavailable | IdamBox CSRM';
const roleCookieName = 'csrm-development-role';
const signInRedirect = /\/sign-in\?returnTo=%2Fapp$/;
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// Each refused runtime takes a port from its own band, below every default ephemeral range (SR-10).
const unattestedPort = harnessPort('unattestedProduction', process.pid);
const unattestedOrigin = `http://127.0.0.1:${unattestedPort}`;
const developmentRuntimePort = harnessPort('unattestedDevelopment', process.pid);
const developmentRuntimeOrigin = `http://127.0.0.1:${developmentRuntimePort}`;

type RunValue =
  | 'CSRM_E2E_NEXT_DIST_DIR'
  | 'CSRM_E2E_STRAPI_ORIGIN'
  | 'CSRM_E2E_WEB_ORIGIN'
  | 'CSRM_E2E_DEVELOPMENT_API_TOKEN'
  | 'CSRM_E2E_ATTESTATION_NONCE_VALUE';

function requireRunValue(name: RunValue): string {
  const value = process.env[name];
  if (!value) throw new Error(`PRODUCTION_HARDENING_RUN_VALUE_MISSING: playwright.config.ts did not expose ${name}`);
  return value;
}

/** The NODE_ENV a spawned `next start` of the run's build runs with. */
type RuntimeNodeEnvironment = 'production' | 'development';

/**
 * The same production build, the same Strapi, the two development variables
 * present, and no run attestation at all: only the attestation gate is removed.
 * The build is started with the given NODE_ENV; `next start` keeps an explicit
 * `development` and only warns about it.
 */
function unattestedEnvironment(nodeEnvironment: RuntimeNodeEnvironment): NodeJS.ProcessEnv {
  const inherited: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(inherited)) {
    if (name.startsWith('CSRM_E2E_RUNTIME_')) delete inherited[name];
  }
  delete inherited.CSRM_E2E_UI_STATE_HARNESS;
  delete inherited.CSRM_E2E_ATTESTATION_NONCE_VALUE;

  return {
    ...inherited,
    NODE_ENV: nodeEnvironment,
    CSRM_NEXT_DIST_DIR: requireRunValue('CSRM_E2E_NEXT_DIST_DIR'),
    CSRM_ENVIRONMENT: 'development',
    CSRM_DEV_IDENTITY: 'true',
    CSRM_API_BASE_URL: `${requireRunValue('CSRM_E2E_STRAPI_ORIGIN')}/api`,
    CSRM_API_TOKEN: requireRunValue('CSRM_E2E_DEVELOPMENT_API_TOKEN'),
  };
}

async function portAnswers(origin: string): Promise<boolean> {
  return fetch(`${origin}/sign-in`, { redirect: 'manual' }).then(() => true).catch(() => false);
}

function startUnattestedServer(port: number, nodeEnvironment: RuntimeNodeEnvironment): { server: ChildProcess; output: () => string } {
  const next = resolve(process.cwd(), 'node_modules/next/dist/bin/next');
  const server = spawn(
    process.execPath,
    [next, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    { cwd: process.cwd(), env: unattestedEnvironment(nodeEnvironment), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  const collect = (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-8_000);
  };
  server.stdout?.on('data', collect);
  server.stderr?.on('data', collect);
  return { server, output: () => output };
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = new Promise<void>((resolveExit) => server.once('exit', () => resolveExit()));
  server.kill('SIGTERM');
  const timeout = new Promise<'timeout'>((resolveTimeout) => setTimeout(() => resolveTimeout('timeout'), 10_000).unref());
  if ((await Promise.race([exited, timeout])) === 'timeout') {
    server.kill('SIGKILL');
    await exited;
  }
}

async function expectUnavailableCard(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: unavailableHeading, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(unavailableTitle);
  await expect(page.getByText('Session authentication is not configured. Contact your administrator.')).toBeVisible();
  await expect(page.getByText('Access is granted by your organisation’s authorization service, never by navigation alone.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue as/ })).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.getByText(/Strapi|development/i)).toHaveCount(0);
}

async function expectNoRoleCookie(context: BrowserContext, moment: string): Promise<void> {
  const names = (await context.cookies()).map((cookie) => cookie.name);
  expect(names, `no development role cookie exists ${moment}`).not.toContain(roleCookieName);
}

/**
 * The sign-in form's Server Action id, read from the attested server. Every server started from the
 * run's build shares it, so a refused runtime can be sent the real action although its unavailable
 * card renders no form.
 */
async function signInActionField(request: APIRequestContext): Promise<string> {
  const html = await (await request.get('/sign-in?returnTo=%2Fapp')).text();
  const field = /name="(\$ACTION_ID_[0-9a-f]+)"/.exec(html)?.[1];
  if (!field) throw new Error('PRODUCTION_HARDENING_ACTION_ID_MISSING: the attested sign-in page rendered no form action');
  return field;
}

async function waitForSignInPage(origin: string, output: () => string, label: string): Promise<void> {
  await expect.poll(
    () => fetch(`${origin}/sign-in`).then((response) => response.status).catch(() => 0),
    { message: `${label} answers /sign-in\n${output()}`, timeout: 120_000 },
  ).toBe(200);
}

/**
 * The fail-closed proof for a server that must not offer the development session: an application
 * route lands on the unavailable card and sets no cookie, the build's real sign-in action posted
 * from the server's own origin mints no role cookie, and the application route still redirects.
 */
async function expectSignInRefused(context: BrowserContext, page: Page, origin: string, actionField: string, label: string): Promise<void> {
  // An application route lands on the unavailable card, never on an error page.
  await page.goto('/app');
  await expect(page, `${label}: an application route redirects to the sign-in page`).toHaveURL(signInRedirect);
  await expectUnavailableCard(page);
  await expectNoRoleCookie(context, `on ${label} after visiting an application route`);

  // The card renders no form, so the build's own sign-in action is posted directly, the way the
  // development form would post it (UI-SPEC §9.1): it must mint nothing.
  const posted = await context.request.post(`${origin}/sign-in`, {
    headers: { Origin: origin },
    multipart: { [actionField]: 'submit', role: 'Requestor', returnTo: '/app' },
    maxRedirects: 0,
  });
  const setCookies = posted.headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value);
  test.info().annotations.push({ type: `sign-in-action-status (${label})`, description: String(posted.status()) });
  console.log(`production-hardening: the sign-in action posted to ${label} answered ${posted.status()}`);
  expect(posted.status(), `${label}: the posted sign-in action does not complete`).not.toBe(303);
  expect(setCookies.filter((value) => value.startsWith(`${roleCookieName}=`)), `${label}: the posted sign-in sets no role cookie`).toEqual([]);
  await expectNoRoleCookie(context, `on ${label} after posting the sign-in action`);

  await page.goto('/app');
  await expect(page, `${label}: an application route still redirects after the posted sign-in`).toHaveURL(signInRedirect);
  await expectUnavailableCard(page);
  await expectNoRoleCookie(context, `on ${label} after the second application visit`);
}

type DevelopmentRole = 'Requestor' | 'Secondary Requestor' | 'Security Analyst';

async function signIn(page: Page, role: DevelopmentRole): Promise<void> {
  await page.goto('/sign-in?returnTo=/app');
  await page.getByRole('button', { name: `Continue as ${role}`, exact: true }).click();
  // Assert the shell, never the URL: '/sign-in?returnTo=/app' also ends in '/app' (D-15).
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByText(role, { exact: true })).toBeVisible();
}

test('the attested production server offers the development sign-in', async ({ request }) => {
  const response = await request.get('/sign-in');

  expect(response.status(), attestationGateMessage).toBe(200);
  expect(await response.text(), attestationGateMessage).toContain('Continue as Requestor');
});

test('a production build without the run attestation refuses the development sign-in', async ({ browser, request }) => {
  test.setTimeout(300_000);
  const actionField = await signInActionField(request);
  await expectPortFree(unattestedPort, 'the unattested production server');
  const { server, output } = startUnattestedServer(unattestedPort, 'production');
  let context: BrowserContext | undefined;

  try {
    await waitForSignInPage(unattestedOrigin, output, 'the unattested production server');

    context = await browser.newContext({ baseURL: unattestedOrigin });
    const page = await context.newPage();

    const signInResponse = await page.goto('/sign-in');
    expect(signInResponse?.status(), 'the unavailable card is an ordinary 200 page').toBe(200);
    await expectUnavailableCard(page);

    // The unavailable state must itself be accessible at both widths (D-25), Label in Name included (D-26).
    for (const width of [375, 1440] as const) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await expect(page.getByRole('heading', { level: 1, name: unavailableHeading, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 }), `the unavailable card has one level-one heading at ${width}px`).toHaveCount(1);
      // AxeBuilder#options replaces earlier options, so the rule is set before the tags.
      const scan = await new AxeBuilder({ page })
        .options({ rules: { 'label-content-name-mismatch': { enabled: true } } })
        .withTags(wcagTags)
        .analyze();
      expect(scan.violations, `the unavailable card has no axe violations at ${width}px`).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `the unavailable card has no horizontal overflow at ${width}px`,
      ).toBe(true);
    }

    await expectSignInRefused(context, page, unattestedOrigin, actionField, 'the unattested production server');
  } finally {
    await context?.close();
    await stopServer(server);
  }

  // No production server is left listening behind the run (T-08-R19).
  await expect.poll(() => portAnswers(unattestedOrigin), { message: 'the unattested server stopped answering', timeout: 30_000 }).toBe(false);
});

/*
 * SR-01: `next start` keeps an explicitly set NODE_ENV=development (it only warns), as a container
 * or compose file that sets NODE_ENV for every service would start it. The build must still refuse
 * the development session: its gate is the NODE_ENV the build was compiled with, and the attested
 * path it keeps needs the attestation this server does not have.
 */
test('a production build started with NODE_ENV=development refuses the development sign-in', async ({ browser, request }) => {
  test.setTimeout(300_000);
  const actionField = await signInActionField(request);
  await expectPortFree(developmentRuntimePort, 'the production build started with NODE_ENV=development');
  const { server, output } = startUnattestedServer(developmentRuntimePort, 'development');
  let context: BrowserContext | undefined;

  try {
    await waitForSignInPage(developmentRuntimeOrigin, output, 'the production build started with NODE_ENV=development');

    context = await browser.newContext({ baseURL: developmentRuntimeOrigin });
    const page = await context.newPage();

    const signInResponse = await page.goto('/sign-in');
    expect(signInResponse?.status(), 'the unavailable card is an ordinary 200 page').toBe(200);
    await expect(
      page.getByRole('button', { name: /Continue as/ }),
      'SR-01: the production build started with NODE_ENV=development offers no fixture role',
    ).toHaveCount(0);
    await expectUnavailableCard(page);

    await expectSignInRefused(context, page, developmentRuntimeOrigin, actionField, 'the production build started with NODE_ENV=development');
  } finally {
    await context?.close();
    await stopServer(server);
  }

  await expect.poll(() => portAnswers(developmentRuntimeOrigin), { message: 'the NODE_ENV=development server stopped answering', timeout: 30_000 }).toBe(false);
});

/*
 * D-19 and D-42: the documented header set. The static headers come from next.config.ts for every
 * path, static assets included; the Content-Security-Policy comes from proxy.ts with a fresh nonce
 * per document. The E2E origin is plain HTTP, so upgrade-insecure-requests must be absent, and HSTS
 * is asserted as sent (browsers ignore it over HTTP).
 */
const staticSecurityHeaders = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  'cross-origin-opener-policy': 'same-origin',
} as const;

const productionPolicy = (nonce: string) => [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function expectStaticSecurityHeaders(headers: Record<string, string>, label: string): void {
  expect(headers['x-powered-by'], `${label} sends no X-Powered-By`).toBeUndefined();
  for (const [name, value] of Object.entries(staticSecurityHeaders)) expect(headers[name], `${label} sends ${name}`).toBe(value);
  expect(headers['permissions-policy'], `${label} turns the camera off`).toContain('camera=()');
}

/** Asserts a document's full header set and returns the nonce its policy carries. */
function expectDocumentSecurityHeaders(headers: Record<string, string>, label: string): string {
  expectStaticSecurityHeaders(headers, label);
  const policy = headers['content-security-policy'] ?? '';
  expect(policy, `${label} scripts need the nonce, with strict-dynamic`).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=_-]+' 'strict-dynamic'/);
  for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    expect(policy, `${label} policy has ${directive}`).toContain(directive);
  }
  expect(policy, `${label} policy never allows eval in production`).not.toContain('unsafe-eval');
  expect(policy, `${label} policy upgrades nothing over plain HTTP`).not.toContain('upgrade-insecure-requests');
  const nonce = /'nonce-([A-Za-z0-9+/=_-]+)'/.exec(policy)?.[1] ?? '';
  expect(policy, `${label} policy is exactly the production policy`).toBe(productionPolicy(nonce));
  expect(headers['x-nonce'], `${label} never sends the nonce as a header of its own`).toBeUndefined();
  expect(Object.keys(headers).filter((name) => name.startsWith('x-middleware-')), `${label} leaks no forwarded request header`).toEqual([]);
  return nonce;
}

/** Every <script> tag in the served HTML carries the document's nonce, so none depends on 'strict-dynamic' alone. */
function expectEveryScriptTagCarriesTheNonce(html: string, nonce: string, label: string): void {
  const tags = [...html.matchAll(/<script\b[^>]*>/g)].map(([tag]) => tag);
  expect(tags.length, `${label} renders Next's scripts`).toBeGreaterThan(3);
  expect(tags.filter((tag) => !tag.includes(`nonce="${nonce}"`)), `${label} has no script tag without the nonce`).toEqual([]);
}

test('every response carries the documented security headers and a fresh nonce policy per document', async ({ page }) => {
  const first = await page.request.get('/sign-in');
  const second = await page.request.get('/sign-in');
  expect(first.status()).toBe(200);
  expect(second.status()).toBe(200);
  const firstNonce = expectDocumentSecurityHeaders(first.headers(), 'GET /sign-in');
  const secondNonce = expectDocumentSecurityHeaders(second.headers(), 'a second GET /sign-in');
  expect(secondNonce, 'each document gets a fresh nonce').not.toBe(firstNonce);
  expectEveryScriptTagCarriesTheNonce(await first.text(), firstNonce, 'the /sign-in HTML');
  // An unmatched URL renders per request too (the root layout is force-dynamic), so even the 404 carries the nonce.
  const notFound = await page.request.get('/app/this-route-does-not-exist');
  expect(notFound.status()).toBe(404);
  expectEveryScriptTagCarriesTheNonce(await notFound.text(), expectDocumentSecurityHeaders(notFound.headers(), 'the 404 document'), 'the 404 HTML');
  // SR-05: a URL that only resembles a path the matcher excludes is a document like any other.
  for (const lookalike of ['/iconXpng', '/icon.png-x', '/_next/staticfoo', '/_next/imagery']) {
    const response = await page.request.get(lookalike);
    expect(response.status(), `${lookalike} renders the not-found document`).toBe(404);
    expectEveryScriptTagCarriesTheNonce(await response.text(), expectDocumentSecurityHeaders(response.headers(), `the ${lookalike} document`), `the ${lookalike} HTML`);
  }

  await signIn(page, 'Security Analyst');
  const app = await page.goto('/app');
  expect(app?.status()).toBe(200);
  const appHeaders = app?.headers() ?? {};
  const appNonce = expectDocumentSecurityHeaders(appHeaders, 'the signed-in /app document');
  expect(appNonce, 'the signed-in document has its own nonce').not.toBe(secondNonce);
  const appHtml = await page.request.get('/app');
  expectEveryScriptTagCarriesTheNonce(await appHtml.text(), expectDocumentSecurityHeaders(appHtml.headers(), 'GET /app signed in'), 'the /app HTML');

  // A static asset the document loads: the static headers, and no policy of its own (the proxy skips it).
  const assetPath = await page.locator('script[src^="/_next/static/"]').first().getAttribute('src');
  expect(assetPath, 'the document loads a Next static script').toBeTruthy();
  const asset = await page.request.get(assetPath ?? '');
  expect(asset.status()).toBe(200);
  expectStaticSecurityHeaders(asset.headers(), `GET ${assetPath}`);
  expect(asset.headers()['content-security-policy'], 'a static asset is left to the static headers').toBeUndefined();

  const observed = { policy: appHeaders['content-security-policy'], ...Object.fromEntries(Object.keys(staticSecurityHeaders).map((name) => [name, appHeaders[name]])) };
  test.info().annotations.push({ type: 'observed-security-headers', description: JSON.stringify(observed) });
  console.log(`production-hardening: observed headers on /app ${JSON.stringify(observed)}`);
});

/*
 * D-19: zero violations on every route. Each step loads a document at 1440px and at 375px with the
 * collector attached, waits for the settled destination, checks it rendered what it should (content
 * with no error state, the permission state for a refusal, the not-found card), and fails on any
 * securitypolicyviolation event or policy console message. A record step opens the first record the
 * list shows, so the sweep holds whatever state earlier specs left.
 */
type RenderedState = 'content' | 'permission' | 'not-found';
type SweepStep = {
  title?: string;
  heading?: string;
  state?: RenderedState;
  status?: number;
  /** The final URL when the route redirects. */
  lands?: RegExp;
} & ({ route: string } | { firstRecordOf: string; link: RegExp });

const sweepWidths = [1440, 375] as const;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function firstRecordHref(page: Page, listRoute: string, link: RegExp): Promise<string> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(listRoute);
  await expect(page.locator('[data-slot="skeleton"], [aria-busy="true"]'), `${listRoute} finishes loading`).toHaveCount(0);
  let href: string | undefined;
  await expect.poll(async () => {
    const hrefs = await page.getByRole('main').locator('a[href]').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));
    href = hrefs.find((candidate) => link.test(candidate));
    return href ?? null;
  }, { message: `${listRoute} lists a record to open` }).not.toBeNull();
  return href ?? '';
}

async function expectRendered(page: Page, step: SweepStep, route: string, label: string): Promise<void> {
  const url = step.lands ?? new RegExp(`${escapeRegExp(route)}$`);
  if (step.title && step.heading) {
    await expectSettled(page, { url, title: step.title, heading: step.heading }, label);
  } else {
    await expect(page, `${label} reaches its destination`).toHaveURL(url);
    if (step.title) await expect(page, `${label} carries its document title`).toHaveTitle(step.title);
    if (step.state !== 'permission') await expect(page.getByRole('heading', { level: 1 }).first(), `${label} shows a level-one heading`).toBeVisible();
    await expect(page.locator('[data-slot="skeleton"], [aria-busy="true"]'), `${label} has nothing still loading`).toHaveCount(0);
  }
  if (step.state === 'permission') {
    await expect(page.getByRole('main').locator('[data-slot="state"][data-state-kind="permission"]'), `${label} renders the permission state`).toBeVisible();
  }
  if (step.state === 'not-found') {
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found', exact: true }), `${label} renders the not-found card`).toBeVisible();
  }
  await expect(page.locator('[data-state-kind="error"]'), `${label} renders no error state`).toHaveCount(0);
}

async function sweep(page: Page, actor: string, steps: readonly SweepStep[]): Promise<string[]> {
  const visited: string[] = [];
  for (const step of steps) {
    const route = 'route' in step ? step.route : await firstRecordHref(page, step.firstRecordOf, step.link);
    for (const width of sweepWidths) {
      const label = `${actor} ${route} at ${width}px`;
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      const response = await page.goto(route);
      expect(response?.status(), `${label} answers ${step.status ?? 200}`).toBe(step.status ?? 200);
      await expectRendered(page, step, route, label);
      await expectNoCspViolations(page, label);
    }
    visited.push(route);
  }
  test.info().annotations.push({ type: `csp-sweep-${actor}`, description: `${visited.length} routes x ${sweepWidths.length} widths: ${visited.join(', ')}` });
  console.log(`production-hardening: ${actor} swept ${visited.length} routes at ${sweepWidths.join(' and ')}px with no CSP violation`);
  return visited;
}

const report = (key: string, heading: string, title: string): SweepStep => ({ route: `/app/reports/${key}`, heading, title: `${title} | IdamBox CSRM` });
const administration = (collection: string, label: string, plural: string, routes: readonly [string, string, string]): SweepStep[] => [
  { route: routes[0], title: `${plural} | IdamBox CSRM`, heading: plural },
  { route: routes[1], title: `Create ${label} | IdamBox CSRM`, heading: `Create ${label}` },
  { route: routes[2], title: `Import ${plural} CSV | IdamBox CSRM`, heading: `Import ${plural} from CSV` },
  { firstRecordOf: routes[0], link: new RegExp(`^/app/admin/${collection}/(?!new$|import$)[^/?#]+$`), title: `${label} Details | IdamBox CSRM` },
];

const personalSteps: readonly SweepStep[] = [
  { route: '/app', title: 'Home | IdamBox CSRM', heading: 'Home' },
  { route: '/app/requests', title: 'My Requests | IdamBox CSRM', heading: 'My Requests' },
  { route: '/app/requests/new', title: 'New Request | IdamBox CSRM', heading: 'New assessment request' },
  { route: '/app/questionnaires', title: 'My Questionnaires | IdamBox CSRM', heading: 'My Questionnaires' },
  { route: '/app/assessments', title: 'My Risk Assessments | IdamBox CSRM', heading: 'My Risk Assessments' },
];
// The request detail is titled by its route; its heading is the request's own title.
const firstOwnRequest: SweepStep = { firstRecordOf: '/app/requests', link: /^\/app\/requests\/(?!new$)[^/?#]+$/, title: 'Assessment Request | IdamBox CSRM' };

/*
 * WR-05 (R-08-16): a record id that does not exist. Strapi answers the analyst's read 404, so each record
 * route renders the in-shell not-found and takes its title. The not-found streams, so the status stays 200
 * (R-08-15), as for the unknown Administration collection. The id has the shape of a real documentId.
 */
const missingRecordId = 'missingrecord00000000000';
const missingRecordSteps: readonly SweepStep[] = [
  '/app/questionnaires',
  '/app/review/requests',
  '/app/review/questionnaires',
  '/app/review/assessments',
].map((list) => ({ route: `${list}/${missingRecordId}`, status: 200, title: 'Page not found | IdamBox CSRM', heading: 'Page not found', state: 'not-found' as const }));

const analystSteps: readonly SweepStep[] = [
  ...personalSteps,
  firstOwnRequest,
  // The analyst's Home (/app, the review summary since D-16) is swept with personalSteps.
  { route: '/app/review/requests', title: 'Assessment Request Review | IdamBox CSRM', heading: 'Assessment request review' },
  { firstRecordOf: '/app/review/requests?queue=awaiting-requestor', link: /^\/app\/review\/requests\/[^/?#]+$/, title: 'Assessment Request Review | IdamBox CSRM' },
  { route: '/app/review/questionnaires', title: 'Questionnaire Review | IdamBox CSRM', heading: 'Questionnaire Review' },
  { firstRecordOf: '/app/review/questionnaires', link: /^\/app\/review\/questionnaires\/[^/?#]+$/, title: 'Questionnaire Review | IdamBox CSRM' },
  { route: '/app/review/assessments', title: 'Risk Assessment Review | IdamBox CSRM', heading: 'Risk assessment review' },
  { firstRecordOf: '/app/review/assessments', link: /^\/app\/review\/assessments\/[^/?#]+$/, title: 'Risk Assessment Review | IdamBox CSRM', heading: 'Risk assessment review' },
  { route: '/app/risks', title: 'Risk Register | IdamBox CSRM', heading: 'Risk Register' },
  { firstRecordOf: '/app/risks', link: /^\/app\/risks\/[^/?#]+$/, title: 'Risk Details | IdamBox CSRM' },
  { route: '/app/alerts', title: 'Alerts | IdamBox CSRM', heading: 'Alerts' },
  { route: '/app/reports', title: 'Reports | IdamBox CSRM', heading: 'Reports' },
  report('risk-exposure', 'Risk exposure', 'Risk Exposure Report'),
  report('treatment-performance', 'Treatment performance', 'Treatment Performance Report'),
  report('assessment-throughput', 'Assessment throughput', 'Assessment Throughput Report'),
  report('control-effectiveness', 'Control effectiveness', 'Control Effectiveness Report'),
  ...administration('risk-types', 'Risk Type', 'Risk Types', ['/app/admin/risk-types', '/app/admin/risk-types/new', '/app/admin/risk-types/import']),
  ...administration('controls', 'Control', 'Controls', ['/app/admin/controls', '/app/admin/controls/new', '/app/admin/controls/import']),
  ...administration('information-systems', 'Information System', 'Information Systems', ['/app/admin/information-systems', '/app/admin/information-systems/new', '/app/admin/information-systems/import']),
  ...administration('information-assets', 'Information Asset', 'Information Assets', ['/app/admin/information-assets', '/app/admin/information-assets/new', '/app/admin/information-assets/import']),
  // The in-shell not-found. Its notFound() is raised while the shell streams, so the status stays
  // 200 (Next's soft 404, as 08-09 recorded for a streamed not-found); the copy and title are the card's.
  { route: '/app/admin/not-a-collection', status: 200, title: 'Page not found | IdamBox CSRM', heading: 'Page not found', state: 'not-found' },
  ...missingRecordSteps,
];

// A Requestor's refusal of an analyst surface keeps its page header and title and shows the shared
// permission state, the Administration refusal included (08-12).
const refusalSteps: readonly SweepStep[] = [
  { route: '/app/risks', title: 'Risk Register | IdamBox CSRM', heading: 'Risk Register', state: 'permission' },
  { route: '/app/alerts', title: 'Alerts | IdamBox CSRM', heading: 'Alerts', state: 'permission' },
  { route: '/app/reports', title: 'Reports | IdamBox CSRM', heading: 'Reports', state: 'permission' },
  { route: '/app/admin/controls', title: 'Controls | IdamBox CSRM', heading: 'Controls', state: 'permission' },
];

const requestorSteps: readonly SweepStep[] = [
  ...personalSteps,
  firstOwnRequest,
  { firstRecordOf: '/app/questionnaires', link: /^\/app\/questionnaires\/[^/?#]+$/, title: 'Questionnaire | IdamBox CSRM' },
  { firstRecordOf: '/app/assessments', link: /^\/app\/assessments\/[^/?#]+$/, title: 'Released Risk Assessment | IdamBox CSRM', heading: 'Released risk assessment' },
  // Her read of a questionnaire id that is not hers, existing or not, is refused 403: the route keeps its title (WR-05).
  { route: `/app/questionnaires/${missingRecordId}`, title: 'Questionnaire | IdamBox CSRM', heading: 'Questionnaire unavailable' },
  ...refusalSteps,
];

// The Secondary Requestor owns no fixture record, so her lists render their empty states.
const secondaryRequestorSteps: readonly SweepStep[] = [...personalSteps, ...refusalSteps];

const signedOutSteps: readonly SweepStep[] = [
  { route: '/', lands: signInRedirect, title: 'Development sign-in | IdamBox CSRM', heading: 'Development sign-in' },
  { route: '/sign-in', title: 'Development sign-in | IdamBox CSRM', heading: 'Development sign-in' },
  { route: '/app/this-route-does-not-exist', status: 404, title: 'Page not found | IdamBox CSRM', heading: 'Page not found', state: 'not-found' },
];

test('every analyst route renders under the production policy with no CSP violation', async ({ page }) => {
  test.setTimeout(600_000);
  await attachCspCollector(page);
  await signIn(page, 'Security Analyst');
  await expectNoCspViolations(page, 'the analyst sign-in');

  const visited = await sweep(page, 'Security Analyst', analystSteps);
  expect(visited).toHaveLength(analystSteps.length);
});

test('every Requestor route and refusal renders under the production policy with no CSP violation', async ({ page }) => {
  test.setTimeout(600_000);
  await attachCspCollector(page);
  await signIn(page, 'Requestor');
  await expectNoCspViolations(page, 'the Requestor sign-in');
  await sweep(page, 'Requestor', requestorSteps);

  await page.context().clearCookies();
  await signIn(page, 'Secondary Requestor');
  await expectNoCspViolations(page, 'the Secondary Requestor sign-in');
  await sweep(page, 'Secondary Requestor', secondaryRequestorSteps);
});

test('the signed-out pages and an unmatched URL render under the production policy with no CSP violation', async ({ page }) => {
  test.setTimeout(300_000);
  await attachCspCollector(page);
  await sweep(page, 'signed out', signedOutSteps);
});

/*
 * D-10 corroboration: the suite drives a production build, so a client-side navigation loads no
 * development runtime (no overlay, no hot-reload connection) and raises no violation either.
 */
test('a client-side navigation on the production build loads no development runtime', async ({ page }) => {
  await attachCspCollector(page);
  const requests: string[] = [];
  const sockets: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('websocket', (socket) => sockets.push(socket.url()));

  await signIn(page, 'Security Analyst');
  await page.evaluate(() => {
    (window as Window & { __csrmSameDocument?: boolean }).__csrmSameDocument = true;
  });
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Risk register', exact: true }).click();
  await expectSettled(page, { url: /\/app\/risks$/, title: 'Risk Register | IdamBox CSRM', heading: 'Risk Register' }, 'the Risk Register after a client-side navigation');

  expect(await page.evaluate(() => (window as Window & { __csrmSameDocument?: boolean }).__csrmSameDocument), 'the navigation kept the document').toBe(true);
  await expect(page.locator('nextjs-portal'), 'no development overlay is mounted').toHaveCount(0);
  expect(requests.filter((url) => /webpack-hmr|turbopack-hmr/.test(url)), 'no hot-reload request').toEqual([]);
  expect(sockets, 'no hot-reload socket').toEqual([]);
  await expectNoCspViolations(page, 'a client-side navigation');
});

/*
 * D-22: the production build's client chunks carry no server-only name or value. Next inlines only
 * NEXT_PUBLIC_ variables, and every transport, auth, gate and service module starts with
 * import 'server-only' (server-only-boundary.test.ts), so this scan is the end-to-end proof.
 */
const serverEnvironmentNames = [
  'CSRM_API_BASE_URL',
  'CSRM_API_TOKEN',
  'CSRM_DEV_IDENTITY',
  'CSRM_E2E_UI_STATE_HARNESS',
  'CSRM_E2E_RUNTIME_NONCE',
  'CSRM_E2E_RUNTIME_ROOT',
  'CSRM_E2E_RUNTIME_ATTESTATION_PATH',
  'CSRM_NEXT_DIST_DIR',
  'CSRM_ENVIRONMENT',
] as const;
const fixtureEmails = ['jane.doe@idambox.com', 'maya.requestor@idambox.com', 'bob.doe@idambox.com'] as const;

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

test('the production client chunks carry no server-only name or value', () => {
  const distDir = resolve(process.cwd(), requireRunValue('CSRM_E2E_NEXT_DIST_DIR'));
  const chunks = filesUnder(join(distDir, 'static')).filter((file) => /\.(?:js|css)$/.test(file));
  expect(chunks.length, 'the scan reads the build, not an empty directory').toBeGreaterThanOrEqual(10);

  // Each needle is named by what it is, so a failure never prints a run value.
  const needles: ReadonlyArray<{ name: string; value: string }> = [
    ...serverEnvironmentNames.map((name) => ({ name, value: name })),
    { name: 'the identity header x-csrm-dev-identity', value: 'x-csrm-dev-identity' },
    { name: "the run's API token", value: requireRunValue('CSRM_E2E_DEVELOPMENT_API_TOKEN') },
    { name: "the run's attestation nonce", value: requireRunValue('CSRM_E2E_ATTESTATION_NONCE_VALUE') },
    { name: "the run's Strapi API base URL", value: `${requireRunValue('CSRM_E2E_STRAPI_ORIGIN')}/api` },
    ...fixtureEmails.map((email) => ({ name: `the fixture email ${email}`, value: email })),
  ];
  const findings: string[] = [];
  for (const chunk of chunks) {
    const text = readFileSync(chunk, 'utf8');
    for (const { name, value } of needles) {
      if (text.includes(value)) findings.push(`${relative(distDir, chunk).split(sep).join('/')} contains ${name}`);
    }
  }

  test.info().annotations.push({ type: 'client-chunks-scanned', description: `${chunks.length} files, ${needles.length} needles` });
  console.log(`production-hardening: scanned ${chunks.length} client chunk files for ${needles.length} server-only names and values`);
  expect(findings, 'no client chunk carries a server-only name or value').toEqual([]);
});

/*
 * D-48, T-08-R13: a cross-origin Server Action request is refused before any action runs. The
 * installed Next compares the Origin host with the Host (or X-Forwarded-Host) header before it looks
 * the action up (app-render/action-handler.js), answering a fetch action 500 and throwing for a form
 * post, unless serverActions.allowedOrigins lists the origin.
 */
const roleCookiesSet = (response: APIResponse) => response.headersArray()
  .filter((header) => header.name.toLowerCase() === 'set-cookie' && header.value.startsWith(`${roleCookieName}=`))
  .map((header) => header.value);

test('a cross-origin Server Action request is refused before any action runs', async ({ page }) => {
  const webOrigin = new URL(requireRunValue('CSRM_E2E_WEB_ORIGIN')).origin;
  const fetchAction = { 'Next-Action': '0'.repeat(40), 'Content-Type': 'text/plain;charset=UTF-8' };

  // The fetch-action probe: refused on origin (500) before the unknown id is even looked up.
  const foreign = await page.request.post('/sign-in', { headers: { ...fetchAction, Origin: 'https://evil.example' }, data: '[]', maxRedirects: 0 });
  expect(foreign.status(), 'a fetch action from https://evil.example is refused').toBe(500);
  expect(roleCookiesSet(foreign), 'the refused request sets no session cookie').toEqual([]);
  const sameOrigin = await page.request.post('/sign-in', { headers: { ...fetchAction, Origin: webOrigin }, data: '[]', maxRedirects: 0 });
  expect(sameOrigin.status(), 'the same request from the web origin passes the origin check').not.toBe(500);
  expect(sameOrigin.status(), 'and is then refused only because no such action exists').toBe(404);

  // The real sign-in form action, posted the way a cross-site form would post it.
  const signInHtml = await (await page.request.get('/sign-in?returnTo=%2Fapp')).text();
  const actionField = /name="(\$ACTION_ID_[0-9a-f]+)"/.exec(signInHtml)?.[1];
  expect(actionField, 'the sign-in page renders its form action id').toBeTruthy();
  // The browser submits the hidden action field empty; Next reads only its name, and Playwright
  // leaves an empty multipart field out of the body, so the field carries a placeholder value.
  const formPost = (origin: string) => page.request.post('/sign-in', {
    headers: { Origin: origin },
    multipart: { [actionField ?? '']: 'submit', role: 'Requestor', returnTo: '/app' },
    maxRedirects: 0,
  });
  const forged = await formPost('https://evil.example');
  expect(forged.status(), 'the forged cross-origin form post does not complete').not.toBe(303);
  expect(roleCookiesSet(forged), 'the forged form post mints no session').toEqual([]);
  expect((await page.context().cookies()).map((cookie) => cookie.name), 'the browser holds no session after the forged posts').not.toContain(roleCookieName);
  const genuine = await formPost(webOrigin);
  expect(genuine.status(), 'the same form post from the web origin runs the action and redirects').toBe(303);
  expect(roleCookiesSet(genuine).length, 'the genuine form post mints the session').toBe(1);

  const observed = `fetch action: foreign ${foreign.status()}, same-origin ${sameOrigin.status()}; form action: foreign ${forged.status()}, same-origin ${genuine.status()}`;
  test.info().annotations.push({ type: 'server-action-origin-statuses', description: observed });
  console.log(`production-hardening: Server Action statuses (${observed})`);
});
