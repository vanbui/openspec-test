import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ readRiskHistoryAction: vi.fn() }));
vi.mock('./risk-curation-actions', () => actions);

import type { RiskHistoryEvent, RiskHistoryPage } from './risk-curation-domain';
import { RiskHistoryTrigger } from './risk-history-trigger';

/*
 * 16-UI-SPEC §8 (X-29; D-18 to D-21, UI-D21, UI-D23): a Risk's history in a code-split side sheet, read from its Server
 * Action when it opens. Entries follow X-29: label, icon, `{instant} by {name}`, the reason and source lines, and the
 * changed fields as X-24's read-only comparison under Before and After. Paging, the honest start and five states.
 */
const bob = { documentId: 'analyst-1', displayName: 'Bob Analyst' };
const base = { actor: bob, sourceKind: 'analyst' as const, aiRunId: null, proposalItem: null, reason: null, undo: false };

function event(id: string, overrides: Partial<RiskHistoryEvent>): RiskHistoryEvent {
  return { id, kind: 'updated', occurredAt: '2026-10-14T03:00:00.000Z', ...base, changes: { schemaVersion: 1, fields: [] }, ...overrides };
}

const withdrawn = event('event-3', { kind: 'withdrawn', reason: 'Proposed under the wrong Risk Type' });
const rewritten = event('event-2', {
  kind: 'updated',
  sourceKind: 'ai-run',
  aiRunId: 'run-1',
  proposalItem: 'u-risk-statement',
  changes: {
    schemaVersion: 1,
    fields: [
      { field: 'riskStatement', from: 'Files are reconciled by hand', to: 'Payment files are reconciled before upload' },
      { field: 'residualRating', from: 'High', to: 'Moderate' },
    ],
  },
});
const controlRemoved = event('event-1', {
  kind: 'control-implementation-removed',
  changes: {
    schemaVersion: 1,
    control: { documentId: 'control-1', controlNumber: 'C-12', name: 'Payment file signing' },
    fields: [
      { field: 'controlStatus', from: 'Implemented', to: null },
      { field: 'controlOwner', from: { documentId: 'person-1', label: 'Sam Owner' }, to: null },
    ],
  },
});

function page(events: RiskHistoryEvent[], { page: number = 1, pageCount = 1, total = events.length, recordedFrom = '2026-10-01T00:00:00.000Z' }: { page?: number; pageCount?: number; total?: number; recordedFrom?: string | null } = {}): { ok: true; data: RiskHistoryPage } {
  return { ok: true, data: { events, pagination: { page: number, pageSize: 25, pageCount, total }, recordedFrom } };
}

async function openHistory(user = userEvent.setup()) {
  render(<RiskHistoryTrigger ownerKey="owner-a" riskId="risk-3" riskNumber="R-3" />);
  const trigger = screen.getByRole('button', { name: 'History of R-3' });
  await user.click(trigger);
  const sheet = await screen.findByRole('dialog', { name: 'History of R-3' });
  return { sheet, trigger, user };
}

/*
 * The sheet is code-split, and its first load transforms the module: under a full parallel suite that alone can outlast a
 * find query's timeout. Loading it once here leaves each test waiting only on the sheet's own work.
 */
beforeAll(async () => {
  await import('./risk-history-sheet');
});

