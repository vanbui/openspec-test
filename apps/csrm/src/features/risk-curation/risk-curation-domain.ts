/*
 * The zod-free half of Phase 16's risk curation and targeted AI re-runs (D-02, D-15, D-47, D-49): the views the
 * closed parsers in risk-curation-schema.ts produce, and the rules and copy the interface shows. Client components
 * import this module instead of the schema, so no browser route downloads zod for them (plan 08-13, D-24). It holds no
 * directive, so Server Actions and client components share it. Nothing here is authorisation: Strapi decides who may
 * act and what a decision does.
 */
import type { ConflictReason } from '../../lib/api/conflict-reasons';
import { controlLabel } from '../assessments/control-label';

/** A person a Phase 16 read names (ActiveUserSummary): a documentId and a display name, nothing else. */
export type RiskPerson = { readonly documentId: string; readonly displayName: string };

/** A withdrawal or reinstatement's outcome: the Risks it changed and the ones it left unchanged, in the request's order. */
export type RiskCurationResult = { readonly applied: readonly string[]; readonly unchanged: readonly string[] };

/* ---- Risk history (D-18 to D-21; 16-03's envelope v1) ---- */

export const RISK_HISTORY_KINDS = [
  'created',
  'updated',
  'withdrawn',
  'reinstated',
  'control-implementation-added',
  'control-implementation-updated',
  'control-implementation-removed',
] as const;
export type RiskHistoryKind = (typeof RISK_HISTORY_KINDS)[number];

/** A recorded value: text, a number, a flag, nothing, or a relation by its id and the label it had then. */
export type RiskHistoryValue = string | number | boolean | null | { readonly documentId: string; readonly label: string | null };
export type RiskHistoryFieldChange = { readonly field: string; readonly from: RiskHistoryValue; readonly to: RiskHistoryValue };
export type RiskHistoryControl = { readonly documentId: string; readonly controlNumber: string; readonly name: string };
export type RiskHistoryChanges = { readonly schemaVersion: 1; readonly fields: readonly RiskHistoryFieldChange[]; readonly control?: RiskHistoryControl };

/** One history event; `changes` is null when the stored envelope could not be read (the read never fails for it). */
export type RiskHistoryEvent = {
  readonly id: string;
  readonly kind: RiskHistoryKind;
  readonly occurredAt: string | null;
  readonly actor: RiskPerson | null;
  readonly sourceKind: 'analyst' | 'ai-run';
  readonly aiRunId: string | null;
  readonly proposalItem: string | null;
  readonly reason: string | null;
  readonly undo: boolean;
  readonly changes: RiskHistoryChanges | null;
};

export type RiskHistoryPagination = { readonly page: number; readonly pageSize: number; readonly pageCount: number; readonly total: number };

/** One page of a Risk's history, newest first; `recordedFrom` is the earliest event's time, null when there is none. */
export type RiskHistoryPage = {
  readonly events: readonly RiskHistoryEvent[];
  readonly pagination: RiskHistoryPagination;
  readonly recordedFrom: string | null;
};

/* ---- Risk AI proposals (D-24 to D-41) ---- */

export type RiskAiOperation = 'risk-suggestions' | 'risk-rewrite';
export const RISK_REWRITE_FOCUS = ['statement', 'ratings', 'treatment'] as const;
export type RiskRewriteFocus = (typeof RISK_REWRITE_FOCUS)[number];

export type RiskProposalJobFailureAttachment = { readonly documentId: string; readonly fileName: string | null };

/** One Suggest more risks or Rewrite this risk job (D-26): the job responses and the proposals read's `jobs`. */
export type RiskProposalJob = {
  readonly jobId: string;
  readonly operation: RiskAiOperation;
  readonly assessmentId: string;
  readonly riskId: string | null;
  readonly status: 'queued' | 'running' | 'completed' | 'failed';
  readonly attempt: number;
  readonly queuedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly runId: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly failureAttachments?: readonly RiskProposalJobFailureAttachment[];
  readonly initiatedBy: RiskPerson | null;
  readonly initiatedByViewer: boolean;
  readonly canRetry: boolean;
};

export type RiskAiAction = { readonly allowed: boolean; readonly reason: string | null };

export const RISK_AI_ADJUSTMENT_CODES = [
  'near-duplicate-active',
  'near-duplicate-withdrawn',
  'near-duplicate-rejected',
  'near-duplicate-proposed',
  'invalid-item',
  'over-limit',
  'accept-not-permitted',
  'accept-with-planned-control',
  'sources-dropped',
  'suggestions-dropped',
  'suggestions-capped',
  'outside-focus',
  'no-change',
] as const;
export type RiskAiAdjustmentCode = (typeof RISK_AI_ADJUSTMENT_CODES)[number];
export type RiskAiAdjustment = { readonly code: RiskAiAdjustmentCode; readonly count: number };

/** One completed risk proposal run's facts: who asked, when, with which provider and instruction, and what it kept. */
export type RiskAiRunFacts = {
  readonly runId: string;
  readonly operation: RiskAiOperation;
  readonly initiatedBy: RiskPerson | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly providerName: string | null;
  readonly providerVersion: string | null;
  readonly instruction: string | null;
  readonly focus: readonly RiskRewriteFocus[] | null;
  readonly riskId: string | null;
  readonly outcome: 'items' | 'no-change';
  readonly counts: { readonly items: number; readonly open: number };
  readonly adjustments: readonly RiskAiAdjustment[];
};

