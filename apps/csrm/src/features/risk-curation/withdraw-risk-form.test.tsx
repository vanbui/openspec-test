import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import type { Action } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  withdrawRisksAction: vi.fn(),
  reinstateRisksAction: vi.fn(),
  undoWithdrawalAction: vi.fn(),
  undoReinstatementAction: vi.fn(),
}));
const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }));
vi.mock('./risk-curation-actions', () => actions);
vi.mock('sonner', () => ({ toast: notifications }));

import { RiskCardActions } from './risk-card-actions';
import { partitionByWithdrawal, type CurationAct } from './risk-curation-domain';
import { useRiskWithdrawal, type WithdrawalCandidate } from './use-risk-withdrawal';
import { WithdrawRiskForm } from './withdraw-risk-form';

/*
 * 16-UI-SPEC §6.1 and §6.5 (X-27; D-11, D-47, UI-D8): withdrawing a Risk from its card. The harness stands in for the
 * assessment editor (16-14): it lists the active and withdrawn cards from the hook's view of the Risks, opens the form
 * from the card's action, reopens it from a refusal, and re-reads the Risks the "server" holds when the hook asks.
 */
type Card = WithdrawalCandidate;

const viewer = { documentId: 'analyst-1', displayName: 'Bob Analyst' };
const withdrawnFacts = { at: '2026-10-14T03:00:00.000Z', by: viewer, reason: 'Proposed under the wrong Risk Type' };
const DRAFT_KEY = 'csrm-draft:risk-withdraw-reason:owner-a:risk-3';
const R1_NOT_MUTABLE = 'This assessment can no longer be changed, so the risk wasn’t withdrawn. Refresh the page to see its current state.';

let server: Card[] = [];
const initialRisks = (): Card[] => [
  { documentId: 'risk-2', riskNumber: 'R-2', withdrawal: null },
  { documentId: 'risk-3', riskNumber: 'R-3', withdrawal: null },
  { documentId: 'risk-4', riskNumber: 'R-4', withdrawal: null },
];

function serverApplies(riskId: string, withdrawal: Card['withdrawal']) {
  server = server.map((risk) => (risk.documentId === riskId ? { ...risk, withdrawal } : risk));
  return { ok: true, data: { applied: [riskId], unchanged: [] } };
}

