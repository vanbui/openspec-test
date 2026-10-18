'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useRef, useState, useSyncExternalStore, useTransition, type RefObject } from 'react';
import { toast, type Action } from 'sonner';

import { landOn } from '@/components/csrm/use-hash-landing';
import { useUnloadWarning } from '@/components/csrm/use-unload-warning';
import { successToast } from '@/components/ui/success-toast';
import { decideRiskProposalsAction, type RiskCurationActionResult } from './risk-curation-actions';
import {
  decisionFailureTitle,
  decisionToast,
  riskCardId,
  undoneToast,
  type DecisionAct,
  type RiskAiItemState,
  type RiskAiProposalItem,
  type RiskAiProposals,
  type RiskDecisionIntent,
  type RiskPerson,
  type RiskProposalDecision,
  type RiskProposalDecisionResult,
} from './risk-curation-domain';
import { riskDecisionRefusal } from './risk-curation-refusal-copy';

/*
 * Every decision on a Phase 16 proposal (16-UI-SPEC §5; D-39, D-40, D-47): one batch Server Action per user act (one
 * item, Confirm all, Reject remaining, an Undo), applied at once at the pending opacity, except Add to assessment, which
 * waits for the server because it creates a Risk. A refusal rolls the cards or rows back and says R3's sentence with Try
 * again or Refresh page; a proposal that is stale or already decided reads the proposals again, so each shows where it
 * stands. Success toasts offer Undo (restore), never for an added risk (D-33), and focus moves as §5.5 says. Loaded only
 * with the section and the AI rewrite, which load on demand, so family R costs no first-load bytes. Nothing here is
 * authorisation: Strapi decides every act again.
 */

export type ProposalDensity = 'comfortable' | 'compact';

/** A proposal's key in the section and the rewrite: its request and its item. */
export const proposalKey = (item: Pick<RiskAiProposalItem, 'runId' | 'itemKey'>): string => `${item.runId}:${item.itemKey}`;

/* The refusals after which the proposals are read again, so each item shows its real state (§5.1). */
const REFRESH_REASONS: ReadonlySet<string> = new Set(['AI_PROPOSAL_STALE', 'AI_PROPOSAL_ALREADY_DECIDED']);

type Change = {
  readonly keys: ReadonlySet<string>;
  readonly state: Extract<RiskAiItemState, 'open' | 'accepted' | 'rejected'>;
  readonly reason?: string | null;
  readonly by?: RiskPerson | null;
  readonly addedRisk?: RiskAiProposalItem['addedRisk'];
};

function withChange(items: readonly RiskAiProposalItem[], change: Change): readonly RiskAiProposalItem[] {
  return items.map((item) => {
    if (!change.keys.has(proposalKey(item))) return item;
    if (change.state === 'open') return { ...item, state: 'open', decision: null, canUndo: false, addedRisk: null };
    return {
      ...item,
      state: change.state,
      canUndo: change.state === 'rejected' || item.kind === 'change',
      addedRisk: change.addedRisk ?? item.addedRisk,
      decision: { action: change.state, by: change.by ?? null, at: new Date().toISOString(), reason: change.reason ?? null, cause: null },
    };
  });
}

/*
 * Walk D3 (12-16): Sonner hands focus back once focus leaves its region, which a removed toast never reports, so each
 * toast action leaves the region first.
 */
export function toastAction(label: string, act: () => void): Action {
  return {
    label,
    onClick: () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest('[data-sonner-toaster]')) active.blur();
      act();
    },
  };
}

/* ---- The breakpoint and the density (§2.1, §2.6; UI-D27, UI-D29) ---- */

const wideQuery = '(min-width: 768px)';

function subscribeToWidth(onChange: () => void): () => void {
  const query = window.matchMedia?.(wideQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

/** From 768px; without matchMedia (a test environment) the page is wide, and the server renders the wide layout. */
export function useIsWide(): boolean {
  return useSyncExternalStore(subscribeToWidth, () => window.matchMedia?.(wideQuery).matches ?? true, () => true);
}

/** Which of a comparison's two layouts the breakpoint shows: both are in the markup (16-12), so focus targets the visible one. */
function isShown(element: HTMLElement): boolean {
  const layout = element.closest<HTMLElement>('[data-comparison-layout]')?.dataset.comparisonLayout;
  if (!layout) return true;
  const wide = window.matchMedia?.(wideQuery).matches ?? true;
  return layout === (wide ? 'table' : 'stacked');
}

/*
 * UI-D29: one density per person, kept in this browser as the DataTable's is, for the section and every AI rewrite on the
 * page. A same-tab change reaches every holder through the listeners, since the storage event fires only in other tabs.
 */
const densityListeners = new Set<() => void>();
const densityMemory = new Map<string, ProposalDensity>();
const densityKey = (ownerKey: string | null) => `csrm:risk-ai-proposals-density:${ownerKey ?? 'page'}`;

function readDensity(ownerKey: string | null): ProposalDensity {
  const key = densityKey(ownerKey);
  if (ownerKey) {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === 'compact' || stored === 'comfortable') return stored;
    } catch {
      /* A browser without usable storage keeps the page's choice. */
    }
  }
  return densityMemory.get(key) ?? 'comfortable';
}

