import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { strapiHealthUrl } from './harness-urls';

type Actor = 'Requestor' | 'Security Analyst';
type Surface = { name: string; route: string; actor: Actor };

// My lists are owner-scoped for every actor, so each surface is visited as the seeded identity
// that owns records there: the Requestor owns the questionnaire fixtures, and the Security
// Analyst owns the Risk, released-assessment and cross-owner request fixtures.
const collectionSurfaces: readonly Surface[] = [
  { name: 'requests', route: '/app/requests', actor: 'Security Analyst' },
  { name: 'questionnaires', route: '/app/questionnaires', actor: 'Requestor' },
  { name: 'released assessments', route: '/app/assessments', actor: 'Security Analyst' },
  { name: 'assessment request review', route: '/app/review/requests', actor: 'Security Analyst' },
  { name: 'assessment review', route: '/app/review/assessments', actor: 'Security Analyst' },
  { name: 'questionnaire review', route: '/app/review/questionnaires', actor: 'Security Analyst' },
  { name: 'risk register', route: '/app/risks', actor: 'Security Analyst' },
  { name: 'risk types administration', route: '/app/admin/risk-types', actor: 'Security Analyst' },
  { name: 'controls administration', route: '/app/admin/controls', actor: 'Security Analyst' },
  { name: 'information systems administration', route: '/app/admin/information-systems', actor: 'Security Analyst' },
  { name: 'information assets administration', route: '/app/admin/information-assets', actor: 'Security Analyst' },
];

const recordLinkSurfaces: readonly Surface[] = [
  ...collectionSurfaces,
  { name: 'dashboard record links', route: '/app', actor: 'Security Analyst' },
];

const stateKinds = ['empty', 'error', 'permission'] as const;
type StyleContract = Pick<CSSStyleDeclaration, 'color' | 'fontWeight' | 'textDecorationLine' | 'textDecorationColor'>;
type HeadingContract = Pick<CSSStyleDeclaration, 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing'>;

function fixtureUrl(route: string, state: string) {
  return `${route}?__e2eState=${state}`;
}

async function signIn(page: Page, actor: Actor) {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);
  await page.getByRole('button', { name: `Continue as ${actor}` }).click();
  // The sign-in URL itself ends in returnTo=/app, so a URL match alone returns before the
  // session exists. Wait for the banner to show the signed-in role.
  await expect(page.getByRole('banner').getByText(actor, { exact: true })).toBeVisible();
}

async function visibleRecordLink(page: Page, surface: string): Promise<Locator> {
  const link = page.locator('a.record-link:visible').first();
  await expect(link, `${surface} has a visible RecordLink`).toBeVisible();
  return link;
}

async function styleOf(locator: Locator): Promise<StyleContract> {
  return locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      color: style.color,
      fontWeight: style.fontWeight,
      textDecorationLine: style.textDecorationLine,
      textDecorationColor: style.textDecorationColor,
    };
  });
}

async function headingStyleOf(locator: Locator): Promise<HeadingContract> {
  return locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
    };
  });
}

async function rootLinkColor(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--text-link)';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

async function expectNoSeriousAxeViolations(page: Page, label: string) {
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'), `${label} has no serious or critical axe violations`).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(geometry.width, `${label} has no horizontal page overflow`).toBeLessThanOrEqual(geometry.viewport);
}

test.describe.configure({ mode: 'serial' });

