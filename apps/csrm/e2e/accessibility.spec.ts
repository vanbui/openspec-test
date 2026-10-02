import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { expectActiveElementNotObscured, expectFocusNotObscured, expectFocusVisible } from './helpers/focus';
import { signInAs, type SignInRole } from './helpers/navigation';
import { expectSettled, type SettledExpectation } from './helpers/settle';

/*
 * The WCAG 2.2 AA route sweep (D-25, D-26, D-13). Every route, for the Security Analyst, the Requestor,
 * the Secondary Requestor and a signed-out visitor, at 1440 and 375px:
 * - settled first (the URL, the exact document title, the level-one heading by name, nothing still
 *   loading), so a scan measures the destination and never the navigation into it (D-13);
 * - exactly one level-one heading, on refusals and not-found pages too;
 * - a populated-content guard: an axe pass cannot tell a list from its error state, so every route
 *   first proves what it rendered (its fixture record, its form, its empty or permission state);
 * - axe with the five WCAG A and AA tags and Label in Name, zero violations, no impact filter;
 * - no horizontal page overflow and no Content-Security-Policy violation (D-19).
 * The criteria axe cannot decide have their own proofs at the end of the file: keyboard operability
 * of dialogs and sheets, focus not obscured, reflow at 320px and text spacing. The conformance record
 * is docs/accessibility/phase-08-wcag22-conformance.md.
 */

type Width = 1440 | 375;
type Guard = (label: string) => Promise<void>;
type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;

const widths = [1440, 375] as const;
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Seeded fixtures (apps/backend/src/bootstrap): Jane's questionnaire workflow and navigation lifecycle
// records, the Security Analyst's own submitted request, the Risk Register and the Phase 7 fixtures.
const analystReviewTitle = 'Customer portal questionnaire awaiting release';
const releasedQuestionnaireTitle = 'Customer portal questionnaire draft';
const requestTitle = 'Customer portal virtual assistant and live chat';
const analystAssessmentNumber = 'ASM-E2E-NAV-ANALYST-001';
const ownerAssessmentNumber = 'ASM-E2E-NAV-OWNER-001';
const analystOwnRequestTitle = 'Azure Pipeline Decorator for all delivery pipelines';
const mutableRiskNumber = 'RSK-DEV-MUTABLE-001';
// Duplicated by value from apps/backend/src/bootstrap/seed-analyst-insights.ts (the Phase 7 fixture).
const phase7OverdueRiskNumber = 'RSK-E2E-P7-OVERDUE-001';

/*
 * Every settled destination: the exact document title each page module declares and the level-one
 * heading its page header renders. Detail routes head with the fixture record's title or their fixed
 * detail heading; a refused page is headed by the page, never by the record.
 */
const dashboard: SettledExpectation = { url: /\/app$/, title: 'Dashboard | IdamBox CSRM', heading: 'Dashboard' };
const myRequests: SettledExpectation = { url: /\/app\/requests$/, title: 'My Requests | IdamBox CSRM', heading: 'My Requests' };
const newRequest: SettledExpectation = { url: /\/app\/requests\/new$/, title: 'New Request | IdamBox CSRM', heading: 'New assessment request' };
const myQuestionnaires: SettledExpectation = { url: /\/app\/questionnaires$/, title: 'My Questionnaires | IdamBox CSRM', heading: 'My Questionnaires' };
const myAssessments: SettledExpectation = { url: /\/app\/assessments$/, title: 'My Risk Assessments | IdamBox CSRM', heading: 'My Risk Assessments' };
const requestDetailTitle = 'Assessment Request | IdamBox CSRM';
const requestQueueTitle = 'Assessment Request Review | IdamBox CSRM';
const requestQueueHeading = 'Assessment request review';
const riskRegister: SettledExpectation = { url: /\/app\/risks$/, title: 'Risk Register | IdamBox CSRM', heading: 'Risk Register' };
const notFound = { title: 'Page not found | IdamBox CSRM', heading: 'Page not found' } as const;
const phase7Reports = [
  { route: '/app/reports/risk-exposure', heading: 'Risk exposure', title: 'Risk Exposure Report | IdamBox CSRM' },
  { route: '/app/reports/treatment-performance', heading: 'Treatment performance', title: 'Treatment Performance Report | IdamBox CSRM' },
  { route: '/app/reports/assessment-throughput', heading: 'Assessment throughput', title: 'Assessment Throughput Report | IdamBox CSRM' },
  { route: '/app/reports/control-effectiveness', heading: 'Control effectiveness', title: 'Control Effectiveness Report | IdamBox CSRM' },
] as const;

/*
 * A Requestor's refusal of each analyst surface keeps the page header and title, and shows the shared
 * permission state headed with the refused area. Both Requestor identities are refused alike.
 */
type Refusal = { route: string; title: string; heading: string; permission: string };
const phase7Refusals: readonly Refusal[] = [
  { route: '/app/review', heading: 'Analyst dashboard', title: 'Analyst Dashboard | IdamBox CSRM', permission: 'You don’t have access to the analyst dashboard' },
  { route: '/app/alerts', heading: 'Alerts', title: 'Alerts | IdamBox CSRM', permission: 'You don’t have access to alerts' },
  { route: '/app/reports', heading: 'Reports', title: 'Reports | IdamBox CSRM', permission: 'You don’t have access to reports' },
  { route: '/app/reports/risk-exposure', heading: 'Reports', title: 'Reports | IdamBox CSRM', permission: 'You don’t have access to reports' },
];
const workspaceRefusals: readonly Refusal[] = [
  { route: '/app/risks', heading: 'Risk Register', title: 'Risk Register | IdamBox CSRM', permission: 'You don’t have access to the Risk Register' },
  { route: '/app/review/requests', heading: requestQueueHeading, title: requestQueueTitle, permission: 'You don’t have access to assessment requests' },
  { route: '/app/review/questionnaires', heading: 'Questionnaire Review', title: 'Questionnaire Review | IdamBox CSRM', permission: 'You don’t have access to questionnaire reviews' },
  { route: '/app/review/assessments', heading: 'Risk assessment review', title: 'Risk Assessment Review | IdamBox CSRM', permission: 'You don’t have access to risk assessments' },
  // The Administration refusal is headed by the refused collection (STATE follow-up 2026-09-25).
  { route: '/app/admin/risk-types', heading: 'Risk Types', title: 'Risk Types | IdamBox CSRM', permission: 'You don’t have access to Administration records' },
  { route: '/app/admin/controls/import', heading: 'Controls', title: 'Import Controls CSV | IdamBox CSRM', permission: 'You don’t have access to Administration records' },
];

/* The four Administration collections and their routes, each written out. */
const administrationCollections = [
  { collection: 'risk-types', label: 'Risk Type', plural: 'Risk Types', firstField: 'Name', list: '/app/admin/risk-types', create: '/app/admin/risk-types/new', upload: '/app/admin/risk-types/import' },
  { collection: 'controls', label: 'Control', plural: 'Controls', firstField: 'Control number', list: '/app/admin/controls', create: '/app/admin/controls/new', upload: '/app/admin/controls/import' },
  { collection: 'information-systems', label: 'Information System', plural: 'Information Systems', firstField: 'Name', list: '/app/admin/information-systems', create: '/app/admin/information-systems/new', upload: '/app/admin/information-systems/import' },
  { collection: 'information-assets', label: 'Information Asset', plural: 'Information Assets', firstField: 'Name', list: '/app/admin/information-assets', create: '/app/admin/information-assets/new', upload: '/app/admin/information-assets/import' },
] as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const routeUrl = (route: string) => new RegExp(`${escapeRegExp(route)}$`);

/*
 * One scan for every route (D-25, D-26): the five WCAG A and AA tags, plus Label in Name, which axe
 * ships disabled. AxeBuilder#options replaces every option set before it, so the rule goes first and
 * the tags after, and the result's own record of what ran is checked, so a reordering cannot quietly
 * drop either. Target Size (wcag22aa) is checked the same way.
 */
