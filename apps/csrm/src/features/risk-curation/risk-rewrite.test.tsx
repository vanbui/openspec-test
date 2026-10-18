import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Action } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  startRiskSuggestionsAction: vi.fn(),
  startRiskRewriteAction: vi.fn(),
  readRiskProposalJobAction: vi.fn(),
  retryRiskProposalJobAction: vi.fn(),
  readRiskAiProposalsAction: vi.fn(),
  decideRiskProposalsAction: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('./risk-curation-actions', () => actions);
vi.mock('sonner', () => ({ toast: notifications }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { readSessionDraft } from '@/lib/session-drafts/session-drafts';
import { installTestResizeObserver } from '@/test/layout-stubs';
import { RewriteForm } from './rewrite-form';
import { RiskRewriteSection } from './risk-rewrite';
import type { RiskAiProposalItem, RiskAiRunFacts, RiskProposalJob } from './risk-curation-domain';
import { causeChangeFixture, residualChangeFixture, rewriteJobFixture, rewriteRunFixture, statementChangeFixture } from './test-fixtures';

const run = rewriteRunFixture as unknown as RiskAiRunFacts;
const statement = statementChangeFixture as unknown as RiskAiProposalItem;
const cause = causeChangeFixture as unknown as RiskAiProposalItem;
const residual = residualChangeFixture as unknown as RiskAiProposalItem;
const queued = rewriteJobFixture as unknown as RiskProposalJob;
const risk = { id: 'r3', riskNumber: 'R-3', values: { residualRating: 'High', residualLikelihood: 'Likely', highestResidualConsequence: 'Major', treatmentPlan: 'Sign every file' }, controlImplementations: [] };
const applied = { ok: true, data: { applied: 1, unchanged: 0 } };

const successCall = (message: string) => notifications.success.mock.calls.find((call) => call[0] === message);
const actionOf = (call: unknown[] | undefined): Action | undefined => (call?.[1] as { action?: Action } | undefined)?.action;
const tableLayout = () => document.querySelector<HTMLElement>('[data-comparison-layout="table"]')!;
const stackedLayout = () => document.querySelector<HTMLElement>('[data-comparison-layout="stacked"]')!;

function phoneWidth() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 767px)', media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
}

function Card({ items = [statement, cause, residual], job = null, unsaved = false }: { items?: readonly RiskAiProposalItem[]; job?: RiskProposalJob | null; unsaved?: boolean }) {
  return (
    <article id="risk-r3">
      <label htmlFor="r3-statement">Risk statement</label>
      <textarea id="r3-statement" />
      <RiskRewriteSection assessmentId="a1" formHasUnsavedChanges={unsaved} items={items} job={job} ownerKey="owner-a" requestId="request-1" risk={risk} run={run} viewer={{ documentId: 'analyst-1', displayName: 'Morgan Analyst' }} />
    </article>
  );
}

