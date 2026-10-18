/*
 * 16-UI-SPEC §13, family R: what a refused withdrawal, reinstatement, history read or edit of a withdrawn Risk (R1), a
 * refused request to the AI (R2), a refused decision on a proposal (R3) and a failed proposal job (R4) tell the analyst,
 * and the one request-deletion line. Only Phase 16's analyst surfaces import this module, so its sentences never ship on
 * the Requestor's request page, whose first load is within 2,000 bytes of its budget (B-1, as 15-10 placed family Q);
 * refusal-copy.ts never imports it. Plain and zod-free, with no directive, so Server Actions and client components can
 * share it. A blocked refusal is resolved only by a change elsewhere (a refresh, another analyst, an administrator); a
 * field refusal is fixed in the form; a retryable one offers Try again.
 */
import type { ConflictReason } from '../../lib/api/conflict-reasons';
import { aiDecisionRefusalCopy, aiPolicyRefusalCopy } from '../../lib/api/refusal-copy';
import { aiJobFailureCopy } from '../ai-assistance/ai-assistance-domain';
import { aiProposalStartRefusalCopy } from '../questionnaire-ai/questionnaire-ai-refusal-copy';
import { ASK_AI_RETRY_LINE, CURATION_REASON_MAX_LENGTH, curationRetryLine, reasonTooLong, type RiskCurationFailureKind, type RiskDecisionIntent, type RiskStartField } from './risk-curation-domain';

export type RiskRefusal = { readonly message: string; readonly kind: RiskCurationFailureKind; readonly detail?: string; readonly field?: RiskStartField };

type Failure = { readonly status?: number; readonly reason?: ConflictReason };

const isRetryable = (status?: number): boolean => status === undefined || status < 400 || status >= 500;

const blocked = (message: string): RiskRefusal => ({ message, kind: 'blocked' });

/** R1's sentence for an edit, a control change, a Phase 12 decision or a rewrite refused because the Risk is withdrawn. */
export const RISK_WITHDRAWN_EDIT = 'This risk has been withdrawn, so it can’t be changed. Reinstate it to change it.';
const NOT_IN_CURRENT_STATE = 'This change can’t be made in the assessment’s current state.';
const RISK_GONE = 'This risk is no longer on this assessment. Refresh the page.';

/** Which act R1 answers: a withdrawal, a reinstatement, the history read, or an edit of a Risk that may be withdrawn. */
export type RiskCurationRefusalAct = 'withdraw' | 'reinstate' | 'history' | 'edit';

/** UI-SPEC §8.5: the history sheet's permission, not-found and error states. */
function historyRefusal(status?: number): RiskRefusal {
  if (status === 403) {
    return {
      message: 'You don’t have access to this history',
      detail: 'Ask a Security Analyst working on this assessment if you need to see how this risk changed.',
      kind: 'blocked',
    };
  }
  if (status === 404) return blocked('This risk’s history isn’t available.');
  return { message: 'We couldn’t load the history', detail: 'Please try again. If the problem continues, contact your administrator.', kind: 'retryable' };
}

/**
 * R1: a refused withdrawal, reinstatement, history read or edit, from its status and served reason. A 400 is the reason
 * field's error (§6.1, §6.2), with the count when the caller knows the reason's length, except on an Undo. For an edit, only
 * `RISK_WITHDRAWN`, a missing Risk and an unknown conflict have R1 sentences; the edit's other refusals keep Phase 10's
 * copy, so a 403 or a failure reads the unknown-conflict and Phase 10's unavailable sentences.
 */
export function riskCurationRefusal(failure: Failure, act: RiskCurationRefusalAct, options: { readonly reasonLength?: number; readonly undo?: boolean } = {}): RiskRefusal {
  const { status, reason } = failure;
  if (act === 'history') return historyRefusal(status);
  if (reason === 'RISK_WITHDRAWN') return blocked(RISK_WITHDRAWN_EDIT);
  if (act === 'edit') {
    if (status === 404) return blocked(RISK_GONE);
    if (isRetryable(status)) return { message: 'The assessment service is unavailable. Please try again later.', kind: 'retryable' };
    return blocked(NOT_IN_CURRENT_STATE);
  }
  const done = act === 'withdraw' ? 'withdrawn' : 'reinstated';
  if (reason === 'ASSESSMENT_NOT_MUTABLE') return blocked(`This assessment can no longer be changed, so the risk wasn’t ${done}. Refresh the page to see its current state.`);
  if (reason === 'RISK_NOT_WITHDRAWN') return blocked('This risk is already in the assessment. Refresh the page to see it.');
  /* BE1-03: an Undo that is no longer the actor's latest act on the Risk (pilot approval `b264ccc6`). */
  if (reason === 'RISK_CURATION_UNDO_UNAVAILABLE') return blocked('This can no longer be undone. Withdraw or reinstate the risk with a reason instead.');
  if (isRetryable(status)) return { message: curationRetryLine(act), kind: 'retryable' };
  /* An Undo sends no reason, so its 400 (a withdrawal with no earlier reason to restore) is not the field's error. */
  if (status === 400 && options.undo) return blocked(NOT_IN_CURRENT_STATE);
  if (status === 400) {
    if (options.reasonLength !== undefined && options.reasonLength > CURATION_REASON_MAX_LENGTH) return { message: reasonTooLong(options.reasonLength), kind: 'field' };
    return { message: act === 'withdraw' ? 'Give a reason for withdrawing this risk.' : 'Give a reason for reinstating this risk.', kind: 'field' };
  }
  if (status === 403) return blocked('You can’t withdraw or reinstate risks on this assessment.');
  if (status === 404) return blocked(RISK_GONE);
  return blocked(NOT_IN_CURRENT_STATE);
}

