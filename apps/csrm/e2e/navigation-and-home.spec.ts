import { expect, test, type Locator, type Page } from '@playwright/test';

import { strapiHealthUrl } from './harness-urls';
import { navigationLabel, navigationText, showPrimaryNavigation, signInAs, type SignInRole } from './helpers/navigation';
import { createCompleteDraftRequest, createDraftRequest, createSubmittedRequest, submitRequestFromItsPage } from './helpers/requests';

/*
 * Home and navigation (UX-08, D-16, D-17, D-24; UI-SPEC §5.1). Every actor signs in to one Home at
 * /app; the Security Analyst's Home is the review summary. These journeys only read or create their own
 * uniquely titled records, so the mobile project runs them again at 375×812 against the same database
 * (playwright.config.ts).
 */

function pageHeader(page: Page) {
  return page.getByRole('main').locator('.page-header');
}

/** The total a list page states beside its controls ("{n} result" or "{n} results"), as a number. */
async function listTotal(page: Page): Promise<number> {
  const output = page.getByRole('main').locator('output').filter({ hasText: /^[\d,]+ results?$/ });
  await expect(output).toHaveCount(1);
  return Number((await output.textContent())!.replace(/[^\d]/g, ''));
}

/** A Home section's "View all {total} in …" link and the total it names. */
async function viewAllOf(section: Locator, list: string): Promise<{ link: Locator; total: number }> {
  const link = section.getByRole('link', { name: new RegExp(`^View all [\\d,]+ in ${list}$`) });
  await expect(link).toHaveCount(1);
  return { link, total: Number((await link.textContent())!.replace(/[^\d]/g, '')) };
}

async function expectStrapiHealthy(page: Page): Promise<void> {
  const health = await page.request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
}

/*
 * The Requestor Home's header carries New request at every width; below 768px the header stacks and
 * the action spans it (direction section 4 Page header; UI-SPEC §5.1).
 */