export type RiskAiSimilarity = {
  readonly kind: 'active' | 'withdrawn' | 'rejected' | 'open';
  readonly riskId: string | null;
  readonly riskNumber: string | null;
  readonly runId: string | null;
  readonly itemKey: string | null;
  readonly score: number;
};

export type RiskAiDecisionFacts = {
  readonly action: 'accepted' | 'rejected' | 'restored' | 'superseded' | 'lapsed';
  readonly by: RiskPerson | null;
  readonly at: string;
  readonly reason: string | null;
  readonly cause: {
    readonly kind: 'newer-rewrite' | 'risk-withdrawn' | 'assessment-not-editable';
    readonly runId: string | null;
    readonly riskId: string | null;
  } | null;
};

export type RiskAiSourceCitation = {
  readonly key: string;
  readonly kind: 'request' | 'answer' | 'system' | 'asset';
  readonly label: string;
  readonly section: string | null;
  readonly classification: string | null;
};

export type RiskAiItemState = 'open' | 'accepted' | 'rejected' | 'superseded' | 'lapsed';

/** One proposed risk (`kind: 'risk'`, `s-1` to `s-8`) or one proposed change to a Risk (`kind: 'change'`, a unit key). */
export type RiskAiProposalItem = {
  readonly runId: string;
  readonly itemKey: string;
  readonly kind: 'risk' | 'change';
  readonly state: RiskAiItemState;
  readonly stale: boolean | null;
  readonly riskId: string | null;
  readonly unitKey: string | null;
  readonly fields: readonly string[];
  readonly current: Readonly<Record<string, string | null>> | null;
  readonly proposed: Readonly<Record<string, string | null>>;
  readonly similarTo: RiskAiSimilarity | null;
  readonly aiAccept: boolean;
  readonly acceptBlocked: 'accept-not-permitted' | 'accept-with-planned-control' | null;
  readonly sources: readonly RiskAiSourceCitation[];
  readonly uncited: readonly string[];
  readonly suggestedControls: readonly { readonly controlNumber: string; readonly name: string; readonly rationale: string }[];
  readonly decision: RiskAiDecisionFacts | null;
  readonly addedRisk: { readonly riskId: string; readonly riskNumber: string | null } | null;
  readonly canUndo: boolean;
};

/** An assessment's AI proposals (D-41): open items first by run newest first, then the 50 most recently decided. */
export type RiskAiProposals = {
  readonly assessmentId: string;
  readonly editable: boolean;
  readonly openCount: number;
  readonly openByRisk: readonly { readonly riskId: string; readonly count: number }[];
  readonly lastAskedAt: string | null;
  readonly actions: { readonly suggest: RiskAiAction; readonly rewrite: RiskAiAction; readonly decide: RiskAiAction };
  readonly runs: readonly RiskAiRunFacts[];
  readonly items: readonly RiskAiProposalItem[];
  readonly jobs: readonly RiskProposalJob[];
};

/** One decision on a proposal as the analyst makes it: `accept` is shown as Confirm or Add to assessment, `restore` is Undo. */
export type RiskProposalDecision = {
  readonly runId: string;
  readonly item: string;
  readonly action: 'accept' | 'reject' | 'restore';
  readonly reason?: string;
};

export type RiskProposalDecisionResult = { readonly applied: number; readonly unchanged: number };

/** What the analyst did, so a refused Undo can say what it would have undone. */
export type RiskDecisionIntent = 'add' | 'confirm' | 'reject' | 'undo-confirmation' | 'undo-rejection';

/* ---- Refusals ---- */

/** What a refused Phase 16 act tells the analyst: `field` is fixed in the form, `blocked` by a change elsewhere, `retryable` by trying again. */
export type RiskCurationFailureKind = 'field' | 'blocked' | 'retryable';

export type RiskCurationFailure = {
  readonly kind: RiskCurationFailureKind;
  readonly status?: number;
  readonly reason?: ConflictReason;
  readonly message: string;
  /** A second line some states carry, such as the history's permission state (UI-SPEC §8.5). */
  readonly detail?: string;
  /** Which part of a start form a `field` refusal belongs to: the rewrite's parts or the instruction (FE4-11). */
  readonly field?: RiskStartField;
};

export type RiskStartField = 'focus' | 'instruction';

/** The longest reason a withdrawal, a reinstatement or a rejection keeps (D-09, D-40). */
export const CURATION_REASON_MAX_LENGTH = 500;

/** Which curation form the analyst submitted, as its copy names the act. */
export type CurationAct = 'withdraw' | 'reinstate';

/**
 * UI-SPEC §6.1 and §6.2: the reason field's error on submit, or null when the reason may be sent. The reason is read
 * trimmed, as it is kept, so a reason of spaces is no reason; the length, and the form's counter, count it trimmed.
 */
export function curationReasonError(act: CurationAct, reason: string): string | null {
  if (reason.trim().length === 0) return act === 'withdraw' ? 'Give a reason for withdrawing this risk.' : 'Give a reason for reinstating this risk.';
  if (reason.trim().length > CURATION_REASON_MAX_LENGTH) return reasonTooLong(reason.trim().length);
  return null;
}

/** §2.7 and §2.3 (Phase 10's job pattern): a failed proposals read and a failed job status check, in one place (FE4-11). */
export const PROPOSALS_LOAD_FAILED = 'We couldn’t load the AI proposals';
export const JOB_STATUS_UNAVAILABLE = 'Status unavailable';

/** §13 R2: asking the AI failed on the way (network, timeout, 5xx); the signal's Suggest more risks says it without family R. */
export const ASK_AI_RETRY_LINE = 'We couldn’t ask the AI. Try again.';