beforeEach(() => {
  actions.readRiskHistoryAction.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RiskHistorySheet (§8)', () => {
  it('opens with focus on its title, then lists the changes newest first with their labels, lines and comparisons', async () => {
    actions.readRiskHistoryAction.mockResolvedValue(page([withdrawn, rewritten, controlRemoved]));
    const { sheet } = await openHistory();
    const title = within(sheet).getByRole('heading', { level: 2, name: 'History of R-3' });
    await waitFor(() => expect(title).toHaveFocus());
    expect(sheet).toHaveAccessibleDescription('Every change to this risk and its mitigation controls, newest first.');
    expect(await within(sheet).findByText('3 of 3 changes')).toHaveClass('tabular-nums');
    expect(actions.readRiskHistoryAction).toHaveBeenCalledWith({ riskId: 'risk-3', page: 1, pageSize: 25 });
    const entries = within(within(sheet).getByRole('list', { name: 'Changes to R-3' })).getAllByRole('listitem').filter((item) => item.hasAttribute('data-history-entry'));
    expect(entries.map((entry) => entry.querySelector('[data-history-label]')?.textContent)).toEqual(['Risk withdrawn', 'Risk changed by a confirmed AI rewrite', 'Mitigation control taken off this risk']);
    expect(entries[0]).toHaveTextContent('Reason: “Proposed under the wrong Risk Type”');
    expect(entries[0]).toHaveTextContent(/by Bob Analyst/);
    expect(entries[0]!.querySelector('time')).toHaveAttribute('dateTime', '2026-10-14T03:00:00.000Z');
    expect(entries[0]!.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(entries[1]).toHaveTextContent('Source: AI rewrite, confirmed');
    const comparison = within(entries[1]!).getByRole('table');
    expect(within(comparison).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Field', 'Before', 'After']);
    expect(within(comparison).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Risk statement', 'Residual rating']);
    expect([...comparison.querySelectorAll('ins')].map((node) => node.textContent)).toEqual(['Payment files', 'before upload']);
    expect(within(comparison).getByLabelText('Severity: moderate (2 of 4)')).toBeInTheDocument();
    expect(entries[2]).toHaveTextContent('Control: C-12 · Payment file signing');
    expect(within(entries[2]!).getByText('Values when taken off')).toHaveClass('micro-label');
    const values = entries[2]!.querySelector('dl')!;
    expect([...values.querySelectorAll('dt')].map((node) => node.textContent)).toEqual(['Control status', 'Control owner']);
    expect([...values.querySelectorAll('dd')].map((node) => node.textContent)).toEqual(['Implemented', 'Sam Owner']);
  });

  it('shows a malformed entry in one line without failing the list', async () => {
    actions.readRiskHistoryAction.mockResolvedValue(page([withdrawn, event('event-9', { kind: 'updated', changes: null })]));
    const { sheet } = await openHistory();
    expect(await within(sheet).findByText('The details of this change couldn’t be read.')).toBeInTheDocument();
    expect(within(sheet).getByText('Risk withdrawn')).toBeInTheDocument();
    expect(within(sheet).getByText('Risk changed')).toBeInTheDocument();
    expect(within(sheet).queryByRole('table')).toBeNull();
  });

  it('Show older changes loads the next 25, keeps the list and moves focus to the first new entry', async () => {
    const first = Array.from({ length: 25 }, (_, index) => event(`event-${30 - index}`, { kind: 'withdrawn', reason: `Reason ${30 - index}` }));
    const second = Array.from({ length: 5 }, (_, index) => event(`event-${5 - index}`, { kind: 'reinstated', reason: `Reason ${5 - index}` }));
    actions.readRiskHistoryAction
      .mockResolvedValueOnce(page(first, { pageCount: 2, total: 30 }))
      .mockResolvedValueOnce(page(second, { page: 2, pageCount: 2, total: 30 }));
    const { sheet, user } = await openHistory();
    expect(await within(sheet).findByText('25 of 30 changes')).toBeInTheDocument();
    expect(within(sheet).queryByText(/History recorded from/)).toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'Show older changes' }));
    expect(actions.readRiskHistoryAction).toHaveBeenLastCalledWith({ riskId: 'risk-3', page: 2, pageSize: 25 });
    expect(await within(sheet).findByText('30 of 30 changes')).toBeInTheDocument();
    const entries = sheet.querySelectorAll('[data-history-entry]');
    expect(entries).toHaveLength(30);
    await waitFor(() => expect(entries[25]).toHaveFocus());
    expect(entries[25]).toHaveTextContent('Reason: “Reason 5”');
    expect(within(sheet).queryByRole('button', { name: 'Show older changes' })).toBeNull();
  });

  it('lists an entry the next page repeats only once, and focuses the first new one (FE3-08)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const first = Array.from({ length: 25 }, (_, index) => event(`event-${30 - index}`, { kind: 'withdrawn', reason: `Reason ${30 - index}` }));
      // A change recorded while the sheet was open shifts the pages, so page 2 begins with page 1's last entry.
      const second = Array.from({ length: 6 }, (_, index) => event(`event-${6 - index}`, { kind: 'reinstated', reason: `Reason ${6 - index}` }));
      actions.readRiskHistoryAction
        .mockResolvedValueOnce(page(first, { pageCount: 2, total: 30 }))
        .mockResolvedValueOnce(page(second, { page: 2, pageCount: 2, total: 31 }));
      const { sheet, user } = await openHistory();
      await within(sheet).findByText('25 of 30 changes');
      await user.click(within(sheet).getByRole('button', { name: 'Show older changes' }));

      expect(await within(sheet).findByText('30 of 31 changes')).toBeInTheDocument();
      const entries = sheet.querySelectorAll('[data-history-entry]');
      expect(entries).toHaveLength(30);
      expect(new Set([...entries].map((entry) => entry.id)).size).toBe(30);
      await waitFor(() => expect(entries[25]).toHaveFocus());
      expect(entries[25]).toHaveTextContent('Reason: “Reason 5”');
      expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('ends the last page with the honest start when no Risk added entry is listed', async () => {
    actions.readRiskHistoryAction.mockResolvedValue(page([withdrawn], { recordedFrom: '2026-10-01T00:00:00.000Z' }));
    const { sheet } = await openHistory();
    expect(await within(sheet).findByText('History recorded from 1 Oct 2026. Earlier changes to this risk weren’t recorded.')).toBeInTheDocument();
  });

  it('shows no honest start once the list holds the Risk added entry', async () => {
    actions.readRiskHistoryAction.mockResolvedValue(page([withdrawn, event('event-0', { kind: 'created', changes: { schemaVersion: 1, fields: [] } })]));
    const { sheet } = await openHistory();
    expect(await within(sheet).findByText('Risk added')).toBeInTheDocument();
    expect(within(sheet).queryByText(/History recorded from/)).toBeNull();
  });

  it('shows a skeleton only after 300 ms while the history loads', async () => {
    vi.useFakeTimers();
    actions.readRiskHistoryAction.mockImplementation(() => new Promise(() => undefined));
    render(<RiskHistoryTrigger ownerKey="owner-a" riskId="risk-3" riskNumber="R-3" />);
    fireEvent.click(screen.getByRole('button', { name: 'History of R-3' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const sheet = screen.getByRole('dialog', { name: 'History of R-3' });
    expect(within(sheet).queryByRole('status', { name: 'Loading the history' })).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(within(sheet).queryByRole('status', { name: 'Loading the history' })).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(within(sheet).getByRole('status', { name: 'Loading the history' })).toBeInTheDocument();
  });

  it('says No changes recorded yet when there are none', async () => {
    actions.readRiskHistoryAction.mockResolvedValue(page([], { total: 0, pageCount: 0, recordedFrom: null }));
    const { sheet } = await openHistory();
    expect(await within(sheet).findByText('No changes recorded yet')).toBeInTheDocument();
    expect(within(sheet).getByText('Changes to this risk are listed here from now on.')).toBeInTheDocument();
  });

  it('offers Try again on an error, which reads the history again with focus on the title', async () => {
    actions.readRiskHistoryAction
      .mockResolvedValueOnce({ ok: false, kind: 'retryable', status: 503, message: 'We couldn’t load the history', detail: 'Please try again. If the problem continues, contact your administrator.' })
      .mockResolvedValueOnce(page([withdrawn]));
    const { sheet, user } = await openHistory();
    const alert = await within(sheet).findByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load the history');
    expect(alert).toHaveTextContent('Please try again. If the problem continues, contact your administrator.');
    await user.click(within(sheet).getByRole('button', { name: 'Try again' }));
    expect(await within(sheet).findByText('Risk withdrawn')).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { level: 2, name: 'History of R-3' })).toHaveFocus();
  });

  it('says a thrown read failed, with Try again', async () => {
    actions.readRiskHistoryAction.mockRejectedValue(new Error('fetch failed'));
    const { sheet } = await openHistory();
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('We couldn’t load the history');
    expect(within(sheet).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('403: says the viewer has no access, naming no role, with no Try again', async () => {
    actions.readRiskHistoryAction.mockResolvedValue({ ok: false, kind: 'blocked', status: 403, message: 'You don’t have access to this history', detail: 'Ask a Security Analyst working on this assessment if you need to see how this risk changed.' });
    const { sheet } = await openHistory();
    expect(await within(sheet).findByText('You don’t have access to this history')).toBeInTheDocument();
    expect(within(sheet).getByText('Ask a Security Analyst working on this assessment if you need to see how this risk changed.')).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('404: says the history isn’t available', async () => {
    actions.readRiskHistoryAction.mockResolvedValue({ ok: false, kind: 'blocked', status: 404, message: 'This risk’s history isn’t available.' });
    const { sheet } = await openHistory();
    expect(await within(sheet).findByText('This risk’s history isn’t available.')).toBeInTheDocument();
  });

  it('Escape closes it and returns focus to History', async () => {
    actions.readRiskHistoryAction.mockResolvedValue(page([withdrawn]));
    const { sheet, trigger, user } = await openHistory();
    await within(sheet).findByText('Risk withdrawn');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('offers Close history, and Show in AI proposals for an added proposal while it is listed', async () => {
    const added = event('event-5', { kind: 'created', sourceKind: 'ai-run', aiRunId: 'run-2', proposalItem: 's-1' });
    actions.readRiskHistoryAction.mockResolvedValue(page([added]));
    render(<RiskHistoryTrigger ownerKey="owner-a" proposalHref={(entry) => (entry.aiRunId === 'run-2' ? '#ai-proposal-run-2-s-1' : null)} riskId="risk-3" riskNumber="R-3" />);
    fireEvent.click(screen.getByRole('button', { name: 'History of R-3' }));
    const sheet = await screen.findByRole('dialog', { name: 'History of R-3' });
    expect(await within(sheet).findByText('Source: proposed risk, added by Bob Analyst')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Show in AI proposals' })).toHaveAttribute('href', '#ai-proposal-run-2-s-1');
    expect(within(sheet).getByRole('button', { name: 'Close history' })).toBeInTheDocument();
  });

  it('collapses each comparison behind Show {n} changed fields in compact density, kept per person', async () => {
    actions.readRiskHistoryAction.mockResolvedValue(page([rewritten]));
    const { sheet, user } = await openHistory();
    await within(sheet).findByText('Risk changed by a confirmed AI rewrite');
    await user.click(within(within(sheet).getByRole('radiogroup', { name: 'Density' })).getByRole('radio', { name: 'Compact' }));
    expect(window.localStorage.getItem('csrm:risk-history-density:owner-a')).toBe('compact');
    expect(within(sheet).queryByRole('table')).toBeNull();
    const toggle = within(sheet).getByRole('button', { name: 'Show 2 changed fields' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(within(sheet).getByRole('button', { name: 'Hide changed fields' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(sheet).getByRole('table')).toBeInTheDocument();
  });

  it('restores the compact density the person chose', async () => {
    window.localStorage.setItem('csrm:risk-history-density:owner-a', 'compact');
    actions.readRiskHistoryAction.mockResolvedValue(page([rewritten]));
    const { sheet } = await openHistory();
    expect(await within(sheet).findByRole('button', { name: 'Show 2 changed fields' })).toBeInTheDocument();
  });

  it('renders reasons and values as text, wrapping anywhere', async () => {
    actions.readRiskHistoryAction.mockResolvedValue(page([event('event-7', { kind: 'withdrawn', reason: '<img src=x onerror=alert(1)> wrong type' })]));
    const { sheet } = await openHistory();
    const line = await within(sheet).findByText('Reason: “<img src=x onerror=alert(1)> wrong type”');
    expect(line).toHaveClass('[overflow-wrap:anywhere]');
    expect(sheet.querySelector('img')).toBeNull();
  });

  it('is loaded on demand through next/dynamic, and neither module imports zod', () => {
    const trigger = readFileSync(resolve(process.cwd(), 'src/features/risk-curation/risk-history-trigger.tsx'), 'utf8');
    const sheet = readFileSync(resolve(process.cwd(), 'src/features/risk-curation/risk-history-sheet.tsx'), 'utf8');
    expect(trigger).toContain("from 'next/dynamic'");
    expect(trigger).toMatch(/import\('\.\/risk-history-sheet'\)/);
    expect(trigger).not.toMatch(/^import [^\n]*from '\.\/risk-history-sheet'/m);
    for (const source of [trigger, sheet]) {
      expect(source).not.toMatch(/from ['"]zod['"]/);
    }
    expect(sheet).toContain('FieldComparison');
  });
});

describe('the history sheet’s read', () => {
  it('reads again each time it opens', async () => {
    actions.readRiskHistoryAction.mockResolvedValue(page([withdrawn]));
    const { sheet, trigger, user } = await openHistory();
    await within(sheet).findByText('Risk withdrawn');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => { await user.click(trigger); });
    await screen.findByRole('dialog', { name: 'History of R-3' });
    await waitFor(() => expect(actions.readRiskHistoryAction).toHaveBeenCalledTimes(2));
  });
});
