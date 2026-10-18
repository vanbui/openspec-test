import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExportActionResult } from '@/features/exports/export-actions';
import { EXPORT_ROW_LIMIT, exportDialogState, exportFormatHint, exportReportScopeSentence } from '@/features/exports/export-scope';
import { exportViewColumns } from '@/features/exports/export-vocabulary';
import { installTestResizeObserver } from '@/test/layout-stubs';
import { ExportButton, type ExportButtonProps } from './export-button';

const mocks = vi.hoisted(() => ({
  saveFile: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/lib/files/save-file', () => ({ saveFile: mocks.saveFile }));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess } }));

/*
 * Phase 19 X-30 (D-06, D-17, D-19, D-20): the export dialog every list reuses. Export opens it, Export file calls the
 * view's Server Action, and a file the server built is saved under the server's name with a toast naming it and its
 * rows. Every state of 19-UI-SPEC §2 is pinned here, at both widths and from the keyboard.
 */

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);
const saved: ExportActionResult = { ok: true, fileName: 'risk-register-2026-10-01.xlsx', contentType: XLSX, bytes, rowCount: 1 };

function props(overrides: Partial<ExportButtonProps> = {}): ExportButtonProps {
  return {
    heading: 'Risk register',
    view: 'risk-register',
    action: vi.fn(async () => saved),
    query: { q: 'HYPERLINK' },
    total: 1,
    searchActive: true,
    search: 'HYPERLINK',
    chips: [],
    multiplePages: false,
    ...overrides,
  };
}

beforeEach(() => {
  installTestResizeObserver();
  window.localStorage.clear();
  mocks.saveFile.mockReset();
  mocks.toastSuccess.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* Opens the dialog from its button and waits for its code. */
async function openDialog(user: ReturnType<typeof userEvent.setup>, overrides: Partial<ExportButtonProps> = {}) {
  const heading = overrides.heading ?? 'Risk register';
  const view = render(<ExportButton {...props(overrides)} />);
  await user.click(screen.getByRole('button', { name: `Export ${heading}` }));
  const dialog = await screen.findByRole('dialog', { name: `Export ${heading}` });
  return { ...view, dialog };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const exportFile = () => screen.getByRole('button', { name: /^(Export file|Exporting…)$/ });

describe('the export button and dialog (X-30)', () => {
  it('opens Export Risk register from the header and saves the server’s file with a toast naming it and its one row', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => saved);
    render(<ExportButton {...props({ action })} />);

    await user.click(screen.getByRole('button', { name: 'Export Risk register' }));
    const dialog = await screen.findByRole('dialog', { name: 'Export Risk register' });
    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Export file' }));

    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalledWith({ fileName: 'risk-register-2026-10-01.xlsx', contentType: XLSX, bytes }));
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ query: { q: 'HYPERLINK' }, format: 'xlsx' }));
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Exported risk-register-2026-10-01.xlsx', expect.objectContaining({ description: '1 row.' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('the scope sentence (§2.2)', () => {
  it('states every page and the active search for 42 risks over three pages', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user, { total: 42, multiplePages: true, searchActive: true, search: 'HYPERLINK' });

    expect(within(dialog).getByText('42 risks that match the current search and filters, in the current order: every page, not just this one.')).toBeInTheDocument();
    expect(within(dialog).getByText('Search: “HYPERLINK”')).toBeInTheDocument();
    expect(within(dialog).queryByText(/^Filters:/)).not.toBeInTheDocument();
  });

  it('states all the risks on one page with no search or filters', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user, { total: 3, multiplePages: false, searchActive: false, search: '' });

    expect(within(dialog).getByText('All 3 risks, in the current order.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/^Search:/)).not.toBeInTheDocument();
  });

  it('names the filters by their chips, joined by the middle dot, and one risk in the singular', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user, {
      total: 1,
      searchActive: false,
      search: '',
      chips: [{ label: 'Residual rating', value: 'High' }, { label: 'Stage', value: 'Released' }],
    });

    expect(within(dialog).getByText('1 risk that matches the current search and filters, in the current order.')).toBeInTheDocument();
    expect(within(dialog).getByText('Filters: Residual rating: High · Stage: Released')).toBeInTheDocument();
  });

  it('toasts one row in the singular and many in the plural', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ExportActionResult> => ({ ...saved, ok: true, rowCount: 1_234 }));
    await openDialog(user, { action });
    await user.click(exportFile());

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Exported risk-register-2026-10-01.xlsx', expect.objectContaining({ description: '1,234 rows.' })));
  });
});

