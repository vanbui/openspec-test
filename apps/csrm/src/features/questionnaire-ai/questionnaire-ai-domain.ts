/*
 * Phase 15 (D-34, D-35; 15-UI-SPEC §2 to §8): the questionnaire AI proposals as the web reads them, and every label, line
 * and rule the panel, the question rows and the hub render. Plain and zod-free, so client components can import it
 * without pulling a parser into the bundle (zod-client-boundary.test.ts); the closed parsers in
 * questionnaire-ai-schema.ts are typed against these views. No business logic lives in JSX: components compose these.
 */
import type { ConflictReason } from '../../lib/api/conflict-reasons';
import type { ContextTooLargeFile } from '../attachments/context-too-large-files';

/** D-06: where the questionnaire stands for the AI, as the proposals read serves it. */
export type ProposalQuestionnaireState = 'analyst-review' | 'awaiting-submission' | 'submitted' | 'draft-in-progress' | 'assessment-started';
export type ProposalItemKind = 'add' | 'change' | 'remove';
export type ProposalState = 'open' | 'accepted' | 'rejected' | 'superseded' | 'lapsed';
export type ProposalOperation = 'questionnaire-proposals' | 'question-rewrite';
export type InstructionSourceView = 'analyst' | 'plain-language-preset' | 'default-task';
export type ProposalAnswerType = 'Text' | 'Long text' | 'Boolean' | 'Single select' | 'Multi select' | 'Date' | 'File upload';

export type PersonView = { readonly documentId: string; readonly displayName: string };

/** Whether the viewing analyst may take an act now, and the closed reason when not (D-03 item 4). */
export type QuestionnaireAiAction = { readonly allowed: boolean; readonly reason: string | null };

export type QuestionnaireAiActions = {
  readonly start: QuestionnaireAiAction;
  readonly rewrite: QuestionnaireAiAction;
  readonly confirm: QuestionnaireAiAction;
  readonly reject: QuestionnaireAiAction;
  readonly replace: QuestionnaireAiAction;
};

export type QuestionnaireAiAdjustment = { readonly code: string; readonly count: number };

export type QuestionnaireAiRunView = {
  readonly runId: string;
  readonly operation: ProposalOperation;
  readonly scope: 'questionnaire' | 'question';
  readonly initiatedBy: PersonView | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly providerName: string | null;
  readonly providerVersion: string | null;
  readonly instruction: string | null;
  readonly instructionSource: InstructionSourceView | null;
  readonly targetQuestion: { readonly questionId: string | null; readonly questionText: string } | null;
  readonly outcome: 'items' | 'no-change';
  readonly counts: { readonly items: number; readonly open: number };
  readonly adjustments: readonly QuestionnaireAiAdjustment[];
  readonly sourcesDropped: number;
};

export type QuestionnaireAiQuestionValues = {
  readonly questionText: string;
  readonly helpText: string | null;
  readonly answerType: ProposalAnswerType;
  readonly choices: readonly { readonly value: string; readonly label: string }[];
  readonly required: boolean;
};

export type ProposalVisibilityView = {
  readonly controllerText: string | null;
  readonly operator: 'equals' | 'notEquals' | 'includes' | 'notIncludes';
  readonly value: string | boolean;
};

export type ProposalPlacementView = {
  readonly sectionTitle: string;
  readonly newSection: boolean;
  readonly visibility: ProposalVisibilityView | null;
};

export type ProposalSourceKind = 'request-field' | 'note' | 'file' | 'answered-question' | 'instruction';

export type ProposalSourceView = {
  readonly kind: ProposalSourceKind;
  readonly ref: string;
  readonly label: string;
  readonly note: { readonly documentId: string; readonly part: 'requestor' | 'security-analyst'; readonly postedAt: string | null } | null;
};

export type ProposalDecisionView = {
  readonly action: 'accepted' | 'rejected' | 'restored' | 'superseded' | 'lapsed';
  readonly by: PersonView | null;
  readonly at: string;
  readonly reason: string | null;
  readonly edited: boolean;
};