/** §13 R1: a withdrawal or reinstatement that failed on the way (network, timeout, 5xx), which trying again may fix. */
export function curationRetryLine(act: CurationAct): string {
  return `We couldn’t ${act} the risk. Try again.`;
}

/** UI-SPEC §6.1 and §5.3: the shared 500-character error, with the count when it is known. */
export function reasonTooLong(length?: number): string {
  return `Keep the reason to ${formatCount(CURATION_REASON_MAX_LENGTH)} characters or fewer.${length === undefined ? '' : ` It has ${formatCount(length)}.`}`;
}

/* ---- Shared formatting (Voice: written-out plurals, Australian English figures) ---- */

const formatCount = (count: number): string => count.toLocaleString('en-AU');
const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);
/** The person a record names, or the role when that person can no longer be read (15's decided proposals). */
const nameOf = (person: RiskPerson | null): string => person?.displayName ?? 'a Security Analyst';
/** Voice: a reason is quoted with typographic quotes. */
const reasonLine = (reason: string): string => `Reason: “${reason}”`;

/* ---- Risk card ids and links (FE3-12) ---- */

/** A Risk card's element id: `risk-{documentId}`, as it is looked up by `getElementById` and named by a decoded hash. */
export const riskCardId = (riskId: string, part = ''): string => `risk-${riskId}${part}`;
/** A link to a Risk card or to one of its parts (`-rewrite`): the id encoded, which the hash landing decodes. */
export const riskCardHref = (riskId: string, part = ''): string => `#${riskCardId(encodeURIComponent(riskId), part)}`;
/** The withdraw or reinstate form's id, which its card action names with `aria-controls` (Accessibility contract 4.1.2; UI-01). */
export const curationFormId = (act: CurationAct, riskId: string): string => riskCardId(riskId, `-${act}-form`);
/** The element holding a run's `Reject remaining` reason row, named by its button's `aria-controls` (UI-01). */
export const rejectRemainingId = (runId: string): string => `reject-remaining-${runId}`;

/* ---- The Show filter and the overall-rating hint (D-08, D-15; UI-SPEC §6.3, §9.2) ---- */

type Curated = { readonly withdrawal: unknown };

/** A Risk is withdrawn while it carries withdrawal facts; the served `withdrawal` is null on an active Risk. */
const isWithdrawn = (risk: Curated): boolean => risk.withdrawal !== null && risk.withdrawal !== undefined;

/** The `Show` control's two counts, each equal to its list (X-10). */
export function showCounts(risks: readonly Curated[]): { active: number; withdrawn: number } {
  const withdrawn = risks.filter(isWithdrawn).length;
  return { active: risks.length - withdrawn, withdrawn };
}

/** The `Active` and `Withdrawn` lists, each in the served order. */
export function partitionByWithdrawal<T extends Curated>(risks: readonly T[]): { active: T[]; withdrawn: T[] } {
  return { active: risks.filter((risk) => !isWithdrawn(risk)), withdrawn: risks.filter(isWithdrawn) };
}

export const RISK_RATINGS = ['Low', 'Moderate', 'High', 'Critical'] as const;
export type RiskRating = (typeof RISK_RATINGS)[number];
const isRating = (value: unknown): value is RiskRating => typeof value === 'string' && (RISK_RATINGS as readonly string[]).includes(value);

export type OverallRatingHint = { readonly highest: RiskRating; readonly line: string; readonly actionLabel: string };

/**
 * §9.2 (D-15): the hint under `Overall rating` while the assessment is editable and the highest residual rating of the
 * active Risks differs from the overall rating (or none is set). It reads active Risks only, so a withdrawn Critical
 * never raises it, and it never writes: `Use {rating}` only sets the field.
 */
export function overallRatingHint(input: {
  readonly editable: boolean;
  readonly overallRating: string | null;
  readonly risks: readonly (Curated & { readonly residualRating: string | null })[];
}): OverallRatingHint | null {
  if (!input.editable) return null;
  const ranks = input.risks.filter((risk) => !isWithdrawn(risk) && isRating(risk.residualRating)).map((risk) => RISK_RATINGS.indexOf(risk.residualRating as RiskRating));
  if (ranks.length === 0) return null;
  const highest = RISK_RATINGS[Math.max(...ranks)]!;
  if (input.overallRating === highest) return null;
  const overall = isRating(input.overallRating) ? ` The overall rating is ${input.overallRating}.` : '';
  return { highest, line: `The highest residual rating among the active risks is ${highest}.${overall}`, actionLabel: `Use ${highest}` };
}

/* ---- The word diff (UI-D21; UI-SPEC §4.3, §8.3) ---- */

/*
 * The bounded word diff lives beside X-24's comparison, which marks it (16-12), so the comparison's module carries no Risk
 * rules; it is re-exported here for the curation callers that read it with the other rules.
 */
export { WORD_DIFF_MAX_LENGTH, wordDiff, type WordDiffSegment } from '../ai-assistance/field-comparison-domain';

/* ---- Field and change labels (UI-SPEC §4.3; the editor's labels in risk-editor.tsx) ---- */