async function scan(page: Page): Promise<AxeResults> {
  const results = await new AxeBuilder({ page })
    .options({ rules: { 'label-content-name-mismatch': { enabled: true } } })
    .withTags(wcagTags)
    .analyze();
  expect(results.toolOptions.runOnly, 'the scan runs the five WCAG tags').toEqual({ type: 'tag', values: wcagTags });
  const ran = [...results.passes, ...results.violations, ...results.incomplete, ...results.inapplicable].map(({ id }) => id);
  expect(ran, 'the scan runs Label in Name').toContain('label-content-name-mismatch');
  expect(ran, 'the scan runs Target Size').toContain('target-size');
  return results;
}

function summarise(violations: AxeResults['violations']): string {
  return violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => `${node.target.join(' ')} ${node.html.replace(/\s+/g, ' ').slice(0, 160)}`).join(' | ')}`).join('; ') || 'none';
}

async function expectAccessibleAtBothWidths(page: Page, surface: string, expected: SettledExpectation, guard?: Guard): Promise<void> {
  for (const width of widths) {
    const label = `${surface} at ${width}px`;
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expectSettled(page, expected, label);
    await expect(page.getByRole('heading', { level: 1 }), `${label} carries exactly one level-one heading`).toHaveCount(1);
    if (guard) await guard(label);
    const { violations } = await scan(page);
    expect(violations, `${label} has no axe violations (${summarise(violations)})`).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${label} has no horizontal overflow`,
    ).toBe(true);
    await expectNoCspViolations(page, label);
  }
}

type RouteVisit = { route: string; surface: string; expected: SettledExpectation; guard: Guard; status?: number };

/* Opens each route, checks its status, then settles, guards and scans it at both widths. */
async function sweep(page: Page, visits: readonly RouteVisit[]): Promise<void> {
  for (const visit of visits) {
    const response = await page.goto(visit.route);
    expect(response?.status(), `${visit.surface} answers ${visit.status ?? 200}`).toBe(visit.status ?? 200);
    await expectAccessibleAtBothWidths(page, visit.surface, visit.expected, visit.guard);
  }
  const description = `${visits.length} routes x ${widths.length} widths: ${visits.map(({ surface }) => surface).join(', ')}`;
  test.info().annotations.push({ type: 'accessibility sweep', description });
  console.log(`accessibility: ${description}`);
}

/* The href of a named record link on a list, read at 1440px, where the list is a table. */
async function recordHref(page: Page, listRoute: string, name: string): Promise<string> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(listRoute);
  const link = page.getByRole('main').getByRole('link', { name, exact: true }).filter({ visible: true }).first();
  await expect(link, `${listRoute} lists ${name}`).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href, `${name} links to its record`).toMatch(/^\/app\/[^?#]+$/);
  return href!;
}

async function switchActor(page: Page, role: SignInRole): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, role);
}

/* Populated-content guards (the 2026-09-24 lesson): each proves what the route rendered before a scan. */

async function expectNoErrorState(page: Page, label: string): Promise<void> {
  await expect(page.locator('[data-state-kind="error"]'), `${label} renders no error state`).toHaveCount(0);
}

/** A list proves an authoritative non-zero total and a record link on screen, the named one when given. */
const populatedList = (page: Page, record?: string): Guard => async (label) => {
  const main = page.getByRole('main');
  await expect(main.locator('output').filter({ hasText: /^[1-9][\d,]* results?$/ }).first(), `${label} shows a non-zero result total`).toBeVisible();
  const link = record ? main.getByRole('link', { name: record, exact: true }) : main.locator('a.record-link');
  await expect(link.filter({ visible: true }).first(), `${label} shows ${record ?? 'a record link'}`).toBeVisible();
  await expectNoErrorState(page, label);
};

/** A list with nothing to show proves its deliberate empty state and no record link. */
const emptyList = (page: Page): Guard => async (label) => {
  const main = page.getByRole('main');
  await expect(main.locator('[data-slot="state"][data-state-kind="empty"]').first(), `${label} shows its empty state`).toBeVisible();
  await expect(main.locator('a.record-link'), `${label} lists no record`).toHaveCount(0);
  await expectNoErrorState(page, label);
};

/** A personal list whose seeded contents are not fixed for this actor: its records, or its empty state. */
const populatedOrEmptyList = (page: Page): Guard => async (label) => {
  const main = page.getByRole('main');
  const total = main.locator('output').filter({ hasText: /^[1-9][\d,]* results?$/ });
  const empty = main.locator('[data-slot="state"][data-state-kind="empty"]');
  await expect(total.or(empty).first(), `${label} shows its records or its empty state`).toBeVisible();
  await ((await empty.first().isVisible()) ? emptyList(page) : populatedList(page))(label);
};

/** A refusal proves the shared permission state headed with the refused area, and no record. */
const permissionState = (page: Page, heading: string): Guard => async (label) => {
  const main = page.getByRole('main');
  const state = main.locator('[data-slot="state"][data-state-kind="permission"]');
  await expect(state, `${label} renders the shared permission state`).toBeVisible();
  await expect(state, `${label} announces the refusal`).toHaveAttribute('role', 'alert');
  await expect(main.getByRole('alert'), `${label} shows one alert`).toHaveCount(1);
  await expect(state.getByRole('heading', { name: heading, exact: true }), `${label} names the refused area`).toBeVisible();
  await expect(main.locator('a.record-link'), `${label} shows no record link`).toHaveCount(0);
  // A refusal is the page header and the state alone: no search, filter, result total or pager (W-3).
  await expect(main.getByRole('searchbox'), `${label} offers no search`).toHaveCount(0);
  await expect(main.getByRole('combobox'), `${label} offers no filter`).toHaveCount(0);
  await expect(main.locator('output'), `${label} shows no result total or page position`).toHaveCount(0);
  await expect(main.getByRole('button', { name: /^(Previous page|Next page|Use (compact|default) density)$/ }), `${label} shows no pager or density toggle`).toHaveCount(0);
  await expectNoErrorState(page, label);
};

/** A personal dashboard proves its seven lifecycle cards. */
const lifecycleDashboard = (page: Page): Guard => async (label) => {
  const cards = page.getByRole('region', { name: 'My Assessment Requests' }).getByRole('list', { name: 'My Assessment Requests by lifecycle state' }).getByRole('listitem');
  await expect(cards, `${label} shows the seven lifecycle cards`).toHaveCount(7);
  await expectNoErrorState(page, label);
};

/** A form proves its first field. */
const formField = (page: Page, field: string): Guard => async (label) => {
  await expect(page.getByRole('main').getByRole('textbox', { name: field, exact: true }), `${label} shows its ${field} field`).toBeVisible();
  await expectNoErrorState(page, label);
};

/** A region, heading or control that only the populated page renders. */
const shows = (page: Page, what: string, locate: (page: Page) => Locator): Guard => async (label) => {
  await expect(locate(page).first(), `${label} shows ${what}`).toBeVisible();
  await expectNoErrorState(page, label);
};

const importGuidance = (page: Page): Guard => shows(page, 'Choose CSV file', (current) => current.getByRole('main').getByRole('button', { name: 'Choose CSV file', exact: true }));

/** The analyst dashboard proves its four KPI tiles, each with a figure. */
const analystDashboardTiles = (page: Page): Guard => async (label) => {
  const tiles = page.getByRole('region', { name: 'Needs action', exact: true }).locator('[data-slot="kpi-tile"]');
  await expect(tiles, `${label} shows its four KPI tiles`).toHaveCount(4);
  await expect(tiles.locator('[data-slot="kpi-tile-value"]').filter({ hasText: /^[\d,]+$/ }), `${label} shows a figure on every tile`).toHaveCount(4);
  await expectNoErrorState(page, label);
};

/** The report index proves its four report cards. */
const reportIndex = (page: Page): Guard => async (label) => {
  await expect(page.getByRole('list', { name: 'Reports' }).getByRole('link'), `${label} shows its report cards`).toHaveCount(phase7Reports.length);
  await expectNoErrorState(page, label);
};