beforeEach(() => {
  for (const mock of [...Object.values(actions), refresh, notifications.success, notifications.error, notifications.dismiss]) mock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('Rewrite this risk (16-UI-SPEC §4.1; D-34, UI-D20)', () => {
  beforeEach(() => installTestResizeObserver());

  it('opens a popover from 768px with focus in the instruction, and Escape keeps the risk as is', async () => {
    render(<RewriteForm assessmentId="a1" onStarted={vi.fn()} openChanges={0} ownerKey="owner-a" riskId="r3" riskNumber="R-3" />);
    const trigger = screen.getByRole('button', { name: 'Rewrite this risk: R-3' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('data-print', 'hidden');
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Rewrite R-3' });
    expect(dialog).toHaveAttribute('data-rewrite-form', 'popover');
    const field = await within(dialog).findByLabelText('Instruction for the AI (optional)');
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(within(dialog).getByText('Say what to change, for example “Make it specific to unsigned payment files”. The AI reads this risk, its mitigation controls, the other risks and the request. It never changes owners, dates or statuses.')).toBeInTheDocument();
    fireEvent.keyDown(field, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(actions.startRiskRewriteAction).not.toHaveBeenCalled();
  });

  it('opens a bottom sheet below 768px', async () => {
    phoneWidth();
    render(<RewriteForm assessmentId="a1" onStarted={vi.fn()} openChanges={0} ownerKey="owner-a" riskId="r3" riskNumber="R-3" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite this risk: R-3' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rewrite R-3' });
    expect(dialog).toHaveAttribute('data-rewrite-form', 'sheet');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('asks for the checked parts, says when none is checked, and names the open changes a new rewrite replaces', async () => {
    const onStarted = vi.fn();
    actions.startRiskRewriteAction.mockResolvedValue({ ok: true, data: queued });
    render(<RewriteForm assessmentId="a1" onStarted={onStarted} openChanges={2} ownerKey="owner-a" riskId="r3" riskNumber="R-3" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite this risk: R-3' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rewrite R-3' });
    const group = await within(dialog).findByRole('group', { name: 'What to rewrite' });
    expect(within(dialog).getByText('This risk already has 2 open AI changes. A new rewrite replaces them when it’s ready.')).toBeInTheDocument();
    const parts = ['Statement and cause', 'Ratings', 'Treatment'].map((name) => within(group).getByRole('checkbox', { name }));
    for (const part of parts) expect(part).toBeChecked();
    for (const part of parts) fireEvent.click(part);
    expect(within(dialog).getByText('Choose at least one part to rewrite.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rewrite risk' }));
    expect(actions.startRiskRewriteAction).not.toHaveBeenCalled();
    fireEvent.click(parts[0]!);
    fireEvent.click(parts[1]!);
    fireEvent.change(within(dialog).getByLabelText('Instruction for the AI (optional)'), { target: { value: 'Make it specific to unsigned payment files' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rewrite risk' }));
    await waitFor(() => expect(actions.startRiskRewriteAction).toHaveBeenCalledExactlyOnceWith({ assessmentId: 'a1', riskId: 'r3', instruction: 'Make it specific to unsigned payment files', focus: ['statement', 'ratings'] }));
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(queued));
  });

  it('shows a refusal of the parts under What to rewrite by the field it names, not by its words (FE4-11)', async () => {
    actions.startRiskRewriteAction.mockResolvedValue({ ok: false, kind: 'field', field: 'focus', status: 400, message: 'A part refusal in other words.' });
    render(<RewriteForm assessmentId="a1" onStarted={vi.fn()} openChanges={0} ownerKey="owner-a" riskId="r3" riskNumber="R-3" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite this risk: R-3' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rewrite R-3' });
    const group = await within(dialog).findByRole('group', { name: 'What to rewrite' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rewrite risk' }));
    expect(await within(group).findByRole('alert')).toHaveTextContent('A part refusal in other words.');
    expect(within(dialog).getByLabelText('Instruction for the AI (optional)')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the form open with its values and R2’s line when the AI cannot be asked', async () => {
    actions.startRiskRewriteAction.mockResolvedValue({ ok: false, kind: 'blocked', status: 409, reason: 'RISK_WITHDRAWN', message: 'This risk has been withdrawn, so the AI can’t rewrite it. Reinstate it first.' });
    render(<RewriteForm assessmentId="a1" onStarted={vi.fn()} openChanges={0} ownerKey="owner-a" riskId="r3" riskNumber="R-3" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite this risk: R-3' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rewrite R-3' });
    fireEvent.change(await within(dialog).findByLabelText('Instruction for the AI (optional)'), { target: { value: 'Shorter' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rewrite risk' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This risk has been withdrawn, so the AI can’t rewrite it. Reinstate it first.');
    expect(within(dialog).getByLabelText('Instruction for the AI (optional)')).toHaveValue('Shorter');
  });
});

describe('the AI rewrite section in a Risk card (§4.2, §4.3)', () => {
  it('says the AI is rewriting the risk while the job runs, then announces the changes', async () => {
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'completed', runId: 'run-w' } });
    const { rerender } = render(<Card items={[]} job={queued} />);
    const section = document.getElementById('risk-r3-rewrite')!;
    expect(section).toHaveAttribute('tabindex', '-1');
    expect(within(section).getByRole('heading', { level: 3, name: 'AI rewrite' })).toBeInTheDocument();
    expect(within(section).getByText('The AI is rewriting R-3')).toBeInTheDocument();
    expect(within(section).getByText('Rewriting…')).toBeInTheDocument();
    expect(within(section).getByText('You can leave this page. The proposed changes show here when you come back.')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(refresh).toHaveBeenCalled();
    rerender(<Card items={[statement, cause, residual]} job={null} />);
    expect(screen.getByText('AI changes to R-3 are ready to review.')).toBeInTheDocument();
  });

  it('says when the AI proposed no change, with its left-out list', async () => {
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'completed', runId: 'run-w' } });
    const nothing = { ...run, outcome: 'no-change', counts: { items: 0, open: 0 }, adjustments: [{ code: 'outside-focus', count: 1 }] } as RiskAiRunFacts;
    render(<article id="risk-r3"><RiskRewriteSection assessmentId="a1" formHasUnsavedChanges={false} items={[]} job={queued} ownerKey="owner-a" requestId={null} risk={risk} run={nothing} /></article>);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByText('The AI proposed no changes to R-3.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1 left out' }));
    expect(screen.getByText('A change outside what you asked to rewrite.')).toBeInTheDocument();
  });

  it('leaves the running state and reads the page again when the followed rewrite job is gone (FE4-01)', async () => {
    vi.useFakeTimers();
    const onJobGone = vi.fn();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: false, kind: 'blocked', status: 404, message: 'Status unavailable' });
    render(<article id="risk-r3"><RiskRewriteSection assessmentId="a1" formHasUnsavedChanges={false} items={[]} job={queued} onJobGone={onJobGone} ownerKey="owner-a" requestId={null} risk={risk} run={null} /></article>);
    expect(screen.getByText('The AI is rewriting R-3')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(onJobGone).toHaveBeenCalledWith(queued);
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText('The AI is rewriting R-3')).toBeNull();
    expect(screen.queryByText('Status unavailable')).toBeNull();
  });

  it('moves focus from the job status line to the section when the rewrite completes (FE4-08)', async () => {
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'completed', runId: 'run-w' } });
    const { rerender } = render(<Card items={[]} job={queued} />);
    act(() => screen.getByText('The AI is rewriting R-3').focus());
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    rerender(<Card items={[statement, cause, residual]} job={null} />);
    expect(document.activeElement).toBe(document.getElementById('risk-r3-rewrite'));
  });

  it('moves focus from the job status line to the failure’s title when the rewrite fails (FE4-08)', async () => {
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'failed', failureCode: 'RISK_WITHDRAWN' } });
    render(<Card items={[]} job={queued} />);
    act(() => screen.getByText('The AI is rewriting R-3').focus());
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(document.activeElement).toBe(screen.getByText('The AI rewrite didn’t finish'));
  });

  it('shows a failed rewrite with R4’s copy and Retry rewrite named by the risk', () => {
    render(<Card items={[]} job={{ ...queued, status: 'failed', failureCode: 'RISK_WITHDRAWN', canRetry: true }} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The AI rewrite didn’t finish');
    expect(alert).toHaveTextContent('R-3 was withdrawn before the AI started, so nothing was sent.');
    expect(within(alert).getByRole('button', { name: 'Retry rewrite: R-3' })).toBeInTheDocument();
  });

  it('lays each change out as its own tbody with marked words, sources and its decision cell', () => {
    render(<Card />);
    const table = within(tableLayout()).getByRole('table');
    expect(table.querySelector('caption')).toHaveTextContent('AI changes proposed for R-3');
    expect(within(table).getByRole('columnheader', { name: 'Current' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Proposed' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Decision' })).toBeInTheDocument();
    expect(table.querySelectorAll('tbody[data-comparison-group]')).toHaveLength(3);
    expect([...stackedLayout().querySelectorAll('[data-comparison-group] > p.micro-label')].map((label) => label.textContent)).toEqual(['Risk statement', 'Risk cause', 'Residual rating']);
    const statementRow = within(table).getByRole('rowheader', { name: 'Risk statement' }).closest('tr')!;
    expect(statementRow.querySelector('ins')).toHaveTextContent('Unsigned payment');
    expect(statementRow).toHaveTextContent('Request: Request title');
    const causeRow = within(table).getByRole('rowheader', { name: 'Risk cause' }).closest('tr')!;
    expect(within(causeRow).getByText('No source cited')).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Residual rating' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Confirm: Risk statement on R-3' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Reject: Risk statement on R-3' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Confirm: Residual rating on R-3' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Morgan Analyst asked the AI to rewrite R-3: “Make it specific to unsigned payment files”' })).toBeInTheDocument();
    expect(screen.getByText(/Provider: Deterministic · Model: v1 · 3 of 3 open/)).toBeInTheDocument();
  });

  it('adds Focus to the facts when only some parts were asked for', () => {
    render(<article id="risk-r3"><RiskRewriteSection assessmentId="a1" formHasUnsavedChanges={false} items={[residual]} job={null} ownerKey="owner-a" requestId={null} risk={risk} run={{ ...run, focus: ['ratings', 'treatment'] }} /></article>);
    expect(screen.getByText(/· Focus: Ratings, Treatment$/)).toBeInTheDocument();
  });
});