/** Every Risk field the editor shows, by its label there; the AI-writable fields are a subset. */
export const RISK_FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  riskType: 'Risk type',
  issueStatement: 'Issue statement',
  riskStatement: 'Risk statement',
  riskCategory: 'Risk category',
  riskSubCategory: 'Risk sub-category',
  riskCause: 'Risk cause',
  potentialImpact: 'Potential impact',
  riskOwner: 'Risk owner',
  informationSystemImpacted: 'Information system impacted',
  informationAssetImpacted: 'Information asset impacted',
  dataClassification: 'Data classification',
  inherentLikelihood: 'Inherent likelihood',
  highestInherentConsequence: 'Highest inherent consequence',
  inherentRating: 'Inherent rating',
  inherentRatingRationale: 'Inherent rating rationale',
  residualLikelihood: 'Residual likelihood',
  highestResidualConsequence: 'Highest residual consequence',
  residualRating: 'Residual rating',
  residualRatingRationale: 'Residual rating rationale',
  controlEffectiveness: 'Control effectiveness',
  riskVelocity: 'Risk velocity',
  identifiedDate: 'Identified date',
  targetDate: 'Target date',
  closureDate: 'Closure date',
  isExempted: 'Exempted',
  exemptionReviewDate: 'Exemption review date',
  escalationDetails: 'Escalation details',
  comments: 'Comments',
  riskCommunicationDate: 'Risk communication date',
  treatmentAction: 'Treatment action',
  treatmentPlan: 'Treatment plan',
  treatmentOwner: 'Treatment owner',
  treatmentResolveDate: 'Treatment resolve date',
  treatmentStatus: 'Treatment status',
});

/** A mitigation control's fields, by the control editor's labels, for the history's comparison. */
export const CONTROL_IMPLEMENTATION_FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  control: 'Control',
  controlOwner: 'Control owner',
  controlStatus: 'Control status',
  effectivenessRating: 'Effectiveness rating',
  evidence: 'Evidence',
  implementationDueDate: 'Implementation due date',
  implementedDate: 'Implemented date',
  reviewDate: 'Review date',
});

/**
 * The approved change units (16-02's RISK_UNIT_DEFINITIONS, the Phase 12 record's "Risk proposal envelope v1"): each
 * unit's fields in order. A unit of several fields is decided together and named by its own label (D-36).
 */
export const RISK_UNIT_FIELDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'u-risk-type': ['riskType'],
  'u-issue-statement': ['issueStatement'],
  'u-risk-statement': ['riskStatement'],
  'u-risk-category': ['riskCategory'],
  'u-risk-sub-category': ['riskSubCategory'],
  'u-risk-cause': ['riskCause'],
  'u-potential-impact': ['potentialImpact'],
  'u-information-system': ['informationSystemImpacted'],
  'u-information-asset': ['informationAssetImpacted', 'dataClassification'],
  'u-inherent-rating': ['inherentLikelihood', 'highestInherentConsequence', 'inherentRating'],
  'u-inherent-rating-rationale': ['inherentRatingRationale'],
  'u-residual-rating': ['residualLikelihood', 'highestResidualConsequence', 'residualRating'],
  'u-residual-rating-rationale': ['residualRatingRationale'],
  'u-treatment': ['treatmentAction', 'treatmentPlan'],
  'u-treatment-action': ['treatmentAction'],
  'u-treatment-plan': ['treatmentPlan'],
});

const UNIT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'u-information-asset': 'Information asset and data classification',
  'u-inherent-rating': 'Inherent rating',
  'u-residual-rating': 'Residual rating',
  'u-treatment': 'Treatment action and plan',
});

const own = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined => (Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined);

/** A field's label: the Risk editor's, else the control editor's, else the field's own name. */
export function fieldLabel(field: string): string {
  return own(RISK_FIELD_LABELS, field) ?? own(CONTROL_IMPLEMENTATION_FIELD_LABELS, field) ?? field;
}

/**
 * §4.3: the label a change is named by in its row, its actions' names and its toasts: a multi-field unit's own label,
 * else its one field's editor label. A unit a later server adds reads its first served field's label, else `AI change`
 * (Voice: an AI item is an "AI change").
 */
export function changeUnitLabel(unitKey: string, fields: readonly string[] = []): string {
  const label = own(UNIT_LABELS, unitKey);
  if (label) return label;
  const first = own(RISK_UNIT_FIELDS, unitKey)?.[0] ?? fields[0];
  return first === undefined ? 'AI change' : own(RISK_FIELD_LABELS, first) ?? 'AI change';
}

/* ---- Confirmable changes and the Accept pre-check (D-37, D-38; UI-D19; UI-SPEC §4.4) ---- */

/** §4.2 `Confirm all ({c})`: the open, current changes whose Accept is not refused; proposed risks are added one by one. */
export function confirmableCount(items: readonly RiskAiProposalItem[]): number {
  return items.filter((item) => item.kind === 'change' && item.state === 'open' && item.stale !== true && item.acceptBlocked === null).length;
}

export type AcceptPreCheckReason = Extract<ConflictReason, 'AI_ACCEPT_NOT_PERMITTED' | 'AI_ACCEPT_WITH_PLANNED_CONTROL'>;

/** §4.4's line for a proposed Accept that cannot be confirmed now. */
export const ACCEPT_NOT_ALLOWED_LINE = 'Accept can be confirmed only while the residual rating is Low or Moderate and the risk has no planned mitigation control. Reject it, or change the treatment yourself.';

/* Decision 8's scales, as the server's risk-scale.ts holds them, so a rating derives here as it does there. */
const LIKELIHOODS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'] as const;
const CONSEQUENCES = ['Insignificant', 'Minor', 'Moderate', 'Major', 'Severe'] as const;

function derivedRating(likelihood: unknown, consequence: unknown): RiskRating | null {
  const l = (LIKELIHOODS as readonly unknown[]).indexOf(likelihood);
  const c = (CONSEQUENCES as readonly unknown[]).indexOf(consequence);
  if (l < 0 || c < 0) return null;
  const score = (l + 1) * (c + 1);
  if (score <= 4) return 'Low';
  if (score <= 9) return 'Moderate';
  return score <= 16 ? 'High' : 'Critical';
}