async function expectRequestorHome(page: Page, role: SignInRole): Promise<void> {
  const header = pageHeader(page);
  await expect(header.getByRole('heading', { level: 1, name: 'Home', exact: true }), `HOME_HEADING:${role}`).toBeVisible();
  await expect(header.getByText('What needs your action, and where your work stands.', { exact: true })).toBeVisible();
  const newRequest = header.getByRole('link', { name: 'New request', exact: true });
  await expect(newRequest, `HOME_NEW_REQUEST:${role}`).toBeVisible();
  await expect(newRequest).toHaveAttribute('href', '/app/requests/new');
  await expect(page).toHaveTitle('Home | IdamBox CSRM');
  // The analyst Home is never rendered for a Requestor (D-16).
  await expect(page.getByRole('region', { name: 'Needs action', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-slot="kpi-tile"]')).toHaveCount(0);

  const width = page.viewportSize()?.width ?? 0;
  if (width < 768) {
    const [headerBox, actionBox] = await Promise.all([header.boundingBox(), newRequest.boundingBox()]);
    expect(headerBox, 'the Home header has a box').not.toBeNull();
    expect(actionBox, 'New request has a box').not.toBeNull();
    expect(Math.abs(actionBox!.width - headerBox!.width), `New request spans the header at ${width}px`).toBeLessThanOrEqual(1);
  }
}

test.describe('Home and navigation @journey', () => {
  test('the Requestor signs in to Home with New request in its header', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Requestor');
    await expectRequestorHome(page, 'Requestor');
  });

  test('the Secondary Requestor signs in to the same Home', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Secondary Requestor');
    await expectRequestorHome(page, 'Secondary Requestor');
  });

  test('the Security Analyst signs in to the review summary at Home, with no header action', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Security Analyst');
    const header = pageHeader(page);
    await expect(header.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
    await expect(header.getByText('What needs your action, and where your work stands.', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Home | IdamBox CSRM');
    // The tiles are the analyst's entry points, so the header carries no action (D-24).
    await expect(header.locator('a, button')).toHaveCount(0);
    const needsAction = page.getByRole('region', { name: 'Needs action', exact: true });
    await expect(needsAction.getByRole('heading', { level: 2, name: 'Needs action', exact: true })).toBeAttached();
    await expect(needsAction.locator('[data-slot="kpi-tile"]'), 'the four Needs action tiles').toHaveCount(4);
    await expect(page.getByRole('region', { name: 'Review queue', exact: true }), 'the Review queue widget').toBeVisible();
  });

  /*
   * UAT-001, D-18, UI-D20: the analyst Home leads with the queue. After the Needs action tiles the first
   * widget is the Review queue at every width. Below xl the tiles sit two by two, so at 375×812 (the mobile
   * project) the Review queue starts within the first screen; from xl (the desktop project, 1440×900) the
   * four tiles share one row. The proof reads the real layout boxes at the project's own width, and no
   * tile's caption or supporting line may push past its tile.
   */
  test('UX08_ANALYST_PHONE_FIRST_SCREEN: the analyst Home leads with the Review queue within the first screen at each project width', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Security Analyst');
    const main = page.getByRole('main');
    const needsAction = page.getByRole('region', { name: 'Needs action', exact: true });
    const tiles = needsAction.locator('[data-slot="kpi-tile"]');
    await expect(tiles, 'the four Needs action tiles').toHaveCount(4);
    const headings = main.getByRole('heading', { level: 2 });
    await expect(headings.nth(0)).toHaveText('Needs action');
    await expect(headings.nth(1), 'UX08_ANALYST_PHONE_FIRST_SCREEN: the first widget after the tiles').toHaveText('Review queue');
    const reviewQueue = page.getByRole('region', { name: 'Review queue', exact: true });
    await expect(reviewQueue).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => window.scrollY), 'the first screen is measured from the top').toBe(0);
    const viewport = page.viewportSize();
    expect(viewport, 'the project sets a viewport').not.toBeNull();
    const { height, width } = viewport!;

    const tileBoxes = await tiles.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top), overflows: element.scrollWidth > element.clientWidth };
    }));
    const rows = new Set(tileBoxes.map((box) => box.top)).size;
    // xl is 1280px: two by two below it, one row of four from it.
    expect(rows, `UX08_ANALYST_PHONE_FIRST_SCREEN: tile rows at ${width}px`).toBe(width < 1280 ? 2 : 1);
    expect(tileBoxes.filter((box) => box.overflows), `no tile text overflows its tile at ${width}px`).toEqual([]);

    const [regionBox, headingBox] = await Promise.all([
      reviewQueue.boundingBox(),
      reviewQueue.getByRole('heading', { level: 2, name: 'Review queue', exact: true }).boundingBox(),
    ]);
    expect(regionBox, 'the Review queue has a box').not.toBeNull();
    expect(headingBox, 'the Review queue heading has a box').not.toBeNull();
    expect(regionBox!.y, `UX08_ANALYST_PHONE_FIRST_SCREEN: the Review queue starts within the first ${height}px screen`).toBeLessThan(height);
    expect(headingBox!.y + headingBox!.height, `UX08_ANALYST_PHONE_FIRST_SCREEN: its heading reads on the first ${height}px screen`).toBeLessThanOrEqual(height);
  });

  /*
   * UAT-004, D-19, D-22: on a phone the Requestor's first content after the page header (Home, its
   * description and New request) is Needs your action, which starts within the first 375×812 screen and
   * lists the draft just saved. The proof uses each project's viewport (375×812 and 1440×900); each run
   * saves its own uniquely titled draft. The section's View all total equals the list it opens (D-35).
   */
  test('UX08_REQUESTOR_PHONE_FIRST_SCREEN: the Requestor Home opens on Needs your action within the first screen at each project width', async ({ page }, testInfo) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Requestor');
    const title = `Phone first screen ${testInfo.project.name} ${Date.now().toString(36)}`;
    await createDraftRequest(page, { title });

    await page.goto('/app');
    const header = pageHeader(page);
    await expect(header.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
    const newRequest = header.getByRole('link', { name: 'New request', exact: true });
    await expect(newRequest).toBeVisible();
    const needs = page.getByRole('region', { name: 'Needs your action', exact: true });
    await expect(needs).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('heading', { level: 2 }).first(),
      'UX08_REQUESTOR_PHONE_FIRST_SCREEN: the first section after the header',
    ).toHaveText('Needs your action');
    await expect(needs.getByRole('link', { name: title, exact: true }), 'UX08_REQUESTOR_PHONE_FIRST_SCREEN: the saved draft is listed').toHaveCount(1);

    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => window.scrollY), 'the first screen is measured from the top').toBe(0);
    const [actionBox, regionBox, headingBox] = await Promise.all([
      newRequest.boundingBox(),
      needs.boundingBox(),
      needs.getByRole('heading', { level: 2, name: 'Needs your action', exact: true }).boundingBox(),
    ]);
    expect(actionBox, 'New request has a box').not.toBeNull();
    expect(regionBox, 'Needs your action has a box').not.toBeNull();
    expect(headingBox, 'its heading has a box').not.toBeNull();
    // DOM order equals visual order: the section starts below the header's action (D-22).
    expect(regionBox!.y, 'UX08_REQUESTOR_PHONE_FIRST_SCREEN: the section follows New request').toBeGreaterThanOrEqual(actionBox!.y + actionBox!.height);
    const height = page.viewportSize()!.height;
    expect(regionBox!.y, `UX08_REQUESTOR_PHONE_FIRST_SCREEN: Needs your action starts within the first ${height}px screen`).toBeLessThan(height);
    expect(headingBox!.y + headingBox!.height, `UX08_REQUESTOR_PHONE_FIRST_SCREEN: its heading reads on the first ${height}px screen`).toBeLessThanOrEqual(height);

    const { link, total } = await viewAllOf(needs, 'My requests');
    await expect(link).toHaveAttribute('href', '/app/requests?holder=requestor');
    await page.goto('/app/requests?holder=requestor');
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
    expect(await listTotal(page), 'UX08_REQUESTOR_PHONE_FIRST_SCREEN: the section total equals the list it opens').toBe(total);
  });

  /*
   * D-17: the analyst dashboard's old address is a temporary redirect to Home from next.config.ts. It
   * answers before the proxy, so even a request with no session gets the 307 and not the sign-in
   * redirect, and the query is kept. A bookmark lands every actor on their own Home; the review queues
   * under /app/review/ are unaffected.
   */
  test('UX08_REVIEW_REDIRECTS_TO_HOME: /app/review answers 307 to Home with its query, for every actor', async ({ page }) => {
    await expectStrapiHealthy(page);
    const redirect = await page.request.get('/app/review?from=bookmark', { maxRedirects: 0 });
    expect(redirect.status(), 'UX08_REVIEW_REDIRECTS_TO_HOME: a temporary redirect').toBe(307);
    expect(redirect.headers().location, 'UX08_REVIEW_REDIRECTS_TO_HOME: to Home, query kept').toMatch(/\/app\?from=bookmark$/);

    for (const role of ['Security Analyst', 'Requestor'] as const) {
      await signInAs(page, role);
      await page.goto('/app/review');
      await expect.poll(() => new URL(page.url()).pathname, { message: `${role} lands on Home` }).toBe('/app');
      await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true }), `UX08_REVIEW_REDIRECTS_TO_HOME:${role}`).toBeVisible();
      await expect(page.getByRole('banner').getByText(role, { exact: true })).toBeVisible();
    }

    await signInAs(page, 'Security Analyst');
    await page.goto('/app/review/requests');
    await expect.poll(() => new URL(page.url()).pathname, { message: 'a review queue is not redirected' }).toBe('/app/review/requests');
    await expect(page.getByRole('heading', { level: 1, name: 'Requests', exact: true })).toBeVisible();
  });
});

