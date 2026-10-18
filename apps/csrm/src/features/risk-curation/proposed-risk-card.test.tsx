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

import { AiProposalsSectionClient } from './ai-proposals-section-client';
import type { RiskAiProposalItem, RiskAiProposals, RiskAiRunFacts } from './risk-curation-domain';
import { paymentFileRiskFixture, similarRiskFixture, suggestionsRunFixture, unratedRiskFixture } from './test-fixtures';

const allowed = { allowed: true, reason: null } as const;
const run = suggestionsRunFixture as unknown as RiskAiRunFacts;
const payment = paymentFileRiskFixture as unknown as RiskAiProposalItem;
const similar = similarRiskFixture as unknown as RiskAiProposalItem;
const unrated = unratedRiskFixture as unknown as RiskAiProposalItem;

function proposals(items: readonly RiskAiProposalItem[] = [payment, similar, unrated]): RiskAiProposals {
  return {
    assessmentId: 'a1',
    editable: true,
    openCount: items.filter((item) => item.state === 'open').length,
    openByRisk: [],
    lastAskedAt: run.completedAt,
    actions: { suggest: allowed, rewrite: allowed, decide: allowed },
    runs: [run],
    items,
    jobs: [],
  };
}

const risks = [{ id: 'r2', riskNumber: 'R-2', values: { riskType: 'Data integrity', riskStatement: 'Supplier bank details changed', informationSystemImpacted: 'Payments gateway', residualRating: 'Moderate' } }];
const applied = { ok: true, data: { applied: 1, unchanged: 0 } };

function renderClient(view: RiskAiProposals = proposals()) {
  return render(<AiProposalsSectionClient assessmentId="a1" ownerKey="owner-a" proposals={view} requestId="request-1" risks={risks} state="editable" />);
}

function successCall(message: string) {
  return notifications.success.mock.calls.find((call) => call[0] === message);
}
const actionOf = (call: unknown[] | undefined): Action | undefined => (call?.[1] as { action?: Action } | undefined)?.action;