export type QuestionnaireAiItemView = {
  readonly runId: string;
  readonly itemKey: string;
  readonly kind: ProposalItemKind;
  readonly state: ProposalState;
  /** Null while the Requestor answers and for a decided item. */
  readonly stale: boolean | null;
  readonly target: { readonly questionId: string; readonly questionText: string; readonly available: boolean } | null;
  readonly current: QuestionnaireAiQuestionValues | null;
  readonly proposed: QuestionnaireAiQuestionValues | null;
  readonly placement: ProposalPlacementView | null;
  readonly rationale: string;
  readonly sources: readonly ProposalSourceView[];
  readonly decision: ProposalDecisionView | null;
  readonly canUndo: boolean;
};

export type QuestionnaireProposalJobView = {
  readonly jobId: string;
  readonly questionnaireId: string;
  readonly operation: ProposalOperation;
  readonly questionId: string | null;
  readonly status: 'queued' | 'running' | 'completed' | 'failed';
  readonly attempt: number;
  readonly queuedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly runId: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  /** S-3: for a CONTEXT_TOO_LARGE failure, the files included in the AI inputs; absent otherwise. */
  readonly failureAttachments?: readonly ContextTooLargeFile[];
  readonly initiatedBy: PersonView | null;
  readonly initiatedByViewer: boolean;
  readonly canRetry: boolean;
};

export type FixedQuestionView = { readonly questionId: string; readonly questionText: string };

export type QuestionnaireAiProposalsView = {
  readonly questionnaireId: string;
  readonly state: ProposalQuestionnaireState;
  readonly openCount: number;
  readonly actions: QuestionnaireAiActions;
  readonly runs: readonly QuestionnaireAiRunView[];
  readonly items: readonly QuestionnaireAiItemView[];
  readonly jobs: readonly QuestionnaireProposalJobView[];
  /** The answered questions in analyst review and on a submitted questionnaire; null while the Requestor answers. */
  readonly fixedQuestions: readonly FixedQuestionView[] | null;
};

export type QuestionnaireAiDecisionResult = { readonly applied: number; readonly unchanged: number };

/** One decision as the batch Server Action sends it (15-07's shape); `accept` is shown as Confirm (UI-D1). */
export type QuestionnaireAiSectionChoice = { readonly kind: 'existing'; readonly key: string } | { readonly kind: 'new'; readonly title: string };

export type QuestionnaireAiDecisionEdits = {
  readonly questionText?: string;
  readonly helpText?: string | null;
  readonly answerType?: Exclude<ProposalAnswerType, 'File upload'>;
  readonly choices?: readonly { readonly value: string; readonly label: string }[];
  readonly required?: boolean;
  readonly section?: QuestionnaireAiSectionChoice;
};

export type QuestionnaireAiDecision = {
  readonly runId: string;
  readonly item: string;
  readonly action: 'accept' | 'reject' | 'restore';
  readonly edits?: QuestionnaireAiDecisionEdits;
  readonly reason?: string;
};

/** How a refused proposal act is recovered: a field error, a refusal only a change elsewhere resolves, or Try again. */
export type QuestionnaireAiFailureKind = 'field' | 'blocked' | 'retryable';

export type QuestionnaireAiFailure = {
  readonly failure: QuestionnaireAiFailureKind;
  readonly status?: number;
  readonly reason?: ConflictReason;
  readonly message: string;
};

/** 15-UI-SPEC §14: the panel's error state when the proposals read fails. */
export const PROPOSALS_LOAD_FAILED = 'We couldn’t load the AI proposals';

/* ---- Presentation rules (15-UI-SPEC §2 to §8). Every sentence is the contract's, verbatim. ---- */

const formatCount = (count: number): string => count.toLocaleString('en-AU');

