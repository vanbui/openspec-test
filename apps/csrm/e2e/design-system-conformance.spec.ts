import AxeBuilder from '@axe-core/playwright';
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

import { harnessPort } from '../src/lib/testing/e2e-harness-ports';
import { strapiHealthUrl } from './harness-urls';
import { expectPortFree } from './helpers/ports';

const auditedRoutes = ['/app', '/app/requests', '/app/risks', '/app/review/assessments', '/app/review/questionnaires', '/app/admin/controls'] as const;
/*
 * Phase 7 routes join their own matrix as each screen lands (plan 05: Alerts; plans 07 and 08 add
 * the reports and the analyst dashboard), so the Phase 6 matrix keeps its ten-minute ceiling.
 */
const phase7AuditedRoutes = [
  '/app/alerts',
  '/app/reports',
  '/app/reports/risk-exposure',
  '/app/reports/treatment-performance',
  '/app/reports/assessment-throughput',
  '/app/reports/control-effectiveness',
  '/app/review',
] as const;
type Phase7AuditedRoute = typeof phase7AuditedRoutes[number];

/*
 * What each Phase 7 route shows once its real content has rendered: a record link on Alerts, the
 * report cards on the index, a section table on each report, and the four KPI tiles on the analyst
 * dashboard. A type scan runs only after it.
 */
function phase7PopulatedContent(page: Page, route: Phase7AuditedRoute): Locator {
  if (route === '/app/alerts') return page.locator('a.record-link:visible').first();
  if (route === '/app/reports') return page.locator('[data-slot="report-card"] a:visible').first();
  // The fourth tile's figure; the loop also counts all four.
  if (route === '/app/review') return page.locator('[data-slot="kpi-tile"] [data-slot="kpi-tile-value"]:visible').nth(3);
  return page.locator('[data-slot="report-section"] table:visible').first();
}
const states = ['populated', 'loading', 'empty', 'error', 'permission'] as const;
const viewports = [375, 1440] as const;
type UiState = typeof states[number];
type TypographyToken = { size: string; weight: string; tracking?: string; uppercase?: boolean };