/*
 * UAT-003, D-19 to D-21, D-35: the Requestor Home splits the Requestor's work by who holds it, never by stored
 * status. A saved draft is under Needs your action and a submitted request under With the Security Analyst, with
 * the server's sentence naming the Security Analyst; each section's View all total equals the list it opens. It
 * proves the 1440 layout (the two sections side by side), so it runs at the desktop project's width only, outside
 * the @journey describe, and creates its own uniquely titled records.
 */
test('UX08_REQUESTOR_HOME_SPLIT: the Requestor Home separates what needs them from what is with the Security Analyst', async ({ page }) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  await signInAs(page, 'Requestor');
  const stamp = Date.now().toString(36);
  const draftTitle = `Home split draft ${stamp}`;
  const submittedTitle = `Home split submitted ${stamp}`;
  await createDraftRequest(page, { title: draftTitle });
  await createSubmittedRequest(page, { title: submittedTitle, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });

  await page.goto('/app');
  const needs = page.getByRole('region', { name: 'Needs your action', exact: true });
  const withAnalyst = page.getByRole('region', { name: 'With the Security Analyst', exact: true });
  const released = page.getByRole('region', { name: 'Released assessments', exact: true });
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Needs your action', 'With the Security Analyst', 'Released assessments']);

  await expect(needs.getByRole('link', { name: draftTitle, exact: true }), 'UX08_REQUESTOR_HOME_SPLIT: the draft needs the Requestor').toHaveCount(1);
  await expect(withAnalyst.getByRole('link', { name: draftTitle, exact: true })).toHaveCount(0);
  const submittedItem = withAnalyst.getByRole('listitem').filter({ has: page.getByRole('link', { name: submittedTitle, exact: true }) });
  await expect(submittedItem, 'UX08_REQUESTOR_HOME_SPLIT: the submitted request is with the Security Analyst').toHaveCount(1);
  // 13-UI-SPEC §12.1: nobody has picked the new request up yet, and the Requestor is told so plainly.
  await expect(submittedItem.getByText('Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.', { exact: true })).toBeVisible();
  await expect(submittedItem.getByText(/ · Submitted (today|1 day ago)$/)).toBeVisible();
  await expect(needs.getByRole('link', { name: submittedTitle, exact: true })).toHaveCount(0);

  // From lg the two sections sit side by side, Released assessments beneath both (UI-SPEC §5.2).
  const [needsBox, withAnalystBox, releasedBox] = await Promise.all([needs.boundingBox(), withAnalyst.boundingBox(), released.boundingBox()]);
  expect(Math.abs(needsBox!.y - withAnalystBox!.y), 'UX08_REQUESTOR_HOME_SPLIT: the sections share a row at 1440').toBeLessThanOrEqual(1);
  expect(withAnalystBox!.x, 'UX08_REQUESTOR_HOME_SPLIT: With the Security Analyst is to the right').toBeGreaterThan(needsBox!.x);
  expect(releasedBox!.y, 'UX08_REQUESTOR_HOME_SPLIT: Released assessments is beneath').toBeGreaterThan(needsBox!.y);

  const needsAll = await viewAllOf(needs, 'My requests');
  const withAnalystAll = await viewAllOf(withAnalyst, 'My requests');
  await expect(needsAll.link).toHaveAttribute('href', '/app/requests?holder=requestor');
  await expect(withAnalystAll.link).toHaveAttribute('href', '/app/requests?holder=analyst');

  await needsAll.link.click();
  await expect.poll(() => new URL(page.url()).search).toBe('?holder=requestor');
  expect(await listTotal(page), 'UX08_REQUESTOR_HOME_SPLIT: Needs your action equals its list').toBe(needsAll.total);
  await page.goto('/app/requests?holder=analyst');
  expect(await listTotal(page), 'UX08_REQUESTOR_HOME_SPLIT: With the Security Analyst equals its list').toBe(withAnalystAll.total);
});

/*
 * D-18 item 7, D-35: the analyst Home ends with Your own requests, whose two counts each equal the total of the
 * My requests list they open. It reads only, at the desktop project's 1440, outside the @journey describe.
 */
