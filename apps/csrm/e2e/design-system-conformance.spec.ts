import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { strapiHealthUrl } from './harness-urls';

const auditedRoutes = ['/app', '/app/requests', '/app/risks', '/app/review/assessments', '/app/review/questionnaires', '/app/admin/controls'] as const;
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

async function signIn(page: Page) {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);
  await page.getByRole('button', { name: 'Continue as Security Analyst' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('banner').getByText('Security Analyst', { exact: true })).toBeVisible();
}

async function signInAsRequestor(page: Page) {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);
  await page.getByRole('button', { name: 'Continue as Requestor' }).click();
  await expect(page).toHaveURL(/\/app$/);
  // Wait for the banner to show the new role. Asserting the URL alone returns while the
  // previous Security Analyst session is still in effect, which would silently run the
  // denial proof as the wrong actor and let an authorised render look like a pass.
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
    const port = 47_000 + (process.pid % 1_000);
    const origin = `http://127.0.0.1:${port}`;
    const next = resolve(process.cwd(), 'node_modules/next/dist/bin/next');
    const env: NodeJS.ProcessEnv = { ...process.env, CSRM_NEXT_DIST_DIR: `.tmp/ordinary-next-${process.pid}` };
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

});

test.describe('design-system type contract', () => {
  test('audited route state, type, and authorization matrix', async ({ page }) => {
    test.setTimeout(600_000); expect(typographyTokens.length).toBeGreaterThan(0); await signIn(page);
    for (const width of viewports) for (const route of auditedRoutes) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(route);
      const violations = await page.evaluate((tokens) => Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((element) => element.offsetParent !== null && element.matches('h1,h2,h3,h4,h5,h6,p,span,a,button,label,select,option,input,textarea,th,td,[role="status"]'))
        .filter((element) => (element.textContent ?? element.getAttribute('placeholder') ?? '').trim())
        .map((element) => { const style = getComputedStyle(element); return { size: style.fontSize, weight: style.fontWeight, tracking: style.letterSpacing === 'normal' ? 0 : Number.parseFloat(style.letterSpacing), transform: style.textTransform }; })
        .filter((actual) => !tokens.some((token) => token.size === actual.size && token.weight === actual.weight && (!token.tracking || Math.abs(actual.tracking - Number.parseFloat(token.tracking) * Number.parseFloat(token.size)) <= 0.05) && (!token.uppercase || actual.transform === 'uppercase'))), typographyTokens);
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