function parseTypographyContract(): TypographyToken[] {
  const direction = readFileSync(resolve(process.cwd(), '../../docs/design/csrm-design-direction.md'), 'utf8');
  const typography = direction.match(/## 3\.10[\s\S]*?(?=\n## 3\.11|$)/)?.[0];
  if (!typography) throw new Error('DESIGN_DIRECTION_TYPOGRAPHY_SECTION_MISSING');
  // The component guidance in section 4 sets sizes the section 3.10 table does not carry.
  // Sidebar navigation is the one that reaches every audited route, so read it from the
  // document rather than hard-coding it, and fail loudly if the document stops saying it.
  const navItem = direction.match(/Nav items:\s*\d+px height,\s*(\d+)px\/(400|500|600)/);
  if (!navItem) throw new Error('DESIGN_DIRECTION_NAV_ITEM_TYPOGRAPHY_MISSING');
  const componentTokens: TypographyToken[] = [{ size: `${navItem[1]}px`, weight: navItem[2] }];
  return [...componentTokens, ...[...typography.matchAll(/\|\s*`--[^`]+`\s*\|\s*(\d+)px\/\d+px\s*\|\s*(400|500|600)\s*\|\s*([^|]*)\|\s*([^|]*)/g)].flatMap(([, size, weight, tracking, usage]) => {
    const token = { size: `${size}px`, weight, tracking: tracking.match(/[+−-]?[\d.]+em/)?.[0]?.replace('−', '-'), uppercase: /uppercase/i.test(tracking) };
    return [token, ...[...usage.matchAll(/\((400|500|600)\)/g)].map(([, inlineWeight]) => ({ ...token, weight: inlineWeight }))];
  })];
}

const typographyTokens = parseTypographyContract();

/*
 * Sign-in helpers assert the shell, never the URL: '/sign-in?returnTo=/app' also ends in '/app', so a
 * URL match passes on a click that never left sign-in.
 */
async function signIn(page: Page) {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);
  await page.getByRole('button', { name: 'Continue as Security Analyst' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByText('Security Analyst', { exact: true })).toBeVisible();
}

async function signInAsRequestor(page: Page) {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);
  await page.getByRole('button', { name: 'Continue as Requestor' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard', exact: true })).toBeVisible();
  // Wait for the banner to show the new role. Every actor's dashboard has the same heading, so only
  // the role proves the previous Security Analyst session is gone; otherwise the denial proof could
  // silently run as the wrong actor and let an authorised render look like a pass.
  await expect(page.getByRole('banner').getByText('Requestor', { exact: true })).toBeVisible();
}

async function expectNoSeriousAxeViolations(page: Page) {
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(geometry.width, `${label} has horizontal viewport overflow`).toBeLessThanOrEqual(geometry.viewport);
}

function fixtureUrl(route: string, state: UiState) { return `${route}?__e2eState=${state}`; }

/** Every visible text element whose size, weight, tracking and case match no documented type token. */
async function typographyViolations(page: Page) {
  return page.evaluate((tokens) => Array.from(document.querySelectorAll<HTMLElement>('body *'))
    .filter((element) => element.offsetParent !== null && element.matches('h1,h2,h3,h4,h5,h6,p,span,a,button,label,select,option,input,textarea,th,td,[role="status"]'))
    .filter((element) => (element.textContent ?? element.getAttribute('placeholder') ?? '').trim())
    .map((element) => { const style = getComputedStyle(element); return { size: style.fontSize, weight: style.fontWeight, tracking: style.letterSpacing === 'normal' ? 0 : Number.parseFloat(style.letterSpacing), transform: style.textTransform }; })
    .filter((actual) => !tokens.some((token) => token.size === actual.size && token.weight === actual.weight && (!token.tracking || Math.abs(actual.tracking - Number.parseFloat(token.tracking) * Number.parseFloat(token.size)) <= 0.05) && (!token.uppercase || actual.transform === 'uppercase'))), typographyTokens);
}

async function expectStateMeaning(page: Page, route: string, state: UiState, width: number) {
  const boundary = page.locator(`[data-ui-state="${state}"]`);
  await expect(boundary, `${route} ${state} ${width}px exposes its exact guarded marker`).toBeVisible();
  await expect(page.getByRole('main'), `${route} ${state} ${width}px retains the application landmark`).toBeVisible();
  if (state === 'loading') {
    await expect(boundary, `${route} loading ${width}px is a meaningful busy region`).toHaveAttribute('aria-busy', 'true');
    await expect(boundary.getByText(/Loading/i), `${route} loading ${width}px has visible loading copy`).toBeVisible();
  } else if (state === 'error' || state === 'permission') {
    // The shared state primitive owns the alert; the fixture boundary must not add a second one.
    await expect(boundary.getByRole('alert'), `${route} ${state} ${width}px has exactly one accessible failure alert`).toHaveCount(1);
    await expect(boundary.getByRole('heading').first(), `${route} ${state} ${width}px has visible failure copy`).toBeVisible();
    // Since 06.6 every list surface renders its states through the shared primitives, so
    // they share one recovery contract: a "Try again" button that refreshes in place, and a
    // "Return to workspace" link on permission denial. The dashboard keeps its own recovery
    // links. Only assert an href when the affordance is a link.
    const recovery: { name: string; href?: string } | undefined = route === '/app'
      ? state === 'permission' ? { name: 'Return to sign in', href: '/sign-in' } : { name: 'View My Requests', href: '/app/requests' }
      : state === 'permission' ? { name: 'Return to workspace', href: '/app' } : { name: 'Try again' };
    if (recovery?.href) {
      await expect(boundary.getByRole('link', { name: recovery.name }), `${route} ${state} ${width}px preserves its visible recovery link`).toHaveAttribute('href', recovery.href);
    } else if (recovery) {
      await expect(boundary.getByRole('button', { name: recovery.name }), `${route} ${state} ${width}px preserves its visible recovery control`).toBeVisible();
    } else {
      await expect(boundary.getByRole('link'), `${route} ${state} ${width}px deliberately has no recovery link`).toHaveCount(0);
    }
    await expect(boundary.getByRole('table'), `${route} ${state} ${width}px does not expose a populated table`).toHaveCount(0);
    await expect(boundary.locator('a[href*="/app/risks/"], a[href*="/app/review/assessments/"]'), `${route} ${state} ${width}px does not expose protected record links`).toHaveCount(0);
  } else if (state === 'empty') {
    await expect(boundary.getByRole('heading').first(), `${route} empty ${width}px has visible empty-state copy`).toBeVisible();
  } else {
    // Several lists render a mobile card variant and a desktop table together, one hidden by
    // breakpoint, so .first() can select the hidden variant. Scope to the visible one.
    await expect(boundary.locator('section:visible, table:visible, [role="list"]:visible').first(), `${route} populated ${width}px has visible route content`).toBeVisible();
  }
  await expectNoHorizontalOverflow(page, `${route} ${state} ${width}px`);
  await expectNoSeriousAxeViolations(page);
}

test.describe.configure({ mode: 'serial' });

test.describe('dashboard state matrix', () => {
  test('renders every guarded dashboard state, ordinary-server boundary, and partial-widget recovery', async ({ page, request, browser }) => {
    test.setTimeout(600_000);
    expect((await request.get(strapiHealthUrl)).ok()).toBe(true);
    await signIn(page);
    for (const width of viewports) for (const state of states) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(fixtureUrl('/app', state));
      await expectStateMeaning(page, '/app', state, width);
      if (state === 'error' || state === 'permission') {
        await expect(page.locator('[aria-label$="items"]'), `${state} dashboard state must not expose populated widget counts`).toHaveCount(0);
        await expect(page.getByRole('link', { name: /REQ-|ASM-/ }), `${state} dashboard state must not expose populated records`).toHaveCount(0);
      }
    }
    // Its own band, below every default ephemeral range (SR-10), checked free before it starts.
    const port = harnessPort('ordinaryDevelopment', process.pid);
    const origin = `http://127.0.0.1:${port}`;
    await expectPortFree(port, 'the ordinary next dev server');
    const next = resolve(process.cwd(), 'node_modules/next/dist/bin/next');
    // Named by the run, so the runner removes it with the run's other artifacts when the run passes (SR-09).
    const distDir = process.env.CSRM_E2E_ORDINARY_NEXT_DIST_DIR;
    if (!distDir) throw new Error('CONFORMANCE_RUN_VALUE_MISSING: playwright.config.ts did not expose CSRM_E2E_ORDINARY_NEXT_DIST_DIR');
    const env: NodeJS.ProcessEnv = { ...process.env, CSRM_NEXT_DIST_DIR: distDir };
    delete env.CSRM_E2E_UI_STATE_HARNESS;
    const server = spawn(process.execPath, [next, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: process.cwd(), env, stdio: 'ignore' });
    try {
      await expect.poll(async () => fetch(`${origin}/sign-in`).then((response) => response.ok).catch(() => false), { timeout: 120_000 }).toBe(true);
      const context = await browser.newContext({ baseURL: origin }); const ordinaryPage = await context.newPage();
      await signIn(ordinaryPage); await ordinaryPage.goto('/app?__e2eState=error');
      await expect(ordinaryPage.locator('[data-ui-state]'), 'ordinary server must ignore the browser fixture query').toHaveCount(0);
      // exact: true - this spawned server has no Strapi credentials in its environment, so
      // the dashboard also renders 'We couldn't load your dashboard' and a loose name match
      // resolves to two headings. The load state is irrelevant here; the assertion above is
      // the real one, proving the fixture query is ignored without an attested runtime.
      await expect(ordinaryPage.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
      await context.close();
    } finally { server.kill(); }
    await signIn(page);
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app?__e2eState=populated&__e2ePartial=draft-requests-error');
      // The widget section carries aria-labelledby, so address it as a labelled region.
      // Walking up from the heading is off by one - it nests h2 > div > div > CardHeader >
      // section, so three hops land on CardHeader and miss the alert in its CardContent sibling.
      const failedWidget = page.getByRole('region', { name: 'Draft requests' });
      await expect(failedWidget.getByRole('alert'), `partial dashboard failure is an alert at ${width}px`).toBeVisible();
      // The failed widget renders the shared compact error state; the in-page skip link was
      // retired in 06.6 because the remaining widgets follow it directly.
      await expect(failedWidget.locator('[data-slot="state"][data-state-kind="error"]'), `failed widget uses the shared error state at ${width}px`).toBeVisible();
      await expect(failedWidget.locator('a[href*="/app/requests/"]'), 'failed widget must not fabricate a request record').toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Questionnaires in progress' }), `safe sibling remains visible at ${width}px`).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Recently released assessments' }), `safe sibling remains visible at ${width}px`).toBeVisible();
      await expectNoSeriousAxeViolations(page);
    }
  });

  test('renders the analyst dashboard Top alerts failure beside intact sibling widgets', async ({ page }) => {
    test.setTimeout(300_000);
    await signIn(page);
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app/review?__e2eState=populated&__e2ePartial=analyst-top-alerts-error');
      await expect(page.locator('[data-ui-state="populated"]'), `the attested populated boundary renders at ${width}px`).toBeVisible();
      const topAlerts = page.getByRole('region', { name: 'Top alerts', exact: true });
      await expect(topAlerts.locator('[data-slot="state"][data-state-kind="error"]'), `the failed widget uses the shared error state at ${width}px`).toBeVisible();
      await expect(topAlerts.locator('a.record-link'), `the failed widget exposes no record link at ${width}px`).toHaveCount(0);
      // The failure is Top alerts' alone: it is the page's only error state, and its siblings show their content.
      await expect(page.locator('[data-state-kind="error"]'), `only Top alerts failed at ${width}px`).toHaveCount(1);
      const reviewQueue = page.getByRole('region', { name: 'Review queue', exact: true });
      await expect(reviewQueue, `the Review queue sibling remains visible at ${width}px`).toBeVisible();
      await expect(reviewQueue.getByRole('link'), `the Review queue sibling keeps its queue rows at ${width}px`).toHaveCount(6);
      const riskExposure = page.getByRole('region', { name: 'Risk exposure', exact: true });
      await expect(riskExposure, `the Risk exposure sibling remains visible at ${width}px`).toBeVisible();
      await expect(riskExposure.getByRole('list', { name: 'Open contextual Risks by residual rating' }), `the Risk exposure sibling keeps its figures at ${width}px`).toBeVisible();
      await expectNoSeriousAxeViolations(page);
    }
  });
});