test('UX08_ANALYST_OWN_REQUESTS: the analyst’s own request counts equal the lists they open', async ({ page }) => {
  await expectStrapiHealthy(page);
  await signInAs(page, 'Security Analyst');
  await expect(page.getByRole('main').getByRole('heading', { level: 2 }).last(), 'UX08_ANALYST_OWN_REQUESTS: the last widget').toHaveText('Your own requests');
  const own = page.getByRole('region', { name: 'Your own requests', exact: true });
  await expect(own.getByText('Requests you raised yourself, as a Requestor.', { exact: true })).toBeVisible();
  await expect(own.getByRole('link', { name: 'View My requests', exact: true })).toHaveAttribute('href', '/app/requests');
  await expect(own.getByRole('link', { name: 'New request', exact: true })).toHaveAttribute('href', '/app/requests/new');

  const rows = [
    { label: 'Needs your action', href: '/app/requests?holder=requestor' },
    { label: 'With the Security Analyst', href: '/app/requests?holder=analyst' },
  ] as const;
  const counts: number[] = [];
  for (const row of rows) {
    const link = own.getByRole('link', { name: new RegExp(`^${row.label}: [\\d,]+ requests?$`) });
    await expect(link, `UX08_ANALYST_OWN_REQUESTS: the ${row.label} row`).toHaveAttribute('href', row.href);
    counts.push(Number(((await link.getAttribute('aria-label')) ?? '').replace(/[^\d]/g, '')));
  }
  for (const [index, row] of rows.entries()) {
    await page.goto(row.href);
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
    expect(await listTotal(page), `UX08_ANALYST_OWN_REQUESTS: ${row.label} equals its list`).toBe(counts[index]);
  }
});

/*
 * UAT-002, D-09, UI-SPEC §2.1: every sidebar label is the level-one heading of the page it opens, and
 * that page's title is "{label} | IdamBox CSRM". The sidebar shows from 1024px, so this proof runs at the
 * desktop project's 1440 only, outside the @journey describe. It reads each visible link's text before
 * clicking it, so a label and a heading that drift apart fail here by name.
 */
test('UX07_LABEL_EQUALS_HEADING: every navigation label opens a page headed and titled with that label', async ({ page }) => {
  await expectStrapiHealthy(page);
  for (const role of ['Requestor', 'Security Analyst'] as const) {
    await signInAs(page, role);
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    const links = await navigation.getByRole('link').evaluateAll((elements) => elements
      .filter((element) => (element as HTMLElement).offsetParent !== null)
      .map((element) => ({ href: element.getAttribute('href') ?? '', text: element.textContent ?? '' })))
      .then((entries) => entries.map(({ href, text }) => ({ href, label: navigationLabel(text) })));
    expect(links.length, `UX07_LABEL_EQUALS_HEADING:${role} has visible navigation links`).toBeGreaterThan(0);

    for (const { href, label } of links) {
      await page.goto('/app');
      await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
      await navigation.locator(`a[href="${href}"]`).click();
      await expect.poll(() => new URL(page.url()).pathname, { message: `${role}: ${label} opens ${href}` }).toBe(href);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 }), `UX07_LABEL_EQUALS_HEADING:${role}:${href}`).toHaveText(label);
      await expect(page, `UX07_LABEL_EQUALS_HEADING:${role}:${href} title`).toHaveTitle(`${label} | IdamBox CSRM`);
    }
  }
});

/*
 * The visible section names and section buttons inside Primary navigation, in DOM order. A collapsed
 * section's group is hidden, so its button stands for it.
 */
async function navigationOutline(page: Page): Promise<string[]> {
  return (await page.getByRole('navigation', { name: 'Primary navigation' }).evaluate((nav) => Array
    .from(nav.querySelectorAll<HTMLElement>('[role="group"]:not([hidden]), button[aria-expanded]'))
    .filter((element) => element.offsetParent !== null)
    .map((element) => element.getAttribute('aria-label') ?? element.textContent ?? ''))).map(navigationLabel);
}

/** The visible links outside every section, in DOM order. */
async function ungroupedLinks(page: Page): Promise<string[]> {
  return (await page.getByRole('navigation', { name: 'Primary navigation' }).evaluate((nav) => Array
    .from(nav.querySelectorAll<HTMLElement>('a'))
    .filter((element) => element.offsetParent !== null && element.closest('[role="group"]') === null)
    .map((element) => element.textContent ?? ''))).map(navigationLabel);
}

/*
 * UAT-002, D-06 to D-08, UI-SPEC §1.1: each actor's sidebar is divided into sections named by job. The
 * analyst reads Home, Assessment work, Oversight, Reference data, then a collapsed My own requests, so no
 * personal item sits above the review work; the Requestor starts from the New request primary action,
 * then Home, then My work. The sidebar shows from 1024px, so this runs at the desktop project's 1440 only.
 */
test('UX07_SECTIONS_PER_ACTOR: each actor’s sidebar is divided into job-named sections, in order', async ({ page }) => {
  await expectStrapiHealthy(page);

  await signInAs(page, 'Security Analyst');
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  expect(await navigationOutline(page), 'UX07_SECTIONS_PER_ACTOR:Security Analyst sections').toEqual([
    'Assessment work',
    'Oversight',
    'Reference data',
    'My own requests',
  ]);
  expect(await ungroupedLinks(page), 'UX07_SECTIONS_PER_ACTOR:Security Analyst has only Home above the sections').toEqual(['Home']);
  await expect(navigation.getByRole('button', { name: navigationText('My own requests') })).toHaveAttribute('aria-expanded', 'false');
  // 13 D-14 (13-UI-SPEC §1, §16 E2): Assigned to me leads Assessment work, before the team's Requests.
  await expect(navigation.getByRole('group', { name: 'Assessment work', exact: true }).getByRole('link')).toHaveText([navigationText('Assigned to me'), navigationText('Requests'), 'Questionnaires', 'Risk assessments']);
  await expect(navigation.getByRole('group', { name: 'Oversight', exact: true }).getByRole('link')).toHaveText(['Risk register', navigationText('Alerts'), 'Reports']);
  await expect(navigation.getByRole('group', { name: 'Reference data', exact: true }).getByRole('link')).toHaveText(['Risk Types', 'Controls', 'Information Systems', 'Information Assets']);

  await signInAs(page, 'Requestor');
  expect(await ungroupedLinks(page), 'UX07_SECTIONS_PER_ACTOR:Requestor leads with New request, then Home').toEqual(['New request', 'Home']);
  await expect(navigation.getByRole('link').first()).toHaveAttribute('href', '/app/requests/new');
  expect(await navigationOutline(page), 'UX07_SECTIONS_PER_ACTOR:Requestor sections').toEqual(['My work']);
  await expect(navigation.getByRole('group', { name: 'My work', exact: true }).getByRole('link')).toHaveText([navigationText('My requests'), navigationText('My questionnaires'), 'My risk assessments']);
});

