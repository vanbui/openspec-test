/*
 * 15-UI-SPEC §13, families Q1 to Q3: what a refused request to the AI, a refused decision on a proposal and a failed
 * proposal job tell the analyst. Only Phase 15's analyst surfaces import this module, so its sentences never ship on the
 * Requestor's request page (B-1); refusal-copy.ts never imports it. Plain and zod-free, with no directive, so Server
 * Actions and client components can share it. A blocked refusal is resolved only by a change elsewhere (a refresh,
 * another analyst, an administrator); a field refusal is fixed in the instruction; a retryable one offers Try again.
 */
import type { ConflictReason } from '../../lib/api/conflict-reasons';
import { aiPolicyRefusalCopy, refusalMessage } from '../../lib/api/refusal-copy';
import { aiJobFailureCopy } from '../ai-assistance/ai-assistance-domain';
import type { QuestionnaireAiFailureKind } from './questionnaire-ai-domain';

export type QuestionnaireAiRefusal = { readonly text: string; readonly kind: QuestionnaireAiFailureKind };

type Failure = { readonly status?: number; readonly reason?: ConflictReason };

const isRetryable = (status?: number): boolean => status === undefined || status < 400 || status >= 500;

const OWN_REQUEST = 'A Security Analyst can’t steer the AI on a request they raised. Another Security Analyst handles it.';
const ASSESSMENT_STARTED = 'An assessment has been drafted from this questionnaire, so its questions can no longer change.';
const ASSESSMENT_DRAFT_IN_PROGRESS = 'An assessment draft is being generated, so this questionnaire can’t change.';
const RUN_LIMIT = 'This questionnaire has reached the most AI requests it can keep, so the AI can’t be asked again. Contact your administrator.';
const HISTORY_FULL = 'This questionnaire’s change history can’t record more changes, so the AI can’t be asked. Contact your administrator.';
const CONTEXT_TOO_LARGE = 'This questionnaire and its request hold more than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.';

/** The three instruction rules, shown beside the field (D-18). */
const instructionReasons: Readonly<Partial<Record<ConflictReason, (length?: number) => string>>> = {
  INSTRUCTION_TOO_LONG: (length) => `Keep the instruction to 500 characters or fewer.${length === undefined ? '' : ` It has ${length.toLocaleString('en-AU')}.`}`,
  INSTRUCTION_CHARACTERS_NOT_ALLOWED: () => 'The instruction contains hidden formatting characters CSRM can’t send. Type it again, or paste it as plain text.',
  INSTRUCTION_REPEATS_REQUESTOR_TEXT: () => 'The instruction repeats a long passage of the Requestor’s own words. The AI already reads the request and the marked notes and files, so say what to focus on in your own words.',
};

/** Q1's sentences for the reasons that block asking the AI. */
const startReasons: Readonly<Partial<Record<ConflictReason, string>>> = {
  QUESTIONNAIRE_NOT_SUBMITTED: 'The Requestor is still answering this questionnaire. Wait for them to submit it, or return it to analyst review.',
  ASSESSMENT_STARTED,
  ASSESSMENT_DRAFT_IN_PROGRESS,
  QUESTION_ANSWERED: 'This question has been answered, so the AI can’t rewrite it. Refresh the page to see it.',
  QUESTION_REMOVED: 'This question has been removed. Refresh the page to see the current list.',
  AI_PROPOSAL_RUN_LIMIT: RUN_LIMIT,
  HISTORY_UNAVAILABLE: HISTORY_FULL,
  OWN_REQUEST,
};

/** Q1: a refused start, rewrite or retry, or a Generate or Replace refused for its instruction. */
export function aiProposalStartRefusalCopy(failure: Failure, options: { readonly instructionLength?: number } = {}): QuestionnaireAiRefusal {
  const { status, reason } = failure;
  const instruction = reason === undefined ? undefined : instructionReasons[reason];
  if (instruction) return { text: instruction(options.instructionLength), kind: 'field' };
  const policy = reason === undefined ? undefined : aiPolicyRefusalCopy(reason);
  if (policy) return { text: policy, kind: 'blocked' };
  const listed = reason === undefined ? undefined : startReasons[reason];
  if (listed) return { text: listed, kind: 'blocked' };
  if (isRetryable(status)) return { text: 'We couldn’t ask the AI. Try again.', kind: 'retryable' };
  if (status === 403) return { text: 'You can’t ask the AI for proposals on this questionnaire.', kind: 'blocked' };
  /* Phase 10's locked questionnaire refusal. */
  if (status === 404) return { text: 'This questionnaire is no longer available.', kind: 'blocked' };
  return { text: 'The AI can’t be asked in this questionnaire’s current state.', kind: 'blocked' };
}

/** What the analyst decided, so a refused Undo can say what it would have undone. `confirm` covers Edit, then confirm. */
export type ProposalDecisionIntent = 'confirm' | 'reject' | 'undo-confirmation' | 'undo-rejection';