describe('the column choice (§2.4, D-06)', () => {
  it('checks the eight visible columns and offers the 13 others unchecked below, in the view’s order', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);
    const columns = within(dialog).getByRole('group', { name: 'Columns' });
    const boxes = within(columns).getAllByRole('checkbox');

    expect(boxes).toHaveLength(21);
    expect(boxes.slice(0, 8).every((box) => box.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(boxes.slice(8).every((box) => box.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(within(columns).getByRole('checkbox', { name: 'Risk number' })).toBe(boxes[0]);
    expect(within(columns).getByRole('checkbox', { name: 'Stage' })).toBe(boxes[8]);
    expect(within(columns).getByText('8 of 21 columns')).toBeInTheDocument();
    expect(within(columns).queryByRole('button', { name: 'Reset to visible' })).not.toBeInTheDocument();
  });

  it('selects all and hides Select all, then resets to the visible columns', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);
    const columns = within(dialog).getByRole('group', { name: 'Columns' });

    await user.click(within(columns).getByRole('button', { name: 'Select all' }));
    expect(within(columns).getByText('21 of 21 columns')).toBeInTheDocument();
    expect(within(columns).queryByRole('button', { name: 'Select all' })).not.toBeInTheDocument();

    await user.click(within(columns).getByRole('button', { name: 'Reset to visible' }));
    expect(within(columns).getByText('8 of 21 columns')).toBeInTheDocument();
    expect(within(columns).queryByRole('button', { name: 'Reset to visible' })).not.toBeInTheDocument();
  });

  /* FE4-04 (WCAG 2.4.3): a pill removes itself when chosen, so focus moves to the other pill when it shows. */
  it('moves focus from Select all to Reset to visible, and back, when each removes itself', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);
    const columns = within(dialog).getByRole('group', { name: 'Columns' });

    within(columns).getByRole('button', { name: 'Select all' }).focus();
    await user.keyboard('{Enter}');
    expect(within(columns).getByText('21 of 21 columns')).toBeInTheDocument();
    expect(within(columns).getByRole('button', { name: 'Reset to visible' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(within(columns).getByText('8 of 21 columns')).toBeInTheDocument();
    expect(within(columns).getByRole('button', { name: 'Select all' })).toHaveFocus();
  });

  it('moves focus to the first column when the chosen pill and the other both go', async () => {
    const user = userEvent.setup();
    const every = exportViewColumns('risk-register').map((column) => column.key);
    const { dialog } = await openDialog(user, { visibleColumns: every });
    const columns = within(dialog).getByRole('group', { name: 'Columns' });

    await user.click(within(columns).getByRole('checkbox', { name: 'Stage' }));
    within(columns).getByRole('button', { name: 'Select all' }).focus();
    await user.keyboard('{Enter}');

    expect(within(columns).queryByRole('button', { name: /^(Select all|Reset to visible)$/ })).not.toBeInTheDocument();
    expect(within(columns).getByRole('checkbox', { name: 'Risk number' })).toHaveFocus();
  });

  it('sends the checked columns in the view’s order', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => saved);
    const { dialog } = await openDialog(user, { action });
    const columns = within(dialog).getByRole('group', { name: 'Columns' });

    await user.click(within(columns).getByRole('checkbox', { name: 'Stage' }));
    await user.click(within(columns).getByRole('checkbox', { name: 'Statement' }));
    await user.click(exportFile());

    await waitFor(() => expect(action).toHaveBeenCalledWith({
      query: { q: 'HYPERLINK' },
      format: 'xlsx',
      columns: ['riskNumber', 'inherentRating', 'residualRating', 'treatmentStatus', 'treatmentOwner', 'targetDate', 'assessment', 'stage'],
    }));
  });

  it('says Choose at least one column. when none is checked, and Export file is disabled and described by it', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);
    const columns = within(dialog).getByRole('group', { name: 'Columns' });

    for (const box of within(columns).getAllByRole('checkbox').slice(0, 8)) await user.click(box);

    const error = within(dialog).getByText('Choose at least one column.');
    expect(exportFile()).toBeDisabled();
    expect(exportFile().getAttribute('aria-describedby')?.split(' ')).toContain(error.closest('[id]')?.id);
  });
});