/** The count a navigation link shows, read from its visible tag; a link with no count fails here. */
async function navigationCount(link: Locator): Promise<number> {
  const tag = link.locator('.nav-count');
  await expect(tag).toHaveCount(1);
  return Number((await tag.textContent())!.replace(/[^\d]/g, ''));
}

/*
 * D-10, D-57, UI-SPEC §1.3: the Requestor's My requests carries how many requests need them, named by its
 * content ("My requests, 3 need your action"), and that number is the total of the list of requests they
 * hold. It creates its own draft, so the count is above zero, and proves the 1440 sidebar, so it runs at the
 * desktop project's width only, outside the @journey describe.
 */
test('UX07_COUNT_EQUALS_LIST: the Requestor’s My requests count equals the requests that need them', async ({ page }) => {
  await expectStrapiHealthy(page);
  await signInAs(page, 'Requestor');
  await createDraftRequest(page, { title: `Count draft ${Date.now().toString(36)}` });

  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  const myRequests = navigation.getByRole('link', { name: /^My requests, [\d,]+ needs? your action$/ });
  await expect(myRequests, 'UX07_COUNT_EQUALS_LIST: My requests is named by its count').toHaveCount(1);
  await expect(myRequests).toHaveAttribute('href', '/app/requests');
  const count = await navigationCount(myRequests);
  expect(count, 'UX07_COUNT_EQUALS_LIST: the new draft needs the Requestor').toBeGreaterThan(0);
  await expect(myRequests).toHaveAccessibleName(`My requests, ${count} ${count === 1 ? 'needs' : 'need'} your action`);

  await page.goto('/app/requests?holder=requestor');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
  expect(await listTotal(page), 'UX07_COUNT_EQUALS_LIST: the count equals the requests the Requestor holds').toBe(count);
});

/** Waits for a successful streamed read, including zero; an unavailable figure never counts as zero. */
async function shownCount(link: Locator): Promise<number> {
  const settled = link.locator('[data-nav-count-state]');
  await expect(settled, 'the navigation count read succeeded and settled').toHaveAttribute('data-nav-count-state', 'ready');
  await expect(settled, 'a successful count exposes its non-negative value').toHaveAttribute('data-nav-count-value', /^\d+$/);
  const value = Number(await settled.getAttribute('data-nav-count-value'));
  expect(Number.isSafeInteger(value) && value >= 0, 'the count is a non-negative integer').toBe(true);
  if (value === 0) await expect(link.locator('.nav-count'), 'a successfully read zero shows no badge').toHaveCount(0);
  else expect(await navigationCount(link), 'the badge equals the settled count').toBe(value);
  return value;
}

/*
 * D-10, D-11, D-57, UI-SPEC §1.3, and 13 D-14 (13-UI-SPEC §1, §16 E2): the analyst's Requests count is the requests
 * that need analyst action and nobody has picked up ("waiting for pick-up"), the total of Requests' default queue
 * narrowed to Not picked up; Assigned to me's count is the viewer's own that need analyst action, the total of
 * Assigned to me's Requires attention queue; and the Alerts count is the overdue alerts list's total. A Requestor
 * submits two requests and Bob picks one up, so both the pick-up pool and Bob's own work hold something (WR-603: no
 * figure is read only at zero); the Phase 7 fixtures hold overdue treatments. The sidebar opens each page unfiltered
 * (UI-D7), so the equal lists are read at their filtered addresses. It proves the 1440 sidebar, so it runs at the
 * desktop project's width only, outside the @journey describe.
 */