beforeEach(() => {
  for (const mock of [...Object.values(actions), refresh, notifications.success, notifications.error, notifications.dismiss]) mock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('a proposed-risk card (16-UI-SPEC §3.2 to §3.4)', () => {
  it('shows its statement, facts, ratings and treatment, and every proposed field behind Show proposed details', () => {
    renderClient();
    const card = document.getElementById('ai-proposal-run-s-s-1')!;
    expect(card).toHaveAttribute('tabindex', '-1');
    expect(card).toHaveTextContent('No Risk Type · Supplier payment file');
    expect(within(card).getByText('Inherent')).toBeInTheDocument();
    expect(within(card).getByText('Residual')).toBeInTheDocument();
    expect(card).toHaveTextContent('Treatment: Treat');
    const unratedCard = document.getElementById('ai-proposal-run-s-s-3')!;
    expect(within(unratedCard).getAllByText('Not rated').length).toBeGreaterThan(0);
    const toggle = within(card).getByRole('button', { name: 'Show proposed details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(within(card).getByRole('button', { name: 'Hide proposed details' })).toHaveAttribute('aria-expanded', 'true');
    for (const heading of ['Statement', 'Classification', 'Ratings', 'Treatment']) expect(within(card).getByRole('heading', { level: 4, name: heading })).toBeInTheDocument();
    expect(within(card).getAllByText('Not proposed').length).toBeGreaterThan(0);
    expect(within(card).getByText('None suggested')).toBeInTheDocument();
  });

  it('renders proposed text as text, never markup', () => {
    renderClient(proposals([{ ...payment, proposed: { ...payment.proposed, riskStatement: 'Files <img src=x onerror=alert(1)> altered' } }]));
    const card = document.getElementById('ai-proposal-run-s-s-1')!;
    expect(card.querySelector('img')).toBeNull();
    expect(card).toHaveTextContent('Files <img src=x onerror=alert(1)> altered');
  });

  it('offers Add to assessment, Reject and no Accept verb', () => {
    renderClient();
    const card = document.getElementById('ai-proposal-run-s-s-1')!;
    expect(within(card).getByRole('button', { name: 'Add to assessment: Payment files altered before signing' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Reject: Payment files altered before signing' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button').filter((button) => /^Accept/.test(button.textContent ?? ''))).toEqual([]);
  });
});

describe('Add to assessment (§5.1, §5.5; D-33)', () => {
  it('Add to assessment waits for the server with Adding…, sends one batch, then toasts Open R-5 with no Undo and focuses the next Add', async () => {
    let finish!: (value: unknown) => void;
    actions.decideRiskProposalsAction.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const added = { ...payment, state: 'accepted', addedRisk: { riskId: 'r5', riskNumber: 'R-5' }, decision: { action: 'accepted', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, at: '2026-10-14T07:00:00.000Z', reason: null, cause: null } } as RiskAiProposalItem;
    actions.readRiskAiProposalsAction.mockResolvedValue({ ok: true, data: proposals([added, similar, unrated]) });
    renderClient();
    const card = document.getElementById('ai-proposal-run-s-s-1')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Add to assessment: Payment files altered before signing' }));
    expect(actions.decideRiskProposalsAction).toHaveBeenCalledExactlyOnceWith({ assessmentId: 'a1', decisions: [{ runId: 'run-s', item: 's-1', action: 'accept' }], intent: 'add' });
    // It waits: the card stays, saying it is adding, its other actions disabled.
    expect(within(card).getByRole('button', { name: /Adding…/ })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Reject: Payment files altered before signing' })).toBeDisabled();
    await act(async () => { finish(applied); });
    await waitFor(() => expect(successCall('R-5 added to the assessment. Review its AI-proposed fields.')).toBeDefined());
    const call = successCall('R-5 added to the assessment. Review its AI-proposed fields.');
    expect(actionOf(call)?.label).toBe('Open R-5');
    expect(notifications.success.mock.calls.some((entry) => actionOf(entry)?.label === 'Undo')).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add to assessment: Supplier bank details changed without checks' })));
    expect(screen.getByText('2 open proposals')).toBeInTheDocument();
  });

  it('Open R-5 lands on the new Risk card once the editor renders it, even when the toast is used first (§5.5)', async () => {
    actions.decideRiskProposalsAction.mockResolvedValue(applied);
    const added = { ...payment, state: 'accepted', addedRisk: { riskId: 'r5', riskNumber: 'R-5' }, decision: { action: 'accepted', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, at: '2026-10-14T07:00:00.000Z', reason: null, cause: null } } as RiskAiProposalItem;
    actions.readRiskAiProposalsAction.mockResolvedValue({ ok: true, data: proposals([added, similar, unrated]) });
    const scrolled = vi.fn();
    const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = scrolled;
    try {
      renderClient();
      fireEvent.click(screen.getByRole('button', { name: 'Add to assessment: Payment files altered before signing' }));
      await waitFor(() => expect(successCall('R-5 added to the assessment. Review its AI-proposed fields.')).toBeDefined());
      // The editor adopts the page's next read a moment later (D-41), so the card is not there yet when Open is used.
      expect(document.getElementById('risk-r5')).toBeNull();
      act(() => { actionOf(successCall('R-5 added to the assessment. Review its AI-proposed fields.'))?.onClick?.({} as never); });
      const card = document.createElement('div');
      card.id = 'risk-r5';
      card.tabIndex = -1;
      await act(async () => { document.body.append(card); });
      await waitFor(() => expect(document.activeElement).toBe(card));
      expect(scrolled.mock.contexts).toContain(card);
      card.remove();
    } finally {
      if (scrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoView);
      else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe('Reject with an optional reason, and Undo (§5.1, §5.3)', () => {
  it('opens the reason row with focus, rejects at once with Undo that sends restore', async () => {
    actions.decideRiskProposalsAction.mockResolvedValue(applied);
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: 'Reject: Payment files altered before signing' }));
    const field = screen.getByLabelText('Reason (optional)');
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(screen.getByText('The AI reads this next time, so it doesn’t propose the same again.')).toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'Already covered by R-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject proposal' }));
    expect(actions.decideRiskProposalsAction).toHaveBeenCalledExactlyOnceWith({ assessmentId: 'a1', decisions: [{ runId: 'run-s', item: 's-1', action: 'reject', reason: 'Already covered by R-1' }], intent: 'reject' });
    // Applied at once.
    expect(screen.queryByRole('button', { name: 'Add to assessment: Payment files altered before signing' })).toBeNull();
    await waitFor(() => expect(successCall('Proposal rejected.')).toBeDefined());
    const undo = actionOf(successCall('Proposal rejected.'));
    expect(undo?.label).toBe('Undo');
    act(() => { undo?.onClick?.({} as never); });
    await waitFor(() => expect(actions.decideRiskProposalsAction).toHaveBeenLastCalledWith({ assessmentId: 'a1', decisions: [{ runId: 'run-s', item: 's-1', action: 'restore' }], intent: 'undo-rejection' }));
    await waitFor(() => expect(successCall('Rejection undone. The proposal is open again.')).toBeDefined());
  });

  it('Keep proposal closes the row and returns focus to Reject', async () => {
    renderClient();
    const reject = screen.getByRole('button', { name: 'Reject: Payment files altered before signing' });
    fireEvent.click(reject);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep proposal' }));
    expect(screen.queryByLabelText('Reason (optional)')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reject: Payment files altered before signing' })));
    expect(actions.decideRiskProposalsAction).not.toHaveBeenCalled();
  });

  it('rolls back with R3’s line and reads the proposals again when the proposal was already decided', async () => {
    actions.decideRiskProposalsAction.mockResolvedValue({ ok: false, kind: 'blocked', status: 409, reason: 'AI_PROPOSAL_ALREADY_DECIDED', message: 'This proposal is no longer open. Refresh the page to see where it stands.' });
    actions.readRiskAiProposalsAction.mockResolvedValue({ ok: true, data: proposals() });
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: 'Reject: Payment files altered before signing' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reject proposal' }));
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    const [title, options] = notifications.error.mock.calls[0]!;
    expect(title).toBe('Proposal not rejected');
    expect((options as { description: string }).description).toBe('This proposal is no longer open. Refresh the page to see where it stands.');
    expect(actionOf(notifications.error.mock.calls[0])?.label).toBe('Refresh page');
    // Rolled back: the card is open again.
    expect(await screen.findByRole('button', { name: 'Add to assessment: Payment files altered before signing' })).toBeInTheDocument();
    await waitFor(() => expect(actions.readRiskAiProposalsAction).toHaveBeenCalledWith({ assessmentId: 'a1' }));
  });

  it('rolls back with Try again when the decision never reached the server', async () => {
    actions.decideRiskProposalsAction.mockRejectedValue(new Error('offline'));
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: 'Reject: Payment files altered before signing' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reject proposal' }));
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    expect((notifications.error.mock.calls[0]![1] as { description: string }).description).toBe('We couldn’t record your decision. Try again.');
    expect(actionOf(notifications.error.mock.calls[0])?.label).toBe('Try again');
    expect(await screen.findByRole('button', { name: 'Add to assessment: Payment files altered before signing' })).toBeInTheDocument();
  });

  it('Reject remaining opens one row for the group and rejects each open proposal with one reason', async () => {
    actions.decideRiskProposalsAction.mockResolvedValue({ ok: true, data: { applied: 3, unchanged: 0 } });
    renderClient();
    const group = screen.getByRole('article');
    fireEvent.click(within(group).getByRole('button', { name: /^Reject remaining \(3\)/ }));
    fireEvent.change(await screen.findByLabelText('Reason (optional)'), { target: { value: 'Out of scope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject 3 proposals' }));
    expect(actions.decideRiskProposalsAction).toHaveBeenCalledExactlyOnceWith({
      assessmentId: 'a1',
      decisions: ['s-1', 's-2', 's-3'].map((item) => ({ runId: 'run-s', item, action: 'reject', reason: 'Out of scope' })),
      intent: 'reject',
    });
    await waitFor(() => expect(successCall('3 proposals rejected.')).toBeDefined());
    await waitFor(() => expect(document.activeElement).toHaveTextContent('No open AI proposals'));
  });
});

describe('similar risks (§3.3; X-28, D-32)', () => {
  it('notes the similarity, compares with R-2 in two columns with Same rows, and Reject as duplicate records the reason', async () => {
    actions.decideRiskProposalsAction.mockResolvedValue(applied);
    renderClient();
    const card = document.getElementById('ai-proposal-run-s-s-2')!;
    expect(within(card).getByText('Similar to R-2')).toBeInTheDocument();
    const compare = within(card).getByRole('button', { name: 'Compare with R-2' });
    expect(compare).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(compare);
    expect(compare).toHaveAttribute('aria-expanded', 'true');
    const table = within(card).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'R-2' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Proposed' })).toBeInTheDocument();
    expect(within(table).getAllByText('Same').length).toBeGreaterThan(0);
    expect(within(table).getByRole('rowheader', { name: 'Risk type' })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Reject as duplicate: Supplier bank details changed without checks' }));
    expect(actions.decideRiskProposalsAction).toHaveBeenCalledExactlyOnceWith({ assessmentId: 'a1', decisions: [{ runId: 'run-s', item: 's-2', action: 'reject', reason: 'Duplicate of R-2' }], intent: 'reject' });
    await waitFor(() => expect(successCall('Proposal rejected as a duplicate of R-2.')).toBeDefined());
  });

  it('offers no compare when the other record is not loaded', () => {
    render(<AiProposalsSectionClient assessmentId="a1" ownerKey="owner-a" proposals={proposals()} requestId="request-1" state="editable" />);
    const card = document.getElementById('ai-proposal-run-s-s-2')!;
    expect(within(card).getByText('Similar to R-2')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Compare with R-2' })).toBeNull();
  });
});