function Harness({ hasUnsavedChanges = false }: { hasUnsavedChanges?: boolean }) {
  const [risks, setRisks] = useState<Card[]>(() => server.map((risk) => ({ ...risk })));
  const [open, setOpen] = useState<{ riskId: string; mode: CurationAct; opener: HTMLElement | null } | null>(null);
  const curation = useRiskWithdrawal({
    assessmentId: 'assessment-1',
    risks,
    draftOwnerKey: 'owner-a',
    viewer,
    onChanged: async () => { setRisks(server.map((risk) => ({ ...risk }))); },
  });
  const { active, withdrawn } = partitionByWithdrawal(curation.risks);

  function form(risk: Card, mode: CurationAct) {
    const refusal = curation.refusal?.riskId === risk.documentId && curation.refusal.mode === mode ? curation.refusal : null;
    if (!refusal && (open?.riskId !== risk.documentId || open.mode !== mode)) return null;
    return (
      <WithdrawRiskForm
        draftOwnerKey="owner-a"
        error={refusal?.message ?? null}
        hasUnsavedChanges={hasUnsavedChanges}
        initialReason={refusal?.reason}
        key={refusal ? `refusal-${refusal.attempt}` : 'form'}
        mode={mode}
        onKeep={() => { setOpen(null); curation.clearRefusal(); }}
        onSubmit={(reason) => {
          setOpen(null);
          curation.clearRefusal();
          if (mode === 'withdraw') curation.withdraw(risk, reason);
          else curation.reinstate(risk, reason);
        }}
        openChanges={0}
        returnFocusTo={open?.opener ?? null}
        riskId={risk.documentId}
        riskNumber={risk.riskNumber}
      />
    );
  }

  return (
    <>
      <div aria-label="Show" data-risk-show="" role="radiogroup" tabIndex={-1} />
      <ul aria-label="Active" data-risk-list="">
        {active.map((risk) => (
          <li key={risk.documentId}>
            <article data-pending={curation.pending.has(risk.documentId)} data-risk-card="" id={`risk-${risk.documentId}`} tabIndex={-1}>
              <h3>{risk.riskNumber}</h3>
              <RiskCardActions onHistory={() => undefined} onWithdraw={(opener) => setOpen({ riskId: risk.documentId, mode: 'withdraw', opener })} rewrite={null} riskId={risk.documentId} riskNumber={risk.riskNumber} />
              {form(risk, 'withdraw')}
            </article>
          </li>
        ))}
      </ul>
      <ul aria-label="Withdrawn" data-risk-list="">
        {withdrawn.map((risk) => (
          <li key={risk.documentId}>
            <article data-pending={curation.pending.has(risk.documentId)} data-risk-card="" id={`risk-${risk.documentId}`} tabIndex={-1}>
              <h3>{risk.riskNumber}</h3>
              <button onClick={(event) => setOpen({ riskId: risk.documentId, mode: 'reinstate', opener: event.currentTarget })} type="button">Reinstate risk {risk.riskNumber}</button>
              {form(risk, 'reinstate')}
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}

const activeList = () => screen.getByRole('list', { name: 'Active' });
const withdrawnList = () => screen.getByRole('list', { name: 'Withdrawn' });
const pills = (riskNumber: string) => document.querySelector<HTMLElement>(`#risk-risk-${riskNumber.slice(2)} [data-card-actions="pills"]`)!;

async function openWithdrawForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(pills('R-3')).getByRole('button', { name: 'Withdraw risk R-3' }));
  return screen.getByRole('textbox', { name: 'Reason for withdrawing' });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

/* The Undo that the success toast offers, as Sonner receives it. */
const toastAction = (call: unknown[] | undefined): Action => (call?.[1] as { action: Action }).action;

beforeEach(() => {
  server = initialRisks();
  window.sessionStorage.clear();
  for (const mock of [...Object.values(actions), ...Object.values(notifications)]) mock.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe('WithdrawRiskForm (§6.1)', () => {
  it('opens in place from Withdraw risk with focus in Reason for withdrawing, its description and hint', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = await openWithdrawForm(user);
    expect(field).toHaveFocus();
    expect(field).toBeRequired();
    const form = screen.getByRole('form', { name: 'Withdraw R-3' });
    expect(form).toHaveClass('bg-surface-muted', 'border-border', 'rounded-lg');
    expect(within(form).getByRole('heading', { level: 4, name: 'Withdraw R-3' })).toBeInTheDocument();
    expect(form).toHaveTextContent('A withdrawn risk leaves this assessment, its counts and release readiness. It keeps its details and history, and you can reinstate it while the assessment is being edited.');
    expect(field).toHaveAccessibleDescription(expect.stringContaining('Kept in the risk’s history. The AI reads it, so it doesn’t propose this risk again.'));
    expect(within(form).getByRole('button', { name: 'Withdraw risk' })).toHaveAttribute('type', 'submit');
    expect(within(form).getByRole('button', { name: 'Keep risk' })).toBeInTheDocument();
    expect(form.querySelector('[data-variant="destructive"], .bg-destructive')).toBeNull();
  });

  it('names the open AI changes that will close, or says any will for the requesting analyst', () => {
    const { rerender } = render(<WithdrawRiskForm draftOwnerKey={null} mode="withdraw" onKeep={vi.fn()} onSubmit={vi.fn()} openChanges={2} riskId="risk-3" riskNumber="R-3" />);
    expect(screen.getByRole('form', { name: 'Withdraw R-3' })).toHaveTextContent('reinstate it while the assessment is being edited. Its 2 open AI changes will close without a decision.');
    rerender(<WithdrawRiskForm draftOwnerKey={null} mode="withdraw" onKeep={vi.fn()} onSubmit={vi.fn()} openChanges={1} riskId="risk-3" riskNumber="R-3" />);
    expect(screen.getByRole('form', { name: 'Withdraw R-3' })).toHaveTextContent('Its 1 open AI change will close without a decision.');
    rerender(<WithdrawRiskForm draftOwnerKey={null} mode="withdraw" onKeep={vi.fn()} onSubmit={vi.fn()} openChanges={null} riskId="risk-3" riskNumber="R-3" />);
    expect(screen.getByRole('form', { name: 'Withdraw R-3' })).toHaveTextContent('being edited. Any open AI changes on it will close without a decision.');
  });

  it('Enter with an empty reason says to give one, and sends nothing', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = await openWithdrawForm(user);
    await user.type(field, '   {Enter}');
    expect(screen.getByText('Give a reason for withdrawing this risk.')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveFocus();
    expect(actions.withdrawRisksAction).not.toHaveBeenCalled();
  });

  it('counts the characters once typed and says a 501-character reason is too long, with its count', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = await openWithdrawForm(user);
    expect(screen.queryByText(/of 500 characters/)).toBeNull();
    fireEvent.change(field, { target: { value: 'x'.repeat(501) } });
    expect(screen.getByText('501 of 500 characters')).toBeInTheDocument();
    await user.type(field, '{Enter}');
    expect(screen.getByText('Keep the reason to 500 characters or fewer. It has 501.')).toBeInTheDocument();
    expect(actions.withdrawRisksAction).not.toHaveBeenCalled();
  });

  it('counts the reason as it is kept, without the spaces around it, as the length rule does (FE3-11)', async () => {
    const user = userEvent.setup();
    actions.withdrawRisksAction.mockImplementation(async () => serverApplies('risk-3', withdrawnFacts));
    render(<Harness />);
    const field = await openWithdrawForm(user);
    fireEvent.change(field, { target: { value: `  ${'x'.repeat(500)}  ` } });
    expect(screen.getByText('500 of 500 characters')).toBeInTheDocument();
    await user.type(field, '{Enter}');
    expect(screen.queryByText(/^Keep the reason to 500 characters or fewer/)).toBeNull();
    expect(actions.withdrawRisksAction).toHaveBeenCalledWith({ assessmentId: 'assessment-1', riskIds: ['risk-3'], reason: 'x'.repeat(500) });
  });

  it('Escape keeps the risk: the form closes and focus returns to Withdraw risk', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = await openWithdrawForm(user);
    await user.type(field, 'Wrong type{Escape}');
    expect(screen.queryByRole('form', { name: 'Withdraw R-3' })).toBeNull();
    await waitFor(() => expect(within(pills('R-3')).getByRole('button', { name: 'Withdraw risk R-3' })).toHaveFocus());
    expect(actions.withdrawRisksAction).not.toHaveBeenCalled();
  });

  it('Keep risk does the same as Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openWithdrawForm(user);
    await user.click(screen.getByRole('button', { name: 'Keep risk' }));
    expect(screen.queryByRole('form', { name: 'Withdraw R-3' })).toBeNull();
    await waitFor(() => expect(within(pills('R-3')).getByRole('button', { name: 'Withdraw risk R-3' })).toHaveFocus());
  });

  it('applies at once: one action, the card leaves Active at the pending opacity, focus moves on, then the Undo toast', async () => {
    const user = userEvent.setup();
    const reply = deferred<unknown>();
    actions.withdrawRisksAction.mockImplementation(() => reply.promise);
    render(<Harness />);
    const field = await openWithdrawForm(user);
    await user.type(field, 'Proposed under the wrong Risk Type{Enter}');
    expect(actions.withdrawRisksAction).toHaveBeenCalledTimes(1);
    expect(actions.withdrawRisksAction).toHaveBeenCalledWith({ assessmentId: 'assessment-1', riskIds: ['risk-3'], reason: 'Proposed under the wrong Risk Type' });
    expect(within(activeList()).queryByRole('heading', { name: 'R-3' })).toBeNull();
    const card = within(withdrawnList()).getByRole('heading', { name: 'R-3' }).closest('article')!;
    expect(card).toHaveAttribute('data-pending', 'true');
    await waitFor(() => expect(document.getElementById('risk-risk-4')).toHaveFocus());
    await act(async () => reply.resolve(serverApplies('risk-3', withdrawnFacts)));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('R-3 withdrawn.', expect.any(Object)));
    expect(toastAction(notifications.success.mock.calls[0]).label).toBe('Undo');
    expect(within(withdrawnList()).getByRole('heading', { name: 'R-3' }).closest('article')).toHaveAttribute('data-pending', 'false');
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('says so, and keeps the reason, when another analyst withdrew the risk first (FE3-04)', async () => {
    const user = userEvent.setup();
    const otherAnalyst = { documentId: 'analyst-2', displayName: 'Ada Analyst' };
    actions.withdrawRisksAction.mockImplementation(async () => {
      server = server.map((risk) => (risk.documentId === 'risk-3' ? { ...risk, withdrawal: { ...withdrawnFacts, by: otherAnalyst, reason: 'Duplicate' } } : risk));
      return { ok: true, data: { applied: [], unchanged: ['risk-3'] } };
    });
    render(<Harness />);
    await user.type(await openWithdrawForm(user), 'Proposed under the wrong Risk Type{Enter}');

    await waitFor(() => expect(notifications.warning).toHaveBeenCalledWith('R-3 was already withdrawn. Your reason wasn’t recorded.', expect.objectContaining({ duration: Infinity })));
    expect(notifications.success).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBe('Proposed under the wrong Risk Type');
    expect(within(withdrawnList()).getByRole('heading', { name: 'R-3' })).toBeInTheDocument();
  });

  it('moves focus to the previous card when the withdrawn one was the last', async () => {
    const user = userEvent.setup();
    actions.withdrawRisksAction.mockImplementation(async ({ riskIds }: { riskIds: string[] }) => serverApplies(riskIds[0]!, withdrawnFacts));
    render(<Harness />);
    await user.click(within(pills('R-4')).getByRole('button', { name: 'Withdraw risk R-4' }));
    await user.type(screen.getByRole('textbox', { name: 'Reason for withdrawing' }), 'Duplicate{Enter}');
    await waitFor(() => expect(document.getElementById('risk-risk-3')).toHaveFocus());
  });

  it('Undo sends the undo flag and no reason, brings the card back with focus and says the withdrawal is undone', async () => {
    const user = userEvent.setup();
    actions.withdrawRisksAction.mockImplementation(async () => serverApplies('risk-3', withdrawnFacts));
    actions.undoWithdrawalAction.mockImplementation(async () => serverApplies('risk-3', null));
    render(<Harness />);
    await user.type(await openWithdrawForm(user), 'Proposed under the wrong Risk Type{Enter}');
    await waitFor(() => expect(notifications.success).toHaveBeenCalledTimes(1));
    await act(async () => toastAction(notifications.success.mock.calls[0]).onClick({} as never));
    expect(actions.undoWithdrawalAction).toHaveBeenCalledWith({ assessmentId: 'assessment-1', riskIds: ['risk-3'] });
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Withdrawal undone. R-3 is back in the assessment.', expect.any(Object)));
    expect(within(activeList()).getByRole('heading', { name: 'R-3' })).toBeInTheDocument();
    await waitFor(() => expect(document.getElementById('risk-risk-3')).toHaveFocus());
  });

  it('Undo lands on the returned card from its start, so its number and actions show (§6.1)', async () => {
    const user = userEvent.setup();
    const scrolled = vi.fn();
    const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = scrolled;
    try {
      actions.withdrawRisksAction.mockImplementation(async () => serverApplies('risk-3', withdrawnFacts));
      actions.undoWithdrawalAction.mockImplementation(async () => serverApplies('risk-3', null));
      render(<Harness />);
      await user.type(await openWithdrawForm(user), 'Proposed under the wrong Risk Type{Enter}');
      await waitFor(() => expect(notifications.success).toHaveBeenCalledTimes(1));
      scrolled.mockClear();
      await act(async () => toastAction(notifications.success.mock.calls[0]).onClick({} as never));
      const card = () => document.getElementById('risk-risk-3');
      await waitFor(() => expect(card()).toHaveFocus());
      expect(scrolled.mock.contexts).toContain(card());
      expect(scrolled.mock.calls[scrolled.mock.contexts.indexOf(card())]).toEqual([{ block: 'start' }]);
    } finally {
      if (scrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoView);
      else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('a refused Undo stays withdrawn and says it couldn’t undo, with R1’s line', async () => {
    const user = userEvent.setup();
    actions.withdrawRisksAction.mockImplementation(async () => serverApplies('risk-3', withdrawnFacts));
    actions.undoWithdrawalAction.mockResolvedValue({ ok: false, kind: 'blocked', status: 409, reason: 'ASSESSMENT_NOT_MUTABLE', message: 'This assessment can no longer be changed, so the risk wasn’t reinstated. Refresh the page to see its current state.' });
    render(<Harness />);
    await user.type(await openWithdrawForm(user), 'Proposed under the wrong Risk Type{Enter}');
    await waitFor(() => expect(notifications.success).toHaveBeenCalledTimes(1));
    await act(async () => toastAction(notifications.success.mock.calls[0]).onClick({} as never));
    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith('Couldn’t undo', expect.objectContaining({ description: 'This assessment can no longer be changed, so the risk wasn’t reinstated. Refresh the page to see its current state.' })));
    expect(within(withdrawnList()).getByRole('heading', { name: 'R-3' })).toBeInTheDocument();
  });

  it('a refusal (409 ASSESSMENT_NOT_MUTABLE) brings the card back and reopens the form with the typed reason and R1’s line', async () => {
    const user = userEvent.setup();
    actions.withdrawRisksAction.mockResolvedValue({ ok: false, kind: 'blocked', status: 409, reason: 'ASSESSMENT_NOT_MUTABLE', message: R1_NOT_MUTABLE });
    render(<Harness />);
    await user.type(await openWithdrawForm(user), 'Proposed under the wrong Risk Type{Enter}');
    const field = await screen.findByRole('textbox', { name: 'Reason for withdrawing' });
    expect(field).toHaveValue('Proposed under the wrong Risk Type');
    await waitFor(() => expect(field).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveTextContent(R1_NOT_MUTABLE);
    const card = within(activeList()).getByRole('heading', { name: 'R-3' }).closest('article')!;
    expect(card).toHaveAttribute('data-pending', 'false');
    expect(within(withdrawnList()).queryByRole('heading', { name: 'R-3' })).toBeNull();
    expect(notifications.success).not.toHaveBeenCalled();
  });

  it('a network failure reopens the form with the retryable line', async () => {
    const user = userEvent.setup();
    actions.withdrawRisksAction.mockRejectedValue(new Error('fetch failed'));
    render(<Harness />);
    await user.type(await openWithdrawForm(user), 'Proposed under the wrong Risk Type{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t withdraw the risk. Try again.');
    expect(screen.getByRole('textbox', { name: 'Reason for withdrawing' })).toHaveValue('Proposed under the wrong Risk Type');
  });

  it('a refusal for a risk that moved meanwhile shows a danger toast and re-reads the risks', async () => {
    const user = userEvent.setup();
    actions.withdrawRisksAction.mockImplementation(async () => {
      server = server.filter((risk) => risk.documentId !== 'risk-3');
      return { ok: false, kind: 'blocked', status: 404, message: 'This risk is no longer on this assessment. Refresh the page.' };
    });
    render(<Harness />);
    await user.type(await openWithdrawForm(user), 'Duplicate{Enter}');
    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith('This risk is no longer on this assessment. Refresh the page.', expect.any(Object)));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'R-3' })).toBeNull());
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('Restored from earlier in this session: the reason survives a remount and is guarded on unload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.type(await openWithdrawForm(user), 'Wrong type');
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBe('Wrong type');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    unmount();
    render(<Harness />);
    const field = await openWithdrawForm(user);
    expect(field).toHaveValue('Wrong type');
    expect(screen.getByText('Restored from earlier in this session.')).toBeInTheDocument();
  });

  it('while the risk has unsaved changes, says so in place of the field and Withdraw risk, keeping Keep risk', async () => {
    const user = userEvent.setup();
    render(<Harness hasUnsavedChanges />);
    await user.click(within(pills('R-3')).getByRole('button', { name: 'Withdraw risk R-3' }));
    const form = screen.getByRole('form', { name: 'Withdraw R-3' });
    expect(form).toHaveTextContent('This risk has unsaved changes. Save or discard them before you withdraw it.');
    expect(within(form).queryByRole('textbox')).toBeNull();
    expect(within(form).queryByRole('button', { name: 'Withdraw risk' })).toBeNull();
    const keep = within(form).getByRole('button', { name: 'Keep risk' });
    await waitFor(() => expect(keep).toHaveFocus());
  });

  it('takes no focus when the risk’s unsaved changes come or go while the analyst works elsewhere (FE3-02)', async () => {
    const nextFrame = () => act(async () => { await new Promise((done) => requestAnimationFrame(() => done(undefined))); });
    const form = (hasUnsavedChanges: boolean) => (
      <>
        <input aria-label="Risk statement" />
        <WithdrawRiskForm draftOwnerKey={null} hasUnsavedChanges={hasUnsavedChanges} mode="withdraw" onKeep={vi.fn()} onSubmit={vi.fn()} openChanges={0} riskId="risk-3" riskNumber="R-3" />
      </>
    );
    const { rerender } = render(form(false));
    await nextFrame();
    expect(screen.getByRole('textbox', { name: 'Reason for withdrawing' })).toHaveFocus();

    const statement = screen.getByRole('textbox', { name: 'Risk statement' });
    statement.focus();
    rerender(form(true));
    await nextFrame();
    expect(statement).toHaveFocus();

    rerender(form(false));
    await nextFrame();
    expect(statement).toHaveFocus();
  });

  it('restores the kept reason once unsaved changes no longer hold the field back (FE3-10)', () => {
    window.sessionStorage.setItem(DRAFT_KEY, 'Wrong type');
    const form = (hasUnsavedChanges: boolean) => <WithdrawRiskForm draftOwnerKey="owner-a" hasUnsavedChanges={hasUnsavedChanges} mode="withdraw" onKeep={vi.fn()} onSubmit={vi.fn()} openChanges={0} riskId="risk-3" riskNumber="R-3" />;
    const { rerender } = render(form(true));
    expect(screen.queryByRole('textbox', { name: 'Reason for withdrawing' })).toBeNull();
    rerender(form(false));
    expect(screen.getByRole('textbox', { name: 'Reason for withdrawing' })).toHaveValue('Wrong type');
    expect(screen.getByText('Restored from earlier in this session.')).toBeInTheDocument();
  });

  it('at 375 renders as a bottom sheet with a title row and Close', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 767px)', media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const onKeep = vi.fn();
    render(<WithdrawRiskForm draftOwnerKey={null} mode="withdraw" onKeep={onKeep} onSubmit={vi.fn()} openChanges={0} riskId="risk-3" riskNumber="R-3" />);
    const sheet = await screen.findByRole('dialog', { name: 'Withdraw R-3' });
    expect(within(sheet).getByRole('heading', { level: 2, name: 'Withdraw R-3' })).toBeInTheDocument();
    await waitFor(() => expect(within(sheet).getByRole('textbox', { name: 'Reason for withdrawing' })).toHaveFocus());
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('imports no zod: the client goes through the typed actions', () => {
    for (const file of ['withdraw-risk-form.tsx', 'use-risk-withdrawal.ts', 'risk-card-actions.tsx']) {
      const source = readFileSync(resolve(process.cwd(), `src/features/risk-curation/${file}`), 'utf8');
      expect(source, file).not.toMatch(/from ['"]zod['"]/);
    }
  });
});

describe('Reinstating (§6.2)', () => {
  const REINSTATE_DRAFT_KEY = 'csrm-draft:risk-reinstate-reason:owner-a:risk-3';
  const withdrawnFirst = () => { server = server.map((risk) => (risk.documentId === 'risk-3' ? { ...risk, withdrawal: withdrawnFacts } : risk)); };

  async function openReinstateForm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(within(withdrawnList()).getByRole('button', { name: 'Reinstate risk R-3' }));
    return screen.getByRole('textbox', { name: 'Reason for reinstating' });
  }

  it('asks for a Reason for reinstating, with its description, hint and Keep withdrawn', async () => {
    const user = userEvent.setup();
    withdrawnFirst();
    render(<Harness />);
    const field = await openReinstateForm(user);
    expect(field).toHaveFocus();
    const form = screen.getByRole('form', { name: 'Reinstate R-3' });
    expect(form).toHaveTextContent('The risk returns to this assessment, its counts and release readiness, and can be edited again.');
    expect(field).toHaveAccessibleDescription('Kept in the risk’s history.');
    expect(within(form).getByRole('button', { name: 'Reinstate risk' })).toHaveAttribute('type', 'submit');
    await user.type(field, '{Enter}');
    expect(screen.getByText('Give a reason for reinstating this risk.')).toBeInTheDocument();
    await user.type(field, 'Belongs here after all');
    expect(window.sessionStorage.getItem(REINSTATE_DRAFT_KEY)).toBe('Belongs here after all');
    await user.click(within(form).getByRole('button', { name: 'Keep withdrawn' }));
    expect(screen.queryByRole('form', { name: 'Reinstate R-3' })).toBeNull();
    expect(actions.reinstateRisksAction).not.toHaveBeenCalled();
  });

  it('reinstates at once and offers Undo, which withdraws it again with its earlier reason through undoReinstatementAction', async () => {
    const user = userEvent.setup();
    withdrawnFirst();
    actions.reinstateRisksAction.mockImplementation(async () => serverApplies('risk-3', null));
    const undo = deferred<unknown>();
    actions.undoReinstatementAction.mockImplementation(() => undo.promise);
    render(<Harness />);
    await user.type(await openReinstateForm(user), 'Belongs here after all{Enter}');
    expect(actions.reinstateRisksAction).toHaveBeenCalledWith({ assessmentId: 'assessment-1', riskIds: ['risk-3'], reason: 'Belongs here after all' });
    await waitFor(() => expect(screen.getByRole('radiogroup', { name: 'Show' })).toHaveFocus());
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('R-3 reinstated.', expect.any(Object)));
    expect(within(activeList()).getByRole('heading', { name: 'R-3' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(REINSTATE_DRAFT_KEY)).toBeNull();
    const action = toastAction(notifications.success.mock.calls[0]);
    expect(action.label).toBe('Undo');
    act(() => action.onClick({} as never));
    expect(actions.undoReinstatementAction).toHaveBeenCalledWith({ assessmentId: 'assessment-1', riskIds: ['risk-3'] });
    const card = within(withdrawnList()).getByRole('heading', { name: 'R-3' }).closest('article')!;
    expect(card).toHaveAttribute('data-pending', 'true');
    await act(async () => undo.resolve(serverApplies('risk-3', withdrawnFacts)));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Reinstatement undone. R-3 is withdrawn again.', expect.any(Object)));
    await waitFor(() => expect(document.getElementById('risk-risk-3')).toHaveFocus());
  });

  it('says so, and keeps the reason, when another analyst reinstated the risk first (FE3-04)', async () => {
    const user = userEvent.setup();
    withdrawnFirst();
    actions.reinstateRisksAction.mockImplementation(async () => {
      server = server.map((risk) => (risk.documentId === 'risk-3' ? { ...risk, withdrawal: null } : risk));
      return { ok: true, data: { applied: [], unchanged: ['risk-3'] } };
    });
    render(<Harness />);
    await user.type(await openReinstateForm(user), 'Belongs here after all{Enter}');

    await waitFor(() => expect(notifications.warning).toHaveBeenCalledWith('R-3 was already reinstated. Your reason wasn’t recorded.', expect.objectContaining({ duration: Infinity })));
    expect(notifications.success).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(REINSTATE_DRAFT_KEY)).toBe('Belongs here after all');
  });

  it('a 409 RISK_NOT_WITHDRAWN shows R1’s line and re-reads the risks, so the card shows where it is', async () => {
    const user = userEvent.setup();
    withdrawnFirst();
    const line = 'This risk is already in the assessment. Refresh the page to see it.';
    actions.reinstateRisksAction.mockImplementation(async () => {
      server = server.map((risk) => (risk.documentId === 'risk-3' ? { ...risk, withdrawal: null } : risk));
      return { ok: false, kind: 'blocked', status: 409, reason: 'RISK_NOT_WITHDRAWN', message: line };
    });
    render(<Harness />);
    await user.type(await openReinstateForm(user), 'Belongs here after all{Enter}');
    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith(line, expect.any(Object)));
    await waitFor(() => expect(within(activeList()).getByRole('heading', { name: 'R-3' })).toBeInTheDocument());
    expect(notifications.success).not.toHaveBeenCalled();
    expect(screen.queryByRole('form')).toBeNull();
  });
});
