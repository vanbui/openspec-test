'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

// The Undo toast pauses while hovered or while focus is inside it (X-14); a refusal's danger toast persists.
import { landOn } from '@/components/csrm/use-hash-landing';
import { successToast } from '@/components/ui/success-toast';
import { toastAction } from '@/components/ui/toast-action';
import { clearSessionDraft } from '@/lib/session-drafts/session-drafts';

import { reinstateRisksAction, undoReinstatementAction, undoWithdrawalAction, withdrawRisksAction } from './risk-curation-actions';
import {
  alreadyCuratedToast,
  curationRetryLine,
  decisionFailureTitle,
  reinstateToast,
  riskCardId,
  undoneToast,
  withdrawToast,
  type CurationAct,
  type RiskCurationFailure,
  type RiskCurationFailureKind,
  type RiskCurationResult,
  type RiskPerson,
} from './risk-curation-domain';

/*
 * Withdraw and reinstate, applied at once (16-UI-SPEC §6.1, §6.2; X-27; D-11, D-47, UI-D7). The card moves to the other
 * list the moment the analyst submits, shown at the §5 pending opacity until the server answers; the toast offers Undo,
 * which sends the closed undo flag and never a reason. A refusal ends the optimistic move, so the card returns with the
 * rollback transition, and the form reopens with the typed reason and §13 R1's line; when the card itself moved meanwhile
 * (it is gone, or already back), a danger toast says so and the Risks are read again. Strapi decides every act.
 *
 * Focus follows §6.1 and §6.2: to the next card in the same list (`[data-risk-card]` inside `[data-risk-list]`), else
 * the previous one, else the `Show` control (`[data-risk-show]`); after an Undo, to the card that came back.
 */

/** A withdrawal's facts as the analyst's assessment read serves them (RiskWithdrawal). */
export type RiskWithdrawalFacts = { readonly at: string; readonly by: RiskPerson | null; readonly reason: string };

/** What the hook needs of a Risk: its id, its number and its withdrawal facts (null while it is active). */
export type WithdrawalCandidate = { readonly documentId: string; readonly riskNumber: string; readonly withdrawal: RiskWithdrawalFacts | null };

/** A refused withdrawal or reinstatement, for the form to reopen with: the reason typed and R1's line. */
export type WithdrawalRefusal = {
  readonly riskId: string;
  readonly mode: CurationAct;
  readonly reason: string;
  readonly message: string;
  readonly kind: RiskCurationFailureKind;
  /** Counts the refusals, so a second refusal of the same Risk reopens a fresh form. */
  readonly attempt: number;
};

export type UseRiskWithdrawalInput<T extends WithdrawalCandidate> = {
  assessmentId: string;
  /** The Risks as last read from Strapi, active and withdrawn. */
  risks: readonly T[];
  /** The signed-in analyst, named on a card while its withdrawal is on its way. */
  viewer?: RiskPerson | null;
  /** The session draft owner key, so a reason kept for the session is cleared once it is recorded. */
  draftOwnerKey?: string | null;
  /** Reads the Risks again once an act is recorded, and after a refusal that moved the card. */
  onChanged?: () => Promise<void> | void;
  /** Where focus goes once a card leaves its list; read before the card moves. Defaults to the §6.1 order. */
  focusAfter?: (risk: T, act: CurationAct) => () => void;
};

type Move = { readonly riskId: string; readonly withdrawal: RiskWithdrawalFacts | null };
type Kind = CurationAct | 'undo-withdrawal' | 'undo-reinstatement';
type Result = { ok: true; data: RiskCurationResult } | ({ ok: false } & RiskCurationFailure);

const SHOW_CONTROL = '[data-risk-show]';

/* §6.1: a card that comes back is landed on from its start, so its number and actions show, and gets focus. */
const focusCard = (riskId: string) => requestAnimationFrame(() => {
  const card = document.getElementById(riskCardId(riskId));
  if (card) landOn(card);
});

/* §6.1: the next card in the same list, else the previous one, else the `Show` control; read while the card is listed. */
function defaultFocusAfter(risk: WithdrawalCandidate): () => void {
  const card = document.getElementById(riskCardId(risk.documentId));
  const list = card?.closest('[data-risk-list]');
  const cards = list ? [...list.querySelectorAll<HTMLElement>('[data-risk-card]')] : [];
  const index = card ? cards.indexOf(card) : -1;
  const target = index < 0 ? undefined : cards[index + 1] ?? cards[index - 1];
  const targetId = target?.id;
  return () => requestAnimationFrame(() => {
    const next = targetId ? document.getElementById(targetId) : null;
    /* The `Show` control is a radio group: focus lands on its chosen option, as a keyboard would reach it. */
    (next ?? document.querySelector<HTMLElement>(`${SHOW_CONTROL} [role="radio"][aria-checked="true"]`) ?? document.querySelector<HTMLElement>(SHOW_CONTROL))?.focus();
  });
}

/* A refusal that leaves the form nothing to reopen on: the Risk is gone, or already where the act would have put it. */
const cardMoved = (failure: RiskCurationFailure): boolean =>
  failure.status === 404 || failure.reason === 'RISK_NOT_WITHDRAWN' || failure.reason === 'RISK_WITHDRAWN';