/* ---- R2: asking the AI ---- */

/** R2's sentences that R4 repeats for the same codes. */
const CONTEXT_TOO_LARGE = 'This assessment holds more risks and earlier proposals than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.';
const RUN_LIMIT = 'This assessment has reached the most AI requests it can keep, so the AI can’t be asked again. Contact your administrator.';

/** 15 §13 Q1's sentence, word for word, from Phase 15's own module (R2 and R3 map OWN_REQUEST to it). */
const ownRequest = (): string => aiProposalStartRefusalCopy({ status: 403, reason: 'OWN_REQUEST' }).text;

const INSTRUCTION_REASONS: ReadonlySet<string> = new Set(['INSTRUCTION_TOO_LONG', 'INSTRUCTION_CHARACTERS_NOT_ALLOWED', 'INSTRUCTION_REPEATS_REQUESTOR_TEXT']);

const startReasons: Readonly<Partial<Record<ConflictReason | 'CONTEXT_TOO_LARGE', string>>> = {
  ASSESSMENT_NOT_MUTABLE: 'This assessment can no longer be changed, so the AI can’t be asked about it.',
  RISK_WITHDRAWN: 'This risk has been withdrawn, so the AI can’t rewrite it. Reinstate it first.',
  CONTEXT_TOO_LARGE,
  AI_PROPOSAL_RUN_LIMIT: RUN_LIMIT,
};

/**
 * R2: a refused Suggest more risks, Rewrite this risk or Retry. The instruction reasons read 15 §13 Q1's field errors
 * (with the count when the caller knows the instruction's length), the policy reasons 12 §11.1's descriptions and
 * OWN_REQUEST Q1's sentence. `CONTEXT_TOO_LARGE` is a job failure code the transport never carries as a refusal reason;
 * it is accepted here so R4 reads R2's sentence from one place. A 400 with no reason is the rewrite's focus.
 */
export function riskAiStartRefusal(
  failure: { readonly status?: number; readonly reason?: ConflictReason | 'CONTEXT_TOO_LARGE' },
  options: { readonly instructionLength?: number; readonly operation?: 'suggest' | 'rewrite' } = {},
): RiskRefusal {
  const { status, reason } = failure;
  if (reason !== undefined && INSTRUCTION_REASONS.has(reason)) {
    const copy = aiProposalStartRefusalCopy({ status: 400, reason: reason as ConflictReason }, options.instructionLength === undefined ? {} : { instructionLength: options.instructionLength });
    return { message: copy.text, kind: 'field', field: 'instruction' };
  }
  if (reason === 'OWN_REQUEST') return blocked(ownRequest());
  const policy = reason === undefined || reason === 'CONTEXT_TOO_LARGE' ? undefined : aiPolicyRefusalCopy(reason);
  if (policy) return blocked(policy);
  const listed = reason === undefined ? undefined : startReasons[reason];
  if (listed) return blocked(listed);
  if (isRetryable(status)) return { message: ASK_AI_RETRY_LINE, kind: 'retryable' };
  if (status === 400 && options.operation === 'rewrite') return { message: 'Choose at least one part to rewrite.', kind: 'field', field: 'focus' };
  if (status === 403) return blocked('You can’t ask the AI about this assessment.');
  /* Phase 10's locked assessment refusal. */
  if (status === 404) return blocked('This assessment is no longer available.');
  return blocked('The AI can’t be asked in this assessment’s current state.');
}

/* ---- R3: deciding a proposal ---- */

export type RiskDecisionRefusalContext = {
  /** The Risk the decision is about, as its number reads; a proposed risk has none. */
  readonly riskNumber?: string | null;
  /** The change's label (changeUnitLabel), for a change to a Risk. */
  readonly label?: string | null;
  readonly intent?: RiskDecisionIntent;
};

/** R3's AI_ACCEPT_NOT_PERMITTED sentence. */
const ACCEPT_NOT_PERMITTED_REFUSAL = 'Accept can be confirmed only while the residual rating is Low or Moderate and the risk has no planned mitigation control, so it wasn’t applied. Reject it, or change the treatment yourself.';