/** The Risk's values the pre-check reads now: the form's or the served Risk's. */
export type AcceptCheckRisk = {
  readonly residualRating?: string | null;
  readonly residualLikelihood?: string | null;
  readonly highestResidualConsequence?: string | null;
  readonly treatmentPlan?: string | null;
  readonly treatmentAction?: string | null;
  /** The Risk's Accept was confirmed from an AI proposal: its provenance holds `treatmentAction` as `accepted`. */
  readonly aiAcceptConfirmed?: boolean;
};

const RESIDUAL_FIELDS: ReadonlySet<string> = new Set(['residualLikelihood', 'highestResidualConsequence', 'residualRating']);

/** Whether a Risk's Accept was confirmed from an AI proposal, as its provenance records it (FE4-07). */
export function aiAcceptConfirmed(provenance: { readonly fields: readonly { readonly field: string; readonly state: string }[] } | null | undefined): boolean {
  return provenance?.fields.some((fact) => fact.field === 'treatmentAction' && fact.state === 'accepted') ?? false;
}

/**
 * UI-D19: the interface's pre-check of the server's Accept rule (16-02's aiAcceptCheck, D-38, G-14), so `Confirm` is not
 * offered when it would be refused. The residual rating is the one the Risk would hold with the change applied (derived
 * from likelihood and consequence when both are set). An AI-proposed Accept needs a Low or Moderate residual rating, a
 * plan with text and no planned mitigation control. A residual change on a Risk whose Accept was confirmed from an AI
 * proposal must leave that rating Low or Moderate and the plan with text (16-RESEARCH Pitfall 11; FE4-07). Null when the
 * change may stand. Strapi stays authoritative and decides on submit.
 */
export function acceptPreCheck(input: {
  readonly item: RiskAiProposalItem;
  readonly riskNow: AcceptCheckRisk | null;
  readonly controlImplementations: readonly { readonly controlStatus?: string | null }[];
}): AcceptPreCheckReason | null {
  const { item, riskNow } = input;
  const residualChange = riskNow?.aiAcceptConfirmed === true && item.fields.some((field) => RESIDUAL_FIELDS.has(field));
  if (!item.aiAccept && !residualChange) return null;
  const values: Record<string, unknown> = { ...(riskNow ?? {}), ...item.proposed };
  if (!item.aiAccept && values.treatmentAction !== 'Accept') return null;
  const residual = derivedRating(values.residualLikelihood, values.highestResidualConsequence) ?? (isRating(values.residualRating) ? values.residualRating : null);
  if (residual === null || RISK_RATINGS.indexOf(residual) > RISK_RATINGS.indexOf('Moderate')) return 'AI_ACCEPT_NOT_PERMITTED';
  if (typeof values.treatmentPlan !== 'string' || values.treatmentPlan.trim().length === 0) return 'AI_ACCEPT_NOT_PERMITTED';
  if (item.aiAccept && input.controlImplementations.some((control) => control.controlStatus === 'Planned')) return 'AI_ACCEPT_WITH_PLANNED_CONTROL';
  return null;
}

/* ---- Left out, similar and decided (X-10, X-28; UI-SPEC §3.1, §3.3, §3.6, §4.2) ---- */

/*
 * §3.1's and §4.2's line for each adjustment that left a proposal or a change out. An Accept turned into Treat is not
 * left out (it shows on the item), and dropped sources and suggested controls concern a kept item, so they have no line.
 */
const LEFT_OUT_LINES: Readonly<Partial<Record<RiskAiAdjustmentCode, string>>> = {
  'near-duplicate-active': 'A risk too close to one already in this assessment.',
  'near-duplicate-withdrawn': 'A risk too close to one you withdrew.',
  'near-duplicate-rejected': 'A risk too close to one you rejected.',
  'near-duplicate-proposed': 'A risk already proposed.',
  'invalid-item': 'A proposal that was incomplete or too long.',
  'outside-focus': 'A change outside what you asked to rewrite.',
  'no-change': 'A change that left the value as it was.',
};
const NOT_LEFT_OUT: ReadonlySet<string> = new Set(['accept-not-permitted', 'accept-with-planned-control', 'sources-dropped', 'suggestions-dropped', 'suggestions-capped']);

const leftOut = (adjustments: readonly { readonly code: string; readonly count: number }[]) => adjustments.filter((adjustment) => !NOT_LEFT_OUT.has(adjustment.code));

/** The `{a} left out` figure: every proposal or change the lines account for. */
export function leftOutCount(adjustments: readonly { readonly code: string; readonly count: number }[]): number {
  return leftOut(adjustments).reduce((sum, adjustment) => sum + adjustment.count, 0);
}

/** The left-out list, one line per adjustment, with a `{count} ×` prefix when it aggregates more than one. */
export function leftOutLines(adjustments: readonly { readonly code: string; readonly count: number }[]): string[] {
  return leftOut(adjustments).map(({ code, count }) => {
    if (code === 'over-limit') return `${formatCount(count)} more ${plural(count, 'risk', 'risks')} beyond the limit of 8 per request.`;
    const line = own(LEFT_OUT_LINES as Readonly<Record<string, string>>, code) ?? 'A proposal CSRM couldn’t use.';
    return count > 1 ? `${formatCount(count)} × ${line}` : line;
  });
}