export function useRiskWithdrawal<T extends WithdrawalCandidate>({ assessmentId, draftOwnerKey = null, focusAfter, onChanged, risks, viewer = null }: UseRiskWithdrawalInput<T>) {
  const [, startTransition] = useTransition();
  const [shown, move] = useOptimistic(risks, (current: readonly T[], change: Move) =>
    current.map((risk) => (risk.documentId === change.riskId ? { ...risk, withdrawal: change.withdrawal } : risk)));
  const [refusal, setRefusal] = useState<WithdrawalRefusal | null>(null);
  const attempts = useRef(0);

  /* A card is pending while the list it shows in is not yet the list last read from Strapi. */
  const served = new Map(risks.map((risk) => [risk.documentId, risk.withdrawal !== null]));
  const pending: ReadonlySet<string> = new Set(shown.filter((risk) => served.get(risk.documentId) !== (risk.withdrawal !== null)).map((risk) => risk.documentId));

  const refresh = () => { void onChanged?.(); };

  function send(kind: Kind, riskId: string, reason: string): Promise<Result> {
    const riskIds = [riskId];
    switch (kind) {
      case 'withdraw': return withdrawRisksAction({ assessmentId, riskIds, reason });
      case 'reinstate': return reinstateRisksAction({ assessmentId, riskIds, reason });
      case 'undo-withdrawal': return undoWithdrawalAction({ assessmentId, riskIds });
      default: return undoReinstatementAction({ assessmentId, riskIds });
    }
  }

  function refused(kind: Kind, risk: T, reason: string, failure: RiskCurationFailure) {
    if (kind === 'undo-withdrawal' || kind === 'undo-reinstatement') {
      toast.error(decisionFailureTitle('undo'), { description: failure.message, duration: Infinity });
      if (failure.kind === 'blocked') refresh();
      return;
    }
    if (cardMoved(failure)) {
      toast.error(failure.message, { duration: Infinity });
      refresh();
      return;
    }
    attempts.current += 1;
    setRefusal({ riskId: risk.documentId, mode: kind, reason, message: failure.message, kind: failure.kind, attempt: attempts.current });
  }

  function succeeded(kind: Kind, risk: T, result: RiskCurationResult) {
    const { riskNumber } = risk;
    if (kind === 'undo-withdrawal' || kind === 'undo-reinstatement') {
      successToast(undoneToast({ undone: kind === 'undo-withdrawal' ? 'withdrawal' : 'reinstatement', riskNumber }));
      focusCard(risk.documentId);
      return;
    }
    /*
     * Already where the act would put it (another analyst got there first): nothing of this analyst's was recorded, so
     * there is nothing to undo, a warning says so and the typed reason stays kept for the session (FE3-04).
     */
    if (!result.applied.includes(risk.documentId)) {
      toast.warning(alreadyCuratedToast(kind, riskNumber), { duration: Infinity });
      return;
    }
    if (draftOwnerKey) clearSessionDraft(kind === 'withdraw' ? 'risk-withdraw-reason' : 'risk-reinstate-reason', draftOwnerKey, risk.documentId);
    const undo = kind === 'withdraw' ? 'undo-withdrawal' : 'undo-reinstatement';
    successToast(kind === 'withdraw' ? withdrawToast(riskNumber) : reinstateToast(riskNumber), {
      action: toastAction('Undo', () => run(undo, risk, '')),
    });
  }

  function run(kind: Kind, risk: T, reason: string) {
    const isUndo = kind === 'undo-withdrawal' || kind === 'undo-reinstatement';
    /* Undoing a reinstatement withdraws the Risk again with the reason it held before (UI-D7). */
    const target: RiskWithdrawalFacts | null = kind === 'withdraw'
      ? { at: new Date().toISOString(), by: viewer, reason: reason.trim() }
      : kind === 'undo-reinstatement' ? risk.withdrawal : null;
    const moveFocus = isUndo ? null : (focusAfter ?? defaultFocusAfter)(risk, kind as CurationAct);
    startTransition(async () => {
      move({ riskId: risk.documentId, withdrawal: target });
      moveFocus?.();
      let result: Result;
      try {
        result = await send(kind, risk.documentId, reason);
      } catch {
        const mode: CurationAct = kind === 'withdraw' || kind === 'undo-reinstatement' ? 'withdraw' : 'reinstate';
        refused(kind, risk, reason, { kind: 'retryable', message: curationRetryLine(mode) });
        return;
      }
      if (!result.ok) {
        refused(kind, risk, reason, result);
        return;
      }
      await onChanged?.();
      succeeded(kind, risk, result.data);
    });
  }

  return {
    /** The Risks with every act on its way applied, so each card shows in the list it is moving to. */
    risks: shown,
    /** The Risks whose act is on its way: their cards show the §5 pending opacity. */
    pending,
    /** The last refused withdrawal or reinstatement, for its form to reopen with; null once dismissed or resent. */
    refusal,
    clearRefusal: () => setRefusal(null),
    withdraw: (risk: T, reason: string) => run('withdraw', risk, reason),
    reinstate: (risk: T, reason: string) => run('reinstate', risk, reason),
  };
}
