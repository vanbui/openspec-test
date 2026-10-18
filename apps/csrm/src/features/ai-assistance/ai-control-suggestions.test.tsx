import { useState } from 'react';
import { flushSync } from 'react-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Action } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const decideAiProposalsAction = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('./ai-assistance-actions', () => ({ decideAiProposalsAction }));
vi.mock('sonner', () => ({ toast }));

import type { AiSuggestionReview } from '../assessments/assessment-schema';
import { AiControlSuggestions } from './ai-control-suggestions';

/* The toast's action, as Sonner receives it: Undo, Try again or Refresh page. */
function toastAction(call: unknown[] | undefined): Action | undefined {
  return (call?.[1] as { action?: Action } | undefined)?.action;
}

const suggestion = (key: string, name: string, state: AiSuggestionReview['state'] = 'proposed'): AiSuggestionReview => ({
  key, control: { documentId: `control-${key}`, controlNumber: key, name, description: null }, rationale: `Applicable to Internet Exposure risks: ${name}.`, state, by: null, at: null, implementation: null,
});
const integrity = suggestion('UATA-001', 'File integrity verification');
const duties = suggestion('UATA-002', 'Segregation of duties');

function renderSuggestions(suggestions: readonly AiSuggestionReview[], overrides: Partial<{ onControlsChanged: () => Promise<void>; onUpdated: () => Promise<void> }> = {}) {
  const onControlsChanged = overrides.onControlsChanged ?? vi.fn(async () => undefined);
  const onUpdated = overrides.onUpdated ?? vi.fn(async () => undefined);
  const view = render(<AiControlSuggestions assessmentId="assessment-1" onControlsChanged={onControlsChanged} onUpdated={onUpdated} riskId="risk-1" riskNumber="RSK-001" suggestions={suggestions} />);
  return { ...view, onControlsChanged, onUpdated };
}

async function settle() {
  await act(async () => { await vi.advanceTimersByTimeAsync(20); });
}