test.describe('design-system type contract', () => {
  test('audited route state, type, and authorization matrix', async ({ page }) => {
    test.setTimeout(600_000); expect(typographyTokens.length).toBeGreaterThan(0); await signIn(page);
    for (const width of viewports) for (const route of auditedRoutes) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(route);
      const violations = await typographyViolations(page);
      // Every documented tracking value is checked against the rendered type contract.
      expect(violations, `${route} at ${width}px contains typography outside the document contract`).toEqual([]);
    }
    for (const width of viewports) for (const route of auditedRoutes) for (const state of states) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(fixtureUrl(route, state)); await expectStateMeaning(page, route, state, width);
    }
    await signInAsRequestor(page);
    for (const route of ['/app/review/assessments', '/app/review/questionnaires', '/app/admin/controls'] as const) {
      await page.goto(fixtureUrl(route, 'error'));
      await expect(page.locator('[data-ui-state]'), `${route} Requestor denial must not expose a fixture boundary`).toHaveCount(0);
      // Scope to main: Next renders an empty __next-route-announcer__ div with role=alert
      // at body level, so an unscoped alert query is a strict-mode violation.
      await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
      await expect(page.getByRole('table')).toHaveCount(0);
      await expect(page.locator('a[href*="/app/review/assessments/"], a[href*="/app/review/questionnaires/"], a[href*="/app/admin/controls/"]')).toHaveCount(0);
    }
  });

  test('Phase 7 audited route state, type, and authorization matrix', async ({ page }) => {
    // Seven routes, five states and two widths, each with an axe scan: a fifteen-minute ceiling.
    test.setTimeout(900_000); expect(typographyTokens.length).toBeGreaterThan(0); await signIn(page);
    for (const width of viewports) for (const route of phase7AuditedRoutes) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(route);
      // Scan the populated screen, never an error state standing in for it.
      await expect(phase7PopulatedContent(page, route), `${route} at ${width}px renders its content before its type scan`).toBeVisible();
      if (route === '/app/review') {
        await expect(page.locator('[data-slot="kpi-tile"]:visible'), `${route} at ${width}px shows its four KPI tiles before its type scan`).toHaveCount(4);
      }
      await expect(page.locator('[data-state-kind="error"]'), `${route} at ${width}px renders no error state before its type scan`).toHaveCount(0);
      expect(await typographyViolations(page), `${route} at ${width}px contains typography outside the document contract`).toEqual([]);
    }
    for (const width of viewports) for (const route of phase7AuditedRoutes) for (const state of states) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(fixtureUrl(route, state)); await expectStateMeaning(page, route, state, width);
    }
    await signInAsRequestor(page);
    for (const route of phase7AuditedRoutes) {
      await page.goto(fixtureUrl(route, 'error'));
      await expect(page.locator('[data-ui-state]'), `${route} Requestor denial must not expose a fixture boundary`).toHaveCount(0);
      await expect(page.getByRole('main').getByRole('alert'), `${route} Requestor denial is one permission alert`).toHaveCount(1);
      await expect(page.getByRole('main').locator('[data-slot="state"][data-state-kind="permission"]'), `${route} Requestor denial is the permission state`).toBeVisible();
      await expect(page.getByRole('table')).toHaveCount(0);
      await expect(page.locator('a[href*="/app/risks/"], a[href*="/app/review/"]'), `${route} Requestor denial must not expose analyst record links`).toHaveCount(0);
    }
  });

  test('asserts the documented repair points at mobile and desktop widths', async ({ page }) => {
    await signIn(page);
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 }); await page.goto('/app');
      const roleNote = page.locator('.role-switcher p'); await expect(roleNote).toHaveCSS('font-size', '12px'); await expect(roleNote).toHaveCSS('font-weight', '400');
      for (const rating of ['Low', 'Moderate', 'High', 'Critical']) {
        const count = page.getByLabel(new RegExp(`${rating} released assessments: \\d+$`)).locator('span').last();
        await expect(count).toHaveCSS('font-size', '14px'); await expect(count).toHaveCSS('font-weight', '500'); await expect(count).toHaveCSS('font-variant-numeric', /tabular-nums/);
      }
      await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
      await page.goto('/app/admin/controls'); const administration = page.locator('aside.sidebar nav').getByText('Administration', { exact: true });
      await expect(administration).toHaveCSS('font-size', '11px'); await expect(administration).toHaveCSS('text-transform', 'uppercase');
      // DataTable renders its mobile card variant below md, so there is no table to assert
      // at 375px by design. The header repair is a desktop-table concern only.
      if (width >= 768) {
        await page.goto('/app/risks'); const header = page.getByRole('table', { name: 'Risk Register results' }).getByRole('columnheader').first(); const button = header.getByRole('button');
        await expect(header).toHaveCSS('text-transform', 'uppercase'); await expect(button).toHaveCSS('text-transform', 'uppercase');
        expect(await button.evaluate((node) => ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing'].every((key) => getComputedStyle(node)[key as keyof CSSStyleDeclaration] === getComputedStyle(node.closest('th')!)[key as keyof CSSStyleDeclaration]))).toBe(true);
      }
      await page.goto('/app/review/assessments');
      if (width < 768) await expect(page.getByRole('list')).toBeVisible(); else await expect(page.getByRole('table', { name: 'Risk assessments for review' })).toBeVisible();
    }
  });
});

