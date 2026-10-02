import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Browser, type Locator, type Page, type Response } from '@playwright/test';

import {
  findBudgetBreaches,
  summariseRouteSamples,
  type Budget,
  type RouteSample,
  type RouteSummary,
} from '../src/lib/testing/performance-metrics';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { signInAs, type SignInRole } from './helpers/navigation';
import { expectSettled } from './helpers/settle';

/*
 * The production-build performance baseline (plan 08-13, D-24). For each of the ten key routes, five
 * samples, each in a fresh browser context at 1440×900, measure against the seeded E2E database:
 * - the first-load JavaScript and CSS: every `/_next/static/` script and stylesheet the browser
 *   downloads that the route's own document references (its HTML tags and the chunks its inline RSC
 *   payload names), both as delivered (the encoded body `sizes()` reports, gzip because `next start`
 *   compresses by default) and as decoded (the body's own length). What the router prefetches for the
 *   links in view once the page has hydrated is another route's code, downloaded on no fixed
 *   schedule: it is recorded apart in the JSON record and never budgeted;
 * - the navigation timings: TTFB (`responseStart`), DOMContentLoaded and load (their event ends);
 * - the largest-contentful-paint candidate buffered at settle time. It is a candidate: the browser
 *   finalises LCP only on the first interaction or when the page is hidden.
 * Each route's samples are summarised by median (src/lib/testing/performance-metrics.ts) and the
 * medians of delivered JavaScript, TTFB and LCP are held to the route's budget.
 *
 * The HTTP cache is disabled through CDP for every sample. The measured navigation follows a sign-in
 * that lands on /app, which has already fetched the shared chunks, and `sizes()` reports zero bytes
 * for a cache hit: with the cache on, the shared chunks would silently drop out of every route's
 * figure. The completeness self-check then proves every `/_next/static/` script and stylesheet in the
 * settled document was downloaded and accounted for, with a non-zero delivered size. The one
 * exception is Next's legacy-browser polyfill file: it is rendered as a `nomodule` script, which a
 * module-capable browser never downloads, so it is neither delivered nor counted.
 *
 * The page leaves the dashboard for about:blank before the measured navigation, so no late request
 * of the sign-in landing is counted. Trace recording is off in this file: its DOM snapshots and
 * screencast run inside the browser being timed.
 *
 * Only the `desktop` project runs this file (it is outside the mobile project's testMatch). The budgets
 * live here and in docs/performance/phase-08-baseline.md, which records their derivation, the
 * measured baseline and how to re-run it. Each run writes its medians and samples to
 * apps/csrm/.tmp/performance/baseline-<project>.json (ignored).
 */

test.use({ trace: 'off' });

const SAMPLES = 5;

/** The research ceilings (08-RESEARCH A8, D-24). A route that needs more gets an override below; these never change. */
const PERFORMANCE_BUDGETS: Budget = { deliveredJsBytes: 300_000, ttfbMs: 500, lcpMs: 2_500 };

type KeyRoute =
  | '/app'
  | '/app/requests'
  | '/app/requests/{documentId}'
  | '/app/questionnaires/{documentId}'
  | '/app/review'
  | '/app/review/assessments/{documentId}'
  | '/app/risks'
  | '/app/risks/{documentId}'
  | '/app/reports/risk-exposure'
  | '/app/admin/controls';

/*
 * Only an inherent cost found by the D-24 triage earns a route its own budget: 1.5 × the measured
 * median, rounded up to the next 10,000 bytes or 50 ms, with a one-line reason beside it and in the
 * baseline record. A real defect is fixed at its source instead.
 */
const ROUTE_BUDGET_OVERRIDES: Partial<Record<KeyRoute, Partial<Budget>>> = {
  // Inherent: the Requestor's answers are validated in the browser by a zod schema built from the questions (react-hook-form's zodResolver), so the route carries zod's full API (64,389 bytes delivered); 1.5 × the 328,599-byte median, rounded up.
  '/app/questionnaires/{documentId}': { deliveredJsBytes: 500_000 },
};