const decisionReasons: Readonly<Partial<Record<ConflictReason, string>>> = {
  QUESTIONNAIRE_RELEASED: 'This questionnaire has been released. Return it to analyst review before you confirm proposals.',
  AI_PROPOSAL_STALE: 'This question has changed since the AI proposed this, so it can’t be confirmed. Reject it, or ask the AI again.',
  /* UI-D29: family J reads the same neutral sentence. */
  AI_PROPOSAL_ALREADY_DECIDED: 'This proposal is no longer open. Refresh the page to see where it stands.',
  ANSWERED_QUESTION_AFFECTED: 'Confirming this would change or hide an answered question, so it wasn’t applied. Reject it, or edit it so answered questions stay as they are.',
  DEFINITION_INVALID: 'Confirming this would make the questionnaire inconsistent, so it wasn’t applied. Edit it before confirming, or reject it.',
  QUESTION_HAS_DEPENDENTS: refusalMessage('questionDelete', 'QUESTION_HAS_DEPENDENTS'),
  LAST_ACTIVE_QUESTION: refusalMessage('questionDelete', 'LAST_ACTIVE_QUESTION'),
  ASSESSMENT_STARTED,
  ASSESSMENT_DRAFT_IN_PROGRESS,
  OWN_REQUEST,
  HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so your decision wasn’t recorded. Contact your administrator.',
};

/**
 * Q2: a refused Confirm, Edit then confirm, Reject or Undo. A 400 that reaches here is a proposal the server no longer
 * has: Edit, then confirm checks its fields against Phase 10 §1.2's rules in the form before it sends anything.
 */
export function aiProposalDecisionRefusalCopy(failure: Failure, context: { readonly decision: ProposalDecisionIntent }): QuestionnaireAiRefusal {
  const { status, reason } = failure;
  if (reason === 'AI_PROPOSAL_UNDO_UNAVAILABLE') {
    return {
      text: context.decision === 'undo-rejection'
        ? 'This proposal can no longer be reopened, because the questionnaire has moved on.'
        : 'This question has changed since the proposal was confirmed, so it can’t be undone here. Change it in the question editor instead.',
      kind: 'blocked',
    };
  }
  const listed = reason === undefined ? undefined : decisionReasons[reason];
  if (listed) return { text: listed, kind: 'blocked' };
  if (isRetryable(status)) return { text: 'We couldn’t record your decision. Try again.', kind: 'retryable' };
  if (status === 400) return { text: 'This proposal is no longer on the questionnaire. Refresh the page to see the current proposals.', kind: 'blocked' };
  if (status === 403) return { text: 'You can’t decide AI proposals on this questionnaire.', kind: 'blocked' };
  if (status === 404) return { text: 'These proposals couldn’t be found. Refresh the page.', kind: 'blocked' };
  return { text: 'Your decision can’t be recorded in this questionnaire’s current state.', kind: 'blocked' };
}

/* Q3's sentences by failure code. A Map, so a served code can never reach an inherited property. */
const jobFailures = new Map<string, string>([
  ['PROVIDER_OUTPUT_INVALID', 'The AI’s reply couldn’t be read, so nothing was proposed. Try again.'],
  ['QUESTIONNAIRE_NOT_SUBMITTED', 'The questionnaire changed before the AI started, so nothing was sent. Refresh the page to see where it stands.'],
  ['QUESTIONNAIRE_RELEASED', 'The questionnaire changed before the AI started, so nothing was sent. Refresh the page to see where it stands.'],
  ['ASSESSMENT_STARTED', 'An assessment draft was started, so the questionnaire can no longer change and nothing was sent.'],
  ['ASSESSMENT_DRAFT_IN_PROGRESS', 'An assessment draft was started, so the questionnaire can no longer change and nothing was sent.'],
  ['QUESTION_ANSWERED', 'The question was answered or removed before the AI started, so nothing was sent.'],
  ['QUESTION_REMOVED', 'The question was answered or removed before the AI started, so nothing was sent.'],
  ['AI_PROPOSAL_RUN_LIMIT', RUN_LIMIT],
  ['HISTORY_UNAVAILABLE', HISTORY_FULL],
  /* The shared rule's case (c) on Phase 15's surfaces (§13 amendment of 2026-10-11): ContextTooLargeFailure's fallback. */
  ['CONTEXT_TOO_LARGE', CONTEXT_TOO_LARGE],
]);

/**
 * Q3: a failed proposal or rewrite job's sentence, by its code; a run a restart interrupted reads its own sentence. The
 * policy codes read 12 §11.2, and any other code the server's own failure message (null when it served none).
 */
export function aiProposalJobFailureCopy(code: string | null, message: string | null, options: { readonly interrupted?: boolean } = {}): string | null {
  if (options.interrupted) return 'The AI request stopped when CSRM restarted, so nothing was proposed. Try again.';
  if (code === null) return message;
  return jobFailures.get(code) ?? aiJobFailureCopy(code) ?? message;
}