/*
 * Self-hosted type families (G-10, closes R-08-24). app/fonts.ts loads the three families through
 * next/font/local from the files committed in app/fonts. On the production build this proves that
 * the preloads are exactly the six committed latin files, that each family renders in its own face
 * at every weight in use, that latin-ext and, for Plus Jakarta Sans and IBM Plex Mono, vietnamese
 * text render in family and their files load only on demand (quick task 261002-drq), that display
 * text falls back for Vietnamese tone letters (Instrument Serif has no vietnamese subset), and that
 * neither the page, its HTML and stylesheets nor the build output reach a Google font host.
 */
/* Written with escaped dots so the pattern cannot match its own source text. */
const googleFontHost = /fonts\.(?:googleapis|gstatic)\.com/;
const latinExtSample = 'Łukasz Dvořák Māori Ştefan';
/* Letters both latin-ext and vietnamese cover: latin-ext, listed first, must serve them. */
const sharedLatinExtSample = 'Đorđević Bălan';
const vietnameseSample = 'Nguyễn Văn Đức, Trần Thị Hồng';

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The committed font files by SHA-256, and the names of each group the test reasons about. */
function committedFonts() {
  const directory = resolve(process.cwd(), 'app', 'fonts');
  const names = readdirSync(directory).filter((name) => name.endsWith('.woff2')).sort();
  const byHash = new Map(names.map((name) => [sha256(readFileSync(join(directory, name))), name] as const));
  return {
    names,
    byHash,
    latin: names.filter((name) => /-latin-\d{3}-normal\.woff2$/.test(name)),
    latinExt400: names.filter((name) => name.endsWith('-latin-ext-400-normal.woff2')),
    latinExtHeavier: names.filter((name) => /-latin-ext-(?:500|600)-normal\.woff2$/.test(name)),
    vietnamese400: names.filter((name) => name.endsWith('-vietnamese-400-normal.woff2')),
    vietnameseHeavier: names.filter((name) => /-vietnamese-(?:500|600)-normal\.woff2$/.test(name)),
  };
}

/** The platform fonts Chromium used for the text inside the first element matching the selector. */
async function platformFonts(session: CDPSession, selector: string) {
  // A fresh document every call, so a node id is never stale after the page changes.
  const { root } = await session.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (nodeId === 0) throw new Error(`SELF_HOSTED_FONTS_NODE_MISSING: no element matches ${selector}`);
  const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
  return fonts.map(({ postScriptName, isCustomFont }) => ({ postScriptName, isCustomFont }));
}

/** Appends a probe with the given inline style and text to main. */
async function probe(page: Page, id: string, style: string, text: string) {
  await page.evaluate(({ id, style, text }) => {
    const element = document.createElement('div');
    element.dataset.g10Probe = id;
    element.setAttribute('style', style);
    element.textContent = text;
    const main = document.querySelector('main');
    if (!main) throw new Error('SELF_HOSTED_FONTS_MAIN_MISSING');
    main.append(element);
  }, { id, style, text });
}

function buildTextFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? buildTextFiles(path) : [path];
  });
}