/** A report proves a section table. */
const reportTable = (page: Page): Guard => shows(page, 'a section table', (current) => current.locator('[data-slot="report-section"] table').filter({ visible: true }));

/*
 * The governed questionnaire surfaces (WR-11). Other specs release and submit the same fixtures, so each guard
 * proves the state its scan claims, whatever ran before it, and fails if the fixture has moved on.
 */
const pageStatus = (page: Page) => page.getByRole('main').locator('.page-header [data-slot="badge"]');
const originatingRequest = (page: Page) => page.getByRole('main').getByRole('link', { name: /^Assessment request / });

/** Analyst review (D-32): not yet released, so the header says so and the release control is offered. */
const analystReviewState = (page: Page): Guard => async (label) => {
  await expect(pageStatus(page), `${label} is in analyst review`).toHaveText('Analyst review');
  await expect(page.getByRole('main').getByRole('button', { name: 'Release questionnaire', exact: true }), `${label} offers the release`).toBeVisible();
  await expect(originatingRequest(page).first(), `${label} shows its originating request`).toBeVisible();
  await expectNoErrorState(page, label);
};

/** Released and awaiting the Requestor's submission: no answers to review yet, and no longer in analyst review. */
const awaitingSubmissionState = (page: Page): Guard => async (label) => {
  await expect(page.getByRole('main').getByText('Awaiting questionnaire submission', { exact: true }), `${label} awaits the Requestor's submission`).toBeVisible();
  await expect(pageStatus(page), `${label} is released and not yet submitted`).not.toHaveText(/^(Analyst review|Submitted)$/);
  await expect(originatingRequest(page).first(), `${label} shows its originating request`).toBeVisible();
  await expectNoErrorState(page, label);
};

/** The Requestor still answering: the completion summary and the submit control, and not yet submitted. */
const requestorAnsweringState = (page: Page): Guard => async (label) => {
  const main = page.getByRole('main');
  await expect(main.getByRole('region', { name: 'Questionnaire completion' }), `${label} shows the questionnaire completion summary`).toBeVisible();
  await expect(main.getByRole('button', { name: 'Submit questionnaire', exact: true }), `${label} is still being answered`).toBeVisible();
  await expect(pageStatus(page), `${label} is not yet submitted`).not.toHaveText('Submitted');
  await expectNoErrorState(page, label);
};

test('has no axe violations in the signed-in CSRM shell', async ({ page }) => {
  await attachCspCollector(page);
  // signInAs asserts the shell (the Dashboard heading and the role in the banner), never the URL (D-15).
  await signInAs(page, 'Security Analyst');
  await expectAccessibleAtBothWidths(page, 'the signed-in shell', dashboard, lifecycleDashboard(page));
});

test('has no axe violations on phase 06.8 governed questionnaire surfaces', async ({ page }) => {
  test.setTimeout(300_000);
  await attachCspCollector(page);
  await signInAs(page, 'Security Analyst');
  await page.goto('/app/review/questionnaires');
  const analystReview = page.getByRole('link', { name: analystReviewTitle }).first();
  await expect(analystReview).toBeVisible();
  await analystReview.click();
  await expectAccessibleAtBothWidths(page, 'analyst questionnaire review', { url: /\/app\/review\/questionnaires\/[^/?]+$/, title: 'Questionnaire Review | IdamBox CSRM', heading: analystReviewTitle }, analystReviewState(page));

  await page.goto('/app/review/questionnaires');
  const releasedReview = page.getByRole('link', { name: releasedQuestionnaireTitle }).first();
  await expect(releasedReview).toBeVisible();
  await releasedReview.click();
  await expectAccessibleAtBothWidths(page, 'analyst released questionnaire review', { url: /\/app\/review\/questionnaires\/[^/?]+$/, title: 'Questionnaire Review | IdamBox CSRM', heading: releasedQuestionnaireTitle }, awaitingSubmissionState(page));

  await switchActor(page, 'Requestor');
  await page.goto('/app/questionnaires');
  const questionnaire = page.getByRole('link', { name: releasedQuestionnaireTitle }).first();
  await expect(questionnaire).toBeVisible();
  await questionnaire.click();
  await expectAccessibleAtBothWidths(page, 'Requestor questionnaire detail timeline', { url: /\/app\/questionnaires\/[^/?]+$/, title: 'Questionnaire | IdamBox CSRM', heading: releasedQuestionnaireTitle }, requestorAnsweringState(page));

  await page.goto('/app/requests');
  await page.getByRole('link', { name: requestTitle }).first().click();
  await expectAccessibleAtBothWidths(page, 'Requestor request hub', { url: /\/app\/requests\/[^/?]+$/, title: requestDetailTitle, heading: requestTitle }, shows(page, 'its request actions', (current) => current.getByRole('region', { name: 'Request actions' })));
  await page.goto('/app');
  await expectAccessibleAtBothWidths(page, 'Requestor dashboard lifecycle cards', dashboard, lifecycleDashboard(page));

  await switchActor(page, 'Security Analyst');
  await page.goto('/app/review/requests');
  await expectAccessibleAtBothWidths(page, 'analyst request queue requires attention', { url: /\/app\/review\/requests$/, title: requestQueueTitle, heading: requestQueueHeading }, populatedList(page));
  await page.getByRole('combobox', { name: 'Queue' }).selectOption('released');
  // Selecting a queue navigates; the settle below waits for the released queue itself (D-13).
  await expect(page).toHaveURL(/queue=released/);
  await expectAccessibleAtBothWidths(page, 'analyst request queue released', { url: /\/app\/review\/requests\?.*queue=released/, title: requestQueueTitle, heading: requestQueueHeading }, populatedList(page));
  /*
   * A released questionnaire the Requestor is still answering is waiting with them, so the request is
   * reached through the explicit awaiting-requestor filter rather than the default action queue.
   */
  await page.goto('/app/review/requests?queue=awaiting-requestor');
  const awaitingRequest = page.getByRole('link', { name: requestTitle }).first();
  await expect(awaitingRequest, 'the request still awaits its Requestor, so the awaiting-requestor queue lists it').toBeVisible();
  await awaitingRequest.click();
  await expectAccessibleAtBothWidths(page, 'analyst request hub', { url: /\/app\/review\/requests\/[^/?]+$/, title: requestQueueTitle, heading: requestTitle }, shows(page, 'the request context', (current) => current.getByRole('main').getByRole('heading', { name: 'Request context', exact: true })));
});

test('has no axe violations on phase 06.9 assessment lifecycle detail surfaces', async ({ page }) => {
  await attachCspCollector(page);
  const lifecycle = (current: Page) => current.locator('section[aria-labelledby="assessment-lifecycle-heading"]');
  await signInAs(page, 'Security Analyst');
  await page.goto('/app/review/assessments');
  await page.getByRole('link', { name: analystAssessmentNumber }).click();
  await expectAccessibleAtBothWidths(page, 'analyst assessment lifecycle editor', { url: /\/app\/review\/assessments\/[^/?]+$/, title: 'Risk Assessment Review | IdamBox CSRM', heading: 'Risk assessment review' }, shows(page, 'its lifecycle', lifecycle));

  await switchActor(page, 'Requestor');
  await page.goto('/app/assessments');
  await page.getByRole('link', { name: ownerAssessmentNumber }).click();
  await expectAccessibleAtBothWidths(page, 'Requestor released assessment lifecycle detail', { url: /\/app\/assessments\/[^/?]+$/, title: 'Released Risk Assessment | IdamBox CSRM', heading: 'Released risk assessment' }, shows(page, 'its lifecycle', lifecycle));
});

