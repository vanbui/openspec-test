import { expect, type Page } from '@playwright/test';

/*
 * The Content-Security-Policy violation collector (D-19). Attach it before the first navigation;
 * it then sees every document the page loads.
 *
 * Two independent signals:
 * - every `securitypolicyviolation` event, which the browser dispatches for each blocked script,
 *   style, image, font, connection, frame or form target. An init script records it in
 *   `window.__cspViolations` (the current document) and reports it to the test through a binding, so
 *   a violation on a document the test has since left still counts;
 * - every console message about the policy. Chromium words a block as "Refused to …" in older
 *   releases and "… violates the following Content Security Policy directive …" since (the
 *   Chromium 145 the suite runs uses the second), so both wordings are collected.
 *
 * Either list being non-empty fails `expectNoCspViolations`.
 */

type CspWindow = Window & { __cspViolations?: string[]; __csrmReportCspViolation?: (violation: string) => void };
type Collected = { violations: string[]; refusals: string[] };

const collected = new WeakMap<Page, Collected>();
const cspConsoleMessage = /Refused to|Content Security Policy/i;

export async function attachCspCollector(page: Page): Promise<void> {
  if (collected.has(page)) return;
  const lists: Collected = { violations: [], refusals: [] };
  collected.set(page, lists);

  page.on('console', (message) => {
    const text = message.text();
    if (cspConsoleMessage.test(text)) lists.refusals.push(`${message.type()}: ${text}`);
  });
  await page.exposeBinding('__csrmReportCspViolation', ({ frame }, violation: string) => {
    lists.violations.push(`${violation} (on ${frame.url()})`);
  });
  await page.addInitScript(() => {
    const target = window as CspWindow;
    target.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation = `${event.violatedDirective}: ${event.blockedURI || 'inline'}`;
      target.__cspViolations?.push(violation);
      target.__csrmReportCspViolation?.(violation);
    });
  });
}

/** Every violation and policy console message since the collector was attached. */
export async function readCspViolations(page: Page): Promise<Collected> {
  const lists = collected.get(page);
  if (!lists) throw new Error('CSP_COLLECTOR_NOT_ATTACHED: call attachCspCollector(page) before the first navigation');
  // A round trip to the page lets any report still in flight reach the binding first.
  const currentDocument = await page.evaluate(() => (window as CspWindow).__cspViolations ?? []).catch(() => []);
  const violations = [...lists.violations];
  for (const violation of currentDocument) {
    if (!violations.some((reported) => reported.startsWith(`${violation} (on `))) violations.push(violation);
  }
  return { violations, refusals: [...lists.refusals] };
}

export async function expectNoCspViolations(page: Page, label: string): Promise<void> {
  const { violations, refusals } = await readCspViolations(page);
  expect(violations, `${label}: no securitypolicyviolation event`).toEqual([]);
  expect(refusals, `${label}: no refused-resource console message`).toEqual([]);
}