/** A written-out count with its noun (Voice: written-out plurals). */
export function pluralise(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

const quoted = (text: string): string => `“${text}”`;

/** §2.1: the panel's status line. */
export function panelStatusLine(openCount: number): string {
  return openCount === 0 ? 'No open AI proposals' : `${pluralise(openCount, 'open proposal', 'open proposals')}`;
}

/** §2.2 (UI-D3): the start action's label, by the instruction field and whether any question is answered. */
export function startActionLabel({ instruction, anyAnswered }: { readonly instruction: string; readonly anyAnswered: boolean }): string {
  if (instruction.trim() !== '') return 'Ask the AI';
  return anyAnswered ? 'Suggest follow-up questions' : 'Suggest more questions';
}

export type PanelGuidance = { readonly icon: 'Clock' | 'Lock' | null; readonly line: string; readonly offerReturnToReview: boolean };

const FORM_OPEN_LINE = 'Save or discard the open question before you confirm proposals or ask the AI.';

/**
 * §2.4: the guidance line for the questionnaire's state, or null in analyst review. A question form open in analyst review
 * reads the form-open caption instead (UI-D10); a released questionnaire takes no question form.
 */
export function panelGuidance(state: ProposalQuestionnaireState, { formOpen }: { readonly formOpen: boolean }): PanelGuidance | null {
  switch (state) {
    case 'analyst-review':
      return formOpen ? { icon: null, line: FORM_OPEN_LINE, offerReturnToReview: false } : null;
    case 'awaiting-submission':
      return { icon: 'Clock', line: 'The Requestor is answering this questionnaire. You can ask the AI once they submit it, or after you return it to analyst review.', offerReturnToReview: true };
    case 'submitted':
      return { icon: 'Lock', line: 'To confirm proposals, return the questionnaire to analyst review. You can ask the AI and reject proposals now.', offerReturnToReview: true };
    case 'draft-in-progress':
      return { icon: 'Lock', line: 'An assessment draft is being generated, so this questionnaire can’t change.', offerReturnToReview: false };
    case 'assessment-started':
      return { icon: 'Lock', line: 'An assessment has been drafted from this questionnaire, so its questions can no longer change.', offerReturnToReview: false };
  }
}

export type ProposalControl = 'enabled' | 'disabled' | 'hidden';
export type ItemActions = { readonly confirm: ProposalControl; readonly editThenConfirm: ProposalControl; readonly reject: boolean; readonly undo: boolean };

const NO_ACTIONS: ItemActions = { confirm: 'hidden', editThenConfirm: 'hidden', reject: false, undo: false };
const BEFORE_DRAFT: ReadonlySet<ProposalQuestionnaireState> = new Set(['analyst-review', 'awaiting-submission', 'submitted']);

/**
 * §2.4 and §4.4: which of Confirm, Edit then confirm, Reject and Undo an item shows. Confirm needs analyst review and a
 * current item; while a question form is open it is disabled (UI-D10). Reject shows on any open item until the draft.
 * Undo shows on a confirmed item in analyst review and on a rejected one until the draft, when the server allows it
 * (D-23). The served actions say what the viewer may do at all; Strapi decides every act again.
 */
export function itemActionsFor(item: QuestionnaireAiItemView, view: Pick<QuestionnaireAiProposalsView, 'state' | 'actions'>, { formOpen }: { readonly formOpen: boolean }): ItemActions {
  const { state, actions } = view;
  if (!BEFORE_DRAFT.has(state)) return NO_ACTIONS;
  if (item.state === 'open') {
    const reject = actions.reject.allowed;
    if (state !== 'analyst-review' || item.stale === true || !actions.confirm.allowed) return { ...NO_ACTIONS, reject };
    const confirm: ProposalControl = formOpen ? 'disabled' : 'enabled';
    return { confirm, editThenConfirm: item.kind === 'remove' ? 'hidden' : confirm, reject, undo: false };
  }
  const undo = item.canUndo && ((item.state === 'accepted' && state === 'analyst-review') || item.state === 'rejected');
  return { ...NO_ACTIONS, undo };
}

/** §4.1: a group's heading, by who asked the AI and what. */
export function runGroupHeading(run: QuestionnaireAiRunView, initiatorName: string, anyAnswered: boolean): string {
  const instruction = run.instructionSource === 'analyst' && run.instruction ? run.instruction : null;
  if (run.operation === 'question-rewrite') {
    return instruction ? `${initiatorName} asked the AI to rewrite a question: ${quoted(instruction)}` : `${initiatorName} asked the AI to rewrite a question in plain language`;
  }
  if (instruction) return `${initiatorName} asked the AI: ${quoted(instruction)}`;
  return `${initiatorName} asked the AI for ${anyAnswered ? 'follow-up questions' : 'more questions'}`;
}

/** §4.1: a group's facts, `{instant} · Provider: {name} · Model: {version} · {k} of {n} open`; `instant` is X-3's. */
export function runFactsLine(run: QuestionnaireAiRunView, instant: string): string {
  return [
    instant,
    ...(run.providerName ? [`Provider: ${run.providerName}`] : []),
    ...(run.providerVersion ? [`Model: ${run.providerVersion}`] : []),
    `${formatCount(run.counts.open)} of ${formatCount(run.counts.items)} open`,
  ].join(' · ');
}

/* §4.1's left-out lines; `ignored-field` (UI-D14) and `sources-dropped` (the unmatched-sources caption) are not listed. */
const leftOutCopy: Readonly<Record<string, string>> = {
  'answered-target': 'A change to an answered question. Answered questions stay as they are.',
  'removed-target': 'A change to a question that has been removed.',
  'unknown-target': 'A change to a question CSRM couldn’t find.',
  'duplicate-target': 'A second proposal for the same question.',
  'invalid-item': 'A proposal that was incomplete or too long.',
  'near-duplicate': 'A question too close to one already asked, proposed, rejected or removed.',
  'no-change': 'A change that left the question as it was.',
  'definition-invalid': 'A proposal that would have made the questionnaire inconsistent.',
  'answers-affected': 'A proposal that would have changed or hidden an answered question.',
  'rewrite-out-of-scope': 'A rewrite that changed more than the wording.',
};
const UNLISTED_ADJUSTMENTS: ReadonlySet<string> = new Set(['ignored-field', 'sources-dropped']);

const listedAdjustments = (adjustments: readonly QuestionnaireAiAdjustment[]): readonly QuestionnaireAiAdjustment[] =>
  adjustments.filter((adjustment) => !UNLISTED_ADJUSTMENTS.has(adjustment.code));

/** §4.1: one line per adjustment CSRM left out, prefixed `{count} ×` when aggregated. */
export function leftOutLines(adjustments: readonly QuestionnaireAiAdjustment[]): readonly string[] {
  return listedAdjustments(adjustments).map(({ code, count }) => {
    if (code === 'over-limit') return `${pluralise(count, 'more proposal', 'more proposals')} beyond the limit of 30, or 15 new questions, per request.`;
    const line = Object.hasOwn(leftOutCopy, code) ? leftOutCopy[code] : 'A proposal CSRM couldn’t use.';
    return count > 1 ? `${formatCount(count)} × ${line}` : `${line}`;
  });
}

/** §4.1: how many proposals CSRM left out, counted as the list counts them. */
export function leftOutCount(adjustments: readonly QuestionnaireAiAdjustment[]): number {
  return listedAdjustments(adjustments).reduce((total, adjustment) => total + adjustment.count, 0);
}

/** §4.1: the `{a} left out` figure link's label, or null when nothing was left out. */
export function leftOutLabel(count: number): string | null {
  return count > 0 ? `${formatCount(count)} left out` : null;
}

/** §4.1: the caption for cited sources CSRM couldn't match, or null when none. */
export function unmatchedSourcesCaption(count: number): string | null {
  if (count === 0) return null;
  return `${pluralise(count, 'source', 'sources')} the AI cited couldn’t be matched, so ${count === 1 ? 'it isn’t' : 'they aren’t'} shown.`;
}

export type ItemEyebrow = { readonly label: string; readonly icon: 'Plus' | 'PenLine' | 'CircleMinus' };

/** §4.2: the card's eyebrow; a rewrite asked for without an instruction is a plain-language rewrite. */
export function itemEyebrow(item: QuestionnaireAiItemView, run: QuestionnaireAiRunView): ItemEyebrow {
  if (item.kind === 'add') return { label: 'New question', icon: 'Plus' };
  if (item.kind === 'remove') return { label: 'Question removal', icon: 'CircleMinus' };
  const plainLanguage = run.operation === 'question-rewrite' && run.instructionSource !== 'analyst';
  return { label: plainLanguage ? 'Plain-language rewrite' : 'Question change', icon: 'PenLine' };
}

/** §4.2: the card's subject, the proposed question for an addition and the current one otherwise. */
export function itemSubject(item: QuestionnaireAiItemView): string {
  if (item.kind === 'add') return item.proposed?.questionText ?? '';
  return item.current?.questionText ?? item.target?.questionText ?? '';
}

/** §4.3: where a new question goes, or null for a change or removal. */
export function placementLine(item: QuestionnaireAiItemView): string | null {
  if (item.kind !== 'add' || item.placement === null) return null;
  const { sectionTitle, newSection } = item.placement;
  return newSection ? `In a new section, ${sectionTitle}, after the last section` : `At the end of ${sectionTitle}`;
}

const visibilityValue = (value: string | boolean): string => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value);

