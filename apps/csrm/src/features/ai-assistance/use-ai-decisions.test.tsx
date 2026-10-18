import { createRef, useRef, useState } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { Action } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const action = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('./ai-assistance-actions', () => ({ decideAiProposalsAction: action }));
vi.mock('sonner', () => ({ toast: notifications }));

import type { AiFieldReview } from '../assessments/assessment-schema';
import { AiFieldMarker } from './ai-field-marker';
import { useAiDecisions } from './use-ai-decisions';

const fields = [{ field: 'issueStatement', state: 'proposed' as const, by: null, at: null, sources: [] }];
const input = () => ({ assessmentId: 'assessment-1', target: { kind: 'risk' as const, riskId: 'risk-1' }, fields, place: 'on RSK-001', formRef: createRef<HTMLFormElement>(), onUpdated: vi.fn(async () => {}) });
const applied = { ok: true, data: { applied: 1, unchanged: 0 } };

/* The toast's action, as Sonner receives it: Undo, Try again or Refresh page. */
function toastAction(call: unknown[] | undefined): Action | undefined {
  return (call?.[1] as { action?: Action } | undefined)?.action;
}

beforeEach(() => { action.mockReset(); notifications.success.mockReset(); notifications.error.mockReset(); notifications.dismiss.mockReset(); });