function subscribeToDensity(onChange: () => void): () => void {
  densityListeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    densityListeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useRiskProposalDensity(ownerKey: string | null): [ProposalDensity, (density: ProposalDensity) => void] {
  const chosen = useSyncExternalStore(subscribeToDensity, () => readDensity(ownerKey), () => 'comfortable' as const);
  const wide = useIsWide();
  function choose(next: ProposalDensity) {
    const key = densityKey(ownerKey);
    densityMemory.set(key, next);
    if (ownerKey) {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        /* Not kept; the choice still applies on this page. */
      }
    }
    densityListeners.forEach((notify) => notify());
  }
  /* Below 768px comfortable applies (§2.1). */
  return [wide ? chosen : 'comfortable', choose];
}

/* ---- Decisions ---- */

/** What a decision names in R3's sentence and its toasts: the Risk and the change, for a change to a Risk. */
export type DecisionContext = { readonly riskNumber?: string | null; readonly label?: string | null };

export type RejectInput = DecisionContext & {
  readonly act: Extract<DecisionAct, 'reject' | 'reject-duplicate' | 'reject-remaining'>;
  readonly reason?: string;
  /** For `Reject as duplicate`: the Risk number its toast names, or null when it duplicates a proposal. */
  readonly duplicateOf?: string | null;
  readonly target: 'proposals' | 'changes';
  readonly onSuccess?: () => void;
};

export type UseRiskProposalDecisionsInput = {
  assessmentId: string;
  items: readonly RiskAiProposalItem[];
  /** The section or the AI rewrite, whose `[data-proposal-primary]` controls focus moves between (§5.5). */
  containerRef: RefObject<HTMLElement | null>;
  /** Where focus goes when no open proposal remains there: the section's status line, or the Risk's first field. */
  fallbackFocus: () => HTMLElement | null;
  /** The analyst deciding, so a decision applied at once names them until the server's read does. */
  viewer?: RiskPerson | null;
  /** Reads the proposals again; resolves with the new read, or null when it failed. */
  onChanged?: () => Promise<RiskAiProposals | null>;
};

type ActResult = RiskCurationActionResult<RiskProposalDecisionResult> | null;

type RunInput = {
  act: DecisionAct | 'undo';
  decisions: RiskProposalDecision[];
  intent: RiskDecisionIntent;
  context: DecisionContext;
  change: Change;
  toastMessage: string;
  undo?: () => void;
  onSuccess?: () => void;
  focus: () => void;
};