test('has no axe violations on phase 07 analyst surfaces', async ({ page }) => {
  test.setTimeout(480_000);
  await attachCspCollector(page);
  await signInAs(page, 'Security Analyst');
  await page.goto('/app/review');
  await expectAccessibleAtBothWidths(page, 'analyst dashboard', { url: /\/app\/review$/, title: 'Analyst Dashboard | IdamBox CSRM', heading: 'Analyst dashboard' }, analystDashboardTiles(page));

  await page.goto('/app/alerts?kind=risk-treatment-overdue&pageSize=50');
  await expectAccessibleAtBothWidths(page, 'analyst alerts', { url: /\/app\/alerts\?/, title: 'Alerts | IdamBox CSRM', heading: 'Alerts' }, shows(page, phase7OverdueRiskNumber, (current) => current.getByRole('link', { name: phase7OverdueRiskNumber, exact: true }).filter({ visible: true })));

  await page.goto('/app/reports');
  await expectAccessibleAtBothWidths(page, 'analyst report index', { url: /\/app\/reports$/, title: 'Reports | IdamBox CSRM', heading: 'Reports' }, reportIndex(page));
  for (const { route, heading, title } of phase7Reports) {
    await page.goto(route);
    await expectAccessibleAtBothWidths(page, `analyst ${route} report`, { url: routeUrl(route), title, heading }, reportTable(page));
  }

  // The Requestor's permission render of each Phase 7 route is scanned too.
  await switchActor(page, 'Requestor');
  await sweep(page, phase7Refusals.map(({ route, heading, title, permission }) => ({
    route, surface: `Requestor ${route} permission`, expected: { url: routeUrl(route), title, heading }, guard: permissionState(page, permission),
  })));
});

test('has no axe violations on the CSV import guidance', async ({ page }) => {
  await attachCspCollector(page);
  await signInAs(page, 'Security Analyst');
  await page.goto('/app/admin/risk-types/import');
  await expectAccessibleAtBothWidths(page, 'CSV import guidance', { url: /\/app\/admin\/risk-types\/import$/, title: 'Import Risk Types CSV | IdamBox CSRM', heading: 'Import Risk Types from CSV' }, importGuidance(page));
});

/* The first record of an Administration list, and the heading its edit page carries (the record's name). */
async function firstAdministrationRecord(page: Page, collection: typeof administrationCollections[number]): Promise<{ href: string; heading: string }> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(collection.list);
  const row = page.getByRole('table', { name: `${collection.plural} results`, exact: true }).locator('tbody tr').first();
  const link = row.locator('a.record-link').first();
  await expect(link, `${collection.list} lists a record`).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href, `${collection.plural} link to their records`).toMatch(new RegExp(`^/app/admin/${collection.collection}/[^/?#]+$`));
  const linkText = (await link.textContent())?.trim() ?? '';
  // A Control's page is headed with its control label (D-36): its number, then its title, or its framework when the
  // Name column says it has no title. Every other record is headed with its name.
  let heading = linkText;
  if (collection.collection === 'controls') {
    const title = (await row.locator('td').nth(1).textContent())?.trim() ?? '';
    const framework = (await row.locator('td').nth(2).textContent())?.trim() ?? '';
    heading = `${linkText} · ${title === 'Not provided' ? framework : title}`;
  }
  return { href: href!, heading };
}

test('has no axe violations on the analyst lists, create forms, records and administration routes', async ({ page }) => {
  test.setTimeout(720_000);
  await attachCspCollector(page);
  await signInAs(page, 'Security Analyst');

  // The analyst's own personal routes: every actor is a Requestor by birthright.
  const ownRequest = await recordHref(page, '/app/requests', analystOwnRequestTitle);
  const analystAssessment = await recordHref(page, '/app/review/assessments', analystAssessmentNumber);
  const risk = await recordHref(page, '/app/risks', mutableRiskNumber);
  const administrationRecords: { collection: typeof administrationCollections[number]; href: string; heading: string }[] = [];
  for (const collection of administrationCollections) administrationRecords.push({ collection, ...(await firstAdministrationRecord(page, collection)) });

  await sweep(page, [
    { route: '/app/requests', surface: 'analyst My Requests', expected: myRequests, guard: populatedList(page, analystOwnRequestTitle) },
    { route: ownRequest, surface: 'analyst own request detail', expected: { url: routeUrl(ownRequest), title: requestDetailTitle, heading: analystOwnRequestTitle }, guard: shows(page, 'its request actions', (current) => current.getByRole('region', { name: 'Request actions' })) },
    { route: '/app/requests/new', surface: 'analyst new request', expected: newRequest, guard: formField(page, 'Request title') },
    { route: '/app/questionnaires', surface: 'analyst My Questionnaires', expected: myQuestionnaires, guard: populatedOrEmptyList(page) },
    { route: '/app/assessments', surface: 'analyst My Risk Assessments', expected: myAssessments, guard: populatedOrEmptyList(page) },
    { route: '/app/review/questionnaires', surface: 'analyst questionnaire review list', expected: { url: /\/app\/review\/questionnaires$/, title: 'Questionnaire Review | IdamBox CSRM', heading: 'Questionnaire Review' }, guard: populatedList(page, analystReviewTitle) },
    { route: '/app/review/assessments', surface: 'analyst risk assessment review list', expected: { url: /\/app\/review\/assessments$/, title: 'Risk Assessment Review | IdamBox CSRM', heading: 'Risk assessment review' }, guard: populatedList(page, analystAssessmentNumber) },
    { route: analystAssessment, surface: 'analyst risk assessment editor', expected: { url: routeUrl(analystAssessment), title: 'Risk Assessment Review | IdamBox CSRM', heading: 'Risk assessment review' }, guard: shows(page, 'its identified Risks', (current) => current.getByRole('main').getByRole('heading', { name: 'Identified Risks', exact: true })) },
    { route: '/app/risks', surface: 'analyst Risk Register', expected: riskRegister, guard: populatedList(page, mutableRiskNumber) },
    { route: risk, surface: 'analyst Risk details', expected: { url: routeUrl(risk), title: 'Risk Details | IdamBox CSRM', heading: mutableRiskNumber }, guard: shows(page, 'its statement and classification', (current) => current.getByRole('region', { name: 'Risk statement and classification' })) },
    ...administrationRecords.flatMap(({ collection, href, heading }): RouteVisit[] => [
      { route: collection.list, surface: `analyst ${collection.plural}`, expected: { url: routeUrl(collection.list), title: `${collection.plural} | IdamBox CSRM`, heading: collection.plural }, guard: populatedList(page) },
      { route: collection.create, surface: `analyst create ${collection.label}`, expected: { url: routeUrl(collection.create), title: `Create ${collection.label} | IdamBox CSRM`, heading: `Create ${collection.label}` }, guard: formField(page, collection.firstField) },
      { route: href, surface: `analyst ${collection.label} record`, expected: { url: routeUrl(href), title: `${collection.label} Details | IdamBox CSRM`, heading }, guard: shows(page, `Edit ${collection.label}`, (current) => current.getByRole('main').getByRole('button', { name: `Edit ${collection.label}`, exact: true })) },
      { route: collection.upload, surface: `analyst ${collection.plural} CSV import`, expected: { url: routeUrl(collection.upload), title: `Import ${collection.plural} CSV | IdamBox CSRM`, heading: `Import ${collection.plural} from CSV` }, guard: importGuidance(page) },
    ]),
    // An unknown collection raises notFound() in the shell; its streamed status stays 200 (08-09).
    { route: '/app/admin/not-a-collection', surface: 'analyst in-shell not-found', expected: { url: /\/app\/admin\/not-a-collection$/, ...notFound }, guard: shows(page, 'Return to workspace', (current) => current.getByRole('main').getByRole('link', { name: 'Return to workspace', exact: true })) },
  ]);
});

