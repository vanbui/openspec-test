'use client';

import { useOptimistic, useState, useTransition, type RefObject } from 'react';
import { toast } from 'sonner';

// A decision's success toast pauses while hovered or while focus is inside it (X-14); a refusal's danger toast persists.
import { successToast } from '@/components/ui/success-toast';

import type { AiFieldReview, AiSuggestionReview } from '../assessments/assessment-schema';
import { decideAiProposalsAction, type DecideAiProposalsActionResult } from './ai-assistance-actions';
import { confirmToastMessage, decisionRefusalRecovery, undoToastMessage } from './ai-assistance-domain';

type Target = { kind: 'assessment' } | { kind: 'risk'; riskId: string };
type Input = {
  assessmentId: string;
  target: Target;
  fields: readonly AiFieldReview[];
  place: string;
  formRef: RefObject<HTMLFormElement | null>;
  /** Reads the assessment again: after an accepted decision, and as a refused decision's Refresh page. */
  onUpdated: () => Promise<void>;
  /**
   * WR-302: applies a decision Strapi accepted to the record's facts before the read that follows, so the decided
   * state holds even when that read fails. Never called for a refused decision.
   */
  onReviewed?: (names: readonly string[], state: AiFieldReview['state']) => void;
};
type OptimisticChange = { names: readonly string[]; state: AiFieldReview['state'] };
type Refusal = Extract<DecideAiProposalsActionResult, { ok: false }>;

const UNRECORDED = 'We couldn’t record your review. Try again.';

/*
 * Walk D3: Sonner hands focus back to wherever it was before its toast region took it, once focus leaves the region,
 * and keeps that hand-back pending while focus stays inside. A toast's action is removed with its toast, which Sonner
 * never hears as focus leaving, so the pending hand-back would land later, over the focus a decision sets (§6.2).
 * Each action therefore leaves the region first, which lets Sonner hand focus back at once.
 */
function leaveToastRegion(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest('[data-sonner-toaster]')) active.blur();
}

/* A toast's action (Undo, Try again, Refresh page): it leaves the toast region before it acts. */
function toastAction(label: string, act: () => void) {
  return { label, onClick: () => { leaveToastRegion(); act(); } };
}

/*
 * 12-UI-SPEC §6.1 and §6.3: a refused decision's danger toast offers Try again, or Refresh page, which re-reads the
 * editor in place so no unsaved edit is lost (WR-303), or nothing when its sentence names the fix on the page.
 */
function refusalAction(refusal: Refusal | null, retry: () => void, refresh: () => void) {
  const recovery = decisionRefusalRecovery(refusal);
  if (recovery === 'try-again') return toastAction('Try again', retry);
  return recovery === 'refresh' ? toastAction('Refresh page', refresh) : undefined;
}

export function useAiDecisions({ assessmentId, target, fields, place, formRef, onUpdated, onReviewed }: Input) {
  const [isPending, startTransition] = useTransition();
  const [reviewedFields, changeFields] = useOptimistic(fields, (current, change: OptimisticChange) =>
    current.map((fact) => change.names.includes(fact.field) ? { ...fact, state: change.state } : fact));
  /* IN-304: a field is pending while the state it shows is not yet the state last read from Strapi. */
  const stored = new Map(fields.map((fact) => [fact.field, fact.state]));
  const pendingFields: ReadonlySet<string> = new Set(reviewedFields.filter((fact) => stored.get(fact.field) !== fact.state).map((fact) => fact.field));

  /* §6.2: the fields whose Confirm follows `field`'s in field order, read before the decision removes its Confirm. */
  function confirmsAfter(field: string): string[] {
    const order = [...(formRef.current?.querySelectorAll<HTMLElement>('[data-ai-confirm]') ?? [])].map((button) => button.dataset.aiConfirm ?? '');
    return order.slice(order.indexOf(field) + 1);
  }

  /* §6.2: focus the first Confirm, in field order, of the named fields; the review status line when there is none. */
  function focusConfirm(names: readonly string[]) {
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;
      const confirm = [...form.querySelectorAll<HTMLElement>('[data-ai-confirm]')].find((button) => names.includes(button.dataset.aiConfirm ?? ''));
      (confirm ?? form.querySelector<HTMLElement>('[data-ai-review-status]'))?.focus();
    });
  }

  function decide(names: readonly string[], action: 'accept' | 'restore', batch = false) {
    if (names.length === 0) return;
    const next = action === 'accept' && !batch ? confirmsAfter(names[0]) : [];
    const failed = action === 'restore' ? 'Couldn’t undo' : batch ? 'Proposals not confirmed' : 'Proposal not confirmed';
    const retry = () => decide(names, action, batch);
    const refresh = () => void onUpdated();
    startTransition(async () => {
      changeFields({ names, state: action === 'accept' ? 'accepted' : 'proposed' });
      if (action === 'accept') focusConfirm(next);
      try {
        const result = await decideAiProposalsAction({ assessmentId, decisions: [{ target, action, fields: [...names] }] });
        if (!result.ok) {
          toast.error(failed, { description: result.formError, duration: Infinity, action: refusalAction(result, retry, refresh) });
          return;
        }
        onReviewed?.(names, action === 'accept' ? 'accepted' : 'proposed');
        await onUpdated();
        if (action === 'restore') {
          successToast(undoToastMessage(names.length));
          focusConfirm(names);
        } else {
          successToast(confirmToastMessage(names, place, batch ? 'remaining' : 'one'), {
            action: toastAction('Undo', () => decide(names, 'restore', batch)),
          });
        }
      } catch {
        toast.error(failed, { description: UNRECORDED, duration: Infinity, action: refusalAction(null, retry, refresh) });
      }
    });
  }

  return { fields: reviewedFields, isPending, pendingFields, confirm: (field: string) => decide([field], 'accept'), confirmRemaining: (names: readonly string[]) => decide(names, 'accept', true) };
}

