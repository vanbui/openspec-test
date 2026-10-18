import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const decide = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('./questionnaire-ai-actions', () => ({
  decideQuestionnaireAiProposalsAction: decide,
  startQuestionnaireAiProposalsAction: vi.fn(),
  getQuestionnaireProposalJobAction: vi.fn(),
  retryQuestionnaireProposalJobAction: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: notifications }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../questionnaires/questionnaire-actions', () => ({ returnQuestionnaireToAnalystReviewAction: vi.fn() }));
// Phase 10's question form's Required checkbox measures itself; jsdom has no ResizeObserver.
vi.stubGlobal('ResizeObserver', class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});

import { AiProposalsPanelClient } from './ai-proposals-panel-client';

import { DecidedProposals } from './decided-proposals';
import { ProposalItemCard, ProposalRunGroup, type ProposalHandlers } from './proposal-item-card';
import type { ItemActions, QuestionnaireAiItemView, QuestionnaireAiProposalsView, QuestionnaireAiRunView } from './questionnaire-ai-domain';
import { proposalsFixture } from './test-fixtures';

const view = proposalsFixture as unknown as QuestionnaireAiProposalsView;
const run = view.runs[0] as QuestionnaireAiRunView;
const add = view.items[0] as QuestionnaireAiItemView;
const change: QuestionnaireAiItemView = { ...(view.items[1] as QuestionnaireAiItemView), state: 'open', decision: null, canUndo: false, stale: false };
const allActions: ItemActions = { confirm: 'enabled', editThenConfirm: 'enabled', reject: true, undo: false };
const rejectOnly: ItemActions = { confirm: 'hidden', editThenConfirm: 'hidden', reject: true, undo: false };

function handlers(): ProposalHandlers {
  return { confirm: vi.fn(), startEdit: vi.fn(), startReject: vi.fn(), undo: vi.fn() };
}

function card(item: QuestionnaireAiItemView, actions: ItemActions = allActions, density: 'comfortable' | 'compact' = 'comfortable', itemRun: QuestionnaireAiRunView = run) {
  return render(<ol><ProposalItemCard actions={actions} density={density} handlers={handlers()} item={item} requestId="request-1" run={itemRun} /></ol>);
}

describe('the proposal card by kind (§4.2, §4.3)', () => {
  it('shows a change as the X-24 comparison of its five fields', () => {
    card(change);
    expect(screen.getByText('Question change')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Proposed change to Where is data stored?' });
    expect(within(table).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Question', 'Help text']);
    expect(screen.getAllByRole('button', { name: 'Show 3 unchanged fields' }).length).toBeGreaterThan(0);
  });

  it('names a rewrite asked for without an instruction a plain-language rewrite', () => {
    const preset = { ...run, operation: 'question-rewrite' as const, scope: 'question' as const, instruction: null, instructionSource: 'plain-language-preset' as const };
    card(change, allActions, 'comfortable', preset);
    expect(screen.getByText('Plain-language rewrite')).toBeInTheDocument();
  });

  it('shows an addition’s proposed values, where it goes and when it shows', () => {
    card(add);
    expect(screen.getByText('New question')).toBeInTheDocument();
    expect(screen.getByText('At the end of Payment processing')).toBeInTheDocument();
    expect(screen.getByText('Shown when')).toBeInTheDocument();
    expect(screen.getByText('“Do you process payments?” is “Yes”')).toBeInTheDocument();
  });

  it('places an addition in a new section', () => {
    card({ ...add, placement: { sectionTitle: 'Offshore support', newSection: true, visibility: null } });
    expect(screen.getByText('In a new section, Offshore support, after the last section')).toBeInTheDocument();
    expect(screen.queryByText('Shown when')).toBeNull();
  });

  it('shows a removal’s current values and what confirming does', () => {
    card({ ...change, kind: 'remove', proposed: null });
    expect(screen.getByText('Question removal')).toBeInTheDocument();
    expect(screen.getByText('Confirming removes this question from the questionnaire. Its history is kept, and Undo puts it back.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('marks a stale proposal, explains why, and offers Reject alone', () => {
    card({ ...change, stale: true }, rejectOnly);
    expect(screen.getByText('Changed since proposed')).toBeInTheDocument();
    expect(screen.getByText('This question has changed, been answered or been removed since the AI proposed this, so it can’t be confirmed. Reject it, or ask the AI again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit, then confirm/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reject: Where is data stored?' })).toBeInTheDocument();
  });

  it('names every action by its subject', () => {
    card(add);
    expect(screen.getByRole('button', { name: 'Confirm: Are payment files signed before upload?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit, then confirm: Are payment files signed before upload?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject: Are payment files signed before upload?' })).toBeInTheDocument();
  });

  it('cites a note as a record link, a request field as a source button, and the rest as plain text', () => {
    card({
      ...add,
      sources: [
        ...add.sources,
        { kind: 'request-field', ref: 'request.description', label: 'Description', note: null },
        { kind: 'file', ref: 'file.1', label: 'Vendor pack.pdf', note: null },
        { kind: 'answered-question', ref: 'answer.q', label: 'Who owns it?', note: null },
      ],
    });
    expect(screen.getByRole('link', { name: /^Note: Security Analyst note/ })).toHaveAttribute('href', '/app/review/requests/request-1#note-note-2');
    expect(screen.getByRole('button', { name: /Request: Description/ })).toBeInTheDocument();
    expect(screen.getByText('File: Vendor pack.pdf')).toBeInTheDocument();
    expect(screen.getByText('Answered question: Who owns it?')).toBeInTheDocument();
    expect(screen.getByText('Instruction')).toBeInTheDocument();
  });

  it('renders the AI’s text as text, never markup (T-15-40)', () => {
    card({ ...add, rationale: '<script>alert(1)</script>\nSecond line' });
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
  });

  it('in compact density, uses 12px padding and keeps the reason and sources behind a toggle', () => {
    card(add, allActions, 'compact');
    const item = document.getElementById('ai-proposal-run-1-i-1')!;
    expect(item).toHaveClass('p-3');
    expect(screen.queryByText('The analyst asked about payment file signing.')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show reason and sources' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByText('The analyst asked about payment file signing.')).toBeInTheDocument();
  });
});

describe('the group (§4.1)', () => {
  function group(adjustments: QuestionnaireAiRunView['adjustments'], sourcesDropped = 0) {
    return render(<ProposalRunGroup actionsFor={() => allActions} anyAnswered density="comfortable" handlers={handlers()} items={[add]} requestId="request-1" run={{ ...run, adjustments, sourcesDropped }} />);
  }

  it('opens the left-out list from its figure link', () => {
    group([{ code: 'over-limit', count: 10 }, { code: 'answered-target', count: 1 }, { code: 'ignored-field', count: 2 }]);
    const toggle = screen.getByRole('button', { name: '11 left out' });
    expect(toggle).toHaveClass('min-h-6');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const list = document.getElementById(toggle.getAttribute('aria-controls')!);
    expect(list).not.toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(list!).getAllByRole('listitem').map((line) => line.textContent)).toEqual([
      '10 more proposals beyond the limit of 30, or 15 new questions, per request.',
      'A change to an answered question. Answered questions stay as they are.',
    ]);
  });

  it('shows no left-out figure when nothing was left out, and the unmatched sources caption when some were dropped', () => {
    group([], 2);
    expect(screen.queryByRole('button', { name: /left out/ })).toBeNull();
    expect(screen.getByText('2 sources the AI cited couldn’t be matched, so they aren’t shown.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show what the AI used' })).toBeInTheDocument();
  });
});

describe('decided proposals (§4.6)', () => {
  const decided = (action: 'accepted' | 'rejected' | 'superseded' | 'lapsed', extra: Partial<NonNullable<QuestionnaireAiItemView['decision']>> = {}, canUndo = false): QuestionnaireAiItemView => ({
    ...change, itemKey: `i-${action.length}${extra.edited ? 'e' : ''}`, state: action, canUndo,
    decision: { action, by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, at: '2026-10-12T00:10:00.000Z', reason: null, edited: false, ...extra },
  });

  it('toggles the decided group and shows each note, with Undo only where it may', () => {
    const items = [
      decided('accepted', {}, true),
      decided('accepted', { edited: true }),
      decided('rejected', { reason: 'Already covered.' }, true),
      decided('superseded'),
      decided('lapsed'),
    ];
    const undo = vi.fn();
    render(<DecidedProposals actionsFor={(item) => ({ ...rejectOnly, reject: false, undo: item.canUndo })} items={items} onUndo={undo} runs={view.runs} />);
    const toggle = screen.getByRole('button', { name: 'Show decided proposals (5)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide decided proposals' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText(/^Confirmed · Morgan Analyst · /)).toHaveLength(1);
    expect(screen.getByText(/^Edited, then confirmed · Morgan Analyst · /)).toBeInTheDocument();
    expect(screen.getByText(/^Rejected · Morgan Analyst · /)).toBeInTheDocument();
    expect(screen.getByText('Reason: “Already covered.”')).toBeInTheDocument();
    expect(screen.getByText(/^Replaced by a newer proposal · Morgan Analyst · /)).toBeInTheDocument();
    expect(screen.getByText('Closed without a decision: an assessment draft froze the questionnaire.')).toBeInTheDocument();
    expect(screen.getAllByText(/^Proposed .* at Morgan Analyst’s request$/)).toHaveLength(5);
    const undos = screen.getAllByRole('button', { name: 'Undo: Where is data stored?' });
    expect(undos).toHaveLength(2);
    fireEvent.click(undos[0]!);
    expect(undo).toHaveBeenCalledWith(items[0]);
  });
});

describe('deciding in the panel (§5.2 to §5.5; UI-D5 to UI-D9)', () => {
  const sections = [{ key: 'payments', label: 'Payment processing', section: { key: 'payments', title: 'Payment processing', order: 1 } }];
  const applied = { ok: true, data: { applied: 1, unchanged: 0 } };
  const openView = (items: readonly QuestionnaireAiItemView[]): QuestionnaireAiProposalsView => ({ ...view, openCount: items.filter((item) => item.state === 'open').length, items, jobs: [], runs: [{ ...run, counts: { items: items.length, open: items.length } }] });
  const panel = (items: readonly QuestionnaireAiItemView[] = [add]) => render(<AiProposalsPanelClient ownerKey="owner-a" requestId="request-1" sections={sections} view={openView(items)} />);

  beforeEach(() => { for (const mock of [decide, refresh, notifications.success, notifications.error]) mock.mockReset(); });
  afterEach(() => { window.sessionStorage.clear(); });

  it('confirms edited placement using the chosen section in the toast and focuses the next item (D4, D5)', async () => {
    decide.mockResolvedValue(applied);
    panel([add, change]);
    fireEvent.click(screen.getByRole('button', { name: /^Edit, then confirm: Are payment/ }));
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: '__new-section__' } });
    const title = 'Offshore team '.padEnd(255, 'a');
    fireEvent.change(screen.getByLabelText('New section title'), { target: { value: title } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm with edits' }));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith(`New question confirmed and added to ${title} with your edits.`, expect.any(Object)));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm: Where is data stored?' })).toHaveFocus());
  });

  it('keeps reject reasons after remount and refusal, warns on unload, and clears only after success (FE-10)', async () => {
    const { unmount } = panel();
    fireEvent.click(screen.getByRole('button', { name: /^Reject:/ }));
    fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'Already covered.' } });
    const unloading = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unloading);
    expect(unloading.defaultPrevented).toBe(true);
    unmount();
    panel();
    fireEvent.click(screen.getByRole('button', { name: /^Reject:/ }));
    expect(screen.getByLabelText('Reason (optional)')).toHaveValue('Already covered.');
    decide.mockResolvedValueOnce({ ok: false, failure: 'retryable', message: 'Try again.' });
    fireEvent.click(screen.getByRole('button', { name: 'Reject proposal' }));
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: /^Reject:/ }));
    expect(screen.getByLabelText('Reason (optional)')).toHaveValue('Already covered.');
    decide.mockResolvedValueOnce(applied);
    fireEvent.click(screen.getByRole('button', { name: 'Reject proposal' }));
    await waitFor(() => expect(notifications.success).toHaveBeenCalled());
    expect(window.sessionStorage.getItem('csrm-draft:proposal-edit:owner-a:reject:run-1:i-1')).toBeNull();
  });

  it('warns before unloading changed proposal edits and stands down after discard (FE-11)', () => {
    panel();
    fireEvent.click(screen.getByRole('button', { name: /^Edit, then confirm:/ }));
    const unchanged = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unchanged);
    expect(unchanged.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText('Question text'), { target: { value: 'Changed wording?' } });
    const changed = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(changed);
    expect(changed.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
    const discarded = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(discarded);
    expect(discarded.defaultPrevented).toBe(false);
  });

  it('Edit, then confirm opens the form in the card prefilled, waits for the server and sends only the changed fields', async () => {
    let finish!: (value: unknown) => void;
    decide.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Edit, then confirm: Are payment files signed before upload?' }));
    const form = screen.getByRole('form', { name: 'Edit, then confirm' });
    const text = within(form).getByLabelText('Question text');
    expect(text).toHaveValue('Are payment files signed before upload?');
    expect(within(form).getByLabelText('Section')).toHaveValue('payments');
    fireEvent.change(text, { target: { value: 'Are payment files signed?' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Confirm with edits' }));
    expect(await within(form).findByRole('button', { name: 'Confirming…' })).toBeInTheDocument();
    expect(decide).toHaveBeenCalledExactlyOnceWith({ documentId: 'questionnaire-1', decisions: [{ runId: 'run-1', item: 'i-1', action: 'accept', edits: { questionText: 'Are payment files signed?' } }], intent: 'confirm' });
    await act(async () => finish(applied));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('New question confirmed and added to Payment processing with your edits.', expect.any(Object)));
    expect(window.sessionStorage.getItem('csrm-draft:proposal-edit:owner-a:run-1:i-1')).toBeNull();
  });

  it('Edit, then confirm keeps its values for the session, and Discard edits returns focus to the opener', () => {
    const { unmount } = panel();
    fireEvent.click(screen.getByRole('button', { name: 'Edit, then confirm: Are payment files signed before upload?' }));
    fireEvent.change(screen.getByLabelText('Question text'), { target: { value: 'Kept wording?' } });
    unmount();
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Edit, then confirm: Are payment files signed before upload?' }));
    expect(screen.getByLabelText('Question text')).toHaveValue('Kept wording?');
    expect(screen.getByText('Restored from earlier in this session.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
    expect(screen.queryByRole('form', { name: 'Edit, then confirm' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit, then confirm: Are payment files signed before upload?' })).toHaveFocus();
    expect(window.sessionStorage.getItem('csrm-draft:proposal-edit:owner-a:run-1:i-1')).toBeNull();
  });

  it('Reject opens the reason row, Enter rejects with the reason, and Undo reopens it', async () => {
    decide.mockResolvedValue(applied);
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Reject: Are payment files signed before upload?' }));
    const reason = screen.getByLabelText('Reason (optional)');
    expect(reason).toHaveFocus();
    expect(screen.getByText('The AI reads this next time, so it doesn’t propose the same again.')).toBeInTheDocument();
    fireEvent.change(reason, { target: { value: 'Already covered.' } });
    fireEvent.keyDown(reason, { key: 'Enter' });
    expect(decide).toHaveBeenCalledWith({ documentId: 'questionnaire-1', decisions: [{ runId: 'run-1', item: 'i-1', action: 'reject', reason: 'Already covered.' }], intent: 'reject' });
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Proposal rejected.', expect.any(Object)));
    const undo = notifications.success.mock.calls[0]![1].action;
    act(() => undo.onClick());
    await waitFor(() => expect(decide).toHaveBeenLastCalledWith({ documentId: 'questionnaire-1', decisions: [{ runId: 'run-1', item: 'i-1', action: 'restore' }], intent: 'undo-rejection' }));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Rejection undone. The proposal is open again.', expect.any(Object)));
  });

  it('Escape keeps the proposal and returns focus to Reject; a reason over 500 characters is refused', () => {
    panel();
    const opener = screen.getByRole('button', { name: 'Reject: Are payment files signed before upload?' });
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByLabelText('Reason (optional)'), { key: 'Escape' });
    expect(screen.queryByLabelText('Reason (optional)')).toBeNull();
    expect(opener).toHaveFocus();
    fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'x'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject proposal' }));
    expect(screen.getByText('Keep the reason to 500 characters or fewer.')).toBeInTheDocument();
    expect(decide).not.toHaveBeenCalled();
  });

  it('Reject remaining rejects every open proposal of the request in one call, stale ones included, and Undo restores each', async () => {
    decide.mockResolvedValue(applied);
    const items = [add, { ...add, itemKey: 'i-3', stale: true }, { ...add, itemKey: 'i-4' }, { ...change, itemKey: 'i-5', state: 'rejected' as const, decision: { action: 'rejected' as const, by: null, at: '2026-10-12T00:10:00.000Z', reason: null, edited: false }, canUndo: true }];
    panel(items);
    fireEvent.click(screen.getByRole('button', { name: /^Reject remaining \(3\) from the request at / }));
    fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'Out of scope.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject 3 proposals' }));
    expect(decide).toHaveBeenCalledExactlyOnceWith({
      documentId: 'questionnaire-1',
      decisions: ['i-1', 'i-3', 'i-4'].map((item) => ({ runId: 'run-1', item, action: 'reject', reason: 'Out of scope.' })),
      intent: 'reject',
    });
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('3 proposals rejected.', expect.any(Object)));
    act(() => notifications.success.mock.calls[0]![1].action.onClick());
    await waitFor(() => expect(decide).toHaveBeenLastCalledWith({ documentId: 'questionnaire-1', decisions: ['i-1', 'i-3', 'i-4'].map((item) => ({ runId: 'run-1', item, action: 'restore' })), intent: 'undo-rejection' }));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Rejections undone.', expect.any(Object)));
  });

  it('Keep proposals closes the Reject remaining row', () => {
    panel([add, { ...add, itemKey: 'i-3' }]);
    fireEvent.click(screen.getByRole('button', { name: /^Reject remaining \(2\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep proposals' }));
    expect(screen.queryByRole('button', { name: 'Reject 2 proposals' })).toBeNull();
  });
});