test('has no axe violations on the Requestor lists, record edit and refusal routes', async ({ page }) => {
  test.setTimeout(600_000);
  await attachCspCollector(page);
  await signInAs(page, 'Requestor');
  const janesRequest = await recordHref(page, '/app/requests', requestTitle);

  await sweep(page, [
    { route: '/app', surface: 'Requestor dashboard', expected: dashboard, guard: lifecycleDashboard(page) },
    { route: '/app/requests', surface: 'Requestor My Requests', expected: myRequests, guard: populatedList(page, requestTitle) },
    { route: '/app/requests/new', surface: 'Requestor new request', expected: newRequest, guard: formField(page, 'Request title') },
    /*
     * Every seeded request of Jane's is past draft, so her edit route renders its refusal, under the
     * page's heading. The populated edit form is the create form's RequestForm (scanned above) with
     * its values and a Submit request control; the request journey drives it at both widths.
     */
    { route: `${janesRequest}/edit`, surface: 'Requestor request edit refusal', expected: { url: routeUrl(`${janesRequest}/edit`), title: 'Edit Request | IdamBox CSRM', heading: 'Edit assessment request' }, guard: permissionState(page, 'You don’t have access to this area') },
    { route: '/app/questionnaires', surface: 'Requestor My Questionnaires', expected: myQuestionnaires, guard: populatedList(page, releasedQuestionnaireTitle) },
    { route: '/app/assessments', surface: 'Requestor My Risk Assessments', expected: myAssessments, guard: populatedList(page, ownerAssessmentNumber) },
    ...workspaceRefusals.map(({ route, heading, title, permission }): RouteVisit => ({
      route, surface: `Requestor ${route} permission`, expected: { url: routeUrl(route), title, heading }, guard: permissionState(page, permission),
    })),
  ]);
});

test('has no axe violations for the Secondary Requestor lists and the denials of another Requestor’s records', async ({ page }) => {
  test.setTimeout(600_000);
  await attachCspCollector(page);
  // Jane's record URLs, taken from her own lists (the plan 08-11 capture pattern).
  await signInAs(page, 'Requestor');
  const janesRequest = await recordHref(page, '/app/requests', requestTitle);
  const janesQuestionnaire = await recordHref(page, '/app/questionnaires', releasedQuestionnaireTitle);
  const janesAssessment = await recordHref(page, '/app/assessments', ownerAssessmentNumber);

  await switchActor(page, 'Secondary Requestor');
  const main = (current: Page) => current.getByRole('main');
  await sweep(page, [
    { route: '/app', surface: 'Secondary Requestor dashboard', expected: dashboard, guard: lifecycleDashboard(page) },
    { route: '/app/requests', surface: 'Secondary Requestor My Requests', expected: myRequests, guard: emptyList(page) },
    { route: '/app/requests/new', surface: 'Secondary Requestor new request', expected: newRequest, guard: formField(page, 'Request title') },
    { route: '/app/questionnaires', surface: 'Secondary Requestor My Questionnaires', expected: myQuestionnaires, guard: emptyList(page) },
    { route: '/app/assessments', surface: 'Secondary Requestor My Risk Assessments', expected: myAssessments, guard: emptyList(page) },
    /*
     * Jane's request: Strapi refuses it (403), so the page shows the shared permission state under the
     * page's heading, which names the page and never the record (D-18).
     */
    { route: janesRequest, surface: 'Secondary Requestor on Jane’s request', expected: { url: routeUrl(janesRequest), title: requestDetailTitle, heading: 'Assessment request' }, guard: permissionState(page, 'You don’t have access to this area') },
    // Jane's questionnaire: Strapi refuses it (403), and the page renders the questionnaire's own permission copy.
    { route: janesQuestionnaire, surface: 'Secondary Requestor on Jane’s questionnaire', expected: { url: routeUrl(janesQuestionnaire), title: 'Questionnaire | IdamBox CSRM', heading: 'Questionnaire unavailable' }, guard: shows(page, 'the questionnaire permission copy', (current) => main(current).getByRole('alert').filter({ hasText: 'You don’t have permission to view this questionnaire' })) },
    /*
     * Jane's assessment: Strapi answers 404, so the page is the in-shell not-found, titled by it
     * (08-12). The status stays the streamed 200.
     */
    { route: janesAssessment, surface: 'Secondary Requestor on Jane’s assessment', expected: { url: routeUrl(janesAssessment), ...notFound }, guard: shows(page, 'Return to workspace', (current) => main(current).getByRole('link', { name: 'Return to workspace', exact: true })) },
    ...[...phase7Refusals, ...workspaceRefusals].map(({ route, heading, title, permission }): RouteVisit => ({
      route, surface: `Secondary Requestor ${route} permission`, expected: { url: routeUrl(route), title, heading }, guard: permissionState(page, permission),
    })),
  ]);
});

test('has no axe violations on the signed-out sign-in and the root not-found page', async ({ page }) => {
  await attachCspCollector(page);
  await sweep(page, [
    { route: '/sign-in', surface: 'signed-out development sign-in', expected: { url: /\/sign-in$/, title: 'Development sign-in | IdamBox CSRM', heading: 'Development sign-in' }, guard: shows(page, 'the three fixture identities', (current) => current.getByRole('button', { name: /^Continue as / }).nth(2)) },
    // A URL no route matches renders the root card outside the shell, with a real 404 (08-09).
    { route: '/app/this-route-does-not-exist', status: 404, surface: 'signed-out root not-found', expected: { url: /\/app\/this-route-does-not-exist$/, ...notFound }, guard: shows(page, 'the root card', (current) => current.locator('main.sign-in > section.sign-in-card').getByRole('link', { name: 'Return to workspace', exact: true })) },
  ]);
});

/*
 * Keyboard operability of dialogs and sheets (D-25): each opens from the keyboard, takes focus, keeps it
 * while open where it is modal, and gives it back to its trigger on Escape. Cited alongside:
 * app-shell.spec.ts (the sheet's focus return at 390px), requestor-request-workflow.spec.ts (the
 * return-to-draft confirmation at 375 and 1440) and risk-register-workflow.spec.ts (the Filters sheet
 * and the More filters popover at every width).
 */