type Suggestion = AiSuggestionReview;
type SuggestionInput = {
  assessmentId: string;
  riskId: string;
  riskNumber: string;
  suggestions: readonly Suggestion[];
  label: (suggestion: Suggestion) => string;
  /** Re-reads the Risk's mitigation controls after a planned control is added or removed. */
  onControlsChanged: () => Promise<void>;
  onUpdated: () => Promise<void>;
  /** WR-302: applies a decision Strapi accepted to the Risk's suggestions before the read that follows. */
  onReviewed?: (key: string, state: Suggestion['state']) => void;
  /**
   * Where focus goes once a row leaves the proposed list (12-UI-SPEC §6.2). It reads the order when a decision
   * starts, while the row still has its place in it, and returns the move to make once the row has changed.
   */
  focusAfter: (key: string) => () => void;
  focusRestored: (key: string) => void;
};

/*
 * Suggested controls (12-UI-SPEC §5, §6.1; D-12, UI-D12). Adding waits for the server, because it creates a record;
 * dismissing and restoring are optimistic and roll back on a refusal.
 */
export function useSuggestionDecisions({ assessmentId, riskId, riskNumber, suggestions, label, onControlsChanged, onUpdated, onReviewed, focusAfter, focusRestored }: SuggestionInput) {
  const [isPending, startTransition] = useTransition();
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [rows, changeRow] = useOptimistic(suggestions, (current, change: { key: string; state: Suggestion['state'] }) =>
    current.map((item) => item.key === change.key ? { ...item, state: change.state } : item));

  const send = (key: string, action: 'accept' | 'dismiss' | 'restore') =>
    decideAiProposalsAction({ assessmentId, decisions: [{ target: { kind: 'risk', riskId }, action, suggestion: key }] });

  /* Refresh page re-reads the suggestions and the Risk's mitigation controls in place (WR-303). */
  const refresh = () => { void onControlsChanged(); void onUpdated(); };

  function refused(title: string, result: Refusal | null, retry: () => void) {
    toast.error(title, {
      description: result?.formError ?? UNRECORDED,
      duration: Infinity,
      action: refusalAction(result, retry, refresh),
    });
  }

  async function add(item: Suggestion) {
    if (addingKey) return;
    const moveFocus = focusAfter(item.key);
    setAddingKey(item.key);
    try {
      const result = await send(item.key, 'accept');
      if (!result.ok) return refused('Control not added', result, () => void add(item));
      onReviewed?.(item.key, 'added');
      await onControlsChanged();
      await onUpdated();
      moveFocus();
      successToast(`${label(item)} added as a planned control on ${riskNumber}.`, {
        action: toastAction('Undo', () => void undoAdd(item)),
      });
    } catch {
      refused('Control not added', null, () => void add(item));
    } finally {
      setAddingKey(null);
    }
  }

  async function undoAdd(item: Suggestion) {
    try {
      const result = await send(item.key, 'restore');
      if (!result.ok) return refused('Couldn’t undo', result, () => void undoAdd(item));
      onReviewed?.(item.key, 'proposed');
      await onControlsChanged();
      await onUpdated();
      successToast('Planned control removed. The suggestion is back.');
      focusRestored(item.key);
    } catch {
      refused('Couldn’t undo', null, () => void undoAdd(item));
    }
  }

  function dismiss(item: Suggestion) {
    const moveFocus = focusAfter(item.key);
    startTransition(async () => {
      changeRow({ key: item.key, state: 'dismissed' });
      moveFocus();
      try {
        const result = await send(item.key, 'dismiss');
        if (!result.ok) return refused('Suggestion not dismissed', result, () => dismiss(item));
        onReviewed?.(item.key, 'dismissed');
        await onUpdated();
        successToast(`Suggestion dismissed: ${label(item)}.`, {
          action: toastAction('Undo', () => restore(item, true)),
        });
      } catch {
        refused('Suggestion not dismissed', null, () => dismiss(item));
      }
    });
  }

  function restore(item: Suggestion, fromUndo = false) {
    const title = fromUndo ? 'Couldn’t undo' : 'Suggestion not restored';
    startTransition(async () => {
      changeRow({ key: item.key, state: 'proposed' });
      try {
        const result = await send(item.key, 'restore');
        if (!result.ok) return refused(title, result, () => restore(item, fromUndo));
        onReviewed?.(item.key, 'proposed');
        await onUpdated();
        successToast(fromUndo ? 'Suggestion restored.' : `Suggestion restored: ${label(item)}.`);
        focusRestored(item.key);
      } catch {
        refused(title, null, () => restore(item, fromUndo));
      }
    });
  }

  return { rows, isPending, addingKey, add: (item: Suggestion) => void add(item), dismiss, restore: (item: Suggestion) => restore(item) };
}