test.describe('cross-surface design contract', () => {
  test('compares RecordLinks, responsive DataTables, accessibility, and console output across every scoped surface', async ({ page, request }) => {
    test.setTimeout(600_000);
    expect((await request.get(strapiHealthUrl)).ok()).toBe(true);
    const consoleErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    let actor: Actor = 'Security Analyst';
    await signIn(page, actor);
    const visitAs = async (surface: Pick<Surface, 'route' | 'actor'>) => {
      if (surface.actor !== actor) {
        actor = surface.actor;
        await signIn(page, actor);
      }
      await page.goto(fixtureUrl(surface.route, 'populated'));
    };

    for (const width of [1440, 375] as const) {
      await page.setViewportSize({ width, height: 900 });
      let reference: StyleContract | undefined;
      let referenceSurface = '';
      for (const surface of recordLinkSurfaces) {
        await visitAs(surface);
        const actual = await styleOf(await visibleRecordLink(page, surface.name));
        if (!reference) {
          reference = actual;
          referenceSurface = surface.name;
        } else {
          expect(actual, `${surface.name} RecordLink at ${width}px matches ${referenceSurface}`).toEqual(reference);
        }
        await expect(page.locator('a[aria-disabled], a[href="#"]'), `${surface.name} has no disabled or placeholder anchors`).toHaveCount(0);
        await expectNoHorizontalOverflow(page, `${surface.name} at ${width}px`);
        await expectNoSeriousAxeViolations(page, `${surface.name} at ${width}px`);
      }
      expect(reference?.color, `the ${referenceSurface} RecordLink color at ${width}px equals --text-link`).toBe(await rootLinkColor(page));

      for (const surface of collectionSurfaces) {
        await visitAs(surface);
        const desktop = page.locator('[data-slot="data-table-desktop"]');
        const mobile = page.locator('[data-slot="data-table-mobile"]');
        if (width >= 768) {
          await expect(desktop, `${surface.name} shows desktop DataTable at ${width}px`).toBeVisible();
          await expect(mobile, `${surface.name} hides mobile cards at ${width}px`).not.toBeVisible();
        } else {
          await expect(desktop, `${surface.name} hides desktop DataTable at ${width}px`).not.toBeVisible();
          await expect(mobile, `${surface.name} shows mobile cards at ${width}px`).toBeVisible();
          await expect(mobile, `${surface.name} mobile container is a list`).toHaveAttribute('role', 'list');
          await expect(mobile.locator('[role="listitem"]'), `${surface.name} mobile cards are list items`).not.toHaveCount(0);
        }
      }
    }

    // At 1440px the register fits; 1024px is a desktop width where its eight columns overflow.
    await page.setViewportSize({ width: 1024, height: 900 });
    await visitAs({ route: '/app/risks', actor: 'Security Analyst' });
    const region = page.getByRole('region', { name: /risk register.*scroll/i });
    await expect(region, 'Risk Register scroll container is a labelled region').toBeVisible();
    await expect(region, 'Risk Register scroll container is keyboard focusable').toHaveAttribute('tabindex', '0');
    await region.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    // Without these the geometry check below passes trivially when nothing scrolls, including
    // when an inner container scrolls instead of the labelled, focusable region.
    const scrolled = await region.evaluate((node) => ({ overflows: node.scrollWidth > node.clientWidth, scrollLeft: node.scrollLeft }));
    expect(scrolled.overflows, 'the labelled Risk Register region is the element that overflows at 1024px').toBe(true);
    expect(scrolled.scrollLeft, 'the labelled Risk Register region scrolled to its right edge').toBeGreaterThan(0);
    const stickyCellsStayWithinRegion = await region.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return Array.from(node.querySelectorAll<HTMLTableRowElement>('tbody tr')).filter((row) => row.offsetParent !== null)
        .map((row) => row.cells.item(0)?.getBoundingClientRect())
        .filter((cell): cell is DOMRect => Boolean(cell))
        .every((cell) => cell.left >= bounds.left - 1 && cell.right <= bounds.right + 1);
    });
    expect(stickyCellsStayWithinRegion, 'every visible Risk Register identifier remains inside its scrolling region').toBe(true);
    expect(consoleErrors, 'scoped route rendering produces no console errors').toEqual([]);
  });

  test('compares shared empty, error, and permission state contracts before their recovery controls', async ({ page }) => {
    test.setTimeout(600_000);
    // Fixture states render without records, so one identity covers every surface.
    await signIn(page, 'Security Analyst');
    for (const width of [1440, 375] as const) for (const state of stateKinds) {
      await page.setViewportSize({ width, height: 900 });
      let reference: HeadingContract | undefined;
      let referenceSurface = '';
      for (const surface of collectionSurfaces) {
        await page.goto(fixtureUrl(surface.route, state));
        const boundary = page.locator(`[data-ui-state="${state}"]`);
        const stateElement = boundary.locator(`[data-slot="state"][data-state-kind="${state}"]`);
        await expect(stateElement, `${surface.name} ${state} fixture renders the shared state primitive`).toBeVisible();
        const actual = await headingStyleOf(stateElement.getByRole('heading').first());
        if (!reference) {
          reference = actual;
          referenceSurface = surface.name;
        } else {
          expect(actual, `${surface.name} ${state} heading at ${width}px matches ${referenceSurface}`).toEqual(reference);
        }
        if (state === 'error') await expect(stateElement.getByRole('button', { name: 'Try again' }), `${surface.name} error recovers with Try again`).toBeVisible();
        if (state === 'permission') await expect(stateElement.getByRole('link', { name: 'Return to workspace' }), `${surface.name} permission recovers with Return to workspace`).toHaveAttribute('href', '/app');
      }
    }
  });
});