describe('the UI review (19-UI-REVIEW UI-04, UI-10)', () => {
  it('describes the Format choice by its hint, and the Columns group by its error once none is checked', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);
    expect(within(dialog).getByRole('radiogroup', { name: 'Format' })).toHaveAccessibleDescription(exportFormatHint('xlsx', 1));
    const columns = within(dialog).getByRole('group', { name: 'Columns' });

    for (const box of within(columns).getAllByRole('checkbox').slice(0, 8)) await user.click(box);

    const error = within(dialog).getByText('Choose at least one column.').closest('[id]') as HTMLElement;
    expect(columns.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    // UI-10: the error's icon sits 8px from its words, on the §3.9 scale, as the import gate line does.
    expect(error).toHaveClass('gap-2');
  });
});

describe('the states before the request (§2.5)', () => {
  it('explains an empty filtered list and disables Export file', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user, { total: 0 });

    const line = within(dialog).getByText('Nothing matches the current search and filters, so there’s nothing to export.');
    expect(exportFile()).toBeDisabled();
    expect(exportFile().getAttribute('aria-describedby')?.split(' ')).toContain(line.closest('[id]')?.id);
  });

  it('explains an empty list with no search or filters', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user, { total: 0, searchActive: false, search: '' });

    expect(within(dialog).getByText('There are no risks to export yet.')).toBeInTheDocument();
    expect(exportFile()).toBeDisabled();
  });

  it('warns over the limit before any request and disables Export file', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => saved);
    const { dialog } = await openDialog(user, { action, total: 10_001, multiplePages: true });

    const alert = within(dialog).getByRole('alert');
    expect(alert).toHaveTextContent('Too many rows to export');
    expect(alert).toHaveTextContent('10,001 risks match, and one export holds at most 10,000 rows. Narrow the search or filters, then export again.');
    expect(exportFile()).toBeDisabled();
    expect(exportFile().getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
    expect(action).not.toHaveBeenCalled();
  });

  it('keeps the dialog’s row limit equal to the server’s EXPORT_ROW_CAP', () => {
    const runExport = readFileSync(resolve(process.cwd(), '../backend/src/csrm/exports/run-export.ts'), 'utf8');
    const cap = /export const EXPORT_ROW_CAP = ([0-9_]+);/.exec(runExport)?.[1];
    expect(Number(cap?.replaceAll('_', ''))).toBe(EXPORT_ROW_LIMIT);
    expect(exportDialogState({ total: EXPORT_ROW_LIMIT, checkedColumns: 1, filtered: true })).toBe('ready');
    expect(exportDialogState({ total: EXPORT_ROW_LIMIT + 1, checkedColumns: 1, filtered: true })).toBe('over-limit');
  });
});