type KeyRouteEntry = {
  route: KeyRoute;
  actor: SignInRole;
  title: string;
  heading: string;
  /** A record route's URL, read from the seeded link on its list. */
  resolve?: { list: string; link: (page: Page) => Locator };
  /** Content only the populated page renders. */
  populated: (page: Page) => Locator;
};

const main = (page: Page) => page.getByRole('main');

// Seeded fixtures (apps/backend/src/bootstrap): Jane's navigation lifecycle and questionnaire records, the Risk Register.
const KEY_ROUTES: readonly KeyRouteEntry[] = [
  {
    route: '/app', actor: 'Requestor', title: 'Dashboard | IdamBox CSRM', heading: 'Dashboard',
    populated: (page) => page.getByRole('region', { name: 'My Assessment Requests' }).getByRole('list', { name: 'My Assessment Requests by lifecycle state' }),
  },
  {
    route: '/app/requests', actor: 'Requestor', title: 'My Requests | IdamBox CSRM', heading: 'My Requests',
    populated: (page) => main(page).locator('a.record-link'),
  },
  {
    route: '/app/requests/{documentId}', actor: 'Requestor', title: 'Assessment Request | IdamBox CSRM', heading: 'Enterprise password manager rollout',
    resolve: { list: '/app/requests?q=RAR-E2E-NAV-OWNER-001', link: (page) => main(page).getByRole('link', { name: 'Enterprise password manager rollout', exact: true }) },
    populated: (page) => page.getByRole('region', { name: 'Request actions' }),
  },
  {
    route: '/app/questionnaires/{documentId}', actor: 'Requestor', title: 'Questionnaire | IdamBox CSRM', heading: 'Customer portal questionnaire draft',
    resolve: { list: '/app/questionnaires', link: (page) => main(page).getByRole('link', { name: 'Customer portal questionnaire draft', exact: true }) },
    /*
     * Either state of Jane's questionnaire, rendered by the same client modules. Alone, this file finds
     * it a draft being answered. In the full suite it runs last in the desktop project (its worker-scoped
     * `trace: 'off'` gives it a worker of its own), after questionnaire-workflow.spec.ts has submitted
     * the questionnaire, which then renders read-only.
     */
    populated: (page) => page.getByRole('region', { name: 'Questionnaire completion' })
      .or(main(page).getByText('Questionnaire submitted. The Security Analyst is reviewing your answers. Until they start the assessment, you can return the questionnaire to draft to change them.')),
  },
  {
    route: '/app/review', actor: 'Security Analyst', title: 'Analyst Dashboard | IdamBox CSRM', heading: 'Analyst dashboard',
    populated: (page) => page.getByRole('region', { name: 'Needs action', exact: true }).locator('[data-slot="kpi-tile"]'),
  },
  {
    route: '/app/review/assessments/{documentId}', actor: 'Security Analyst', title: 'Risk Assessment Review | IdamBox CSRM', heading: 'Risk assessment review',
    resolve: { list: '/app/review/assessments?q=ASM-E2E-NAV-OWNER-001', link: (page) => main(page).getByRole('link', { name: 'ASM-E2E-NAV-OWNER-001', exact: true }) },
    populated: (page) => page.locator('section[aria-labelledby="assessment-lifecycle-heading"]'),
  },
  {
    route: '/app/risks', actor: 'Security Analyst', title: 'Risk Register | IdamBox CSRM', heading: 'Risk Register',
    populated: (page) => main(page).getByRole('link', { name: 'RSK-DEV-MUTABLE-001', exact: true }),
  },
  {
    route: '/app/risks/{documentId}', actor: 'Security Analyst', title: 'Risk Details | IdamBox CSRM', heading: 'RSK-DEV-MUTABLE-001',
    resolve: { list: '/app/risks', link: (page) => page.getByRole('table', { name: 'Risk Register results' }).getByRole('link', { name: 'RSK-DEV-MUTABLE-001', exact: true }) },
    populated: (page) => page.getByRole('region', { name: 'Risk statement and classification' }),
  },
  {
    route: '/app/reports/risk-exposure', actor: 'Security Analyst', title: 'Risk Exposure Report | IdamBox CSRM', heading: 'Risk exposure',
    populated: (page) => page.locator('[data-slot="report-section"] table'),
  },
  {
    route: '/app/admin/controls', actor: 'Security Analyst', title: 'Controls | IdamBox CSRM', heading: 'Controls',
    populated: (page) => page.getByRole('table', { name: 'Controls results', exact: true }).locator('a.record-link'),
  },
];