export type SimilarityNote = {
  readonly note: string;
  /** The compare toggle's name; null when there is nothing listed to compare with. */
  readonly compareLabel: string | null;
  /** The comparison's column headings, when it compares with a Risk. */
  readonly columns: readonly [string, string] | null;
  /** The reason `Reject as duplicate` records. */
  readonly duplicateReason: string;
};

/** §3.3: the similarity note on a proposed risk, its compare control and the reason `Reject as duplicate` records. */
export function similarityNote(similarTo: RiskAiSimilarity | null): SimilarityNote | null {
  if (!similarTo) return null;
  if ((similarTo.kind === 'active' || similarTo.kind === 'withdrawn') && similarTo.riskNumber) {
    const number = similarTo.riskNumber;
    const withdrawn = similarTo.kind === 'withdrawn';
    return {
      note: withdrawn ? `Similar to a withdrawn risk, ${number}` : `Similar to ${number}`,
      compareLabel: `Compare with ${number}`,
      columns: [withdrawn ? `${number} (withdrawn)` : number, 'Proposed'],
      duplicateReason: `Duplicate of ${number}`,
    };
  }
  if (similarTo.kind === 'rejected') {
    return { note: 'Similar to a rejected proposal', compareLabel: 'Compare with the rejected proposal', columns: null, duplicateReason: 'Duplicate of a rejected proposal' };
  }
  return { note: 'Similar to an open proposal', compareLabel: 'Compare with the open proposal', columns: null, duplicateReason: 'Duplicate of an open proposal' };
}

export type DecidedNoteIcon = 'Plus' | 'X' | 'Check' | 'Lock' | 'ListRestart' | 'Archive';

export type DecidedNote = {
  readonly label: string;
  readonly icon: DecidedNoteIcon;
  /** `Reason: “{reason}”` on a rejection that gave one. */
  readonly reasonLine: string | null;
  /** Who decided, for the ` · {name} · {instant}` suffix; null when nobody did (a replacement or a lock). */
  readonly byName: string | null;
  readonly at: string | null;
};

/** §3.6 and §4.4: a decided proposed risk's or change's note. `riskNumber` names the Risk a withdrawal closed. */
export function decidedNote(item: RiskAiProposalItem, context: { readonly riskNumber?: string | null } = {}): DecidedNote {
  const decision = item.decision;
  const at = decision?.at ?? null;
  const byName = decision?.by ? decision.by.displayName : null;
  const note = (label: string, icon: DecidedNoteIcon, by: string | null = byName, reason: string | null = null): DecidedNote => ({ label, icon, reasonLine: reason ? reasonLine(reason) : null, byName: by, at });
  if (item.state === 'lapsed' || decision?.cause?.kind === 'assessment-not-editable') return note('Closed without a decision: the assessment could no longer be changed.', 'Lock', null);
  if (item.state === 'superseded') {
    return decision?.cause?.kind === 'risk-withdrawn'
      ? note(`Closed when ${context.riskNumber || 'the risk'} was withdrawn`, 'Archive', null)
      : note('Replaced by a newer rewrite', 'ListRestart', null);
  }
  if (item.state === 'rejected') return note('Rejected', 'X', byName, decision?.reason ?? null);
  if (item.kind === 'risk') return note(item.addedRisk?.riskNumber ? `Added as ${item.addedRisk.riskNumber}` : 'Added to the assessment', 'Plus');
  return note('Confirmed', 'Check');
}

/** §3.6: a decided rewrite's summary, omitting the parts that are zero. */
export function rewriteDecidedSummary(counts: { readonly confirmed: number; readonly rejected: number; readonly closed: number }): string {
  return [
    counts.confirmed > 0 ? `${formatCount(counts.confirmed)} confirmed` : null,
    counts.rejected > 0 ? `${formatCount(counts.rejected)} rejected` : null,
    counts.closed > 0 ? `${formatCount(counts.closed)} closed` : null,
  ].filter((part): part is string => part !== null).join(' · ');
}

/* ---- The section's state and status lines (UI-SPEC §2.1, §2.4, §10.2) ---- */

/** Where the assessment stands for the AI proposals section; the policy refusal shows 12 §11.1's alert instead. */
export type ProposalsAssessmentState = 'editable' | 'released' | 'not-editable' | 'own-request';

/** §2.4's line (with a `Lock` icon), or null while the assessment is editable and the viewer may ask the AI. */
export function assessmentStateLine(state: ProposalsAssessmentState): string | null {
  switch (state) {
    case 'released': return 'This assessment has been released, so the AI can no longer propose changes and its risks can’t be withdrawn or reinstated.';
    case 'not-editable': return 'This assessment can’t be changed now, so the AI can’t be asked and proposals can’t be decided.';
    case 'own-request': return 'You raised this request, so another Security Analyst asks the AI about this assessment and decides its proposals. You can still edit, withdraw and reinstate its risks.';
    default: return null;
  }
}

/** §2.1's status line: the open proposed risks plus the open AI changes on Risks. */
export function proposalsStatusLine(openCount: number): string {
  return openCount === 0 ? 'No open AI proposals' : `${formatCount(openCount)} open ${plural(openCount, 'proposal', 'proposals')}`;
}

/** The latest completed Suggest more risks request: the AI inputs signal's baseline moves only with it (16-10, D-28). */
export function latestSuggestionsAskedAt(runs: readonly RiskAiRunFacts[]): string | null {
  return runs
    .filter((run) => run.operation === 'risk-suggestions' && run.completedAt !== null)
    .map((run) => run.completedAt as string)
    .reduce<string | null>((latest, at) => (latest === null || Date.parse(at) > Date.parse(latest) ? at : latest), null);
}