/** §4.3: when a new question shows, or null when it always shows. A controlling question no longer named reads as an earlier one. */
export function visibilityLine(placement: ProposalPlacementView): string | null {
  const rule = placement.visibility;
  if (rule === null) return null;
  const controller = rule.controllerText === null ? 'An earlier question' : quoted(rule.controllerText);
  const value = quoted(visibilityValue(rule.value));
  switch (rule.operator) {
    case 'equals': return `${controller} is ${value}`;
    case 'notEquals': return `${controller} is not ${value}`;
    case 'includes': return `${controller} includes ${value}`;
    case 'notIncludes': return `${controller} doesn’t include ${value}`;
  }
}

/** §4.3 (UI-D15): a citation's label; `instant` is a cited note's X-3 time. An answered question's answer is never shown. */
export function citationLabel(source: ProposalSourceView, instant: string): string {
  switch (source.kind) {
    case 'request-field': return `Request: ${source.label}`;
    case 'note': return `Note: ${source.note?.part === 'requestor' ? 'Requestor' : 'Security Analyst'} note · ${instant}`;
    case 'file': return `File: ${source.label}`;
    case 'answered-question': return `Answered question: ${source.label}`;
    case 'instruction': return 'Instruction';
  }
}

/** §4.4: why a stale item can't be confirmed, or null when it is current. */
export function staleLine(item: QuestionnaireAiItemView): string | null {
  if (item.stale !== true) return null;
  return item.kind === 'add'
    ? 'The questionnaire has changed since the AI proposed this, so it can’t be added as proposed. Reject it, or add the question yourself.'
    : 'This question has changed, been answered or been removed since the AI proposed this, so it can’t be confirmed. Reject it, or ask the AI again.';
}