describe('useAiDecisions', () => {
  it('confirms immediately through one decision and offers Undo for five seconds', async () => {
    let finish!: (value: unknown) => void;
    action.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(applied);
    const props = input();
    const { result } = renderHook(() => useAiDecisions(props));
    act(() => result.current.confirm('issueStatement'));
    expect(result.current.fields[0].state).toBe('accepted');
    expect(action).toHaveBeenCalledWith({ assessmentId: 'assessment-1', decisions: [{ target: { kind: 'risk', riskId: 'risk-1' }, action: 'accept', fields: ['issueStatement'] }] });
    await act(async () => finish(applied));
    await waitFor(() => expect(notifications.success).toHaveBeenCalled());
    const [message, options] = notifications.success.mock.calls[0];
    expect(message).toBe('Issue statement confirmed on RSK-001.');
    // The five seconds are the toast's own timer, which focus pauses (stage B S1); Sonner keeps none.
    expect(options.duration).toBe(Infinity);
    expect(options.action.label).toBe('Undo');
    act(() => options.action.onClick());
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1][0].decisions[0]).toMatchObject({ action: 'restore', fields: ['issueStatement'] });
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Confirmation undone.', expect.any(Object)));
  });

  /*
   * Stage B S1 (X-14, WCAG 2.2.1): Sonner pauses a toast on hover and Alt+T, not when Tab brings focus into it. The
   * Undo toast stays up while focus is inside the toast region, and closes once 5,000 ms have passed without a pause.
   */
  it('keeps the Undo toast up while focus is inside the toast region, then closes it on the success timing', async () => {
    vi.useFakeTimers();
    const region = document.createElement('ol');
    region.setAttribute('data-sonner-toaster', '');
    const undo = document.createElement('button');
    region.append(undo);
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere, region);
    try {
      action.mockResolvedValueOnce(applied);
      const { result } = renderHook(() => useAiDecisions(input()));
      act(() => result.current.confirm('issueStatement'));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      const [message, options] = notifications.success.mock.calls[0];
      expect(message).toBe('Issue statement confirmed on RSK-001.');
      expect(options.duration).toBe(Infinity);
      act(() => undo.focus());
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(notifications.dismiss).not.toHaveBeenCalledWith(options.id);
      act(() => elsewhere.focus());
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
      expect(notifications.dismiss).toHaveBeenCalledWith(options.id);
    } finally {
      vi.useRealTimers();
      region.remove();
      elsewhere.remove();
    }
  });

  /* WR-405: the editor reads the assessment again after an accepted decision, so the markers show the stored state. */
  it('reads the assessment again after an accepted decision, and never after a refusal', async () => {
    action.mockResolvedValueOnce(applied);
    const accepted = input();
    const { result } = renderHook(() => useAiDecisions(accepted));
    act(() => result.current.confirm('issueStatement'));
    await waitFor(() => expect(notifications.success).toHaveBeenCalled());
    expect(accepted.onUpdated).toHaveBeenCalledOnce();

    action.mockResolvedValueOnce({ ok: false, kind: 'retryable', formError: 'We couldn’t record your review. Try again.' });
    const refused = input();
    const second = renderHook(() => useAiDecisions(refused));
    act(() => second.result.current.confirm('issueStatement'));
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    expect(refused.onUpdated).not.toHaveBeenCalled();
  });

  /*
   * WR-302: a decision Strapi accepted is applied to the record before the editor reads it again, so a failed read
   * cannot bring back the state the decision replaced. A refused decision is never applied.
   */
  it('applies an accepted decision to the record before reading it again, and never a refused one', async () => {
    action.mockResolvedValueOnce(applied).mockResolvedValueOnce(applied).mockResolvedValueOnce({ ok: false, kind: 'retryable', formError: 'We couldn’t record your review. Try again.' });
    const steps: string[] = [];
    const props = {
      ...input(),
      onReviewed: vi.fn((names: readonly string[], state: AiFieldReview['state']) => { steps.push(`${state}: ${names.join(', ')}`); }),
      onUpdated: vi.fn(async () => { steps.push('read'); }),
    };
    const { result } = renderHook(() => useAiDecisions(props));
    act(() => result.current.confirm('issueStatement'));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledTimes(1));
    expect(steps).toEqual(['accepted: issueStatement', 'read']);

    act(() => toastAction(notifications.success.mock.calls[0])?.onClick({} as never));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Confirmation undone.', expect.anything()));
    expect(steps).toEqual(['accepted: issueStatement', 'read', 'proposed: issueStatement', 'read']);

    act(() => result.current.confirm('issueStatement'));
    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith('Proposal not confirmed', expect.anything()));
    expect(props.onReviewed).toHaveBeenCalledTimes(2);
  });

  /* IN-304: Confirm remaining speaks for the batch even when it holds one field (12-UI-SPEC §6.1). */
  it('names a Confirm remaining of one field as a count of AI-proposed fields', async () => {
    action.mockResolvedValueOnce(applied);
    const { result } = renderHook(() => useAiDecisions(input()));
    act(() => result.current.confirmRemaining(['issueStatement']));
    await waitFor(() => expect(notifications.success).toHaveBeenCalled());
    expect(notifications.success.mock.calls[0][0]).toBe('1 AI-proposed field confirmed on RSK-001.');
  });

  it.each([
    [{ ok: false, status: 409, reason: 'ASSESSMENT_NOT_MUTABLE', kind: 'blocked', formError: 'This assessment can no longer be changed, so your review wasn’t recorded. Refresh the page to see its current state.' }, 'Refresh page'],
    [{ ok: false, kind: 'retryable', formError: 'We couldn’t record your review. Try again.' }, 'Try again'],
    // WR-303: the sentence names the fix on this page, so the toast offers no refresh.
    [{ ok: false, status: 409, reason: 'AI_ACCEPT_WITH_PLANNED_CONTROL', kind: 'blocked', formError: 'This Risk has a planned control, so the AI’s proposed Accept can’t be confirmed. Change the treatment action to Treat, or remove the planned control.' }, null],
  ] as const)('rolls a refused confirmation back and offers its recovery (%#: %s)', async (failure, label) => {
    action.mockResolvedValueOnce(failure);
    const { result } = renderHook(() => useAiDecisions(input()));
    act(() => result.current.confirm('issueStatement'));
    expect(result.current.fields[0].state).toBe('accepted');
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    expect(result.current.fields[0].state).toBe('proposed');
    expect(notifications.error).toHaveBeenCalledWith('Proposal not confirmed', expect.objectContaining({ description: failure.formError }));
    expect(toastAction(notifications.error.mock.calls[0])?.label ?? null).toBe(label);
  });

  it('refuses a batch atomically and keeps every proposal available', async () => {
    action.mockResolvedValueOnce({ ok: false, status: 409, reason: 'AI_ACCEPT_WITH_PLANNED_CONTROL', kind: 'blocked', formError: 'This Risk has a planned control, so the AI’s proposed Accept can’t be confirmed. Change the treatment action to Treat, or remove the planned control.' });
    const { result } = renderHook(() => useAiDecisions({ ...input(), fields: [...fields, { ...fields[0], field: 'treatmentAction' }] }));
    act(() => result.current.confirmRemaining(['issueStatement', 'treatmentAction']));
    expect(result.current.fields.map((fact) => fact.state)).toEqual(['accepted', 'accepted']);
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    expect(result.current.fields.map((fact) => fact.state)).toEqual(['proposed', 'proposed']);
    expect(notifications.error).toHaveBeenCalledWith('Proposals not confirmed', expect.objectContaining({ description: expect.stringContaining('Change the treatment action to Treat') }));
    expect(toastAction(notifications.error.mock.calls[0]), 'WR-303: the fix is on this page').toBeUndefined();
    expect(action).toHaveBeenCalledTimes(1);
  });

  /* WR-303: Refresh page re-reads the assessment in place; a reload would discard every unsaved Risk edit. */
  it('refreshes the editor in place from a blocked refusal, never reloading the document', async () => {
    action.mockResolvedValueOnce({ ok: false, status: 409, reason: 'AI_PROPOSAL_ALREADY_DECIDED', kind: 'blocked', formError: 'This proposal is no longer open. Refresh the page to see where it stands.' });
    const props = input();
    const { result } = renderHook(() => useAiDecisions(props));
    act(() => result.current.confirm('issueStatement'));
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    const refresh = toastAction(notifications.error.mock.calls[0]);
    expect(refresh?.label).toBe('Refresh page');
    expect(props.onUpdated).not.toHaveBeenCalled();
    act(() => refresh?.onClick({} as never));
    expect(props.onUpdated).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledTimes(1);
  });

  /* WR-405: Try again sends exactly the decision that failed. */
  it('sends the same decisions again from Try again', async () => {
    action.mockResolvedValueOnce({ ok: false, kind: 'retryable', formError: 'We couldn’t record your review. Try again.' }).mockResolvedValueOnce(applied);
    const { result } = renderHook(() => useAiDecisions({ ...input(), fields: [...fields, { ...fields[0], field: 'riskCause' }] }));
    act(() => result.current.confirmRemaining(['issueStatement', 'riskCause']));
    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith('Proposals not confirmed', expect.anything()));
    const retry = toastAction(notifications.error.mock.calls[0]);
    expect(retry?.label).toBe('Try again');
    act(() => retry?.onClick({} as never));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1][0]).toEqual(action.mock.calls[0][0]);
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('2 AI-proposed fields confirmed on RSK-001.', expect.anything()));
  });

  /* WR-405: a failed Undo has its own title (12-UI-SPEC §6.1). */
  it('titles a failed Undo Couldn’t undo and offers it again', async () => {
    action.mockResolvedValueOnce(applied).mockResolvedValueOnce({ ok: false, kind: 'retryable', formError: 'We couldn’t record your review. Try again.' });
    const { result } = renderHook(() => useAiDecisions(input()));
    act(() => result.current.confirm('issueStatement'));
    await waitFor(() => expect(notifications.success).toHaveBeenCalled());
    act(() => toastAction(notifications.success.mock.calls[0])?.onClick({} as never));
    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith('Couldn’t undo', expect.objectContaining({ description: 'We couldn’t record your review. Try again.' })));
    expect(action.mock.calls[1][0].decisions[0]).toMatchObject({ action: 'restore', fields: ['issueStatement'] });
    expect(toastAction(notifications.error.mock.calls[0])?.label).toBe('Try again');
  });

  /*
   * Walk D3: Sonner hands focus back to wherever it was before the toast region took it, once focus leaves the region.
   * A toast's own action leaves the region at once, so that hand-back cannot land later over the focus a decision sets.
   */
  it('takes focus out of the toast region as soon as a toast action runs', async () => {
    action.mockResolvedValueOnce(applied).mockResolvedValueOnce(applied);
    const { result } = renderHook(() => useAiDecisions(input()));
    act(() => result.current.confirm('issueStatement'));
    await waitFor(() => expect(notifications.success).toHaveBeenCalled());
    const region = document.createElement('ol');
    region.setAttribute('data-sonner-toaster', '');
    const undo = document.createElement('button');
    region.append(undo);
    document.body.append(region);
    undo.focus();
    expect(undo).toHaveFocus();
    act(() => toastAction(notifications.success.mock.calls[0])?.onClick({} as never));
    expect(region.contains(document.activeElement)).toBe(false);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    region.remove();
  });
});