describe('the request (§2.6)', () => {
  it('shows Exporting… with the controls read-only and Cancel enabled, and saves nothing once cancelled', async () => {
    const user = userEvent.setup();
    const pending = deferred<ExportActionResult>();
    const action = vi.fn(() => pending.promise);
    const { dialog } = await openDialog(user, { action });

    await user.click(exportFile());
    expect(exportFile()).toHaveTextContent('Exporting…');
    // UI-01 (§2.6, WCAG 2.4.3): the pressed button keeps focus, read-only by aria-disabled, and a second press sends nothing.
    expect(exportFile()).toBeEnabled();
    expect(exportFile()).toHaveAttribute('aria-disabled', 'true');
    expect(exportFile()).toHaveFocus();
    await user.click(exportFile());
    expect(action).toHaveBeenCalledTimes(1);
    // The choices stay focusable and read-only: a press changes nothing while the file is built.
    expect(within(dialog).getByRole('radiogroup', { name: 'Format' })).toHaveAttribute('aria-readonly', 'true');
    for (const radio of within(dialog).getAllByRole('radio')) expect(radio).toBeEnabled();
    await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }));
    expect(within(dialog).getByRole('radio', { name: 'CSV (.csv)' })).toHaveAttribute('aria-checked', 'false');
    const riskNumber = within(dialog).getByRole('checkbox', { name: 'Risk number' });
    expect(riskNumber).toBeEnabled();
    expect(riskNumber).toHaveAttribute('aria-readonly', 'true');
    await user.click(riskNumber);
    expect(riskNumber).toHaveAttribute('aria-checked', 'true');
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(cancel).toBeEnabled();

    await user.click(cancel);
    await act(async () => pending.resolve(saved));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.saveFile).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('shows a 403 refusal in a danger alert, moves focus to its title and keeps every choice', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ExportActionResult> => ({ ok: false, refusal: { tone: 'danger', message: 'You don’t have access to export this list.', retry: false } }));
    const { dialog } = await openDialog(user, { action });

    await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Stage' }));
    await user.click(exportFile());

    const title = await within(dialog).findByText('You don’t have access to export this list.');
    const alert = title.closest('[data-slot="alert"]');
    expect(alert).toHaveAttribute('data-tone', 'danger');
    await waitFor(() => expect(title).toHaveFocus());
    // FE4-03 (accessibility contract 4.1.3): focus moves to the refusal, so it is not also a live region; it is read once.
    expect(alert).not.toHaveAttribute('role');
    expect(alert?.closest('[aria-live], [role="alert"], [role="status"]')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'CSV (.csv)' })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('checkbox', { name: 'Stage' })).toHaveAttribute('aria-checked', 'true');
    expect(mocks.saveFile).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('offers Try again after a failure, which sends the same format and columns', async () => {
    const user = userEvent.setup();
    const action = vi.fn<(input: unknown) => Promise<ExportActionResult>>()
      .mockResolvedValueOnce({ ok: false, refusal: { tone: 'danger', message: 'We couldn’t create the file.', retry: true } })
      .mockResolvedValueOnce(saved);
    const { dialog } = await openDialog(user, { action });

    await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Stage' }));
    await user.click(exportFile());
    await user.click(await within(dialog).findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalled());
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1]?.[0]).toEqual(action.mock.calls[0]?.[0]);
    expect(action.mock.calls[1]?.[0]).toMatchObject({ format: 'csv', columns: expect.arrayContaining(['stage']) });
  });

  /* FE4-04 (WCAG 2.4.3): Try again keeps its place while it runs, so focus never falls back to the dialog. */
  it('keeps Try again in place and focused while it runs, then focuses the new refusal', async () => {
    const user = userEvent.setup();
    const retry = deferred<ExportActionResult>();
    const failure: ExportActionResult = { ok: false, refusal: { tone: 'danger', message: 'We couldn’t create the file.', retry: true } };
    const action = vi.fn<(input: unknown) => Promise<ExportActionResult>>()
      .mockResolvedValueOnce(failure)
      .mockImplementationOnce(() => retry.promise);
    const { dialog } = await openDialog(user, { action });

    await user.click(exportFile());
    const tryAgain = await within(dialog).findByRole('button', { name: 'Try again' });
    tryAgain.focus();
    await user.keyboard('{Enter}');

    const running = within(tryAgain.closest('[data-slot="alert"]') as HTMLElement).getByRole('button', { name: 'Exporting…' });
    expect(running).toHaveFocus();
    expect(running).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Enter}');
    expect(action).toHaveBeenCalledTimes(2);

    await act(async () => retry.resolve(failure));
    await waitFor(() => expect(within(dialog).getByText('We couldn’t create the file.')).toHaveFocus());
  });

  it('shows the warning tone for a fixable refusal', async () => {
    const user = userEvent.setup();
    const message = 'This export would hold 12,500 rows, more than the 10,000 limit. Narrow the search or filters, then export again.';
    const action = vi.fn(async (): Promise<ExportActionResult> => ({ ok: false, refusal: { tone: 'warning', message, retry: false } }));
    const { dialog } = await openDialog(user, { action });

    await user.click(exportFile());

    expect((await within(dialog).findByText(message)).closest('[data-slot="alert"]')).toHaveAttribute('data-tone', 'warning');
  });

  /* The exports record's code review amendment (3b5c66fa): a refusal with a title shows it, then its sentence. */
  it('shows a titled refusal by its title, then its sentence, and focuses the title', async () => {
    const user = userEvent.setup();
    const message = 'Statement holds text longer than Excel’s 32,767-character cell limit, so the workbook would cut it. Export as CSV instead, or shorten the text in CSRM.';
    const action = vi.fn(async (): Promise<ExportActionResult> => ({ ok: false, refusal: { tone: 'warning', title: 'A value is too long for Excel', message, retry: false } }));
    const { dialog } = await openDialog(user, { action });

    await user.click(exportFile());

    const title = await within(dialog).findByText('A value is too long for Excel');
    const alert = title.closest('[data-slot="alert"]') as HTMLElement;
    await waitFor(() => expect(title).toHaveFocus());
    expect(alert).toHaveAttribute('data-tone', 'warning');
    expect(within(alert).getByText(message)).toBeInTheDocument();
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('treats an action that cannot be reached as the failed file, with Try again', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ExportActionResult> => {
      throw new Error('network');
    });
    const { dialog } = await openDialog(user, { action });

    await user.click(exportFile());

    expect(await within(dialog).findByText('We couldn’t create the file.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    // FE4-15: S1's failed-file row has one source, export-refusal-copy.ts's EXPORT_FAILED.
    const source = readFileSync(resolve(process.cwd(), 'src/components/csrm/export/export-dialog.tsx'), 'utf8');
    expect(source).toMatch(/import \{[^}]*\bEXPORT_FAILED\b[^}]*\} from '@\/features\/exports\/export-refusal-copy';/);
    expect(source).not.toContain('We couldn’t create the file.');
  });
});