/** One downloaded asset; `requestedAtMs` is its Resource Timing start, on the same clock as the navigation timings. */
type Asset = {
  url: string;
  kind: 'js' | 'css';
  deliveredBytes: number;
  decodedBytes: number;
  requestedAtMs: number | null;
  referencedByDocument?: boolean;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pathOf = (value: string) => {
  const url = new URL(value);
  return `${url.pathname}${url.search}`;
};
const assetKind = (value: string): Asset['kind'] | undefined => {
  const { pathname } = new URL(value);
  if (!pathname.startsWith('/_next/static/')) return undefined;
  return pathname.endsWith('.js') ? 'js' : pathname.endsWith('.css') ? 'css' : undefined;
};

function budgetFor(route: KeyRoute): Budget {
  return { ...PERFORMANCE_BUDGETS, ...ROUTE_BUDGET_OVERRIDES[route] };
}

/*
 * The `/_next/static/` scripts and stylesheets the current document references, as paths. A `nomodule`
 * script is left out: Next renders its legacy-browser polyfill file that way, and a module-capable
 * browser never downloads it, so it is not part of what the route delivers.
 */
async function referencedAssets(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...Array.from(document.scripts).filter((script) => !script.noModule).map((script) => script.src),
    ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), (link) => link.href),
  ].flatMap((value) => {
    if (!value) return [];
    const url = new URL(value);
    return url.pathname.startsWith('/_next/static/') ? [`${url.pathname}${url.search}`] : [];
  }));
}