/**
 * §10.2 (UI-D26): the AI inputs signal's heading. Once a Suggest more risks request completed after the draft was
 * generated, the signal compares against that request, so the draft heading would be untrue.
 */
export function aiInputsChangedHeadingFor(input: { readonly askedAt: string | null; readonly generatedAt: string | null }): string {
  const asked = input.askedAt === null ? Number.NaN : Date.parse(input.askedAt);
  const generated = input.generatedAt === null ? Number.NEGATIVE_INFINITY : Date.parse(input.generatedAt);
  return Number.isFinite(asked) && asked > generated
    ? 'AI inputs changed since the AI was last asked about this assessment'
    : 'AI inputs changed since this draft was generated';
}

/* ---- Risk history entries (X-29; UI-SPEC §8.2 to §8.4) ---- */

export type HistoryEntryIcon = 'Plus' | 'Sparkles' | 'FilePenLine' | 'Undo2' | 'Archive' | 'ArchiveRestore' | 'CircleMinus' | 'History';

export type HistoryEntryPresentation = {
  readonly label: string;
  readonly icon: HistoryEntryIcon;
  /** Who made the change, for `{instant} by {name}`. */
  readonly actorName: string;
  /** The entry's lines in order: its source, its reason or control, or the unreadable line. */
  readonly lines: readonly string[];
  /** The fields to compare (`Before` and `After`), or the values a removed control held; null when there are none. */
  readonly comparison: readonly RiskHistoryFieldChange[] | null;
  readonly comparisonKind: 'compare' | 'values' | null;
  /** Whether the entry links to its proposed risk under AI proposals, while that is listed. */
  readonly showInProposals: boolean;
  readonly malformed: boolean;
};

const UNREADABLE = 'The details of this change couldn’t be read.';

type EntryBase = { label: string; icon: HistoryEntryIcon; lines: string[]; showInProposals?: boolean; compare: 'compare' | 'values' | null };

function entryBase(event: RiskHistoryEvent): EntryBase {
  const name = nameOf(event.actor);
  const reason = event.reason ? [reasonLine(event.reason)] : [];
  switch (event.kind) {
    case 'created':
      if (event.sourceKind !== 'ai-run') return { label: 'Risk added', icon: 'Plus', lines: [], compare: null };
      return event.proposalItem
        ? { label: 'Risk added from an AI proposal', icon: 'Sparkles', lines: [`Source: proposed risk, added by ${name}`], showInProposals: true, compare: null }
        : { label: 'Risk added by the AI draft', icon: 'Sparkles', lines: [`Source: AI draft requested by ${name}`], compare: null };
    case 'updated':
      if (event.undo) return { label: 'AI change undone', icon: 'Undo2', lines: [], compare: 'compare' };
      return event.sourceKind === 'ai-run'
        ? { label: 'Risk changed by a confirmed AI rewrite', icon: 'Sparkles', lines: ['Source: AI rewrite, confirmed'], compare: 'compare' }
        : { label: 'Risk changed', icon: 'FilePenLine', lines: [], compare: 'compare' };
    case 'withdrawn':
      return event.undo ? { label: 'Reinstatement undone', icon: 'Undo2', lines: reason, compare: null } : { label: 'Risk withdrawn', icon: 'Archive', lines: reason, compare: null };
    case 'reinstated':
      return event.undo ? { label: 'Withdrawal undone', icon: 'Undo2', lines: [], compare: null } : { label: 'Risk reinstated', icon: 'ArchiveRestore', lines: reason, compare: null };
    case 'control-implementation-added':
      return { label: 'Mitigation control added', icon: 'Plus', lines: [], compare: 'compare' };
    case 'control-implementation-updated':
      return { label: 'Mitigation control changed', icon: 'FilePenLine', lines: [], compare: 'compare' };
    case 'control-implementation-removed':
      return { label: 'Mitigation control taken off this risk', icon: 'CircleMinus', lines: [], compare: 'values' };
    default:
      /* A kind a later phase adds: named generically, with its comparison when it carries one. */
      return { label: 'Change recorded', icon: 'History', lines: [], compare: 'compare' };
  }
}

/**
 * §8.3: one history entry's label, icon, lines and comparison. A control change names the control by its §16.1 label as
 * recorded at the time. A malformed entry (its envelope unreadable, so `changes` is null) keeps its label, icon, source
 * and reason, and reads the unreadable line in place of its control and comparison.
 */
export function historyEntryPresentation(event: RiskHistoryEvent): HistoryEntryPresentation {
  const base = entryBase(event);
  const actorName = nameOf(event.actor);
  const showInProposals = base.showInProposals ?? false;
  if (event.changes === null) {
    return { label: base.label, icon: base.icon, actorName, lines: [...base.lines, UNREADABLE], comparison: null, comparisonKind: null, showInProposals, malformed: true };
  }
  const control = event.changes.control ? [`Control: ${controlLabel(event.changes.control)}`] : [];
  const fields = event.changes.fields;
  const comparison = base.compare !== null && fields.length > 0 ? fields : null;
  return {
    label: base.label,
    icon: base.icon,
    actorName,
    lines: [...base.lines, ...control],
    comparison,
    comparisonKind: comparison === null ? null : base.compare,
    showInProposals,
    malformed: false,
  };
}

/** §8.2: `{shown} of {total} {change|changes}`. */
export function historyCountLine(shown: number, total: number): string {
  return `${formatCount(shown)} of ${formatCount(total)} ${plural(total, 'change', 'changes')}`;
}