/** §4.3: what confirming a removal does. */
export const REMOVAL_NOTE = 'Confirming removes this question from the questionnaire. Its history is kept, and Undo puts it back.';

export type DecidedNote = { readonly icon: 'Check' | 'PenLine' | 'X' | 'ListRestart' | 'Lock'; readonly text: string; readonly reason: string | null };

/** §4.6: a decided item's note, with the rejection's reason when given; null for an open item. */
export function decidedNote(item: QuestionnaireAiItemView, { deciderName, instant }: { readonly deciderName: string | null; readonly instant: string }): DecidedNote | null {
  const decision = item.decision;
  if (decision === null || item.state === 'open') return null;
  const by = (label: string): string => [label, ...(deciderName ? [deciderName] : []), instant].join(' · ');
  switch (decision.action) {
    case 'accepted': return decision.edited ? { icon: 'PenLine', text: by('Edited, then confirmed'), reason: null } : { icon: 'Check', text: by('Confirmed'), reason: null };
    case 'rejected': return { icon: 'X', text: by('Rejected'), reason: decision.reason ? `Reason: ${quoted(decision.reason)}` : null };
    case 'superseded': return { icon: 'ListRestart', text: by('Replaced by a newer proposal'), reason: null };
    case 'lapsed': return { icon: 'Lock', text: 'Closed without a decision: an assessment draft froze the questionnaire.', reason: null };
    case 'restored': return null;
  }
}