/* A record route's path, read in a throwaway context from the seeded link on its list; a static route is its own path. */
async function resolveRouteUrl(browser: Browser, entry: KeyRouteEntry): Promise<string> {
  if (!entry.resolve) return entry.route;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await signInAs(page, entry.actor);
    await page.goto(entry.resolve.list);
    const link = entry.resolve.link(page).filter({ visible: true }).first();
    await expect(link, `PERFORMANCE_ROUTE_UNRESOLVED:${entry.route}`).toBeVisible();
    const href = await link.getAttribute('href');
    if (!href || !/^\/app\/[^?#]+$/.test(href)) throw new Error(`PERFORMANCE_ROUTE_UNRESOLVED:${entry.route}`);
    return href;
  } finally {
    await context.close();
  }
}

/*
 * The scripts a sample downloaded that the route's document does not reference (the router's prefetch
 * of the routes behind the links in view), recorded outside the budget; and how many of the document's
 * own scripts were requested after its load event, which shows why the load event is not the cut.
 */
type Unreferenced = { jsBytes: number; scriptCount: number; documentScriptsAfterLoad: number };

/* One measured navigation of the signed-in route in a fresh context with the HTTP cache disabled. */
async function measureSample(browser: Browser, entry: KeyRouteEntry, path: string): Promise<{ sample: RouteSample; assets: Asset[]; unreferenced: Unreferenced }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await context.addInitScript(() => {
      const target = window as Window & { __csrmLcp?: number };
      try {
        new PerformanceObserver((list) => {
          const latest = list.getEntries().at(-1);
          if (latest) target.__csrmLcp = latest.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // No LCP support: the sample records null and the LCP budget is not applied to it.
      }
    });
    const page = await context.newPage();
    await attachCspCollector(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

    await signInAs(page, entry.actor);
    await page.goto('about:blank');
    const responses: Response[] = [];
    const keep = (response: Response) => {
      if (assetKind(response.url())) responses.push(response);
    };
    page.on('response', keep);

    const documentResponse = await page.goto(path, { waitUntil: 'load' });
    expect(documentResponse?.status(), `${entry.route} answers 200`).toBe(200);
    // The route itself, settled and populated: a redirect to sign-in or an error state fails here.
    await expectSettled(page, { url: new RegExp(`${escapeRegExp(path)}$`), title: entry.title, heading: entry.heading }, entry.route);
    await expect(entry.populated(page).filter({ visible: true }).first(), `${entry.route} shows its populated content`).toBeVisible();
    await expect(page.locator('[data-state-kind="error"]'), `${entry.route} renders no error state`).toHaveCount(0);

    // Every referenced asset must have been downloaded before the accounting closes.
    await expect.poll(async () => {
      const seen = new Set(responses.map((response) => pathOf(response.url())));
      return (await referencedAssets(page)).filter((url) => !seen.has(url));
    }, { message: `PERFORMANCE_ACCOUNTING_INCOMPLETE:${entry.route}: a referenced asset has no counted response` }).toEqual([]);
    page.off('response', keep);

    const requestedAt = new Map(await page.evaluate(() => performance.getEntriesByType('resource').map((resource): [string, number] => {
      const url = new URL(resource.name);
      return [`${url.pathname}${url.search}`, resource.startTime];
    })));
    const assets: Asset[] = [];
    for (const response of responses) {
      const failure = await response.finished();
      if (failure) throw new Error(`PERFORMANCE_ACCOUNTING_INCOMPLETE:${entry.route}: ${pathOf(response.url())} failed`);
      const sizes = await response.request().sizes();
      const body = await response.body();
      const url = pathOf(response.url());
      assets.push({ url, kind: assetKind(response.url())!, deliveredBytes: sizes.responseBodySize, decodedBytes: body.byteLength, requestedAtMs: requestedAt.get(url) ?? null });
    }
    // A cache hit reports zero delivered bytes; with the cache disabled none may appear.
    const zeroSized = assets.filter((asset) => asset.deliveredBytes <= 0).map((asset) => asset.url);
    if (zeroSized.length > 0) throw new Error(`PERFORMANCE_ACCOUNTING_INCOMPLETE:${entry.route}: zero delivered bytes for ${zeroSized.join(', ')}`);

    await expect.poll(() => page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventEnd), {
      message: `${entry.route} has finished its load event`,
    }).toBeGreaterThan(0);
    const { loadEventStartMs, ...timings } = await page.evaluate(() => {
      const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return {
        ttfbMs: navigation.responseStart,
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadMs: navigation.loadEventEnd,
        lcpMs: (window as Window & { __csrmLcp?: number }).__csrmLcp ?? null,
        loadEventStartMs: navigation.loadEventStart,
      };
    });
    await expectNoCspViolations(page, entry.route);

    /*
     * First load is what the route's own document references: the script and stylesheet tags of its
     * server-rendered HTML and the chunks its inline RSC payload names for the client components it
     * renders. Once hydrated, the router prefetches the routes behind the links in view and loads the
     * chunks their payloads name: another route's code, downloaded on no fixed schedule (sometimes
     * before the load event of a page that streams for longer), recorded apart and never budgeted.
     */
    const html = await documentResponse!.text();
    const referencedByDocument = (asset: Asset) => html.includes(asset.url.split('?')[0].split('/').at(-1)!);
    const firstLoad = assets.filter(referencedByDocument);
    const otherScripts = assets.filter((asset) => !referencedByDocument(asset) && asset.kind === 'js');
    const scripts = firstLoad.filter((asset) => asset.kind === 'js');
    const sum = (list: readonly Asset[], read: (asset: Asset) => number) => list.reduce((total, asset) => total + read(asset), 0);
    return {
      assets: assets.map((asset) => ({ ...asset, referencedByDocument: referencedByDocument(asset) })),
      unreferenced: {
        jsBytes: sum(otherScripts, (asset) => asset.deliveredBytes),
        scriptCount: otherScripts.length,
        documentScriptsAfterLoad: scripts.filter((asset) => asset.requestedAtMs !== null && asset.requestedAtMs > loadEventStartMs).length,
      },
      sample: {
        route: entry.route,
        actor: entry.actor,
        deliveredJsBytes: sum(scripts, (asset) => asset.deliveredBytes),
        decodedJsBytes: sum(scripts, (asset) => asset.decodedBytes),
        deliveredCssBytes: sum(firstLoad.filter((asset) => asset.kind === 'css'), (asset) => asset.deliveredBytes),
        scriptCount: scripts.length,
        ...timings,
        assetUrls: firstLoad.map((asset) => asset.url),
      },
    };
  } finally {
    await context.close();
  }
}

type RecordedRoute = RouteSummary & {
  budget: Budget;
  browserVersion: string;
  measuredAt: string;
  samples: (Omit<RouteSample, 'assetUrls'> & { unreferencedJsBytes: number; unreferencedScriptCount: number; documentScriptsAfterLoad: number })[];
  firstSampleAssets: Asset[];
};

/* Keeps this route's summary, samples and first sample's assets in the run's JSON record, replacing any earlier entry for it. */
function recordSummary(summary: RouteSummary, samples: readonly RouteSample[], unreferenced: readonly Unreferenced[], firstSampleAssets: Asset[], budget: Budget, browserVersion: string): void {
  const testInfo = test.info();
  const directory = resolve(testInfo.project.testDir, '..', '.tmp', 'performance');
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, `baseline-${testInfo.project.name}.json`);
  let records: RecordedRoute[] = [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(parsed)) records = parsed as RecordedRoute[];
  } catch {
    records = [];
  }
  const record: RecordedRoute = {
    ...summary,
    budget,
    browserVersion,
    measuredAt: new Date().toISOString(),
    samples: samples.map(({ assetUrls: _assetUrls, ...measured }, index) => ({
      ...measured,
      unreferencedJsBytes: unreferenced[index].jsBytes,
      unreferencedScriptCount: unreferenced[index].scriptCount,
      documentScriptsAfterLoad: unreferenced[index].documentScriptsAfterLoad,
    })),
    firstSampleAssets,
  };
  writeFileSync(file, `${JSON.stringify([...records.filter((existing) => existing.route !== summary.route), record], null, 2)}\n`);
}