export function useRiskProposalDecisions({ assessmentId, containerRef, fallbackFocus, items, onChanged, viewer = null }: UseRiskProposalDecisionsInput) {
  const router = useRouter();
  const [decisionPending, startTransition] = useTransition();
  useUnloadWarning(decisionPending);
  const [settled, setSettled] = useState<{ source: readonly RiskAiProposalItem[]; changes: readonly Change[] }>({ source: items, changes: [] });
  const base = settled.source === items ? settled.changes.reduce<readonly RiskAiProposalItem[]>(withChange, items) : items;
  const [shown, applyOptimistic] = useOptimistic<readonly RiskAiProposalItem[], Change>(base, withChange);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const pendingFocus = useRef<{ keys: ReadonlySet<string>; order: readonly string[] } | { reopen: string } | { fallback: true } | null>(null);
  const [, setFocusCycle] = useState(0);

  /* §5.5: focus moves once the render that closes or reopens the card has committed. */
  useEffect(() => {
    const request = pendingFocus.current;
    if (!request) return;
    const container = containerRef.current;
    const controls = container ? [...container.querySelectorAll<HTMLElement>('[data-proposal-primary]')].filter(isShown) : [];
    let target: HTMLElement | null = null;
    if ('reopen' in request) {
      target = controls.find((element) => element.dataset.proposalPrimary === request.reopen) ?? null;
      if (!target) return;
    } else if ('keys' in request) {
      const start = Math.max(...request.order.map((key, index) => (request.keys.has(key) ? index : -1)));
      const order = [...request.order.slice(start + 1), ...request.order.slice(0, Math.max(start, 0))];
      target = order.map((key) => controls.find((element) => element.dataset.proposalPrimary === key && !request.keys.has(key))).find((element) => element !== undefined) ?? null;
    }
    target ??= fallbackFocus();
    if (!target || (target instanceof HTMLButtonElement && target.disabled)) return;
    target.focus();
    pendingFocus.current = null;
  });

  function requestFocus(request: NonNullable<typeof pendingFocus.current>) {
    pendingFocus.current = request;
    setFocusCycle((current) => current + 1);
  }

  /* The open proposals' first controls in the order the page shows them. */
  function primaryKeys(): string[] {
    return [...(containerRef.current?.querySelectorAll<HTMLElement>('[data-proposal-primary]') ?? [])].filter(isShown).map((element) => element.dataset.proposalPrimary ?? '');
  }

  /*
   * FE4-06: a decision settles against the items the hook holds when it resolves, not when it was clicked, so a read that
   * landed meanwhile (an earlier decision's) cannot reopen it.
   */
  const currentItems = useRef(items);
  useEffect(() => {
    currentItems.current = items;
  });
  function settle(change: Change) {
    setSettled((current) => {
      const source = currentItems.current;
      return { source, changes: current.source === source ? [...current.changes, change] : [change] };
    });
  }

  async function send(decisions: RiskProposalDecision[], intent: RiskDecisionIntent, context: DecisionContext): Promise<ActResult> {
    try {
      return (await decideRiskProposalsAction({
        assessmentId,
        decisions,
        intent,
        ...(context.riskNumber ? { riskNumber: context.riskNumber } : {}),
        ...(context.label ? { label: context.label } : {}),
      })) ?? null;
    } catch {
      return null;
    }
  }

  /* §5.1's rollback toast: R3's sentence, with Try again when retrying may help and Refresh page when it cannot. */
  function refused(act: DecisionAct | 'undo', result: ActResult, intent: RiskDecisionIntent, context: DecisionContext, retry: () => void) {
    const copy = result === null || result.ok ? riskDecisionRefusal({}, { intent, ...context }) : { message: result.message, kind: result.kind };
    toast.error(decisionFailureTitle(act), {
      description: copy.message,
      duration: Infinity,
      action: copy.kind === 'retryable' ? toastAction('Try again', retry) : toastAction('Refresh page', () => router.refresh()),
    });
    if (result !== null && !result.ok && result.reason !== undefined && REFRESH_REASONS.has(result.reason)) {
      void onChanged?.();
      router.refresh();
    }
  }

  function run(input: RunInput) {
    const { act, change, context, decisions, focus, intent, toastMessage, undo } = input;
    setPending((current) => new Set([...current, ...change.keys]));
    startTransition(async () => {
      applyOptimistic(change);
      focus();
      const result = await send(decisions, intent, context);
      setPending((current) => new Set([...current].filter((key) => !change.keys.has(key))));
      if (result === null || !result.ok) {
        refused(act, result, intent, context, () => run(input));
        return;
      }
      settle(change);
      input.onSuccess?.();
      successToast(toastMessage, undo ? { action: toastAction('Undo', undo) } : {});
      void onChanged?.();
    });
  }

  function undoItems(targets: readonly RiskAiProposalItem[], context: DecisionContext) {
    if (targets.length === 0) return;
    const rejection = targets[0]!.state === 'rejected';
    const several = targets.length > 1;
    const toastMessage = rejection
      ? undoneToast({ undone: several ? 'rejections' : 'rejection' })
      : several ? undoneToast({ undone: 'confirmations' }) : undoneToast({ undone: 'confirmation', label: context.label ?? 'The field' });
    run({
      act: 'undo',
      decisions: targets.map((item) => ({ runId: item.runId, item: item.itemKey, action: 'restore' })),
      intent: rejection ? 'undo-rejection' : 'undo-confirmation',
      context,
      change: { keys: new Set(targets.map(proposalKey)), state: 'open' },
      toastMessage,
      focus: () => requestFocus({ reopen: proposalKey(targets[0]!) }),
    });
  }

  /* §3.6 and §4.4: Undo from the decided list or a decided change reverses what was decided. */
  function undo(item: RiskAiProposalItem, context: DecisionContext = {}) {
    undoItems([{ ...item, state: item.state === 'rejected' ? 'rejected' : 'accepted' }], context);
  }

  /*
   * §5.1 (D-33): Add to assessment waits for the server, since it creates a Risk; the card shows `Adding…` with its other
   * actions disabled. The toast names the new Risk from the read that follows and offers `Open {risk number}`, no Undo.
   */
  async function add(item: RiskAiProposalItem) {
    if (adding !== null) return;
    const key = proposalKey(item);
    const order = primaryKeys();
    setAdding(key);
    const result = await send([{ runId: item.runId, item: item.itemKey, action: 'accept' }], 'add', {});
    if (result === null || !result.ok) {
      setAdding(null);
      refused('add', result, 'add', {}, () => void add(item));
      return;
    }
    const next = (await onChanged?.()) ?? null;
    const addedRisk = next?.items.find((candidate) => proposalKey(candidate) === key)?.addedRisk ?? null;
    settle({ keys: new Set([key]), state: 'accepted', by: viewer, addedRisk });
    setAdding(null);
    requestFocus({ keys: new Set([key]), order });
    const riskNumber = addedRisk?.riskNumber ?? null;
    if (riskNumber && addedRisk) {
      const message = decisionToast({ act: 'add', riskNumber });
      successToast(message.message, { action: toastAction(message.actionLabel ?? `Open ${riskNumber}`, () => openRisk(addedRisk.riskId)) });
    } else {
      successToast(ADDED_WITHOUT_NUMBER);
    }
  }

  function confirm(item: RiskAiProposalItem, context: DecisionContext) {
    const keys = new Set([proposalKey(item)]);
    const order = primaryKeys();
    run({
      act: 'confirm',
      decisions: [{ runId: item.runId, item: item.itemKey, action: 'accept' }],
      intent: 'confirm',
      context,
      change: { keys, state: 'accepted', by: viewer },
      toastMessage: decisionToast({ act: 'confirm', label: context.label ?? 'The field', riskNumber: context.riskNumber ?? '' }).message,
      undo: () => undoItems([{ ...item, state: 'accepted' }], context),
      focus: () => requestFocus({ keys, order }),
    });
  }

  function confirmAll(targets: readonly RiskAiProposalItem[], context: DecisionContext) {
    if (targets.length === 0) return;
    const keys = new Set(targets.map(proposalKey));
    run({
      act: 'confirm-all',
      decisions: targets.map((item) => ({ runId: item.runId, item: item.itemKey, action: 'accept' })),
      intent: 'confirm',
      context: { riskNumber: context.riskNumber ?? null },
      change: { keys, state: 'accepted', by: viewer },
      toastMessage: decisionToast({ act: 'confirm-all', count: targets.length, riskNumber: context.riskNumber ?? '' }).message,
      undo: () => undoItems(targets.map((item) => ({ ...item, state: 'accepted' })), { riskNumber: context.riskNumber ?? null }),
      focus: () => requestFocus({ fallback: true }),
    });
  }

  /* §5.3, §5.4 and §3.3: Reject, Reject remaining and Reject as duplicate, with one optional reason for each. */
  function reject(targets: readonly RiskAiProposalItem[], input: RejectInput) {
    if (targets.length === 0) return;
    const keys = new Set(targets.map(proposalKey));
    const order = primaryKeys();
    const reason = input.reason?.trim() ? input.reason.trim() : undefined;
    const context: DecisionContext = { riskNumber: input.riskNumber ?? null, label: input.label ?? null };
    const toastMessage = input.act === 'reject-remaining'
      ? decisionToast({ act: 'reject-remaining', count: targets.length, target: input.target }).message
      : input.act === 'reject-duplicate'
        ? decisionToast({ act: 'reject-duplicate', riskNumber: input.duplicateOf ?? null }).message
        : decisionToast({ act: 'reject', label: input.target === 'changes' ? input.label ?? null : null }).message;
    run({
      act: input.act,
      decisions: targets.map((item) => ({ runId: item.runId, item: item.itemKey, action: 'reject', ...(reason === undefined ? {} : { reason }) })),
      intent: 'reject',
      context,
      change: { keys, state: 'rejected', by: viewer, reason: reason ?? null },
      toastMessage,
      undo: () => undoItems(targets.map((item) => ({ ...item, state: 'rejected' })), context),
      onSuccess: input.onSuccess,
      focus: () => requestFocus(input.act === 'reject-remaining' ? { fallback: true } : { keys, order }),
    });
  }

  return { items: shown, pending, adding, add, confirm, confirmAll, reject, undo };
}

/** An added risk whose number the read could not name yet (Voice: the Risk is "in the assessment"). */
const ADDED_WITHOUT_NUMBER = 'Proposed risk added to the assessment. Review its AI-proposed fields.';

/* How long `Open {risk number}` waits for the editor to render a Risk card it has not adopted yet. */
const OPEN_RISK_WAIT_MS = 10_000;

/*
 * §5.5: `Open {risk number}` lands on the new Risk card. The editor adopts the page's next read a moment after the toast
 * (D-41), so a card not rendered yet is landed on as soon as it arrives.
 */
function openRisk(riskId: string) {
  const id = riskCardId(riskId);
  const card = document.getElementById(id);
  if (card) {
    landOn(card);
    return;
  }
  const observer = new MutationObserver(() => {
    const arrived = document.getElementById(id);
    if (!arrived) return;
    stop();
    landOn(arrived);
  });
  const timer = setTimeout(stop, OPEN_RISK_WAIT_MS);
  function stop() {
    observer.disconnect();
    clearTimeout(timer);
  }
  observer.observe(document.body, { childList: true, subtree: true });
}