test.describe('self-hosted type families (G-10, R-08-24)', () => {
  test('serves, renders and loads the three families from the origin only', async ({ page }) => {
    test.setTimeout(120_000);
    const fonts = committedFonts();
    expect(fonts.names, 'app/fonts holds the 17 committed woff2 files').toHaveLength(17);
    expect(fonts.latin, 'six latin files').toHaveLength(6);
    expect(fonts.latinExt400, 'three latin-ext 400 files').toHaveLength(3);
    expect(fonts.latinExtHeavier, 'three latin-ext 500 and 600 files').toHaveLength(3);
    expect(fonts.vietnamese400, 'two vietnamese 400 files').toHaveLength(2);
    expect(fonts.vietnameseHeavier, 'three vietnamese 500 and 600 files').toHaveLength(3);

    const requests: Array<{ url: string; resourceType: string }> = [];
    page.on('request', (request) => requests.push({ url: request.url(), resourceType: request.resourceType() }));
    const fetched: Array<{ url: string; file: string }> = [];
    const pending: Array<Promise<void>> = [];
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'font') return;
      pending.push(response.body().then((body) => {
        const hash = sha256(body);
        fetched.push({ url: response.url(), file: fonts.byHash.get(hash) ?? `UNKNOWN_FONT:${hash}` });
      }));
    });
    const fetchedFiles = async () => {
      await Promise.all(pending);
      return [...new Set(fetched.map(({ file }) => file))].sort();
    };

    const response = await page.goto('/sign-in');
    expect(response?.ok(), '/sign-in responds').toBe(true);
    await expect(page.getByRole('heading', { level: 1, name: 'Development sign-in' })).toBeVisible();
    const origin = new URL(page.url()).origin;

    // Preloads: same-origin build media whose bytes are exactly the six committed latin files.
    const preloads = await page.locator('link[rel="preload"][as="font"]').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    const preloadHashes: string[] = [];
    for (const href of preloads) {
      const url = new URL(href, page.url());
      expect(url.origin, `the preload ${href} is same-origin`).toBe(origin);
      expect(url.pathname, `the preload ${href} is build media`).toMatch(/^\/_next\/static\/media\//);
      const preloadResponse = await page.request.get(url.toString());
      expect(preloadResponse.ok(), `the preload ${href} is served`).toBe(true);
      preloadHashes.push(sha256(await preloadResponse.body()));
    }
    expect(preloadHashes.map((hash) => fonts.byHash.get(hash) ?? `UNKNOWN_FONT:${hash}`).sort(), '/sign-in preloads exactly the six committed latin files').toEqual(fonts.latin);

    // Rendered faces: each element's text in its own self-hosted face at the weight in use.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const session = await page.context().newCDPSession(page);
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const expectFace = async (selector: string, postScriptName: string) => {
      await expect.poll(() => platformFonts(session, selector), { message: `${selector} renders in ${postScriptName} only` })
        .toEqual([{ isCustomFont: true, postScriptName }]);
    };
    await expectFace('.sign-in-card h1', 'InstrumentSerif-Regular');
    await expectFace('.sign-in-card .wordmark', 'InstrumentSerif-Regular');
    await expectFace('.sign-in-eyebrow', 'IBMPlexMono-Regular');
    await expectFace('.sign-in-lead', 'PlusJakartaSans-Regular');
    // The button renders in the Plus Jakarta Sans face of its computed weight (the unlayered
    // `button { font: inherit }` reset in globals.css decides that weight, not the loader).
    const requestorButton = 'button[name="role"][value="Requestor"]';
    const buttonWeight = await page.locator(requestorButton).evaluate((element) => getComputedStyle(element).fontWeight);
    const jakartaFaces: Record<string, string> = { 400: 'PlusJakartaSans-Regular', 500: 'PlusJakartaSans-Medium', 600: 'PlusJakartaSans-SemiBold' };
    expect(Object.keys(jakartaFaces), `the Continue as Requestor button uses a shipped weight, not ${buttonWeight}`).toContain(buttonWeight);
    await expectFace(requestorButton, jakartaFaces[buttonWeight]!);
    await probe(page, 'sans-500', 'font-family: var(--font-sans); font-weight: 500', 'Medium weight');
    await probe(page, 'sans-600', 'font-family: var(--font-sans); font-weight: 600', 'Semibold weight');
    await probe(page, 'mono-500', 'font-family: var(--font-mono); font-weight: 500', 'Medium weight');
    await expectFace('[data-g10-probe="sans-500"]', 'PlusJakartaSans-Medium');
    await expectFace('[data-g10-probe="sans-600"]', 'PlusJakartaSans-SemiBold');
    await expectFace('[data-g10-probe="mono-500"]', 'IBMPlexMono-Medium');

    // Before any latin-ext text, only latin files are fetched.
    const beforeLatinExt = await fetchedFiles();
    expect(beforeLatinExt.filter((file) => !fonts.latin.includes(file)), 'only latin files load before latin-ext text renders').toEqual([]);

    // latin-ext renders in family, and only its 400 files load for 400-weight text.
    await probe(page, 'sans-latin-ext', 'font-family: var(--font-sans); font-weight: 400', latinExtSample);
    await probe(page, 'display-latin-ext', 'font-family: var(--font-display); font-size: 28px', latinExtSample);
    await probe(page, 'mono-latin-ext', 'font-family: var(--font-mono); text-transform: uppercase', latinExtSample);
    await expectFace('[data-g10-probe="sans-latin-ext"]', 'PlusJakartaSans-Regular');
    await expectFace('[data-g10-probe="display-latin-ext"]', 'InstrumentSerif-Regular');
    await expectFace('[data-g10-probe="mono-latin-ext"]', 'IBMPlexMono-Regular');
    await probe(page, 'sans-shared-latin-ext', 'font-family: var(--font-sans); font-weight: 400', sharedLatinExtSample);
    await expectFace('[data-g10-probe="sans-shared-latin-ext"]', 'PlusJakartaSans-Regular');
    await expect.poll(fetchedFiles, { message: 'latin-ext text loads the latin-ext 400 file of each family' })
      .toEqual(expect.arrayContaining(fonts.latinExt400));
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const afterLatinExt = await fetchedFiles();
    expect(afterLatinExt.filter((file) => fonts.latinExtHeavier.includes(file)), '400-weight latin-ext text loads no latin-ext 500 or 600 file').toEqual([]);
    expect(
      afterLatinExt.filter((file) => fonts.vietnamese400.includes(file) || fonts.vietnameseHeavier.includes(file)),
      'latin-ext text, including letters vietnamese also covers, loads no vietnamese file',
    ).toEqual([]);
    expect(afterLatinExt.filter((file) => !fonts.names.includes(file)), 'every font response is a committed file').toEqual([]);

    // Vietnamese renders in one face per family, and only the 400 vietnamese files load for 400-weight
    // text. Display text falls back for the tone letters: Instrument Serif has no vietnamese subset.
    await probe(page, 'sans-vietnamese', 'font-family: var(--font-sans); font-weight: 400', vietnameseSample);
    await probe(page, 'mono-vietnamese', 'font-family: var(--font-mono); text-transform: uppercase', vietnameseSample);
    await probe(page, 'display-vietnamese', 'font-family: var(--font-display); font-size: 28px', vietnameseSample);
    await expectFace('[data-g10-probe="sans-vietnamese"]', 'PlusJakartaSans-Regular');
    await expectFace('[data-g10-probe="mono-vietnamese"]', 'IBMPlexMono-Regular');
    const displayFaces = async () => {
      const used = await platformFonts(session, '[data-g10-probe="display-vietnamese"]');
      return {
        custom: used.filter(({ isCustomFont }) => isCustomFont).map(({ postScriptName }) => postScriptName).sort(),
        platform: used.some(({ isCustomFont }) => !isCustomFont),
      };
    };
    await expect.poll(displayFaces, { message: 'Vietnamese display text renders Instrument Serif plus a platform fallback' })
      .toEqual({ custom: ['InstrumentSerif-Regular'], platform: true });
    await expect.poll(fetchedFiles, { message: 'Vietnamese text loads the vietnamese 400 file of Plus Jakarta Sans and IBM Plex Mono' })
      .toEqual(expect.arrayContaining(fonts.vietnamese400));
    const afterVietnamese = await fetchedFiles();
    expect(afterVietnamese.filter((file) => fonts.vietnameseHeavier.includes(file)), '400-weight Vietnamese text loads no vietnamese 500 or 600 file').toEqual([]);
    expect(afterVietnamese.filter((file) => fonts.latinExtHeavier.includes(file)), '400-weight Vietnamese text loads no latin-ext 500 or 600 file').toEqual([]);
    expect(afterVietnamese.filter((file) => !fonts.names.includes(file)), 'every font response is a committed file').toEqual([]);

    // No request leaves the origin, and every font comes from the build media.
    expect(requests.filter(({ url }) => googleFontHost.test(url)).map(({ url }) => url), 'no request reaches a Google font host').toEqual([]);
    expect(requests.filter(({ url }) => !url.startsWith(`${origin}/`) && !url.startsWith('data:')).map(({ url }) => url), 'no request leaves the web origin').toEqual([]);
    const fontRequests = requests.filter(({ resourceType }) => resourceType === 'font');
    expect(fontRequests.length, 'the page requested its fonts').toBeGreaterThanOrEqual(6);
    for (const { url } of fontRequests) {
      const parsed = new URL(url);
      expect(parsed.origin, `the font request ${url} is same-origin`).toBe(origin);
      expect(parsed.pathname, `the font request ${url} is build media`).toMatch(/^\/_next\/static\/media\//);
    }

    // The HTML and every stylesheet it links name no Google font host.
    expect(await response!.text(), 'the /sign-in HTML names no Google font host').not.toMatch(googleFontHost);
    const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(stylesheets.length, '/sign-in links its stylesheets').toBeGreaterThan(0);
    for (const href of stylesheets) {
      const stylesheet = await page.request.get(new URL(href, page.url()).toString());
      expect(stylesheet.ok(), `the stylesheet ${href} is served`).toBe(true);
      expect(await stylesheet.text(), `the stylesheet ${href} names no Google font host`).not.toMatch(googleFontHost);
    }

    // The build output names no Google font host.
    const distDirectory = process.env.CSRM_E2E_NEXT_DIST_DIR;
    if (!distDirectory) throw new Error('SELF_HOSTED_FONTS_RUN_VALUE_MISSING: playwright.config.ts did not expose CSRM_E2E_NEXT_DIST_DIR');
    const distDir = resolve(process.cwd(), distDirectory);
    const buildFiles = ['static', 'server']
      .flatMap((directory) => buildTextFiles(join(distDir, directory)))
      .filter((file) => /\.(?:js|mjs|cjs|css|html|json|rsc|txt|map)$/.test(file));
    expect(buildFiles.length, 'the scan reads the build, not an empty directory').toBeGreaterThanOrEqual(10);
    const offenders = buildFiles
      .filter((file) => googleFontHost.test(readFileSync(file, 'utf8')))
      .map((file) => relative(distDir, file).split(sep).join('/'));
    expect(offenders, 'no build file names a Google font host').toEqual([]);
  });
});