for (const entry of KEY_ROUTES) {
  test(`${entry.route} stays within its performance budget`, async ({ browser }) => {
    test.setTimeout(240_000);
    const path = await resolveRouteUrl(browser, entry);
    const samples: RouteSample[] = [];
    const unreferenced: Unreferenced[] = [];
    let firstSampleAssets: Asset[] = [];
    for (let index = 0; index < SAMPLES; index += 1) {
      const measured = await measureSample(browser, entry, path);
      samples.push(measured.sample);
      unreferenced.push(measured.unreferenced);
      if (index === 0) firstSampleAssets = measured.assets;
    }
    const summary = summariseRouteSamples(samples);
    const budget = budgetFor(entry.route);
    await test.info().attach('performance-summary', { body: JSON.stringify({ ...summary, budget, samples, unreferenced }, null, 2), contentType: 'application/json' });
    await test.info().attach('performance-assets', { body: JSON.stringify(firstSampleAssets, null, 2), contentType: 'application/json' });
    recordSummary(summary, samples, unreferenced, firstSampleAssets, budget, browser.version());
    const { assetUrls, ...printed } = summary;
    expect(findBudgetBreaches(summary, budget), JSON.stringify({ ...printed, assetCount: assetUrls.length })).toEqual([]);
  });
}