/** §4.6: a decided card's caption. */
export function proposedCaption(instant: string, initiatorName: string): string {
  return `Proposed ${instant} at ${initiatorName}’s request`;
}

export type DecisionAct = 'confirm' | 'reject' | 'reject-remaining' | 'undo-confirm' | 'undo-reject' | 'undo-reject-remaining';

/** §5.1: a decision's success toast, or Undo's. `edited` is Confirm with edits. */
export function decisionToast(act: DecisionAct, { kind, edited = false, sectionTitle, count = 1 }: { readonly kind?: ProposalItemKind; readonly edited?: boolean; readonly sectionTitle?: string; readonly count?: number }): string {
  switch (act) {
    case 'confirm': {
      const base = kind === 'add' ? `New question confirmed and added to ${sectionTitle ?? 'the questionnaire'}` : kind === 'remove' ? 'Question removed' : 'Question change confirmed';
      return `${base}${edited ? ' with your edits' : ''}.`;
    }
    case 'reject': return 'Proposal rejected.';
    case 'reject-remaining': return `${pluralise(count, 'proposal', 'proposals')} rejected.`;
    case 'undo-confirm':
      if (kind === 'add') return 'Confirmation undone. The question was taken out again.';
      return kind === 'remove' ? 'Confirmation undone. The question is back.' : 'Confirmation undone. The question is back as it was.';
    case 'undo-reject': return 'Rejection undone. The proposal is open again.';
    case 'undo-reject-remaining': return 'Rejections undone.';
  }
}

/** §5.1: a refused decision's toast title. */
export function decisionFailureTitle(act: DecisionAct): string {
  if (act === 'confirm') return 'Proposal not confirmed';
  if (act === 'reject') return 'Proposal not rejected';
  if (act === 'reject-remaining') return 'Proposals not rejected';
  return 'Couldn’t undo';
}

/** §3.1: the instruction's count, shown once it holds text. */
export function instructionCountLine(length: number): string | null {
  return length > 0 ? `${formatCount(length)} of 500 characters` : null;
}

/** §3.1: the field's error when the instruction is over 500 characters, checked when its action is pressed. */
export function instructionTooLongLine(length: number): string | null {
  return length > 500 ? `Keep the instruction to 500 characters or fewer. It has ${formatCount(length)}.` : null;
}

/** §7.2: the answered questions' toggle, or null at zero. */
export function fixedQuestionsToggle(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? '1 answered question stays as it is' : `${formatCount(count)} answered questions stay as they are`;
}

export type EmptyState = { readonly title: string; readonly body: string };

/** §2.5: the first-use or cleared empty state, or null when proposals are open or the start is not offered with none. */
export function emptyState(view: Pick<QuestionnaireAiProposalsView, 'items' | 'openCount' | 'actions'>): EmptyState | null {
  if (view.openCount > 0) return null;
  if (view.items.length > 0) return { title: 'No open AI proposals', body: 'Every proposal has been decided. They’re listed under Decided proposals.' };
  if (!view.actions.start.allowed) return null;
  return { title: 'No AI proposals yet', body: 'Ask the AI for follow-up questions, or give it an instruction such as “Add questions about the offshore support team”.' };
}

export type GateLine = { readonly text: string; readonly link: { readonly label: string; readonly href: string } | null };

const PANEL_ANCHOR = '#ai-proposals';
const openProposalsLabel = (count: number): string => `${formatCount(count)} open AI ${count === 1 ? 'proposal' : 'proposals'}`;

/**
 * §8.1 (UI-D19): the line in place of Release questionnaire while proposals are open or a proposal job is active, or null
 * when release is offered. A requesting analyst is not served the count (D-32): the caller passes `countServed: false`
 * only when the questionnaire has open proposals.
 */