describe('per-change states (§4.4; D-37, D-38, UI-D17, UI-D19)', () => {
  const stale = { ...cause, stale: true, current: { riskCause: 'Edited by hand since' } } as RiskAiProposalItem;
  const accept = {
    ...statement,
    itemKey: 'u-treatment-action',
    unitKey: 'u-treatment-action',
    fields: ['treatmentAction'],
    current: { treatmentAction: 'Treat' },
    proposed: { treatmentAction: 'Accept' },
    aiAccept: true,
    sources: [],
  } as RiskAiProposalItem;

  it('a change Changed since proposed shows the value now and offers Reject only; a forbidden Accept offers Reject only; Confirm all counts the rest', () => {
    render(<Card items={[statement, stale, residual, accept]} />);
    const table = tableLayout();
    const staleBody = table.querySelector<HTMLElement>('tbody[data-comparison-group="run-w:u-risk-cause"]')!;
    expect(within(staleBody).getByText('Changed since proposed')).toBeInTheDocument();
    expect(staleBody).toHaveTextContent('Edited by hand since');
    expect(staleBody).toHaveTextContent('Risk cause has changed since the AI proposed this, so it can’t be confirmed. Reject it, or rewrite the risk again.');
    expect(within(staleBody).queryByRole('button', { name: /^Confirm/ })).toBeNull();
    expect(within(staleBody).getByRole('button', { name: 'Reject: Risk cause on R-3' })).toBeInTheDocument();
    const acceptBody = table.querySelector<HTMLElement>('tbody[data-comparison-group="run-w:u-treatment-action"]')!;
    expect(acceptBody).toHaveTextContent('Accept can be confirmed only while the residual rating is Low or Moderate and the risk has no planned mitigation control. Reject it, or change the treatment yourself.');
    expect(within(acceptBody).queryByRole('button', { name: /^Confirm/ })).toBeNull();
    expect(within(acceptBody).getByRole('button', { name: 'Reject: Treatment action on R-3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm all (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reject remaining \(4\)/ })).toBeInTheDocument();
  });

  it('offers Reject only for a residual change that would leave a High rating under an AI-confirmed Accept, and Confirm all leaves it out (FE4-07)', () => {
    const raised = { ...residual, current: { residualLikelihood: 'Possible', highestResidualConsequence: 'Minor', residualRating: 'Moderate' }, proposed: { residualLikelihood: 'Likely', highestResidualConsequence: 'Major', residualRating: 'High' } } as RiskAiProposalItem;
    const accepted = { ...risk, values: { treatmentAction: 'Accept', aiAcceptConfirmed: true, residualRating: 'Moderate', residualLikelihood: 'Possible', highestResidualConsequence: 'Minor', treatmentPlan: 'Accept until patched' } };
    render(<article id="risk-r3"><RiskRewriteSection assessmentId="a1" formHasUnsavedChanges={false} items={[statement, cause, raised]} job={null} ownerKey="owner-a" requestId={null} risk={accepted} run={run} /></article>);
    const body = tableLayout().querySelector<HTMLElement>('tbody[data-comparison-group="run-w:u-residual-rating"]')!;
    expect(within(body).queryByRole('button', { name: /^Confirm/ })).toBeNull();
    expect(within(body).getByRole('button', { name: 'Reject: Residual rating on R-3' })).toBeInTheDocument();
    expect(body).toHaveTextContent('Accept can be confirmed only while the residual rating is Low or Moderate and the risk has no planned mitigation control. Reject it, or change the treatment yourself.');
    expect(screen.getByRole('button', { name: 'Confirm all (2)' })).toBeInTheDocument();
  });

  it('withholds Confirm and Confirm all while the Risk form has unsaved changes, keeping Reject', () => {
    render(<Card unsaved />);
    expect(screen.getByText('Save or discard your changes to this risk before you confirm AI changes.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull();
    expect(within(tableLayout()).getByRole('button', { name: 'Reject: Risk statement on R-3' })).toBeInTheDocument();
  });

  it('confirming applies at once with Undo sending restore; the decided change stays in place with its note', async () => {
    let finish!: (value: unknown) => void;
    actions.decideRiskProposalsAction.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue(applied);
    render(<Card />);
    fireEvent.click(within(tableLayout()).getByRole('button', { name: 'Confirm: Risk statement on R-3' }));
    expect(actions.decideRiskProposalsAction).toHaveBeenCalledExactlyOnceWith({ assessmentId: 'a1', decisions: [{ runId: 'run-w', item: 'u-risk-statement', action: 'accept' }], intent: 'confirm', riskNumber: 'R-3', label: 'Risk statement' });
    const body = () => tableLayout().querySelector<HTMLElement>('tbody[data-comparison-group="run-w:u-risk-statement"]')!;
    expect(body()).toHaveTextContent(/Confirmed · Morgan Analyst/);
    await act(async () => { finish(applied); });
    await waitFor(() => expect(successCall('Risk statement confirmed on R-3.')).toBeDefined());
    await waitFor(() => expect(document.activeElement).toBe(within(tableLayout()).getByRole('button', { name: 'Confirm: Risk cause on R-3' })));
    const undo = actionOf(successCall('Risk statement confirmed on R-3.'));
    expect(undo?.label).toBe('Undo');
    act(() => { undo?.onClick?.({} as never); });
    await waitFor(() => expect(actions.decideRiskProposalsAction).toHaveBeenLastCalledWith(expect.objectContaining({ decisions: [{ runId: 'run-w', item: 'u-risk-statement', action: 'restore' }], intent: 'undo-confirmation' })));
    await waitFor(() => expect(successCall('Confirmation undone. Risk statement is back to its earlier value.')).toBeDefined());
  });

  it('keeps a change decided when an earlier decision’s read lands while it is on its way (FE4-06)', async () => {
    let finish!: (value: unknown) => void;
    actions.decideRiskProposalsAction.mockResolvedValueOnce(applied).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { rerender } = render(<Card />);
    fireEvent.click(within(tableLayout()).getByRole('button', { name: 'Confirm: Risk statement on R-3' }));
    await waitFor(() => expect(successCall('Risk statement confirmed on R-3.')).toBeDefined());
    fireEvent.click(within(tableLayout()).getByRole('button', { name: 'Confirm: Risk cause on R-3' }));
    // The first decision's read lands, read before the second was sent: the statement confirmed, the cause still open.
    const confirmed = { ...statement, state: 'accepted', canUndo: true, decision: { action: 'accepted', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, at: '2026-10-14T07:00:00.000Z', reason: null, cause: null } } as RiskAiProposalItem;
    rerender(<Card items={[confirmed, cause, residual]} />);
    await act(async () => { finish(applied); });
    await waitFor(() => expect(successCall('Risk cause confirmed on R-3.')).toBeDefined());
    expect(within(tableLayout()).queryByRole('button', { name: 'Confirm: Risk cause on R-3' })).toBeNull();
    expect(tableLayout().querySelector('tbody[data-comparison-group="run-w:u-risk-cause"]')).toHaveTextContent(/Confirmed · Morgan Analyst/);
  });

  it('keeps a confirmed change in place when the page reads it again, though the Risk now holds the proposed value (§4.4)', () => {
    // Strapi serves a change against the Risk as it is now, so once confirmed its current value is the proposed one.
    const served = {
      ...statement,
      state: 'accepted',
      current: { riskStatement: 'Unsigned payment files reconciled by hand' },
      decision: { action: 'accepted', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, at: '2026-10-14T07:00:00.000Z', reason: null, cause: null },
      canUndo: true,
    } as RiskAiProposalItem;
    render(<Card items={[served, cause, residual]} />);
    const body = tableLayout().querySelector<HTMLElement>('tbody[data-comparison-group="run-w:u-risk-statement"]');
    expect(body, 'the confirmed row stays in the table').not.toBeNull();
    expect(body).toHaveTextContent(/Confirmed · Morgan Analyst/);
    expect(within(body!).getByRole('button', { name: 'Undo: Risk statement on R-3' })).toBeInTheDocument();
    const card = stackedLayout().querySelector<HTMLElement>('li[data-comparison-group="run-w:u-risk-statement"]');
    expect(card, 'the confirmed change stays in the stacked list').not.toBeNull();
    expect(card).toHaveTextContent(/Confirmed · Morgan Analyst/);
    // Only the residual change's unchanged consequence folds away; the confirmed statement is not counted as unchanged.
    expect(screen.getByRole('button', { name: 'Show 1 unchanged field' })).toBeInTheDocument();
  });

  it('Confirm all confirms only the confirmable changes, then closes the section and focuses the Risk’s first field', async () => {
    actions.decideRiskProposalsAction.mockResolvedValue({ ok: true, data: { applied: 3, unchanged: 0 } });
    render(<Card />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm all (3)' }));
    expect(actions.decideRiskProposalsAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      decisions: ['u-risk-statement', 'u-risk-cause', 'u-residual-rating'].map((item) => ({ runId: 'run-w', item, action: 'accept' })),
      intent: 'confirm',
    }));
    await waitFor(() => expect(successCall('3 AI changes confirmed on R-3.')).toBeDefined());
    await waitFor(() => expect(document.getElementById('risk-r3-rewrite')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Risk statement')));
  });

  it('Reject opens the reason row under the change and rejects it with a toast naming the change', async () => {
    actions.decideRiskProposalsAction.mockResolvedValue(applied);
    render(<Card />);
    fireEvent.click(within(tableLayout()).getByRole('button', { name: 'Reject: Risk cause on R-3' }));
    const field = await screen.findByLabelText('Reason (optional)');
    await waitFor(() => expect(document.activeElement).toBe(field));
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(successCall('Risk cause change rejected.')).toBeDefined());
    expect(tableLayout().querySelector('tbody[data-comparison-group="run-w:u-risk-cause"]')).toHaveTextContent(/Rejected · Morgan Analyst/);
  });

  it('keeps a rejection’s typed reason when the rejection is refused, and clears it once one is recorded (FE4-10)', async () => {
    actions.decideRiskProposalsAction.mockResolvedValueOnce({ ok: false, kind: 'blocked', status: 409, reason: 'ASSESSMENT_NOT_MUTABLE', message: 'This assessment can no longer be changed.' }).mockResolvedValue(applied);
    render(<Card />);
    fireEvent.click(within(tableLayout()).getByRole('button', { name: 'Reject: Risk cause on R-3' }));
    fireEvent.change(await screen.findByLabelText('Reason (optional)'), { target: { value: 'Covered by R-1' } });
    fireEvent.keyDown(screen.getByLabelText('Reason (optional)'), { key: 'Enter' });
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    await waitFor(() => expect(within(tableLayout()).getByRole('button', { name: 'Reject: Risk cause on R-3' })).toBeInTheDocument());
    fireEvent.click(within(tableLayout()).getByRole('button', { name: 'Reject: Risk cause on R-3' }));
    expect(await screen.findByLabelText('Reason (optional)')).toHaveValue('Covered by R-1');
    fireEvent.keyDown(screen.getByLabelText('Reason (optional)'), { key: 'Enter' });
    await waitFor(() => expect(successCall('Risk cause change rejected.')).toBeDefined());
    expect(readSessionDraft('risk-reject-reason', 'owner-a', 'reject:run-w:u-risk-cause') ?? '').toBe('');
  });

  it('names what Reject remaining and each Show sources reveal, one target per layout (UI-01, Accessibility contract 4.1.2)', () => {
    window.localStorage.setItem('csrm:risk-ai-proposals-density:owner-a', 'compact');
    render(<Card />);
    const reject = screen.getByRole('button', { name: /^Reject remaining/ });
    const rejectTarget = reject.getAttribute('aria-controls');
    expect(rejectTarget, 'REJECT_REMAINING_NO_ARIA_CONTROLS').toBeTruthy();
    expect(document.getElementById(rejectTarget!), 'REJECT_REMAINING_TARGET_MISSING').not.toBeNull();
    fireEvent.click(reject);
    expect(within(document.getElementById(rejectTarget!)!).getByRole('textbox')).toHaveFocus();

    const toggles = screen.getAllByRole('button', { name: 'Show sources' });
    expect(toggles.length).toBeGreaterThan(0);
    const targets = toggles.map((toggle) => toggle.getAttribute('aria-controls'));
    expect(targets.every(Boolean), 'SOURCES_NO_ARIA_CONTROLS').toBe(true);
    expect(new Set(targets).size, 'SOURCES_TARGET_NOT_UNIQUE').toBe(targets.length);
    for (const target of targets) expect(document.getElementById(target!), 'SOURCES_TARGET_MISSING').not.toBeNull();
    fireEvent.click(toggles[0]!);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(targets[0]!)!.childElementCount).toBeGreaterThan(0);
  });

  it('at 375 each change is a stacked card, Current above Proposed, with Confirm first at full width', () => {
    render(<Card />);
    const card = stackedLayout().querySelector<HTMLElement>('li[data-comparison-group="run-w:u-risk-statement"]')!;
    const labels = [...card.querySelectorAll('p.micro-label')].map((label) => label.textContent);
    expect(labels.indexOf('Current')).toBeLessThan(labels.indexOf('Proposed'));
    const buttons = within(card.querySelector<HTMLElement>('[data-comparison-decision]')!).getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Confirm: Risk statement on R-3');
    expect(buttons[0]!.className).toContain('max-md:w-full');
  });
});

describe('the verbs (Voice; Orchestrator Confirmations)', () => {
  it('no control in features/risk-curation reads Accept', () => {
    render(<Card />);
    expect(screen.queryAllByRole('button').filter((button) => /^\s*Accept/.test(button.textContent ?? ''))).toEqual([]);
    const directory = resolve(process.cwd(), 'src', 'features', 'risk-curation');
    const offenders = readdirSync(directory)
      .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
      .filter((name) => /<Button[^>]*>[^<]*(<[^>]+\/>)?\s*Accept( all)?\s*</.test(readFileSync(resolve(directory, name), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