/*
 * Print (direction section 4 Print, X-4; D-33). A4 is 794px wide at 96 CSS pixels per inch; 718px
 * is what remains inside the browser's default print margins, below md, where the screen shows
 * cards. At both widths a page prints its content only: no shell, no interaction-only control, no
 * sticky, scrolling or blurred box, no scroll cue or vertical rule, headers that repeat, rows and
 * badges that keep together and keep their tints, and nothing wider than the paper.
 *
 * One table is allowed past the paper: the eight-column Risk Register, whose narrowest layout at the
 * screen type scale is wider than A4 (08-09 summary). For it the proof is that nothing clips it,
 * every cell wraps and nothing else is wider; the browser's print scaling brings it onto the page,
 * which the A4 samples in the summary show.
 */
const printWidths = [794, 718] as const;

type PrintLayout = {
  shownControls: string[];
  sticky: string[];
  cues: number;
  backdrops: string[];
  verticalRules: string[];
  unwrappedCells: number;
  headerGroups: string[];
  breakableRows: number;
  untintedMarks: string[];
  clamped: string[];
  scrollWidth: number;
  viewport: number;
};

async function printLayout(page: Page): Promise<PrintLayout> {
  return page.evaluate(() => {
    const describe = (element: Element) => [element.tagName.toLowerCase(), element.getAttribute('data-slot'), element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40)].filter(Boolean).join(' ');
    const laidOut = (element: Element) => element.getClientRects().length > 0;
    const inMain = (selector: string) => Array.from(document.querySelectorAll(`main ${selector}`)).filter(laidOut);
    return {
      // The markers and everything inside them, so a box-less marker cannot hide a control that still prints.
      shownControls: Array.from(document.querySelectorAll('[data-print="hidden"], [data-print="hidden"] *, form[role="search"], form[role="search"] *')).filter(laidOut).map(describe),
      sticky: inMain('*').filter((element) => getComputedStyle(element).position === 'sticky').map(describe),
      cues: Array.from(document.querySelectorAll('[data-overflow]')).filter((element) => getComputedStyle(element, '::after').content !== 'none').length,
      // Chromium prints an element behind a blurred backdrop blank, which emptied the table header row.
      backdrops: inMain('*').filter((element) => getComputedStyle(element).backdropFilter !== 'none').map(describe),
      verticalRules: inMain('td, th').filter((cell) => Number.parseFloat(getComputedStyle(cell).borderRightWidth) > 0).map(describe),
      unwrappedCells: inMain('td, th').filter((cell) => getComputedStyle(cell).whiteSpace !== 'normal').length,
      headerGroups: inMain('thead').map((thead) => getComputedStyle(thead).display).filter((display) => display !== 'table-header-group'),
      breakableRows: inMain('tr').filter((row) => getComputedStyle(row).breakInside !== 'avoid').length,
      untintedMarks: inMain('[data-slot="badge"], [data-slot="bar-chart-mark"]').filter((mark) => {
        const style = getComputedStyle(mark) as CSSStyleDeclaration & { printColorAdjust?: string; webkitPrintColorAdjust?: string };
        return (style.printColorAdjust || style.webkitPrintColorAdjust) !== 'exact';
      }).map(describe),
      // Text a long-text column clamps on screen prints whole (X-4, W-4).
      clamped: inMain('*').filter((element) => {
        const clamp = getComputedStyle(element).getPropertyValue('-webkit-line-clamp');
        return clamp !== '' && clamp !== 'none';
      }).map(describe),
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    };
  });
}