test('UX07_ANALYST_COUNTS_EQUAL_LISTS: the analyst’s Assigned to me, Requests and Alerts counts equal the lists they count', async ({ page }) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  await signInAs(page, 'Requestor');
  const stamp = Date.now().toString(36);
  await createSubmittedRequest(page, { title: `Count queue ${stamp}`, assessmentType: 'BAU', businessCriticality: 'Low', dueDate: null });
  const held = await createSubmittedRequest(page, { title: `Count assigned ${stamp}`, assessmentType: 'BAU', businessCriticality: 'Low', dueDate: null });

  await signInAs(page, 'Security Analyst');
  await page.goto(`/app/review/requests/${encodeURIComponent(held.documentId)}`);
  const assignment = page.getByRole('region', { name: 'Assignment' });
  await assignment.getByRole('button', { name: `Pick up ${held.requestNumber}`, exact: true }).click();
  await expect(assignment.getByText('Assigned to Bob Doe', { exact: true }), 'UX07_ANALYST_COUNTS_EQUAL_LISTS: Bob holds a request that needs him').toBeVisible();
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  const requests = navigation.getByRole('link', { name: /^Requests, [\d,]+ waiting for pick-up$/ });
  await expect(requests, 'UX07_ANALYST_COUNTS_EQUAL_LISTS: Requests is named by its count').toHaveCount(1);
  const queueCount = await navigationCount(requests);
  await expect(requests).toHaveAccessibleName(`Requests, ${queueCount} waiting for pick-up`);
  expect(queueCount, 'UX07_ANALYST_COUNTS_EQUAL_LISTS: the request nobody holds waits for pick-up').toBeGreaterThanOrEqual(1);
  // WR-603: Bob holds the request he picked up, so Assigned to me is named by a count of at least one.
  const assigned = navigation.getByRole('link', { name: navigationText('Assigned to me') });
  await expect(assigned).toHaveAttribute('href', '/app/review/assigned');
  const assignedCount = await shownCount(assigned);
  expect(assignedCount, 'UX07_ANALYST_COUNTS_EQUAL_LISTS: the request Bob picked up needs him').toBeGreaterThanOrEqual(1);
  await expect(assigned).toHaveAccessibleName(`Assigned to me, ${assignedCount} ${assignedCount === 1 ? 'needs' : 'need'} your action`);
  const alerts = navigation.getByRole('link', { name: /^Alerts, [\d,]+ overdue$/ });
  await expect(alerts, 'UX07_ANALYST_COUNTS_EQUAL_LISTS: Alerts is named by its overdue count').toHaveCount(1);
  const overdueCount = await navigationCount(alerts);
  await expect(alerts).toHaveAccessibleName(`Alerts, ${overdueCount} overdue`);

  await requests.click();
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Requests', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('requires-attention');
  await page.goto('/app/review/requests?assignee=unassigned');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Requests', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('requires-attention');
  await expect(page.getByRole('combobox', { name: 'Assigned to', exact: true })).toHaveValue('unassigned');
  expect(await listTotal(page), 'UX07_ANALYST_COUNTS_EQUAL_LISTS: Requests equals the Requires attention requests nobody has picked up').toBe(queueCount);

  await page.goto('/app/review/assigned?queue=requires-attention');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Assigned to me', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('requires-attention');
  expect(await listTotal(page), 'UX07_ANALYST_COUNTS_EQUAL_LISTS: Assigned to me equals the viewer’s Requires attention requests').toBe(assignedCount);
  await expect(page.getByRole('main').getByRole('link', { name: held.requestNumber, exact: true }), 'UX07_ANALYST_COUNTS_EQUAL_LISTS: the list holds the request Bob picked up').toHaveCount(1);

  await page.goto('/app/alerts?urgency=overdue');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Alerts', exact: true })).toBeVisible();
  expect(await listTotal(page), 'UX07_ANALYST_COUNTS_EQUAL_LISTS: Alerts equals the overdue alerts').toBe(overdueCount);
});

/*
 * D-11, research Assumption A2: counts refresh with the layout's server renders, never by polling. The Requestor
 * saves a complete draft, reads My requests' count, submits the draft from its page, returns to Home by the
 * sidebar, and the count has dropped by one. It proves the 1440 sidebar, so it runs at the desktop project's
 * width only, outside the @journey describe.
 */
test('UX07_COUNTS_REFRESH_AFTER_SUBMIT: My requests’ count drops by one when the Requestor submits a draft', async ({ page }) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  await signInAs(page, 'Requestor');
  await createCompleteDraftRequest(page, { title: `Count refresh remaining ${Date.now().toString(36)}`, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });
  const draft = await createCompleteDraftRequest(page, { title: `Count refresh ${Date.now().toString(36)}`, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });

  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  const myRequests = navigation.getByRole('link', { name: navigationText('My requests') });
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  const before = await navigationCount(myRequests);
  expect(before, 'UX07_COUNTS_REFRESH_AFTER_SUBMIT: two drafts need the Requestor').toBeGreaterThanOrEqual(2);

  await page.goto(`/app/requests/${encodeURIComponent(draft.documentId)}`);
  await submitRequestFromItsPage(page);
  await navigation.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  await expect(myRequests, 'UX07_COUNTS_REFRESH_AFTER_SUBMIT: the successful count dropped by one').toHaveAccessibleName(`My requests, ${before - 1} ${before - 1 === 1 ? 'needs' : 'need'} your action`);
  expect(await navigationCount(myRequests)).toBe(before - 1);
});

/** The visible section names and section buttons inside one Primary navigation landmark, in DOM order. */
async function sectionsOf(navigation: Locator): Promise<string[]> {
  return (await navigation.evaluate((nav) => Array
    .from(nav.querySelectorAll<HTMLElement>('[role="group"]:not([hidden]), button[aria-expanded]'))
    .map((element) => element.getAttribute('aria-label') ?? element.textContent ?? ''))).map(navigationLabel);
}

/*
 * The phone drawer, the own-requests section and the order of the analyst's sections (D-08, D-12,
 * UI-SPEC §1.4, §1.6). These journeys only read, so the mobile project runs them again at 375×812. The
 * drawer proof claims 375×812 and sets it in both projects; the others run at the project's own width,
 * through the sidebar at 1440 and the drawer at 375.
 */