test('keyboard operability of dialogs and sheets', async ({ page }) => {
  test.setTimeout(300_000);
  await attachCspCollector(page);
  const focusInside = (container: Locator) => container.evaluate((element) => element.contains(document.activeElement));

  // The navigation sheet at 375: Tab reaches Menu, Enter opens it, focus stays inside, Escape returns it.
  await page.setViewportSize({ width: 375, height: 812 });
  await signInAs(page, 'Security Analyst');
  await expectSettled(page, dashboard, 'the dashboard at 375px');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' }), 'the first Tab stop is the skip link').toBeFocused();
  await page.keyboard.press('Tab');
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await expect(menu, 'the next Tab stop is Menu').toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Navigation' });
  await expect(sheet, 'Enter opens the navigation sheet').toBeVisible();
  await expect(page.locator('.mobile-trigger'), 'the trigger reports the open sheet').toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Close navigation' }), 'the sheet takes focus on its close control').toBeFocused();
  /*
   * The open sheet is scanned too, once its entrance has settled. Its Close control inherited the
   * sheet's light sidebar text on a white pill, 1.09:1, and no sweep scanned the sheet open (B-1).
   */
  await sheet.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.then(() => undefined, () => undefined)));
  });
  const { violations: sheetViolations } = await scan(page);
  expect(sheetViolations, `the open navigation sheet at 375px has no axe violations (${summarise(sheetViolations)})`).toEqual([]);
  const sheetStops = await sheet.locator('a[href], button:not([disabled])').count();
  for (let stop = 1; stop <= sheetStops + 2; stop += 1) {
    await page.keyboard.press('Tab');
    await expect.poll(() => focusInside(sheet), { message: `Tab ${stop} keeps focus inside the sheet` }).toBe(true);
  }
  for (let stop = 1; stop <= 3; stop += 1) {
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => focusInside(sheet), { message: `Shift+Tab ${stop} keeps focus inside the sheet` }).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(sheet, 'Escape closes the sheet').toBeHidden();
  await expect(menu, 'Escape returns focus to Menu').toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  // The More filters popover at 1440: opened from the keyboard, it takes focus; Escape returns it.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/risks');
  await expectSettled(page, riskRegister, 'the Risk Register at 1440px');
  const moreFilters = page.getByRole('button', { name: 'More filters' });
  await expectFocusVisible(moreFilters, 'More filters');
  await expectFocusNotObscured(page, moreFilters, 'More filters');
  await page.keyboard.press('Enter');
  const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
  await expect(popover, 'Enter opens More filters').toBeVisible();
  await expect.poll(() => focusInside(popover), { message: 'More filters moves focus into its fields' }).toBe(true);
  await page.keyboard.press('Tab');
  await expect.poll(() => focusInside(popover), { message: 'Tab moves between the More filters fields' }).toBe(true);
  await page.keyboard.press('Escape');
  await expect(popover, 'Escape closes More filters').toHaveCount(0);
  await expect(moreFilters, 'Escape returns focus to More filters').toBeFocused();

  /*
   * A confirmation dialog, opened and cancelled, never confirmed (T-08-12-03). No seeded request is a
   * draft, so the Submit request confirmation cannot be reached without creating a record; the shared
   * ConfirmDialog is proven instead on the Security Analyst's own submitted request, whose Return to
   * draft confirmation also holds the required reason field. Escape cancels it, and a reload proves
   * nothing changed.
   */
  const ownRequest = await recordHref(page, '/app/requests', analystOwnRequestTitle);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.goto(ownRequest);
    await expectSettled(page, { url: routeUrl(ownRequest), title: requestDetailTitle, heading: analystOwnRequestTitle }, `the analyst's own request at ${width}px`);
    const actions = page.getByRole('region', { name: 'Request actions' });
    const trigger = actions.getByRole('button', { name: 'Return to draft' });
    await expectFocusVisible(trigger, `Return to draft at ${width}px`);
    await expectFocusNotObscured(page, trigger, `Return to draft at ${width}px`);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: 'Return this request to draft?' });
    await expect(dialog, `Enter opens the confirmation at ${width}px`).toBeVisible();
    await expect.poll(() => focusInside(dialog), { message: `the confirmation takes focus at ${width}px` }).toBe(true);
    for (let stop = 1; stop <= 5; stop += 1) {
      await page.keyboard.press('Tab');
      await expect.poll(() => focusInside(dialog), { message: `Tab ${stop} stays inside the confirmation at ${width}px` }).toBe(true);
    }
    for (let stop = 1; stop <= 5; stop += 1) {
      await page.keyboard.press('Shift+Tab');
      await expect.poll(() => focusInside(dialog), { message: `Shift+Tab ${stop} stays inside the confirmation at ${width}px` }).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog, `Escape cancels the confirmation at ${width}px`).toHaveCount(0);
    await expect(trigger, `Escape returns focus to Return to draft at ${width}px`).toBeFocused();
    await page.reload();
    await expect(page.locator('.page-header [data-slot="badge"]'), `the request is still submitted at ${width}px`).toHaveText('Submitted');
    await expect(actions.getByRole('button', { name: 'Return to draft' }), `the confirmation changed nothing at ${width}px`).toBeVisible();
  }

  // The CSV import's first control is reached by Tab and shows its focus ring at both widths.
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.goto('/app/admin/risk-types/import');
    await expectSettled(page, { url: /\/app\/admin\/risk-types\/import$/, title: 'Import Risk Types CSV | IdamBox CSRM', heading: 'Import Risk Types from CSV' }, `the CSV import at ${width}px`);
    await expectFocusVisible(page.getByRole('button', { name: 'Choose CSV file', exact: true }), `Choose CSV file at ${width}px`);
  }
  await expectNoCspViolations(page, 'the keyboard proofs');
});

/*
 * WCAG 1.4.12 Text Spacing: the four overrides the criterion names, applied to everything. Nothing may
 * be lost: no horizontal page overflow, nothing wider than main, and no heading, badge or page title
 * cut off by its own box.
 */
const textSpacingCss = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';