/** Nothing clips the table: its scroller and every ancestor up to main let it overflow visibly. */
async function clippingAncestors(table: Locator): Promise<string[]> {
  return table.evaluate((element) => {
    const clipping: string[] = [];
    for (let node = element.parentElement; node && node.tagName !== 'MAIN'; node = node.parentElement) {
      const { overflowX } = getComputedStyle(node);
      if (overflowX !== 'visible') clipping.push(`${node.tagName.toLowerCase()}[data-slot=${node.getAttribute('data-slot')}] overflow-x ${overflowX}`);
    }
    return clipping;
  });
}

async function expectPrintedWithoutShell(page: Page, surface: string, content: (width: number) => Promise<void>, widerThanPaper?: Locator): Promise<void> {
  await page.emulateMedia({ media: 'print' });
  for (const width of printWidths) {
    await page.setViewportSize({ width, height: 1123 });
    const label = `${surface} printed at ${width}px`;
    for (const chrome of ['.sidebar', '.header', '.skip-link']) await expect(page.locator(chrome), `${label} drops ${chrome}`).toBeHidden();
    await expect(page.getByRole('main'), `${label} prints the page content`).toBeVisible();
    await content(width);
    const layout = await printLayout(page);
    expect(layout.shownControls, `${label} prints no interaction-only control`).toEqual([]);
    expect(layout.sticky, `${label} has no sticky element inside main`).toEqual([]);
    expect(layout.cues, `${label} draws no scroll cue`).toBe(0);
    expect(layout.backdrops, `${label} prints nothing behind a blurred backdrop`).toEqual([]);
    expect(layout.verticalRules, `${label} draws no vertical rule in a table`).toEqual([]);
    expect(layout.unwrappedCells, `${label} lets every table cell wrap`).toBe(0);
    expect(layout.headerGroups, `${label} repeats every table header`).toEqual([]);
    expect(layout.breakableRows, `${label} keeps every table row on one page`).toBe(0);
    expect(layout.untintedMarks, `${label} keeps badge and chart mark tints`).toEqual([]);
    expect(layout.clamped, `${label} prints no text cut short`).toEqual([]);
    if (widerThanPaper) {
      expect(await clippingAncestors(widerThanPaper), `${label} clips nothing of its table`).toEqual([]);
      // One pixel absorbs the rounding between the table's fractional edge and the document's integer width.
      const tableRight = await widerThanPaper.evaluate((element) => Math.ceil(element.getBoundingClientRect().right));
      expect(layout.scrollWidth, `${label} is no wider than its table`).toBeLessThanOrEqual(Math.max(layout.viewport, tableRight + 1));
    } else {
      expect(layout.scrollWidth, `${label} fits the paper`).toBeLessThanOrEqual(layout.viewport);
    }
  }
  await page.emulateMedia({ media: null });
}