test.describe('Sectioned navigation @journey', () => {
  test('UX07_DRAWER_SAME_SECTIONS: the phone drawer renders each actor’s sections, and the analyst’s fit 375×812', async ({ page }) => {
    await expectStrapiHealthy(page);
    await page.setViewportSize({ width: 375, height: 812 });

    await signInAs(page, 'Requestor');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    let sheet = page.getByRole('dialog', { name: 'Navigation' });
    await expect(sheet.getByRole('button', { name: 'Close navigation', exact: true }), 'UX07_DRAWER_SAME_SECTIONS: Close navigation is focused first').toBeFocused();
    await page.keyboard.press('Tab');
    await expect(sheet.getByRole('link', { name: 'New request', exact: true }), 'UX07_DRAWER_SAME_SECTIONS: New request follows Close').toBeFocused();
    let navigation = sheet.getByRole('navigation', { name: 'Primary navigation' });
    expect(await sectionsOf(navigation), 'UX07_DRAWER_SAME_SECTIONS:Requestor sections').toEqual(['My work']);
    await expect(navigation.getByRole('group', { name: 'My work', exact: true }).getByRole('link')).toHaveText([navigationText('My requests'), navigationText('My questionnaires'), 'My risk assessments']);

    await signInAs(page, 'Security Analyst');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    sheet = page.getByRole('dialog', { name: 'Navigation' });
    await expect(sheet.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused();
    navigation = sheet.getByRole('navigation', { name: 'Primary navigation' });
    expect(await sectionsOf(navigation), 'UX07_DRAWER_SAME_SECTIONS:Security Analyst sections').toEqual(['Assessment work', 'Oversight', 'Reference data', 'My own requests']);
    await expect(navigation.getByRole('button', { name: navigationText('My own requests') })).toHaveAttribute('aria-expanded', 'false');

    // With My own requests collapsed, every analyst navigation item shows without scrolling the drawer.
    const lastItem = navigation.locator('a, button').last();
    await expect(lastItem).toHaveText(navigationText('My own requests'));
    const box = await lastItem.boundingBox();
    expect(box, 'the last navigation item has a box').not.toBeNull();
    expect(box!.y + box!.height, 'UX07_DRAWER_SAME_SECTIONS: the last navigation item ends within 812px').toBeLessThanOrEqual(812);
  });

  test('UX07_OWN_SECTION_OPENS_ON_ITS_ROUTE: My own requests opens on its own pages and starts collapsed elsewhere', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Security Analyst');

    for (const [path, heading] of [
      ['/app/requests', 'My requests'],
      ['/app/requests/new', 'New request'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('main').getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      const navigation = await showPrimaryNavigation(page);
      await expect(navigation.getByRole('button', { name: navigationText('My own requests') }), `UX07_OWN_SECTION_OPENS_ON_ITS_ROUTE: expanded on ${path}`).toHaveAttribute('aria-expanded', 'true');
      const own = navigation.getByRole('group', { name: 'My own requests', exact: true });
      await expect(own.getByRole('link')).toHaveText([navigationText('My requests'), 'New request']);
      await expect(own.getByRole('link', { name: navigationText(heading) }), `UX07_OWN_SECTION_OPENS_ON_ITS_ROUTE: ${heading} is current on ${path}`).toHaveAttribute('aria-current', 'page');
      await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    }

    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
    const navigation = await showPrimaryNavigation(page);
    await expect(navigation.getByRole('button', { name: navigationText('My own requests') }), 'UX07_OWN_SECTION_OPENS_ON_ITS_ROUTE: collapsed on /app').toHaveAttribute('aria-expanded', 'false');
    await expect(navigation.getByRole('link', { name: navigationText('My requests') })).toHaveCount(0);
  });

  test('UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW: the analyst’s own requests follow the review work and reference data', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Security Analyst');
    const navigation = await showPrimaryNavigation(page);
    await expect(navigation.getByRole('group', { name: 'Reference data', exact: true })).toBeVisible();
    await expect(navigation.getByRole('button', { name: navigationText('My own requests') })).toBeVisible();

    const order = await navigation.evaluate((nav) => {
      const referenceData = nav.querySelector('[role="group"][aria-label="Reference data"]');
      const review = nav.querySelector('[role="group"][aria-label="Assessment work"]');
      const ownRequests = Array.from(nav.querySelectorAll('button[aria-expanded]')).find((button) => (button.textContent ?? '').trim().startsWith('My own requests'));
      if (!referenceData || !review || !ownRequests) return null;
      return {
        ownAfterReferenceData: Boolean(referenceData.compareDocumentPosition(ownRequests) & Node.DOCUMENT_POSITION_FOLLOWING),
        linksBeforeReview: Array.from(nav.querySelectorAll('a'))
          .filter((link) => Boolean(link.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING))
          .map((link) => (link.textContent ?? '').trim()),
      };
    });
    expect(order, 'the analyst navigation holds Assessment work, Reference data and My own requests').not.toBeNull();
    expect(order!.ownAfterReferenceData, 'UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW: My own requests follows Reference data').toBe(true);
    expect(order!.linksBeforeReview, 'UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW: only Home precedes the review work').toEqual(['Home']);
  });

  /*
   * D-10, D-12, D-57: the drawer carries the same counts as the sidebar. Each actor saves a draft of their own,
   * so their needs-your-action count is above zero; the counts are read in the sidebar at 1440, then in the
   * drawer at 375. As the analyst, the collapsed My own requests button carries its items' count in its name.
   */
  test('UX07_DRAWER_COUNTS: the phone drawer shows the sidebar’s counts, and the collapsed My own requests its own', async ({ page }) => {
    test.setTimeout(180_000);
    await expectStrapiHealthy(page);
    const stamp = Date.now().toString(36);
    const needsYourAction = (count: number) => `${count} ${count === 1 ? 'needs' : 'need'} your action`;

    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, 'Requestor');
    await createSubmittedRequest(page, { title: `Drawer queue ${stamp}`, assessmentType: 'BAU', businessCriticality: 'Low', dueDate: null });
    await createDraftRequest(page, { title: `Drawer count ${stamp}` });
    await page.goto('/app');
    let sidebar = page.getByRole('navigation', { name: 'Primary navigation' });
    const requestorCount = await navigationCount(sidebar.getByRole('link', { name: navigationText('My requests') }));
    const questionnaireCount = await shownCount(sidebar.getByRole('link', { name: navigationText('My questionnaires') }));

    await page.setViewportSize({ width: 375, height: 812 });
    let drawer = await showPrimaryNavigation(page);
    await expect(drawer.getByRole('link', { name: navigationText('My requests') }), 'UX07_DRAWER_COUNTS: the Requestor’s drawer count').toHaveAccessibleName(`My requests, ${needsYourAction(requestorCount)}`);
    expect(await shownCount(drawer.getByRole('link', { name: navigationText('My questionnaires') })), 'UX07_DRAWER_COUNTS: My questionnaires').toBe(questionnaireCount);

    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, 'Security Analyst');
    await createDraftRequest(page, { title: `Drawer own count ${stamp}` });
    await page.goto('/app');
    sidebar = page.getByRole('navigation', { name: 'Primary navigation' });
    const ownToggle = sidebar.getByRole('button', { name: /^My own requests, [\d,]+ needs? your action$/ });
    await expect(ownToggle, 'UX07_DRAWER_COUNTS: the collapsed My own requests carries its count').toHaveAttribute('aria-expanded', 'false');
    const ownCount = await navigationCount(ownToggle);
    const queueCount = await navigationCount(sidebar.getByRole('link', { name: navigationText('Requests') }));
    const overdueCount = await navigationCount(sidebar.getByRole('link', { name: navigationText('Alerts') }));
    expect(queueCount, 'the submitted fixture waits for pick-up').toBeGreaterThan(0);
    expect(overdueCount, 'the seeded overdue alerts give the drawer a count to carry').toBeGreaterThan(0);

    await page.setViewportSize({ width: 375, height: 812 });
    drawer = await showPrimaryNavigation(page);
    const drawerToggle = drawer.getByRole('button', { name: /^My own requests\b/ });
    await expect(drawerToggle, 'UX07_DRAWER_COUNTS: the drawer’s collapsed My own requests').toHaveAccessibleName(`My own requests, ${needsYourAction(ownCount)}`);
    expect(await navigationCount(drawer.getByRole('link', { name: navigationText('Requests') })), 'UX07_DRAWER_COUNTS: Requests').toBe(queueCount);
    expect(await navigationCount(drawer.getByRole('link', { name: navigationText('Alerts') })), 'UX07_DRAWER_COUNTS: Alerts').toBe(overdueCount);

    // Opened, the count moves from the button to its My requests item.
    await drawerToggle.click();
    await expect(drawerToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(drawerToggle).toHaveAccessibleName('My own requests');
    await expect(drawer.getByRole('group', { name: 'My own requests', exact: true }).getByRole('link', { name: navigationText('My requests') })).toHaveAccessibleName(`My requests, ${needsYourAction(ownCount)}`);
  });

  /* T-11-07: a Requestor's navigation holds no analyst item, so no analyst figure reaches it. */
  test('UX07_REQUESTOR_NO_ANALYST_COUNTS: the Requestor’s navigation has no Requests or Alerts link, and counts only their own work', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Requestor');
    await createDraftRequest(page, { title: `Private count ${Date.now().toString(36)}` });
    for (const role of ['Requestor', 'Secondary Requestor'] as const) {
      await signInAs(page, role);
      const navigation = await showPrimaryNavigation(page);
      await expect(navigation.getByRole('link', { name: 'Home', exact: true }), `${role} navigation rendered`).toBeVisible();
      await expect(navigation.getByRole('link', { name: /^Requests\b/ }), `UX07_REQUESTOR_NO_ANALYST_COUNTS: ${role} has no Requests link`).toHaveCount(0);
      await expect(navigation.getByRole('link', { name: /^Assigned to me\b/ }), `UX07_REQUESTOR_NO_ANALYST_COUNTS: ${role} has no Assigned to me link`).toHaveCount(0);
      await expect(navigation.getByRole('link', { name: /^Alerts\b/ }), `UX07_REQUESTOR_NO_ANALYST_COUNTS: ${role} has no Alerts link`).toHaveCount(0);
      await expect(navigation.getByRole('button', { name: /^My own requests\b/ })).toHaveCount(0);
      const ownRequests = navigation.getByRole('link', { name: navigationText('My requests') });
      const ownCount = await shownCount(ownRequests);
      if (role === 'Requestor') expect(ownCount, 'Jane has her newly saved draft').toBeGreaterThan(0);
      else {
        expect(ownCount, 'the Secondary Requestor owns none of Jane’s work').toBe(0);
        await expect(ownRequests).toHaveAccessibleName('My requests');
      }
      await shownCount(navigation.getByRole('link', { name: navigationText('My questionnaires') }));
      // Any count shown sits on the Requestor's own My requests or My questionnaires.
      const counted = await navigation.locator('a:has(.nav-count)').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(counted.every((href) => href === '/app/requests' || href === '/app/questionnaires'), `${role} counts only their own work: ${counted.join(', ')}`).toBe(true);
    }
  });
});
