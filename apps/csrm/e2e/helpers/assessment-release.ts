import { expect, type Locator, type Page } from '@playwright/test';

export async function selectOwner(ownerPicker: Locator): Promise<void> {
  await ownerPicker.fill('Jane');
  await ownerPicker.page().getByRole('option', { name: 'Jane Doe' }).click();
}

/*
 * WR-401: a review decision on AI proposals is a Server Action, which answers HTTP 200 even when Strapi refuses it, so a
 * journey judges each decision by its own outcome (12-UI-SPEC §6.1): its success toast shows, and no danger toast does.
 * A toast Sonner is removing still matches its text for a moment, so only toasts it keeps are read.
 */
export async function expectDecisionRecorded(page: Page, toastText: string, decision: string): Promise<Locator> {
  const toast = page.locator('[data-sonner-toast]:not([data-removed="true"])').filter({ hasText: toastText });
  await expect(toast, `WR-401: ${decision} is recorded (“${toastText}”)`).toBeVisible();
  await expect(page.locator('[data-sonner-toast][data-type="error"]'), `WR-401: ${decision} raises no danger toast`).toHaveCount(0);
  return toast;
}

/**
 * 12-UI-SPEC §6.1: the success toast of the Confirm remaining button named `name`, whose name gives the count and the
 * record: `Confirm remaining ({n}) on {risk number}` or `… in the assessment details` reads
 * `{n} AI-proposed {field|fields} confirmed on {risk number}.` or `… in the assessment details.`
 */
export function confirmRemainingToastText(name: string): string {
  const match = /^Confirm remaining \((\d+)\) (on \S+|in the assessment details)$/.exec(name);
  if (!match) throw new Error(`CONFIRM_REMAINING_NAME_UNREADABLE:${name}`);
  const count = Number(match[1]);
  return `${count} AI-proposed ${count === 1 ? 'field' : 'fields'} confirmed ${match[2]}.`;
}

/**
 * Completes the release fields of the Risk form at `index` in the editor's Identified Risks region and saves it,
 * then reloads and checks the save persisted. Shared by the release journey and the Phase 12 AI journey.
 */
export async function completeRiskForRelease(
  page: Page,
  index: number,
  treatmentAction: 'Accept' | 'Treat',
): Promise<void> {
  const riskForm = page.getByRole('region', { name: 'Identified Risks' }).locator('form').nth(index);
  await riskForm.getByRole('textbox', { name: 'Inherent likelihood' }).fill('Likely');
  await riskForm.getByRole('textbox', { name: 'Highest inherent consequence' }).fill('Major');
  await riskForm.getByRole('textbox', { name: 'Residual likelihood' }).fill('Possible');
  await riskForm.getByRole('textbox', { name: 'Highest residual consequence' }).fill('Moderate');
  await selectOwner(riskForm.getByRole('combobox', { name: 'Risk owner' }));
  await riskForm.getByRole('combobox', { name: 'Treatment action' }).selectOption(treatmentAction);
  await riskForm.getByRole('textbox', { name: 'Target date' }).fill('2027-08-30');

  if (treatmentAction === 'Treat') {
    await riskForm.getByRole('textbox', { name: 'Treatment plan' }).fill('Implement and verify the selected reusable mitigation control.');
    await selectOwner(riskForm.getByRole('combobox', { name: 'Treatment owner' }));
    await riskForm.getByRole('textbox', { name: 'Treatment resolve date' }).fill('2027-06-30');
  }

  const saveResponse = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().includes('/app/review/assessments/'));
  await riskForm.getByRole('button', { name: 'Save risk' }).click();
  expect((await saveResponse).ok(), `ASSESS-03 risk ${index + 1} persisted`).toBe(true);
  // D-33, UI-SPEC §13.4: the save confirms beside Save risk with the local time, in its polite region.
  await expect(
    riskForm.getByRole('status').filter({ hasText: /^Risk saved at / }),
    `ASSESS06_RISK_SAVE_CONFIRMED risk ${index + 1} confirms the save with its time`,
  ).toBeVisible();
  await page.reload();
  await expect(riskForm.getByRole('combobox', { name: 'Treatment action' })).toHaveValue(treatmentAction);
  await expect(page.getByRole('list', { name: 'Release requirements' }), `ASSESS-03 risk ${index + 1} retains the complete readiness checklist`).toBeVisible();
}