test.describe('print', () => {
  test('prints application pages without the shell', async ({ page }) => {
    test.setTimeout(300_000);
    await signIn(page);
    await page.setViewportSize({ width: 794, height: 1123 });

    // A filtered register: the chip's label and the counts print, the chip's control does not.
    await page.goto('/app/risks?state=open');
    const register = page.getByRole('table', { name: 'Risk Register results' });
    await expect(register.locator('a.record-link').first(), 'the register shows its records before printing').toBeVisible();
    const firstRiskHref = await register.locator('a.record-link[href^="/app/risks/"]').first().getAttribute('href');
    expect(firstRiskHref).toMatch(/^\/app\/risks\/[^/]+$/);
    await expectPrintedWithoutShell(page, 'the Risk Register', async (width) => {
      await expect(register, `the register prints as a table at ${width}px`).toBeVisible();
      await expect(register.getByRole('columnheader'), `the register prints its eight column headers at ${width}px`).toHaveCount(8);
      for (const header of await register.getByRole('columnheader').all()) await expect(header, `a column header prints at ${width}px`).toBeVisible();
      await expect(page.locator('[data-slot="data-table-mobile"]'), `the register prints no cards at ${width}px`).toBeHidden();
      await expect(page.getByText('Risk state: Open', { exact: true }), `the active filter prints at ${width}px`).toBeVisible();
      await expect(page.locator('output').filter({ hasText: /\d+ results?$/ }), `the result count prints at ${width}px`).toBeVisible();
      await expect(page.locator('output').filter({ hasText: /^Page \d+ of \d+$/ }), `the page position prints at ${width}px`).toBeVisible();
      // The sorted column's direction prints the table's order; the unsorted columns' cue does not (verdict 4c).
      await expect(register.locator('thead svg.lucide-chevrons-up-down').filter({ visible: true }), `no unsorted sort cue prints at ${width}px`).toHaveCount(0);
      await expect(register.locator('thead svg.lucide-chevron-up, thead svg.lucide-chevron-down').filter({ visible: true }), `the sorted column's direction prints at ${width}px`).toHaveCount(1);
    }, register);

    await page.goto('/app/reports/risk-exposure');
    const sectionTables = page.locator('[data-slot="report-section"] table');
    await expect(sectionTables.first(), 'the report shows its section tables before printing').toBeVisible();
    await expectPrintedWithoutShell(page, 'the risk-exposure report', async (width) => {
      const count = await sectionTables.count();
      expect(count, `the report has section tables at ${width}px`).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) await expect(sectionTables.nth(index), `section table ${index + 1} prints at ${width}px`).toBeVisible();
    });

    await page.goto(firstRiskHref!);
    const heading = page.getByRole('main').getByRole('heading', { level: 1 });
    // The header's ratings and status are content, not controls, so they print (PageHeader status).
    const ratings = page.locator('.page-header [aria-label="Risk ratings and status"]');
    await expect(heading, 'the Risk detail shows its heading before printing').toBeVisible();
    await expect(ratings, 'the Risk detail shows its ratings before printing').toContainText('Residual');
    await expectPrintedWithoutShell(page, 'a Risk detail', async (width) => {
      await expect(heading, `the Risk number prints at ${width}px`).toBeVisible();
      await expect(ratings, `the Risk ratings print at ${width}px`).toBeVisible();
      await expect(ratings, `the Risk ratings print at ${width}px`).toContainText('Inherent');
    });

    // In-page workflow actions are interaction-only, so they do not print (X-4, W-14).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/review/questionnaires');
    await page.getByRole('main').getByRole('link', { name: 'Customer portal questionnaire awaiting release', exact: true }).filter({ visible: true }).first().click();
    const questionnaireTitle = page.getByRole('main').getByRole('heading', { level: 1, name: 'Customer portal questionnaire awaiting release' });
    const workflowActions = page.getByRole('main').getByRole('button', { name: /^(Release questionnaire|Add question|Edit|Delete)\b/ });
    await expect(questionnaireTitle, 'the analyst questionnaire review shows its title before printing').toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Release questionnaire', exact: true }), 'the questionnaire is in analyst review, with its workflow actions, before printing').toBeVisible();
    expect(await workflowActions.count(), 'the analyst review offers its question editor actions before printing').toBeGreaterThan(2);
    await expectPrintedWithoutShell(page, 'the analyst questionnaire review', async (width) => {
      await expect(questionnaireTitle, `the questionnaire title prints at ${width}px`).toBeVisible();
      await expect(workflowActions.filter({ visible: true }), `no questionnaire workflow action prints at ${width}px`).toHaveCount(0);
    });
  });
});

/*
 * Direction section 4: a page header's actions sit beside the title from 768px and stack full-width
 * below it (W-13), and a status or risk badge is 20px tall (W-11).
 */
test.describe('components at the direction values', () => {
  test('draws every status and risk badge 20px tall', async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const route of ['/app/risks', '/app/review/assessments'] as const) {
      await page.goto(route);
      const badges = page.getByRole('main').locator('[data-slot="badge"]').filter({ visible: true });
      await expect(badges.first(), `${route} shows its badges`).toBeVisible();
      const heights = await badges.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
      expect(heights.filter((height) => Math.abs(height - 20) > 0.5), `every badge on ${route} is 20px tall`).toEqual([]);
    }
  });

  test('stacks page header actions full-width below 768px', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    const header = page.locator('.page-header');
    for (const width of [375, 700, 767, 768, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app/admin/risk-types');
      const actions = [
        header.getByRole('link', { name: 'Create Risk Type', exact: true }),
        header.getByRole('link', { name: 'Import CSV', exact: true }),
      ];
      for (const action of actions) await expect(action, `the Risk Types header action shows at ${width}px`).toBeVisible();
      const headerBox = await header.boundingBox();
      for (const action of actions) {
        const actionBox = await action.boundingBox();
        const name = await action.textContent();
        if (width < 768) {
          expect(Math.abs((actionBox?.width ?? 0) - (headerBox?.width ?? 0)), `${name} spans the header at ${width}px`).toBeLessThanOrEqual(1);
        } else {
          expect(actionBox?.width ?? 0, `${name} keeps its own width beside the title at ${width}px`).toBeLessThan((headerBox?.width ?? 0) / 2);
        }
      }
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/admin/not-a-collection');
    const returnLink = header.getByRole('link', { name: 'Return to workspace', exact: true });
    await expect(returnLink, 'the in-shell not-found offers its action').toBeVisible();
    const [notFoundHeader, returnBox] = await Promise.all([header.boundingBox(), returnLink.boundingBox()]);
    expect(Math.abs((returnBox?.width ?? 0) - (notFoundHeader?.width ?? 0)), 'Return to workspace spans the header at 375px').toBeLessThanOrEqual(1);
  });
});