describe('the keyboard (§2.6)', () => {
  it('starts focus on the checked Format segment', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);

    await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'Excel workbook (.xlsx)' })).toHaveFocus());
  });

  it('focus returns to Export Risk register when Escape closes the dialog', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Export Risk register' })).toHaveFocus();
  });

  it('focus returns to Export Risk register after a successful export', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await user.click(exportFile());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Export Risk register' })).toHaveFocus();
  });

  it('exports with Enter from within the form', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => saved);
    const { dialog } = await openDialog(user, { action });
    await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'Excel workbook (.xlsx)' })).toHaveFocus());

    await user.keyboard('{Enter}');

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});

describe('the phone sheet (§2.1)', () => {
  it('renders the phone sheet below 768px with a visible title row and Close, and Export file first', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);

    expect(dialog).toHaveAttribute('data-export-frame', 'phone-sheet');
    expect(within(dialog).getByRole('heading', { name: 'Export Risk register' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    const actions = within(dialog).getAllByRole('button').filter((button) => ['Export file', 'Cancel'].includes(button.textContent ?? ''));
    expect(actions.map((button) => button.textContent)).toEqual(['Export file', 'Cancel']);

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('renders the form dialog from 768px', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);

    expect(dialog).toHaveAttribute('data-export-frame', 'dialog');
  });
});

describe('the remembered format (§2.3)', () => {
  it('opens with CSV checked after an export with CSV', async () => {
    const user = userEvent.setup();
    const first = await openDialog(user);
    await user.click(within(first.dialog).getByRole('radio', { name: 'CSV (.csv)' }));
    await user.click(exportFile());
    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalled());
    first.unmount();

    const second = await openDialog(user);
    expect(within(second.dialog).getByRole('radio', { name: 'CSV (.csv)' })).toHaveAttribute('aria-checked', 'true');
    expect(within(second.dialog).getByText('Plain text for any tool. Excel may remove leading zeros (0042) and change date-like text when it opens a CSV.')).toBeInTheDocument();
  });

  it('falls back to XLSX when browser storage throws, without an error', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    });
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);

    expect(within(dialog).getByRole('radio', { name: 'Excel workbook (.xlsx)' })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByText('Opens in Excel with numbers, dates and leading zeros kept. Includes an “About this export” sheet.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }));
    expect(within(dialog).getByRole('radio', { name: 'CSV (.csv)' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Assigned to me (19-11)', () => {
  it('offers Assigned to unchecked, since the page shows its own requests without the column', async () => {
    const user = userEvent.setup();
    const { dialog } = await openDialog(user, {
      heading: 'Assigned to me',
      view: 'requests',
      query: { q: '', queue: 'open', assignee: 'me', sort: 'submittedDate:desc' },
      search: undefined,
      searchActive: false,
      total: 4,
      visibleColumns: ['requestNumber', 'title', 'requestor', 'assessmentType', 'businessCriticality', 'status', 'dueDate', 'ageDays', 'submittedAt'],
    });

    const columns = within(dialog).getByRole('group', { name: /Columns/ });
    expect(within(columns).getByRole('checkbox', { name: 'Assigned to' })).not.toBeChecked();
    expect(within(columns).getByRole('checkbox', { name: 'Request' })).toBeChecked();
  });
});

describe('fixed tables (§2.3, UI-D5)', () => {
  const fixedTables = [{ key: 'risks', heading: 'Risks' }, { key: 'controls', heading: 'Mitigation controls' }];

  /* Review amendment R1 part 1, rows 9 and 10: the dialog's description names only the choices the view offers. */
  it('describes a list view by its format and columns, and a fixed-table view by its format and CSV table', async () => {
    const user = userEvent.setup();
    const list = await openDialog(user);
    expect(list.dialog).toHaveAccessibleDescription('Choose the file’s format and columns, then export the file.');
    list.unmount();

    const { dialog } = await openDialog(user, { fixedTables, heading: 'ASM-2026-0001' });
    expect(dialog).toHaveAccessibleDescription('Choose the file’s format and, for a CSV, its table, then export the file.');
  });

  it('offers no column choice, says every column is included, and shows Table only while CSV is checked, keeping its choice', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => saved);
    const { dialog } = await openDialog(user, { action, fixedTables, heading: 'ASM-2026-0001' });

    expect(within(dialog).queryByRole('group', { name: 'Columns' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Every column of each table is included, as on the page.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('radiogroup', { name: 'Table' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Each table is its own sheet, followed by an “About this export” sheet.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }));
    const table = within(dialog).getByRole('radiogroup', { name: 'Table' });
    expect(within(table).getByRole('radio', { name: 'Risks' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(table).getByRole('radio', { name: 'Mitigation controls' }));

    await user.click(within(dialog).getByRole('radio', { name: 'Excel workbook (.xlsx)' }));
    expect(within(dialog).queryByRole('radiogroup', { name: 'Table' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }));
    expect(within(dialog).getByRole('radio', { name: 'Mitigation controls' })).toHaveAttribute('aria-checked', 'true');

    await user.click(exportFile());
    await waitFor(() => expect(action).toHaveBeenCalledWith({ query: { q: 'HYPERLINK' }, format: 'csv', table: 'controls' }));
  });
  it('states a report’s scope with its as-at date and tables, and exports it with no list view behind it (19-11, §2.2)', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => saved);
    const tables = [{ key: 'released-per-month', heading: 'Released per month' }, { key: 'request-lifecycle', heading: 'Assessment Requests by lifecycle state' }];
    const { dialog } = await openDialog(user, {
      action,
      chips: [],
      fixedTables: tables,
      heading: 'Assessment throughput',
      query: { period: '12' },
      scope: exportReportScopeSentence({ title: 'Assessment throughput', asAt: '24 Sept 2026', period: '12 months', tables: 2 }),
      search: undefined,
      searchActive: false,
      total: 2,
      view: 'report:assessment-throughput',
    });

    expect(within(dialog).getByText('The Assessment throughput report as at 24 Sept 2026, for 12 months, with its 2 tables.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }));
    await user.click(within(within(dialog).getByRole('radiogroup', { name: 'Table' })).getByRole('radio', { name: 'Assessment Requests by lifecycle state' }));
    await user.click(exportFile());
    await waitFor(() => expect(action).toHaveBeenCalledWith({ query: { period: '12' }, format: 'csv', table: 'request-lifecycle' }));
  });

  it('words a report without a period', () => {
    expect(exportReportScopeSentence({ title: 'Risk exposure', asAt: '24 Sept 2026', tables: 4 })).toBe('The Risk exposure report as at 24 Sept 2026, with its 4 tables.');
  });
});