/* Family J's sentence for a reason it holds: R3 reads it for the assessment lock and Phase 12's own decision reasons. */
const familyJ = (reason: ConflictReason): string => aiDecisionRefusalCopy({ status: 409, reason }).text;

/**
 * R3: a refused Add to assessment, Confirm, Reject or Undo. A refused Undo says what it would have undone; a stale
 * restore is a refused Undo of a confirmation. Where the Risk number or the label is unknown, the sentence names "This
 * risk" or "This field".
 */
export function riskDecisionRefusal(failure: Failure, context: RiskDecisionRefusalContext = {}): RiskRefusal {
  const { status, reason } = failure;
  const riskNumber = context.riskNumber || 'This risk';
  const label = context.label || 'This field';
  const undo = context.intent === 'undo-confirmation' || context.intent === 'undo-rejection';
  if (undo && (reason === 'AI_PROPOSAL_UNDO_UNAVAILABLE' || reason === 'AI_PROPOSAL_STALE')) {
    return blocked(context.intent === 'undo-rejection'
      ? 'This proposal can no longer be reopened, because the assessment has moved on.'
      : `${label} has changed since the change was confirmed, so it can’t be undone here. Change it in the risk form instead.`);
  }
  switch (reason) {
    case 'OWN_REQUEST': return blocked(ownRequest());
    case 'RISK_WITHDRAWN': return blocked(`${riskNumber} has been withdrawn, so its AI changes can’t be confirmed. Reinstate it first.`);
    case 'AI_PROPOSAL_STALE': return blocked(`${label} has changed since the AI proposed this, so it can’t be confirmed. Reject it, or rewrite the risk again.`);
    case 'AI_ACCEPT_NOT_PERMITTED': return blocked(ACCEPT_NOT_PERMITTED_REFUSAL);
    case 'AI_PROPOSAL_UNDO_UNAVAILABLE': return blocked('This proposal can no longer be reopened, because the assessment has moved on.');
    case 'ASSESSMENT_NOT_MUTABLE':
    case 'AI_PROPOSAL_ALREADY_DECIDED':
    case 'AI_ACCEPT_WITH_PLANNED_CONTROL':
    case 'AI_RUN_RECORD_UNAVAILABLE':
      return blocked(familyJ(reason));
    default:
      break;
  }
  if (isRetryable(status)) return { message: 'We couldn’t record your decision. Try again.', kind: 'retryable' };
  if (status === 400) return blocked('This proposal is no longer on the assessment. Refresh the page to see the current proposals.');
  if (status === 403) return blocked('You can’t decide AI proposals on this assessment.');
  if (status === 404) return blocked('These proposals couldn’t be found. Refresh the page.');
  return blocked('Your decision can’t be recorded in this assessment’s current state.');
}

/* ---- R4: a failed proposal job (the section, the Risk card, the signal) ---- */

/* R4's sentences by failure code. A Map, so a served code can never reach an inherited property. */
const jobFailures = new Map<string, (riskNumber: string) => string>([
  ['PROVIDER_OUTPUT_INVALID', () => 'The AI’s reply couldn’t be read, so nothing was proposed. Try again.'],
  ['ASSESSMENT_NOT_MUTABLE', () => 'The assessment stopped being editable before the AI started, so nothing was sent.'],
  ['RISK_WITHDRAWN', (riskNumber) => `${riskNumber} was withdrawn before the AI started, so nothing was sent.`],
  ['CONTEXT_TOO_LARGE', () => CONTEXT_TOO_LARGE],
  ['AI_PROPOSAL_RUN_LIMIT', () => RUN_LIMIT],
]);

/**
 * R4: a failed suggestion or rewrite job's sentence, by its code. The policy codes read 12 §11.2, and any other code the
 * server's own failure message (null when it served none). `riskNumber` names a rewritten Risk; a Suggest more risks job
 * has none. R4's restart row has no served code: jobs are process-local, so an interrupted job is never served (FE4-11).
 */
export function riskProposalJobFailureCopy(
  job: { readonly failureCode: string | null; readonly failureMessage: string | null },
  riskNumber: string | null,
): string | null {
  if (job.failureCode === null) return job.failureMessage;
  return jobFailures.get(job.failureCode)?.(riskNumber || 'The risk') ?? aiJobFailureCopy(job.failureCode) ?? job.failureMessage;
}

/* ---- Request deletion (R1's last row; UI-D34) ---- */

/**
 * R1's request-deletion line for a request that holds a Risk Assessment (D-16: no persisted Risk is deleted). The web
 * offers no request deletion, so this is the line any later surface reads; null for any other refusal, which keeps its
 * own copy there.
 */
export function requestDeletionRefusal(failure: Failure): RiskRefusal | null {
  return failure.reason === 'REQUEST_HAS_ASSESSMENT'
    ? blocked('This request has a risk assessment, so it can’t be deleted. The assessment and its risks are kept.')
    : null;
}