export function releaseGateLine({ openCount, activeJob, countServed }: { readonly openCount: number; readonly activeJob: boolean; readonly countServed: boolean }): GateLine | null {
  if (!countServed) return { text: 'This questionnaire has open AI proposals. Another Security Analyst decides them before release.', link: null };
  if (openCount > 0) return { text: `Decide the ${openProposalsLabel(openCount)} before you release this questionnaire.`, link: { label: openProposalsLabel(openCount), href: PANEL_ANCHOR } };
  if (activeJob) return { text: 'The AI is preparing proposals. Decide them before you release this questionnaire.', link: { label: 'Go to AI proposals', href: PANEL_ANCHOR } };
  return null;
}

/** §8.2: the hub draft card's line in place of Generate assessment draft, or null when nothing is open. */
export function draftGateLine(openCount: number, questionnaireId: string): GateLine | null {
  if (openCount === 0) return null;
  return {
    text: `Decide the ${openProposalsLabel(openCount)} on the questionnaire before you generate the draft.`,
    link: { label: openProposalsLabel(openCount), href: `/app/review/questionnaires/${encodeURIComponent(questionnaireId)}${PANEL_ANCHOR}` },
  };
}

export type ReplaceOffer = { readonly offered: true } | { readonly offered: false; readonly line: string | null; readonly link: { readonly label: string; readonly href: string } | null };

/**
 * §8.3 (D-09, D-12): whether the hub offers Replace questionnaire, from the served replace action, or its line and link.
 * A released questionnaire keeps Phase 10 §3.3 (no line here).
 */
export function replaceOffer(view: Pick<QuestionnaireAiProposalsView, 'actions' | 'openCount'>): ReplaceOffer {
  const { allowed, reason } = view.actions.replace;
  if (allowed) return { offered: true };
  const openPanel = { label: 'Open AI proposals', href: PANEL_ANCHOR };
  switch (reason) {
    case 'QUESTIONNAIRE_ANSWERED':
      return { offered: false, line: 'The Requestor has answered this questionnaire, so it can’t be replaced. Ask the AI for follow-up questions instead.', link: openPanel };
    case 'QUESTIONNAIRE_HAS_ANALYST_CHANGES':
      return { offered: false, line: 'Analysts have changed this questionnaire since it was generated, so replacing it would discard their work. Use AI proposals to change it instead.', link: openPanel };
    case 'AI_PROPOSALS_OPEN':
      return { offered: false, line: 'This questionnaire has open AI proposals. Decide them before replacing it.', link: view.openCount > 0 ? { label: openProposalsLabel(view.openCount), href: PANEL_ANCHOR } : { label: 'Go to AI proposals', href: PANEL_ANCHOR } };
    default:
      return { offered: false, line: null, link: null };
  }
}

/** §8.4: the hub card's AI proposals line; linked to the panel when any is open. */
export function hubProposalsLine(openCount: number): { readonly text: string; readonly linked: boolean } {
  return openCount > 0 ? { text: `AI proposals: ${formatCount(openCount)} open`, linked: true } : { text: 'AI proposals: none open', linked: false };
}

/**
 * The panel's groups and cards a timeline entry may link to (15-03's `proposalAnchors`): the runs with an open proposal,
 * by run id, and their open proposals' card anchors. Decided cards sit in a collapsed list, so no entry links to them.
 */
export function proposalAnchorsOf(view: Pick<QuestionnaireAiProposalsView, 'items'>): { runs: readonly string[]; items: readonly string[] } {
  const open = view.items.filter((item) => item.state === 'open');
  return {
    runs: [...new Set(open.map((item) => item.runId))],
    items: open.map((item) => `ai-proposal-${item.runId}-${item.itemKey}`),
  };
}