/*
 * 12-UI-SPEC §6.2 (WR-301, WR-405): a form like the editor's, whose base states come from the server after each
 * accepted decision, as the editor's re-read gives them.
 */
const server = new Map<string, AiFieldReview['state']>();

function ReviewForm({ names, onUpdated }: { names: readonly string[]; onUpdated: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [facts, setFacts] = useState<readonly AiFieldReview[]>(() => names.map((field) => ({ field, state: 'proposed', by: null, at: null, sources: [] })));
  const decisions = useAiDecisions({
    assessmentId: 'assessment-1', target: { kind: 'risk', riskId: 'risk-1' }, fields: facts, place: 'on RSK-001', formRef,
    onUpdated: async () => {
      onUpdated();
      setFacts((current) => current.map((fact) => ({ ...fact, state: server.get(fact.field) ?? fact.state })));
    },
  });
  const proposed = decisions.fields.filter((fact) => fact.state === 'proposed').map((fact) => fact.field);
  return (
    <form ref={formRef}>
      <p data-ai-review-status tabIndex={-1}>{proposed.length ? `${proposed.length} to review` : 'All AI proposals reviewed'}</p>
      <button onClick={() => decisions.confirmRemaining(proposed)} type="button">Confirm remaining</button>
      {decisions.fields.map((fact) => (
        <AiFieldMarker field={fact.field} id={`${fact.field}-marker`} key={fact.field} label={fact.field} onConfirm={() => decisions.confirm(fact.field)} state={fact.state} />
      ))}
    </form>
  );
}

describe('focus after a decision (12-UI-SPEC §6.2)', () => {
  beforeEach(() => {
    server.clear();
    action.mockImplementation(async ({ decisions }: { decisions: { action: 'accept' | 'restore'; fields: string[] }[] }) => {
      for (const decision of decisions) for (const field of decision.fields) server.set(field, decision.action === 'accept' ? 'accepted' : 'proposed');
      return applied;
    });
  });

  it('moves focus to the next Confirm in field order, not the first', async () => {
    render(<ReviewForm names={['issueStatement', 'riskStatement', 'riskCause']} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm riskStatement' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm riskCause' })).toHaveFocus());
    await waitFor(() => expect(notifications.success).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Confirm riskCause' })).toHaveFocus();
  });

  it('moves focus to the review status line after the last Confirm in field order', async () => {
    render(<ReviewForm names={['issueStatement', 'riskStatement', 'riskCause']} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm riskCause' }));
    await waitFor(() => expect(screen.getByText('2 to review')).toHaveFocus());
  });

  it('moves focus to the review status line after Confirm remaining', async () => {
    render(<ReviewForm names={['issueStatement', 'riskStatement']} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remaining' }));
    await waitFor(() => expect(screen.getByText('All AI proposals reviewed')).toHaveFocus());
  });

  it('returns focus to the restored field’s Confirm after Undo', async () => {
    const onUpdated = vi.fn();
    render(<ReviewForm names={['issueStatement', 'riskStatement', 'riskCause']} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm riskStatement' }));
    await waitFor(() => expect(notifications.success).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm riskStatement' })).not.toBeInTheDocument());
    act(() => toastAction(notifications.success.mock.calls[0])?.onClick({} as never));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Confirmation undone.', expect.anything()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm riskStatement' })).toHaveFocus());
    expect(onUpdated).toHaveBeenCalledTimes(2);
  });

  it('returns focus to the first restored Confirm after a Confirm remaining is undone', async () => {
    render(<ReviewForm names={['issueStatement', 'riskStatement', 'riskCause']} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm riskStatement' }));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remaining' }));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledTimes(2));
    expect(notifications.success.mock.calls[1][0]).toBe('2 AI-proposed fields confirmed on RSK-001.');
    act(() => toastAction(notifications.success.mock.calls[1])?.onClick({} as never));
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Confirmations undone.', expect.anything()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm issueStatement' })).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Confirm riskStatement' })).not.toBeInTheDocument();
  });

  it('leaves focus where it is when a confirmation rolls back', async () => {
    action.mockResolvedValueOnce({ ok: false, kind: 'retryable', formError: 'We couldn’t record your review. Try again.' });
    render(<ReviewForm names={['issueStatement', 'riskStatement', 'riskCause']} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm riskStatement' }));
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm riskStatement' })).toBeInTheDocument());
    // The optimistic move happens on the next frame, which a rollback this fast can precede; the rollback moves nothing.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm riskCause' })).toHaveFocus());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(screen.getByRole('button', { name: 'Confirm riskCause' })).toHaveFocus();
  });
});