async function expectTextSpacingLosesNothing(page: Page, label: string): Promise<void> {
  const style = await page.addStyleTag({ content: textSpacingCss });
  try {
    await expect.poll(() => page.evaluate(() => {
      const problems: string[] = [];
      const shown = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return element.getClientRects().length > 0 && box.width > 1 && box.height > 1 && !element.closest('.sr-only');
      };
      const describe = (element: Element) => `${element.tagName.toLowerCase()} "${(element.textContent ?? '').trim().slice(0, 40)}"`;
      if (document.documentElement.scrollWidth > window.innerWidth) problems.push(`page ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
      const main = document.querySelector<HTMLElement>('main');
      if (main && main.scrollWidth > main.clientWidth + 1) problems.push(`main ${main.scrollWidth} > ${main.clientWidth}`);
      for (const element of document.querySelectorAll<HTMLElement>('[data-slot="badge"], .page-header h1')) {
        if (shown(element) && element.scrollWidth > element.clientWidth + 1) problems.push(`clipped width: ${describe(element)} ${element.scrollWidth} > ${element.clientWidth}`);
      }
      for (const element of document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, [data-slot="badge"]')) {
        const computed = getComputedStyle(element);
        const clips = [computed.overflow, computed.overflowX, computed.overflowY].some((value) => value === 'hidden' || value === 'clip');
        if (shown(element) && clips && element.scrollHeight > element.clientHeight + 1) problems.push(`clipped height: ${describe(element)} ${element.scrollHeight} > ${element.clientHeight}`);
      }
      return problems;
    }), { message: `${label} loses no text under the text-spacing overrides` }).toEqual([]);
  } finally {
    await style.evaluate((element) => element.parentNode?.removeChild(element));
  }
}

/*
 * WCAG 2.4.11 Focus Not Obscured (Minimum): from the skip link into main, each of the first fifteen Tab
 * presses leaves focus below the sticky header and clear of a scrolling table's sticky column. Focus is
 * read from document.activeElement, so a date input's own fields count as the stops they are. A page
 * with fewer stops ends early, and only when Tab has left the page and nothing in it holds focus.
 */
async function expectTabStopsNeverObscured(page: Page, label: string): Promise<{ checked: number; endOfPage: boolean }> {
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await skipLink.focus();
  await page.keyboard.press('Enter');
  let checked = 0;
  let endOfPage = false;
  for (let press = 1; press <= 15; press += 1) {
    await page.keyboard.press('Tab');
    if (!(await expectActiveElementNotObscured(page, `${label}, Tab ${press}`))) {
      endOfPage = true;
      break;
    }
    checked += 1;
  }
  expect(checked, `${label} has Tab stops to check`).toBeGreaterThan(0);
  return { checked, endOfPage };
}

test('focus is never obscured and text reflows', async ({ page }) => {
  test.setTimeout(600_000);
  await attachCspCollector(page);

  // The six journey landing pages (D-14), each opened as the actor who uses it.
  await signInAs(page, 'Requestor');
  const janesQuestionnaire = await recordHref(page, '/app/questionnaires', releasedQuestionnaireTitle);
  const janesAssessment = await recordHref(page, '/app/assessments', ownerAssessmentNumber);
  const journeyPages: { role: SignInRole; route: string; surface: string; expected: SettledExpectation }[] = [
    { role: 'Requestor', route: '/app/requests', surface: 'My Requests', expected: myRequests },
    { role: 'Requestor', route: janesQuestionnaire, surface: 'the questionnaire', expected: { url: routeUrl(janesQuestionnaire), title: 'Questionnaire | IdamBox CSRM', heading: releasedQuestionnaireTitle } },
    { role: 'Requestor', route: janesAssessment, surface: 'the released assessment', expected: { url: routeUrl(janesAssessment), title: 'Released Risk Assessment | IdamBox CSRM', heading: 'Released risk assessment' } },
  ];
  await switchActor(page, 'Security Analyst');
  const analystAssessment = await recordHref(page, '/app/review/assessments', analystAssessmentNumber);
  journeyPages.push(
    { role: 'Security Analyst', route: analystAssessment, surface: 'the risk assessment editor', expected: { url: routeUrl(analystAssessment), title: 'Risk Assessment Review | IdamBox CSRM', heading: 'Risk assessment review' } },
    { role: 'Security Analyst', route: '/app/risks', surface: 'the Risk Register', expected: riskRegister },
    { role: 'Security Analyst', route: '/app/admin/risk-types/import', surface: 'the CSV import', expected: { url: /\/app\/admin\/risk-types\/import$/, title: 'Import Risk Types CSV | IdamBox CSRM', heading: 'Import Risk Types from CSV' } },
  );

  const measured: string[] = [];
  let actor: SignInRole = 'Security Analyst';
  for (const role of ['Requestor', 'Security Analyst'] as const) {
    if (actor !== role) {
      await switchActor(page, role);
      actor = role;
    }
    for (const journeyPage of journeyPages.filter((candidate) => candidate.role === role)) {
      for (const width of widths) {
        const label = `${journeyPage.surface} at ${width}px`;
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.goto(journeyPage.route);
        await expectSettled(page, journeyPage.expected, label);
        const stops = await expectTabStopsNeverObscured(page, label);
        await expectTextSpacingLosesNothing(page, label);
        measured.push(`${label}: ${stops.checked} Tab presses clear${stops.endOfPage ? ' (then Tab left the page)' : ''}, text spacing kept`);
      }
      // WCAG 1.4.10 Reflow: at 320 CSS px the page scrolls in one direction only.
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(journeyPage.route);
      await expectSettled(page, journeyPage.expected, `${journeyPage.surface} at 320px`);
      await expect.poll(
        () => page.evaluate(() => document.documentElement.scrollWidth),
        { message: `${journeyPage.surface} reflows into 320px with no horizontal page scroll` },
      ).toBeLessThanOrEqual(320);
      measured.push(`${journeyPage.surface} at 320px: no horizontal scroll`);
    }
  }
  test.info().annotations.push({ type: 'focus, reflow and text spacing', description: measured.join('; ') });
  console.log(`accessibility: ${measured.join('; ')}`);
  await expectNoCspViolations(page, 'the focus, reflow and text-spacing proofs');
});

/*
 * 10-23 walkthrough fix 8 (axe aria-dialog-name, serious): every record picker, owner combobox and relation
 * search keeps focus in its input and reaches its options through aria-activedescendant, so its popup is a
 * listbox (ARIA APG combobox pattern), never an unnamed dialog. Each list is opened by typing a search, scanned
 * open at 1440 and 375 (WCAG tags, Label in Name and best practice, failing on any serious or critical
 * violation), and closed with Escape without choosing, so no record changes. More filters, which does take
 * focus, is a dialog named by its title.
 */
const openPopups = (page: Page) => page.locator('[data-slot="popover-content"][data-state="open"]');

/*
 * The route scan plus axe's best-practice rules. `aria-dialog-name`, which the pilot's scan reported, is a
 * best-practice rule, so the WCAG tags alone never run it; the result's record of what ran is checked.
 */
async function scanWithBestPractice(page: Page): Promise<AxeResults> {
  const results = await new AxeBuilder({ page })
    .options({ rules: { 'label-content-name-mismatch': { enabled: true } } })
    .withTags([...wcagTags, 'best-practice'])
    .analyze();
  const ran = [...results.passes, ...results.violations, ...results.incomplete, ...results.inapplicable].map(({ id }) => id);
  expect(ran, 'the scan runs aria-dialog-name').toContain('aria-dialog-name');
  expect(ran, 'the scan runs Label in Name').toContain('label-content-name-mismatch');
  return results;
}

async function expectOpenListAccessible(page: Page, combobox: Locator, search: string, label: string): Promise<string> {
  await combobox.scrollIntoViewIfNeeded();
  await combobox.fill(search);
  // Within the listbox: More filters holds native selects, whose options are never visible.
  const option = openPopups(page).getByRole('listbox').getByRole('option').first();
  await expect(option, `${label} lists options for "${search}"`).toBeVisible();
  const { violations } = await scanWithBestPractice(page);
  const blocking = violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(blocking, `${label} with its list open has no serious or critical axe violation (${summarise(violations)})`).toEqual([]);
  const popup = openPopups(page).filter({ has: page.getByRole('listbox') });
  await expect(popup, `${label} opens one listbox popup`).toHaveCount(1);
  await expect(popup, `${label}: the popup that positions the listbox is not a dialog`).not.toHaveAttribute('role', 'dialog');
  await expect(combobox, `${label}: the combobox declares a listbox popup`).toHaveAttribute('aria-haspopup', 'listbox');
  await expect(combobox, `${label}: the combobox controls the open listbox`).toHaveAttribute('aria-controls', (await popup.getByRole('listbox').getAttribute('id'))!);
  await expect(combobox, `${label}: focus stays in the input`).toBeFocused();
  await combobox.press('Escape');
  await expect(openPopups(page).getByRole('listbox'), `${label}: Escape closes the list without choosing`).toHaveCount(0);
  return `${label}: ${violations.length === 0 ? 'no violations' : summarise(violations)}`;
}

test('picker lists pass axe while open at 1440 and 375', async ({ page }) => {
  test.setTimeout(600_000);
  await attachCspCollector(page);
  await signInAs(page, 'Security Analyst');
  const results: string[] = [];
  const editableAssessment = await recordHref(page, '/app/review/assessments', 'ASM-E2E-P7-MUTABLE-001');
  const risk = await recordHref(page, '/app/risks', mutableRiskNumber);

  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });

    // The assessment editor: the system, asset and owner pickers on a Risk, and the Control and Control owner pickers.
    await page.goto(editableAssessment);
    await expectSettled(page, { url: routeUrl(editableAssessment), title: 'Risk Assessment Review | IdamBox CSRM', heading: 'Risk assessment review' }, `the assessment editor at ${width}px`);
    const identifiedRisks = page.getByRole('region', { name: 'Identified Risks' });
    const riskForm = identifiedRisks.locator('form').first();
    for (const [name, search] of [['Information system impacted', 'Customer'], ['Information asset impacted', 'Customer'], ['Risk owner', 'Bob']] as const) {
      results.push(await expectOpenListAccessible(page, riskForm.getByRole('combobox', { name, exact: true }), search, `assessment editor ${name} at ${width}px`));
    }
    if (await identifiedRisks.getByRole('combobox', { name: 'Control', exact: true }).count() === 0) {
      await identifiedRisks.getByRole('button', { name: 'Add mitigation control' }).first().click();
    }
    for (const [name, search] of [['Control', 'APP-11'], ['Control owner', 'Bob']] as const) {
      results.push(await expectOpenListAccessible(page, identifiedRisks.getByRole('combobox', { name, exact: true }).first(), search, `assessment editor ${name} at ${width}px`));
    }

    // The Risk Register detail: the edit form's pickers, then a new mitigation control's, discarded.
    await page.goto(risk);
    await expectSettled(page, { url: routeUrl(risk), title: 'Risk Details | IdamBox CSRM', heading: mutableRiskNumber }, `the Risk details at ${width}px`);
    await page.getByRole('button', { name: 'Edit risk' }).click();
    const editRisk = page.getByRole('form', { name: 'Edit Risk' });
    for (const [name, search] of [['Information system impacted', 'Customer'], ['Information asset impacted', 'Customer'], ['Risk owner', 'Bob'], ['Treatment owner', 'Bob']] as const) {
      results.push(await expectOpenListAccessible(page, editRisk.getByRole('combobox', { name, exact: true }), search, `Risk details ${name} at ${width}px`));
    }
    await page.goto(risk);
    await expectSettled(page, { url: routeUrl(risk), title: 'Risk Details | IdamBox CSRM', heading: mutableRiskNumber }, `the Risk details at ${width}px`);
    await page.getByRole('button', { name: 'Add mitigation control' }).click();
    const addForm = page.getByRole('region', { name: 'Mitigation controls' }).locator('form').last();
    for (const [name, search] of [['Control', 'APP-11'], ['Control owner', 'Bob']] as const) {
      results.push(await expectOpenListAccessible(page, addForm.getByRole('combobox', { name, exact: true }), search, `Risk details ${name} at ${width}px`));
    }
    await addForm.getByRole('button', { name: 'Discard mitigation changes' }).click();

    // The Risk Register's relation filters: in More filters at 1440, in the Filters sheet at 375.
    await page.goto('/app/risks');
    await expectSettled(page, riskRegister, `the Risk Register at ${width}px`);
    await page.getByRole('button', width === 375 ? { name: /^Filters \(\d+\)$/ } : { name: 'More filters' }).click();
    const filters = page.getByRole('dialog', { name: width === 375 ? 'Risk Register filters' : 'More filters' });
    await expect(filters, `the filters open as a named dialog at ${width}px`).toBeVisible();
    results.push(await expectOpenListAccessible(page, filters.getByRole('combobox', { name: 'Risk owner', exact: true }), 'Bob', `Risk Register Risk owner filter at ${width}px`));
    await page.keyboard.press('Escape');

    // A new request's relation searches, never submitted.
    await page.goto('/app/requests/new');
    await expectSettled(page, newRequest, `the new request at ${width}px`);
    for (const name of ['Search information systems', 'Search information assets']) {
      results.push(await expectOpenListAccessible(page, page.getByRole('combobox', { name, exact: true }), 'Customer', `new request ${name} at ${width}px`));
    }
  }
  test.info().annotations.push({ type: 'open picker scans', description: results.join('; ') });
  console.log(`accessibility: open picker scans: ${results.join('; ')}`);
  await expectNoCspViolations(page, 'the open picker scans');
});

/*
 * 10-23 Fix 8 addendum: a picker list that overflows its popover. The scans above open short lists, which fit.
 * The Risk Register's Control picker searched for `data` lists a full page of ten controls, each a title line and
 * a framework line, with the "Showing the first 10 matches" status under them. With the field mid-viewport the
 * popover has about half the viewport on either side, so at 1440x900 and 375x812 the list runs past the
 * popover's available height and the popover content scrolls (the pilot measured 552px of content in a 458px box).
 */
const overflowSearch = 'data';

/*
 * The one accepted axe exception (10-23 Fix 8 addendum). When a picker list overflows, axe reports
 * `scrollable-region-focusable` on the popover content, the element that scrolls, because nothing in it takes
 * focus. That is the ARIA APG combobox pattern with a listbox popup: focus stays on the combobox and the options
 * are reached with aria-activedescendant, each scrolled into view as it becomes active. A tabbable popup container
 * would add a Tab stop the pattern does not have and break its Tab behaviour, so it is not added. The pilot checked
 * WCAG 2.1.1 directly (ArrowDown reaches all ten options, each scrolled into view; Escape closes the list; Discard
 * returns focus to Add mitigation control), and the test below proves the same keyboard path. Only that rule, and
 * only on the open popover content that holds the listbox, is set aside: any other node it reports, and every other
 * rule, still counts.
 */
type AxeViolation = AxeResults['violations'][number];

async function withoutAcceptedPopupScroll(page: Page, violations: readonly AxeViolation[]): Promise<{ remaining: AxeViolation[]; accepted: number }> {
  const remaining: AxeViolation[] = [];
  let accepted = 0;
  for (const violation of violations) {
    if (violation.id !== 'scrollable-region-focusable') {
      remaining.push(violation);
      continue;
    }
    const nodes: AxeViolation['nodes'] = [];
    for (const node of violation.nodes) {
      const [selector] = node.target;
      const isOpenListPopup = node.target.length === 1 && typeof selector === 'string' && await page.evaluate((target) => {
        const element = document.querySelector(target);
        return element !== null
          && element.matches('[data-slot="popover-content"][data-state="open"]')
          && element.querySelector('[role="listbox"]') !== null;
      }, selector);
      if (isOpenListPopup) accepted += 1;
      else nodes.push(node);
    }
    if (nodes.length > 0) remaining.push({ ...violation, nodes });
  }
  return { remaining, accepted };
}

test('an overflowing picker list passes axe while open at 1440 and 375', async ({ page }) => {
  test.setTimeout(300_000);
  await attachCspCollector(page);
  await signInAs(page, 'Security Analyst');
  const results: string[] = [];
  const risk = await recordHref(page, '/app/risks', mutableRiskNumber);

  for (const width of widths) {
    const label = `Risk details Control searching "${overflowSearch}" at ${width}px`;
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.goto(risk);
    await expectSettled(page, { url: routeUrl(risk), title: 'Risk Details | IdamBox CSRM', heading: mutableRiskNumber }, `the Risk details at ${width}px`);
    await page.getByRole('button', { name: 'Add mitigation control' }).click();
    const addForm = page.getByRole('region', { name: 'Mitigation controls' }).locator('form').last();
    const combobox = addForm.getByRole('combobox', { name: 'Control', exact: true });
    // Mid-viewport, so neither side of the field has room for the whole list.
    await combobox.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await combobox.fill(overflowSearch);
    const popup = openPopups(page).filter({ has: page.getByRole('listbox') });
    await expect(popup.getByRole('status'), `${label} loads a full page of matches`).toContainText('Showing the first 10 matches');
    const options = popup.getByRole('listbox').getByRole('option');
    await expect(options, `${label} lists ten options`).toHaveCount(10);
    const box = await popup.evaluate((element) => ({ content: element.scrollHeight, height: element.clientHeight }));
    expect(box.content, `${label}: the list overflows its popover (${box.content}px in ${box.height}px)`).toBeGreaterThan(box.height);

    const { violations } = await scanWithBestPractice(page);
    const { remaining, accepted } = await withoutAcceptedPopupScroll(page, violations);
    const blocking = remaining.filter(({ impact }) => impact === 'serious' || impact === 'critical');
    expect(blocking, `${label} with its list open has no serious or critical axe violation beyond the accepted popup scroll (${summarise(violations)})`).toEqual([]);
    expect(accepted, `${label}: the accepted finding is the one open popover`).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${label} has no horizontal page overflow`,
    ).toBe(true);

    // WCAG 2.1.1 through the APG pattern: with focus on the combobox, ArrowDown reaches the last option.
    await expect(combobox, `${label}: focus is on the combobox`).toBeFocused();
    const count = await options.count();
    for (let press = 0; press < count; press += 1) await combobox.press('ArrowDown');
    const last = options.last();
    await expect(combobox, `${label}: ArrowDown makes the last option active`).toHaveAttribute('aria-activedescendant', (await last.getAttribute('id'))!);
    await expect(last, `${label}: the last option is the active one`).toHaveAttribute('aria-selected', 'true');
    await expect(combobox, `${label}: focus stays on the combobox`).toBeFocused();
    const placement = () => last.evaluate((option) => {
      const scroller = option.closest('[data-slot="popover-content"]');
      if (!scroller) return { inView: false, scrollTop: 0, optionBottom: 0, scrollerBottom: 0 };
      const optionBox = option.getBoundingClientRect();
      const scrollerBox = scroller.getBoundingClientRect();
      return {
        inView: optionBox.top >= scrollerBox.top - 1 && optionBox.bottom <= scrollerBox.bottom + 1,
        scrollTop: Math.round(scroller.scrollTop),
        optionBottom: Math.round(optionBox.bottom),
        scrollerBottom: Math.round(scrollerBox.bottom),
      };
    });
    await expect.poll(async () => (await placement()).inView, `${label}: the last option is scrolled into view inside the list`).toBe(true);
    const shown = await placement();
    expect(shown.scrollTop, `${label}: the list scrolled to show the last option`).toBeGreaterThan(0);
    results.push(`${label}: ${box.content}px in ${box.height}px; option ${count} active and in view (scrolled ${shown.scrollTop}px, bottom ${shown.optionBottom} of ${shown.scrollerBottom}); accepted ${accepted}; ${remaining.length === 0 ? 'no other violations' : summarise(remaining)}`);

    await combobox.press('Escape');
    await expect(openPopups(page).getByRole('listbox'), `${label}: Escape closes the list without choosing`).toHaveCount(0);
    await addForm.getByRole('button', { name: 'Discard mitigation changes' }).click();
    await expect(page.getByRole('button', { name: 'Add mitigation control' }), `${label}: Discard returns focus to Add mitigation control`).toBeFocused();
  }
  test.info().annotations.push({ type: 'overflowing picker scans', description: results.join('; ') });
  console.log(`accessibility: overflowing picker scans: ${results.join('; ')}`);
  await expectNoCspViolations(page, 'the overflowing picker scans');
});