/* §2.2, §2.3 and §3.1: the start form's and the job state's fixed lines. */
export const PANEL_INSTRUCTION_HINT = 'Say what to focus on, add, change or remove. The AI already reads the request, the marked notes and files, and which questions are answered, and it never changes an answered question.';
export const ASKING_THE_AI = 'Asking the AI…';
export const JOB_PREPARING = 'The AI is preparing proposals';
export const JOB_LEAVE_CAPTION = 'You can leave this page. The proposals show here when you come back.';
export const JOB_CHECKS_STOPPED = 'Automatic checks stopped after 30 seconds. The AI may still be working.';
export const JOB_FAILED_TITLE = 'The AI request didn’t finish';
export const RETRY_PROPOSALS = 'Retry AI proposals';
export const NOTHING_NEW = 'The AI proposed nothing new for this questionnaire.';
export const STATUS_UNAVAILABLE = 'Status unavailable';

/** §2.3: who started a job, when it was not the viewer. */
export function jobStartedBy(job: Pick<QuestionnaireProposalJobView, 'initiatedBy' | 'initiatedByViewer'>): string | null {
  return job.initiatedByViewer || !job.initiatedBy ? null : `Started by ${job.initiatedBy.displayName}.`;
}

/** §2.3: what the live region says once a finished job's proposals are listed. */
export function proposalsReadyLine(count: number): string {
  return count === 1 ? '1 AI proposal is ready to review.' : `${formatCount(count)} AI proposals are ready to review.`;
}

/** §2.3: the questionnaire-wide job the panel follows: the latest queued, running or failed one, or null. */
export function panelJobOf(jobs: readonly QuestionnaireProposalJobView[]): QuestionnaireProposalJobView | null {
  return [...jobs].reverse().find((job) => job.operation === 'questionnaire-proposals' && job.status !== 'completed') ?? null;
}

/* §6: the rewrite control's words. */
export const REWRITE_LABEL = 'Rewrite in plain language';
export const REWRITE_HINT = 'Leave it empty for plain words, one thing per question and help text for specialist terms. The answer type and choices stay the same.';
export const REWRITE_SUBMIT = 'Rewrite question';
export const KEEP_AS_IS = 'Keep as is';
export const REWRITING = 'Rewriting…';
export const REWRITE_FAILED = 'The rewrite didn’t finish.';
export const NOTHING_TO_SIMPLIFY = 'The AI found nothing to simplify in this question.';

/** §4.7: the row's link to its first open proposal. */
export function openProposalLinkLabel(count: number): string {
  return count === 1 ? 'Open AI proposal' : `${formatCount(count)} open AI proposals`;
}

/**
 * What each question row needs from the proposals read (§4.7, §6), as plain data so it crosses from the server page to
 * the client review: whether a rewrite may start, each question's open proposals (count and the first card's anchor),
 * each question's rewrite job, and the rewrite runs that proposed nothing.
 */
export type QuestionRowAiFacts = {
  readonly rewriteAllowed: boolean;
  readonly open: Readonly<Record<string, { readonly count: number; readonly anchor: string }>>;
  readonly rewriteJobs: Readonly<Record<string, QuestionnaireProposalJobView>>;
  readonly noChangeRunIds: readonly string[];
};

export function questionRowAiFactsOf(view: QuestionnaireAiProposalsView): QuestionRowAiFacts {
  const open: Record<string, { count: number; anchor: string }> = {};
  for (const item of view.items) {
    const questionId = item.target?.questionId;
    if (item.state !== 'open' || !questionId) continue;
    const current = open[questionId];
    open[questionId] = current ? { ...current, count: current.count + 1 } : { count: 1, anchor: `ai-proposal-${item.runId}-${item.itemKey}` };
  }
  const rewriteJobs: Record<string, QuestionnaireProposalJobView> = {};
  for (const job of view.jobs) if (job.operation === 'question-rewrite' && job.questionId) rewriteJobs[job.questionId] = job;
  return {
    rewriteAllowed: view.actions.rewrite.allowed,
    open,
    rewriteJobs,
    noChangeRunIds: view.runs.filter((run) => run.operation === 'question-rewrite' && run.outcome === 'no-change').map((run) => run.runId),
  };
}

/* §8.4 and §9.1: the default task's start, from the signal and the hub. */
export const SUGGEST_FOLLOW_UP = 'Suggest follow-up questions';
