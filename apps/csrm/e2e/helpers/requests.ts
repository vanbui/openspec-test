import { expect, type Page } from '@playwright/test';

/**
 * Scope is chosen by searching now, not by ticking an enumerated list.
 */
export async function chooseRelation(page: Page, label: string): Promise<void> {
  const group = page.getByRole('group', { name: label });
  const combobox = group.getByRole('combobox', { name: `Search ${label.toLowerCase()}` });
  await combobox.fill('e');
  const selected = group.getByRole('list', { name: `Selected ${label}` });
  // Enter takes the first match and is a no-op until the debounced search has
  // returned, so press until a selection lands. This is also the keyboard path
  // a person without a pointer uses.
  await expect(async () => {
    await combobox.press('Enter');
    await expect(selected.getByRole('listitem')).not.toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

export type SubmittedRequestInput = {
  title: string;
  assessmentType: 'BAU' | 'Project' | 'Other';
  businessCriticality: 'Low' | 'Moderate' | 'High' | 'Critical';
  /** A `YYYY-MM-DD` calendar date, or null to leave the due date empty. */
  dueDate: string | null;
};

export type SubmittedRequest = { requestNumber: string; documentId: string };

/**
 * Creates and submits a request through the UI, as a Requestor would (D-56): the page must already be signed in
 * as a Requestor. It fills the fields the Requestor journey fills before it submits, plus the due date, saves the
 * draft, submits it from the request page, and returns the request number the page header shows and the document
 * id from the URL. Each caller names its own title, so a journey that runs in both projects creates its own record.
 */
export async function createSubmittedRequest(page: Page, input: SubmittedRequestInput): Promise<SubmittedRequest> {
  const request = await createCompleteDraftRequest(page, input);
  await submitRequestFromItsPage(page);
  return request;
}

/**
 * Saves, through the UI, a draft with every field a submission needs, and leaves the page on that draft. The
 * caller submits it later with submitRequestFromItsPage, so a journey can read what the draft changes first.
 */
export async function createCompleteDraftRequest(page: Page, input: SubmittedRequestInput): Promise<SubmittedRequest> {
  await page.goto('/app/requests/new');
  await expect(page.getByRole('textbox', { name: 'Request title' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Request title' }).fill(input.title);
  await page.getByRole('textbox', { name: 'Description' }).fill(`Assessment requested for ${input.title}.`);
  await page.getByRole('combobox', { name: 'Assessment type' }).selectOption(input.assessmentType);
  await page.getByRole('textbox', { name: 'Division' }).fill('Digital Services');
  await page.getByRole('textbox', { name: 'Business unit' }).fill('Customer Platforms');
  await page.getByRole('textbox', { name: 'Business purpose' }).fill('Expand secure online customer services.');
  await page.getByRole('combobox', { name: 'Business criticality' }).selectOption(input.businessCriticality);
  await page.getByRole('checkbox', { name: 'Third-party involvement' }).check();
  await page.getByRole('textbox', { name: 'Third-party details' }).fill(`Hosting partner operates the platform for ${input.title}`);
  await page.getByRole('textbox', { name: 'Regulatory requirements' }).fill(`Privacy Act 1988 obligations for ${input.title}`);
  /*
   * By role, as every other field here: on a first load React can client-render the form before the streamed one
   * arrives, and the late segment then stays in the page in a hidden `<div hidden id="S:…">` with a second
   * `dueDate` input. A label query also matches hidden elements and fails strict mode on that pair.
   */
  if (input.dueDate) await page.getByRole('textbox', { name: 'Due date', exact: true }).fill(input.dueDate);
  await chooseRelation(page, 'Information systems');
  await chooseRelation(page, 'Information assets');
  await page.getByRole('button', { name: 'Save draft' }).click();

  // `new` would also satisfy a bare single-segment pattern while the redirect is still in flight.
  await expect(page).toHaveURL(/\/app\/requests\/(?!new$)[^/]+$/);
  const documentId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
  await expect(page.getByRole('heading', { level: 1, name: input.title })).toBeVisible();
  const requestNumber = (await page.locator('.page-header p').first().textContent())?.trim() ?? '';
  expect(requestNumber, 'CREATED_REQUEST_NUMBER').toMatch(/^RAR-\d{4}-[A-Z0-9]+$/);
  return { requestNumber, documentId };
}

/** Submits the request whose page is open, through its actions region and the confirmation (the page must show it). */
export async function submitRequestFromItsPage(page: Page): Promise<void> {
  // Act only inside the request page's actions region: the edit form carries a Submit request trigger of its own.
  const requestActions = page.getByRole('region', { name: 'Request actions' });
  await expect(requestActions).toBeVisible();
  await requestActions.getByRole('button', { name: 'Submit request' }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Submit this assessment request?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByText('Request submitted.')).toBeVisible();
  await expect(requestActions.getByText('Submitted', { exact: true })).toBeVisible();
}

export type DraftRequest = { requestNumber: string; documentId: string };

/**
 * Creates a draft request through the UI, as a Requestor would (D-56), and leaves it unsubmitted: the page must
 * already be signed in as a Requestor. A draft needs only its title (requestDraftSchema), so the helper fills the
 * title and a description, presses Save draft, and returns the request number the page header shows and the
 * document id from the URL. Each caller names its own title, so a journey that runs in both projects creates its
 * own record.
 */
export async function createDraftRequest(page: Page, input: { title: string }): Promise<DraftRequest> {
  await page.goto('/app/requests/new');
  const title = page.getByRole('textbox', { name: 'Request title' });
  await expect(title).toBeVisible();
  await title.fill(input.title);
  await page.getByRole('textbox', { name: 'Description' }).fill(`Draft assessment request for ${input.title}.`);
  await page.getByRole('button', { name: 'Save draft' }).click();

  // `new` would also satisfy a bare single-segment pattern while the redirect is still in flight.
  await expect(page).toHaveURL(/\/app\/requests\/(?!new$)[^/]+$/);
  const documentId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
  await expect(page.getByRole('heading', { level: 1, name: input.title })).toBeVisible();
  const requestNumber = (await page.locator('.page-header p').first().textContent())?.trim() ?? '';
  expect(requestNumber, 'CREATED_DRAFT_NUMBER').toMatch(/^RAR-\d{4}-[A-Z0-9]+$/);

  return { requestNumber, documentId };
}