describe('AiControlSuggestions (12-UI-SPEC §5, §6)', () => {
  beforeEach(() => { vi.useFakeTimers(); decideAiProposalsAction.mockReset(); toast.success.mockReset(); toast.error.mockReset(); toast.dismiss.mockReset(); });
  afterEach(() => vi.useRealTimers());

  it('lists each proposed suggestion with its label, rationale and named actions', () => {
    renderSuggestions([integrity, duties, suggestion('UATA-003', 'Backup recovery testing', 'present')]);
    expect(screen.getByRole('heading', { level: 4, name: 'Suggested by AI' })).toHaveAttribute('tabindex', '-1');
    const list = screen.getByRole('list', { name: 'Suggested by AI' });
    expect(within(list).getByText('UATA-001 · File integrity verification')).toBeInTheDocument();
    expect(within(list).getByText('Applicable to Internet Exposure risks: File integrity verification.')).toHaveClass('whitespace-pre-wrap');
    expect(within(list).getByRole('button', { name: 'Add as planned control: UATA-001 · File integrity verification' })).toBeEnabled();
    expect(within(list).getByRole('button', { name: 'Dismiss suggestion: UATA-001 · File integrity verification' })).toBeEnabled();
    expect(within(list).getByText('Already a mitigation control')).toBeInTheDocument();
    expect(within(list).getAllByRole('button')).toHaveLength(4);
  });

  /* axe landmark-unique (the pilot's walk): every Risk shows the block, so its region is named by its Risk. */
  it('names each Risk’s region by its Risk, under the visible heading Suggested by AI', () => {
    const decisions = { assessmentId: 'assessment-1', onControlsChanged: vi.fn(async () => undefined), onUpdated: vi.fn(async () => undefined) };
    render(<>
      <AiControlSuggestions {...decisions} riskId="risk-1" riskNumber="RSK-001" suggestions={[integrity]} />
      <AiControlSuggestions {...decisions} riskId="risk-2" riskNumber="RSK-002" suggestions={[duties]} />
    </>);
    expect(screen.getByRole('region', { name: 'Suggested by AI for RSK-001' })).toHaveTextContent('UATA-001 · File integrity verification');
    expect(screen.getByRole('region', { name: 'Suggested by AI for RSK-002' })).toHaveTextContent('UATA-002 · Segregation of duties');
    expect(screen.queryByRole('region', { name: 'Suggested by AI' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4, name: 'Suggested by AI' })).toHaveLength(2);
    expect(screen.getAllByRole('list', { name: 'Suggested by AI' })).toHaveLength(2);
  });

  /* Stage B S1 (X-14, WCAG 2.2.1): a suggestion's Undo toast stays up while focus is inside the toast region. */
  it('keeps a dismissal’s Undo toast up while focus is inside the toast region, then closes it on the success timing', async () => {
    decideAiProposalsAction.mockResolvedValue({ ok: true, data: { applied: 1, unchanged: 0 } });
    renderSuggestions([integrity, duties]);
    const region = document.createElement('ol');
    region.setAttribute('data-sonner-toaster', '');
    const undo = document.createElement('button');
    region.append(undo);
    document.body.append(region);
    try {
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-001/ }));
      await settle();
      const [message, options] = toast.success.mock.calls[0];
      expect(message).toBe('Suggestion dismissed: UATA-001 · File integrity verification.');
      expect(options.duration).toBe(Infinity);
      act(() => undo.focus());
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(toast.dismiss).not.toHaveBeenCalledWith(options.id);
      act(() => screen.getByRole('button', { name: /^Add as planned control: UATA-002/ }).focus());
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
      expect(toast.dismiss).toHaveBeenCalledWith(options.id);
    } finally {
      region.remove();
    }
  });

  it('adds a planned control after the server answers, with Undo that removes it', async () => {
    decideAiProposalsAction.mockResolvedValue({ ok: true, data: { applied: 1, unchanged: 0 } });
    const { onControlsChanged } = renderSuggestions([integrity, duties]);
    const add = screen.getByRole('button', { name: /^Add as planned control: UATA-001/ });
    fireEvent.click(add);
    expect(add).toHaveTextContent('Adding…');
    expect(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-001/ })).toBeDisabled();
    await settle();
    expect(decideAiProposalsAction).toHaveBeenCalledWith({ assessmentId: 'assessment-1', decisions: [{ target: { kind: 'risk', riskId: 'risk-1' }, action: 'accept', suggestion: 'UATA-001' }] });
    expect(onControlsChanged).toHaveBeenCalledTimes(1);
    const [message, options] = toast.success.mock.calls[0];
    expect(message).toBe('UATA-001 · File integrity verification added as a planned control on RSK-001.');
    expect(screen.getByRole('button', { name: /^Add as planned control: UATA-002/ })).toHaveFocus();
    await act(async () => { options.action.onClick(); await vi.advanceTimersByTimeAsync(20); });
    expect(decideAiProposalsAction).toHaveBeenLastCalledWith({ assessmentId: 'assessment-1', decisions: [{ target: { kind: 'risk', riskId: 'risk-1' }, action: 'restore', suggestion: 'UATA-001' }] });
    expect(toast.success).toHaveBeenLastCalledWith('Planned control removed. The suggestion is back.', expect.anything());
    expect(onControlsChanged).toHaveBeenCalledTimes(2);
  });

  it('explains a refused Undo when the planned control changed, and offers no refresh for a fix made on the page', async () => {
    decideAiProposalsAction
      .mockResolvedValueOnce({ ok: true, data: { applied: 1, unchanged: 0 } })
      .mockResolvedValueOnce({ ok: false, status: 409, reason: 'AI_SUGGESTION_CONTROL_CHANGED', kind: 'blocked', formError: 'The planned control has changed since it was added, so it stays. Remove it from the risk if it should go.' });
    renderSuggestions([integrity]);
    fireEvent.click(screen.getByRole('button', { name: /^Add as planned control/ }));
    await settle();
    await act(async () => { toast.success.mock.calls[0][1].action.onClick(); await vi.advanceTimersByTimeAsync(20); });
    expect(toast.error).toHaveBeenCalledWith('Couldn’t undo', expect.objectContaining({
      description: 'The planned control has changed since it was added, so it stays. Remove it from the risk if it should go.',
    }));
    // WR-303: the sentence says what to do on this page, so the toast offers no refresh.
    expect(toastAction(toast.error.mock.calls[0])).toBeUndefined();
  });

  /* WR-303: Refresh page re-reads the Risk's suggestions and mitigation controls in place, never reloading the document. */
  it('refreshes the suggestions and the mitigation controls in place from a blocked refusal', async () => {
    decideAiProposalsAction.mockResolvedValueOnce({ ok: false, status: 409, reason: 'AI_PROPOSAL_ALREADY_DECIDED', kind: 'blocked', formError: 'This proposal is no longer open. Refresh the page to see where it stands.' });
    const { onControlsChanged, onUpdated } = renderSuggestions([integrity]);
    fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion/ }));
    await settle();
    const refresh = toastAction(toast.error.mock.calls[0]);
    expect(refresh?.label).toBe('Refresh page');
    expect(onUpdated).not.toHaveBeenCalled();
    act(() => refresh?.onClick({} as never));
    expect(onUpdated).toHaveBeenCalledOnce();
    expect(onControlsChanged).toHaveBeenCalledOnce();
    expect(decideAiProposalsAction).toHaveBeenCalledTimes(1);
  });

  /* WR-405: the failure titles of 12-UI-SPEC §6.1, each with Try again sending the same decision. */
  it('titles a refused Add Control not added, and Try again adds it', async () => {
    decideAiProposalsAction.mockResolvedValueOnce({ ok: false, kind: 'retryable', formError: 'We couldn’t record your review. Try again.' }).mockResolvedValueOnce({ ok: true, data: { applied: 1, unchanged: 0 } });
    const { onControlsChanged } = renderSuggestions([integrity]);
    fireEvent.click(screen.getByRole('button', { name: /^Add as planned control/ }));
    await settle();
    expect(toast.error).toHaveBeenCalledWith('Control not added', expect.objectContaining({ description: 'We couldn’t record your review. Try again.', duration: Infinity }));
    expect(onControlsChanged).not.toHaveBeenCalled();
    const retry = toastAction(toast.error.mock.calls[0]);
    expect(retry?.label).toBe('Try again');
    await act(async () => { retry?.onClick({} as never); await vi.advanceTimersByTimeAsync(20); });
    expect(decideAiProposalsAction.mock.calls[1][0]).toEqual(decideAiProposalsAction.mock.calls[0][0]);
    expect(onControlsChanged).toHaveBeenCalledOnce();
  });

  it('titles a refused Restore Suggestion not restored, and puts the row back in the dismissed list', async () => {
    decideAiProposalsAction.mockResolvedValueOnce({ ok: false, kind: 'retryable', formError: 'We couldn’t record your review. Try again.' });
    renderSuggestions([{ ...integrity, state: 'dismissed' }, duties]);
    fireEvent.click(screen.getByRole('button', { name: 'Show dismissed suggestions (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore suggestion: UATA-001 · File integrity verification' }));
    await settle();
    expect(decideAiProposalsAction).toHaveBeenCalledWith({ assessmentId: 'assessment-1', decisions: [{ target: { kind: 'risk', riskId: 'risk-1' }, action: 'restore', suggestion: 'UATA-001' }] });
    expect(toast.error).toHaveBeenCalledWith('Suggestion not restored', expect.objectContaining({ description: 'We couldn’t record your review. Try again.' }));
    expect(toastAction(toast.error.mock.calls[0])?.label).toBe('Try again');
    expect(screen.getByRole('button', { name: 'Restore suggestion: UATA-001 · File integrity verification' })).toBeInTheDocument();
  });

  it('dismisses at once with Undo, and restores from the dismissed list', async () => {
    decideAiProposalsAction.mockResolvedValue({ ok: true, data: { applied: 1, unchanged: 0 } });
    const { rerender, onUpdated, onControlsChanged } = renderSuggestions([integrity, duties]);
    fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-001/ }));
    expect(screen.queryByRole('button', { name: /^Add as planned control: UATA-001/ })).not.toBeInTheDocument();
    await settle();
    expect(decideAiProposalsAction).toHaveBeenCalledWith({ assessmentId: 'assessment-1', decisions: [{ target: { kind: 'risk', riskId: 'risk-1' }, action: 'dismiss', suggestion: 'UATA-001' }] });
    expect(toast.success).toHaveBeenCalledWith('Suggestion dismissed: UATA-001 · File integrity verification.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));

    rerender(<AiControlSuggestions assessmentId="assessment-1" onControlsChanged={onControlsChanged} onUpdated={onUpdated} riskId="risk-1" riskNumber="RSK-001" suggestions={[{ ...integrity, state: 'dismissed' }, duties]} />);
    const toggle = screen.getByRole('button', { name: 'Show dismissed suggestions (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide dismissed suggestions' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Restore suggestion: UATA-001 · File integrity verification' }));
    await settle();
    expect(decideAiProposalsAction).toHaveBeenLastCalledWith({ assessmentId: 'assessment-1', decisions: [{ target: { kind: 'risk', riskId: 'risk-1' }, action: 'restore', suggestion: 'UATA-001' }] });
    expect(toast.success).toHaveBeenLastCalledWith('Suggestion restored: UATA-001 · File integrity verification.', expect.anything());
  });

  /*
   * WR-302: each decision Strapi accepted is applied to the Risk's suggestions before the editor reads them again, so a
   * failed read never puts back a row that was dismissed, added or restored. A refused decision is never applied.
   */
  it('applies each accepted decision to the Risk before reading it again, and keeps a dismissed row out when that read fails', async () => {
    decideAiProposalsAction.mockResolvedValue({ ok: true, data: { applied: 1, unchanged: 0 } });
    const reviewed = vi.fn();
    function Suggestions() {
      const [items, setItems] = useState<readonly AiSuggestionReview[]>([integrity, duties]);
      return (
        <AiControlSuggestions
          assessmentId="assessment-1"
          onControlsChanged={async () => undefined}
          onReviewed={(key, state) => { reviewed(key, state); setItems((current) => current.map((item) => (item.key === key ? { ...item, state } : item))); }}
          onUpdated={async () => undefined /* the read fails: the editor keeps what it holds */}
          riskId="risk-1"
          riskNumber="RSK-001"
          suggestions={items}
        />
      );
    }
    render(<Suggestions />);
    fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-001/ }));
    await settle();
    expect(reviewed).toHaveBeenLastCalledWith('UATA-001', 'dismissed');
    expect(screen.queryByRole('button', { name: /^Add as planned control: UATA-001/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show dismissed suggestions (1)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Add as planned control: UATA-002/ }));
    await settle();
    expect(reviewed).toHaveBeenLastCalledWith('UATA-002', 'added');
    expect(screen.getByText('Added as a planned control')).toBeInTheDocument();

    await act(async () => { toastAction(toast.success.mock.calls[1])?.onClick({} as never); await vi.advanceTimersByTimeAsync(20); });
    expect(reviewed).toHaveBeenLastCalledWith('UATA-002', 'proposed');
    expect(screen.getByRole('button', { name: /^Add as planned control: UATA-002/ })).toBeInTheDocument();

    decideAiProposalsAction.mockResolvedValueOnce({ ok: false, kind: 'retryable', formError: 'We couldn’t record your review. Try again.' });
    fireEvent.click(screen.getByRole('button', { name: 'Show dismissed suggestions (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore suggestion: UATA-001 · File integrity verification' }));
    await settle();
    expect(reviewed).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Restore suggestion: UATA-001 · File integrity verification' })).toBeInTheDocument();
  });

  it('rolls a refused dismissal back with the family J copy', async () => {
    decideAiProposalsAction.mockResolvedValue({ ok: false, status: 409, reason: 'AI_PROPOSAL_ALREADY_DECIDED', kind: 'blocked', formError: 'This proposal is no longer open. Refresh the page to see where it stands.' });
    renderSuggestions([integrity]);
    fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion/ }));
    await settle();
    expect(toast.error).toHaveBeenCalledWith('Suggestion not dismissed', expect.objectContaining({ description: 'This proposal is no longer open. Refresh the page to see where it stands.' }));
    expect(screen.getByRole('button', { name: /^Add as planned control/ })).toBeInTheDocument();
  });

  it('says when nothing was suggested, and when every suggestion was dismissed', () => {
    const { rerender } = renderSuggestions([]);
    expect(screen.getByText('The AI suggested no controls for this Risk. Use Add mitigation control to choose one from the library.')).toBeInTheDocument();
    rerender(<AiControlSuggestions assessmentId="assessment-1" onControlsChanged={vi.fn()} onUpdated={vi.fn()} riskId="risk-1" riskNumber="RSK-001" suggestions={[{ ...integrity, state: 'dismissed' }]} />);
    expect(screen.getByText('You dismissed every suggestion for this Risk.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show dismissed suggestions (1)' })).toBeInTheDocument();
  });

  /*
   * 12-UI-SPEC §6.2 (WR-301): after Add or Dismiss, the next suggestion's first action, else the previous one's, read
   * from the order the analyst saw when they decided, not the order after the row changed.
   */
  describe('focus after a decision', () => {
    const recovery = suggestion('UATA-003', 'Backup recovery testing');
    const served = new Map<string, AiSuggestionReview['state']>();

    /*
     * The editor's re-read commits before the next frame in a browser; here it commits at once, because the test's
     * act() would otherwise hold the render back until after the frame that moves focus.
     */
    function LiveSuggestions({ initial }: { initial: readonly AiSuggestionReview[] }) {
      const [items, setItems] = useState(initial);
      return (
        <AiControlSuggestions
          assessmentId="assessment-1"
          onControlsChanged={async () => undefined}
          onUpdated={async () => flushSync(() => setItems((current) => current.map((item) => ({ ...item, state: served.get(item.key) ?? item.state }))))}
          riskId="risk-1"
          riskNumber="RSK-001"
          suggestions={items}
        />
      );
    }

    beforeEach(() => {
      served.clear();
      decideAiProposalsAction.mockImplementation(async ({ decisions }: { decisions: { action: 'accept' | 'dismiss' | 'restore'; suggestion: string }[] }) => {
        for (const decision of decisions) served.set(decision.suggestion, decision.action === 'accept' ? 'added' : decision.action === 'dismiss' ? 'dismissed' : 'proposed');
        return { ok: true, data: { applied: 1, unchanged: 0 } };
      });
    });

    it('moves focus to the next suggestion after a Dismiss', async () => {
      render(<LiveSuggestions initial={[integrity, duties, recovery]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-002/ }));
      await settle();
      expect(screen.getByRole('button', { name: /^Add as planned control: UATA-003/ })).toHaveFocus();
    });

    it('moves focus to the previous suggestion after the last one is dismissed', async () => {
      render(<LiveSuggestions initial={[integrity, duties, recovery]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-003/ }));
      await settle();
      expect(screen.getByRole('button', { name: /^Add as planned control: UATA-002/ })).toHaveFocus();
    });

    it('moves focus to the next suggestion once an Add has been recorded', async () => {
      render(<LiveSuggestions initial={[integrity, duties, recovery]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Add as planned control: UATA-002/ }));
      await settle();
      expect(screen.getByText('Added as a planned control')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Add as planned control: UATA-003/ })).toHaveFocus();
    });

    it('moves focus to the heading when no suggestion is left to decide', async () => {
      render(<LiveSuggestions initial={[integrity]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-001/ }));
      await settle();
      expect(screen.getByRole('heading', { level: 4, name: 'Suggested by AI' })).toHaveFocus();
    });

    it('returns focus to the restored suggestion after Undo of a Dismiss, and after Restore', async () => {
      render(<LiveSuggestions initial={[integrity, duties, recovery]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-001/ }));
      await settle();
      expect(screen.getByRole('button', { name: /^Add as planned control: UATA-002/ })).toHaveFocus();
      await act(async () => { toastAction(toast.success.mock.calls[0])?.onClick({} as never); await vi.advanceTimersByTimeAsync(20); });
      expect(toast.success).toHaveBeenLastCalledWith('Suggestion restored.', expect.anything());
      expect(screen.getByRole('button', { name: /^Add as planned control: UATA-001/ })).toHaveFocus();

      fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-001/ }));
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'Show dismissed suggestions (1)' }));
      fireEvent.click(screen.getByRole('button', { name: 'Restore suggestion: UATA-001 · File integrity verification' }));
      await settle();
      expect(screen.getByRole('button', { name: /^Add as planned control: UATA-001/ })).toHaveFocus();
    });

    /*
     * Walk D3: Sonner hands focus back to wherever it was before the toast region took it, once focus leaves the
     * region. Undo leaves the region at once, so that hand-back cannot land later over the restored suggestion's Add.
     */
    it('takes focus out of the toast region as soon as Undo runs', async () => {
      render(<LiveSuggestions initial={[integrity, duties]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss suggestion: UATA-001/ }));
      await settle();
      const region = document.createElement('ol');
      region.setAttribute('data-sonner-toaster', '');
      const undo = document.createElement('button');
      region.append(undo);
      document.body.append(region);
      undo.focus();
      act(() => toastAction(toast.success.mock.calls[0])?.onClick({} as never));
      expect(region.contains(document.activeElement)).toBe(false);
      await settle();
      expect(screen.getByRole('button', { name: /^Add as planned control: UATA-001/ })).toHaveFocus();
      region.remove();
    });
  });

  /*
   * Stage B S2 (direction §4 Buttons: touch targets of at least 44px below 768px): every suggestion action keeps the
   * touch-target height up to 767px and takes the small height from 768px, never from 640px.
   */
  it('keeps every suggestion action at the touch-target height below 768px', () => {
    renderSuggestions([integrity, { ...duties, state: 'dismissed' }]);
    const toggle = screen.getByRole('button', { name: 'Show dismissed suggestions (1)' });
    expect(toggle).toHaveClass('max-md:min-h-11');
    fireEvent.click(toggle);
    for (const name of [/^Add as planned control: UATA-001/, /^Dismiss suggestion: UATA-001/, /^Restore suggestion: UATA-002/]) {
      const action = screen.getByRole('button', { name });
      expect(action, String(name)).toHaveClass('min-h-11', 'md:min-h-8');
      expect(action, String(name)).not.toHaveClass('sm:min-h-8');
    }
  });

  it('stacks full-width actions on a phone, Add first, and never prints', () => {
    const { container } = renderSuggestions([integrity]);
    const add = screen.getByRole('button', { name: /^Add as planned control/ });
    expect(add).toHaveClass('w-full', 'min-h-11', 'sm:w-auto');
    expect(add.compareDocumentPosition(screen.getByRole('button', { name: /^Dismiss/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('section')).toHaveAttribute('data-print', 'hidden');
  });
});