/** §8.4: the honest start, with the served `recordedFrom` already formatted as a date. */
export function honestStartLine(date: string): string {
  return `History recorded from ${date}. Earlier changes to this risk weren’t recorded.`;
}

/** §8.4: the honest start shows on the last page when the list holds no `Risk added` entry and the record has a start. */
export function showsHonestStart(input: { readonly events: readonly RiskHistoryEvent[]; readonly lastPage: boolean; readonly recordedFrom: string | null }): boolean {
  return input.lastPage && input.recordedFrom !== null && !input.events.some((event) => event.kind === 'created');
}

/* ---- Toasts (UI-SPEC §5.1, §6.1, §6.2, §7) ---- */

/** §6.1: a withdrawal's toast, offered with `Undo`. */
export function withdrawToast(riskNumber: string): string {
  return `${riskNumber} withdrawn.`;
}

/** §6.2: a reinstatement's toast, offered with `Undo`. */
export function reinstateToast(riskNumber: string): string {
  return `${riskNumber} reinstated.`;
}

/** FE3-04: the act found the Risk already where it would have put it, so the analyst's reason was not recorded. */
export function alreadyCuratedToast(act: CurationAct, riskNumber: string): string {
  return `${riskNumber} was already ${act === 'withdraw' ? 'withdrawn' : 'reinstated'}. Your reason wasn’t recorded.`;
}

export type UndoneToastInput =
  | { readonly undone: 'withdrawal' | 'reinstatement'; readonly riskNumber: string }
  | { readonly undone: 'confirmation'; readonly label: string }
  | { readonly undone: 'confirmations' | 'rejection' | 'rejections' };

/** §5.1, §6.1 and §6.2: what the toast says once an Undo succeeded. */
export function undoneToast(input: UndoneToastInput): string {
  switch (input.undone) {
    case 'withdrawal': return `Withdrawal undone. ${input.riskNumber} is back in the assessment.`;
    case 'reinstatement': return `Reinstatement undone. ${input.riskNumber} is withdrawn again.`;
    case 'confirmation': return `Confirmation undone. ${input.label} is back to its earlier value.`;
    case 'confirmations': return 'Confirmations undone.';
    case 'rejection': return 'Rejection undone. The proposal is open again.';
    default: return 'Rejections undone.';
  }
}

/** §7: discarding a new Risk's typed values, offered with `Undo`. */
export function discardToast(): string {
  return 'New risk discarded.';
}

/**
 * §7 (amended 2026-10-16): Phase 10's leave warning, in the new Risk's words, while the Add Risk form holds input. The
 * typed values live in client state only, so leaving the page loses them.
 */
export const newRiskLeaveCopy = {
  title: 'Leave with a new risk not added?',
  description: 'Your new risk hasn’t been added to this assessment. If you leave now, what you typed will be lost.',
  cancelLabel: 'Keep editing',
  confirmLabel: 'Leave page',
  pendingLabel: 'Leaving page…',
} as const;

export type DecisionAct = 'add' | 'confirm' | 'confirm-all' | 'reject' | 'reject-duplicate' | 'reject-remaining';

export type DecisionToastInput =
  | { readonly act: 'add'; readonly riskNumber: string }
  | { readonly act: 'confirm'; readonly label: string; readonly riskNumber: string }
  | { readonly act: 'confirm-all'; readonly count: number; readonly riskNumber: string }
  | { readonly act: 'reject'; readonly label?: string | null }
  | { readonly act: 'reject-duplicate'; readonly riskNumber?: string | null }
  | { readonly act: 'reject-remaining'; readonly count: number; readonly target: 'proposals' | 'changes' };

export type DecisionToast = { readonly message: string; readonly actionLabel?: string; readonly undoable: boolean };

/** §5.1: a decision's success toast; an added risk offers `Open {risk number}` and no Undo (D-33). */
export function decisionToast(input: DecisionToastInput): DecisionToast {
  switch (input.act) {
    case 'add': return { message: `${input.riskNumber} added to the assessment. Review its AI-proposed fields.`, actionLabel: `Open ${input.riskNumber}`, undoable: false };
    case 'confirm': return { message: `${input.label} confirmed on ${input.riskNumber}.`, undoable: true };
    case 'confirm-all': return { message: `${formatCount(input.count)} AI ${plural(input.count, 'change', 'changes')} confirmed on ${input.riskNumber}.`, undoable: true };
    case 'reject': return { message: input.label ? `${input.label} change rejected.` : 'Proposal rejected.', undoable: true };
    case 'reject-duplicate': return { message: input.riskNumber ? `Proposal rejected as a duplicate of ${input.riskNumber}.` : 'Proposal rejected.', undoable: true };
    default: {
      const noun = input.target === 'proposals' ? plural(input.count, 'proposal', 'proposals') : plural(input.count, 'change', 'changes');
      return { message: `${formatCount(input.count)} ${noun} rejected.`, undoable: true };
    }
  }
}

const FAILURE_TITLES: Readonly<Record<DecisionAct | 'undo', string>> = {
  add: 'Risk not added',
  confirm: 'Change not confirmed',
  'confirm-all': 'Changes not confirmed',
  reject: 'Proposal not rejected',
  'reject-duplicate': 'Proposal not rejected',
  'reject-remaining': 'Proposals not rejected',
  undo: 'Couldn’t undo',
};

/** §5.1: the danger toast's title when a decision or an Undo is refused; its body is R3's sentence. */
export function decisionFailureTitle(act: DecisionAct | 'undo'): string {
  return FAILURE_TITLES[act];
}
