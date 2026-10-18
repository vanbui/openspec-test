/*
 * Presentation rules for the request hub and assessment review.
 * Plain and zod-free, so client components can import it without pulling a parser into the bundle.
 */
import { aiPolicyRefusalCopy } from '../../lib/api/refusal-copy';
import type { AiFieldReview } from '../assessments/assessment-schema';
import type { AiRunContextRiskProposals } from './ai-assistance-schema';

export const AI_FIELD_LABELS = {
  riskType: 'Risk type', issueStatement: 'Issue statement', riskStatement: 'Risk statement', riskCategory: 'Risk category',
  riskSubCategory: 'Risk sub-category', riskCause: 'Risk cause', potentialImpact: 'Potential impact',
  informationSystemImpacted: 'Information system impacted', informationAssetImpacted: 'Information asset impacted',
  dataClassification: 'Data classification', inherentLikelihood: 'Inherent likelihood',
  highestInherentConsequence: 'Highest inherent consequence', inherentRating: 'Inherent rating',
  inherentRatingRationale: 'Inherent rating rationale', residualLikelihood: 'Residual likelihood',
  highestResidualConsequence: 'Highest residual consequence', residualRating: 'Residual rating',
  residualRatingRationale: 'Residual rating rationale', treatmentAction: 'Treatment action', treatmentPlan: 'Treatment plan',
  summary: 'Summary', overallRating: 'Overall rating', overallRiskRationale: 'Overall risk rationale',
  recommendationsSummary: 'Recommendations',
} as const;

export type AiReviewProvenance = { readonly fields: readonly AiFieldReview[] };
export type AiMarkerState = AiFieldReview['state'] | 'changed' | null;

export function fieldMarkerState(fact: AiFieldReview | undefined, formValue: unknown, loadedValue: unknown): AiMarkerState {
  if (!fact) return null;
  return (formValue ?? '') !== (loadedValue ?? '') ? 'changed' : fact.state;
}

/*
 * WR-302: a record's AI facts once Strapi has accepted a change to them, before the editor reads the record again. A
 * decision sets the state it decided; an accepted save sets `edited` on each AI field it changed, as Strapi does in the
 * same transaction (D-21). Applied at once, so a read that fails afterwards never offers Confirm again for a field
 * already reviewed. Unchanged facts come back as the same object.
 */
export function withFieldStates<T extends AiReviewProvenance & { readonly outstanding: number }>(provenance: T, names: Iterable<string>, state: AiFieldReview['state']): T {
  const changed = new Set(names);
  if (!provenance.fields.some((fact) => changed.has(fact.field) && fact.state !== state)) return provenance;
  const fields = provenance.fields.map((fact) => (changed.has(fact.field) ? { ...fact, state } : fact));
  return { ...provenance, fields, outstanding: fields.filter((fact) => fact.state === 'proposed').length };
}

/* 12-UI-SPEC §3.3 (WR-305): the Risk card badge's count, read after its label as `AI proposed: {n} {field|fields} to review`. */
export function fieldsToReviewLabel(count: number): string {
  return `${count} ${count === 1 ? 'field' : 'fields'} to review`;
}

export function reviewBarState(provenance: AiReviewProvenance, changedFields: ReadonlySet<string>) {
  const proposed = provenance.fields.filter((fact) => fact.state === 'proposed');
  const remaining = proposed.filter((fact) => !changedFields.has(fact.field));
  const changed = proposed.length - remaining.length;
  const uncited = remaining.filter((fact) => Array.isArray(fact.sources) && fact.sources.length === 0).length;
  return {
    fields: remaining.map((fact) => fact.field), count: remaining.length, changed, uncited, complete: proposed.length === 0,
    caption: changed ? `Confirm remaining skips the ${changed} ${changed === 1 ? 'field' : 'fields'} you’ve changed. Save to record your ${changed === 1 ? 'edit' : 'edits'}.` : null,
  };
}

export function prefillNote(field: string, proposed: boolean, value: unknown, assetName?: string | null): string | null {
  if (!proposed) return null;
  if (field === 'dataClassification' && assetName) return `Taken from ${assetName}.`;
  if (field === 'riskType' && !value) return 'The AI found no Risk Type that fits this Risk. Choose one, or confirm to leave it unset.';
  return null;
}

/*
 * 12-UI-SPEC §3.5 (D-11, G-14): why the Treatment action holds what it does, while it is proposed. One note, the first
 * that applies: the adapter's change of an Accept to Treat (beside suggested controls, on a High or Critical residual
 * rating, then without a reason, amended 2026-10-08), else the AI's own Accept.
 */
export function treatmentActionNote(proposed: boolean, action: string | null | undefined, rating: string | null | undefined, adjustments: readonly string[]): string | null {
  if (!proposed) return null;
  if (adjustments.includes('accept-with-suggested-controls')) return 'The AI proposed Accept and also suggested controls to plan, so Treat is proposed instead. Accept fits only a Risk with no planned control.';
  if (adjustments.includes('accept-not-permitted')) return 'The AI proposed Accept, which it may suggest only for a Low or Moderate residual rating, so Treat is proposed instead.';
  if (adjustments.includes('accept-without-rationale')) return 'The AI proposed Accept without giving a reason, so Treat is proposed instead. Accept needs its reason in the treatment plan.';
  if (action === 'Accept' && (rating === 'Low' || rating === 'Moderate')) return `Proposed because the residual rating is ${rating}. The treatment plan holds the AI’s reason.`;
  return null;
}

/* 12-UI-SPEC §6.1: Confirm names its field; Confirm remaining counts its fields, even when it confirms one (IN-304). */
export function confirmToastMessage(fields: readonly string[], place: string, action: 'one' | 'remaining' = 'one'): string {
  if (action === 'one' && fields.length === 1) return `${AI_FIELD_LABELS[fields[0] as keyof typeof AI_FIELD_LABELS] ?? fields[0]} confirmed ${place}.`;
  return `${fields.length} AI-proposed ${fields.length === 1 ? 'field' : 'fields'} confirmed ${place}.`;
}

export function undoToastMessage(count: number): string {
  return count === 1 ? 'Confirmation undone.' : 'Confirmations undone.';
}

/* Refusals whose sentence names the fix on the page itself: change the treatment action, or remove the control. */
const refusalsFixedOnThePage: ReadonlySet<string> = new Set(['AI_ACCEPT_WITH_PLANNED_CONTROL', 'AI_SUGGESTION_CONTROL_CHANGED']);

/**
 * 12-UI-SPEC §6.1 and §6.3: what a refused decision's danger toast offers. Try again for a retryable refusal, or for a
 * decision that never reached Strapi (`null`); Refresh page for a blocked one, which re-reads the editor in place so
 * no unsaved edit is lost (WR-303); nothing when the sentence already names the fix on the page.
 */
export function decisionRefusalRecovery(refusal: { kind: 'blocked' | 'retryable'; reason?: string } | null): 'try-again' | 'refresh' | null {
  if (!refusal || refusal.kind === 'retryable') return 'try-again';
  return refusal.reason !== undefined && refusalsFixedOnThePage.has(refusal.reason) ? null : 'refresh';
}

export type AiPolicyClassification = 'Public' | 'Internal' | 'Restricted' | 'Critical Infrastructure Sensitive';

/** The served `AiPolicyStatus`: what the next generation for this request would be allowed to send. */
export type AiPolicyStatus = {
  status: 'allowed' | 'refused';
  reason: 'AI_CLASSIFICATION_ABOVE_CEILING' | 'AI_POLICY_NOT_CONFIGURED' | null;
  requestClassification: AiPolicyClassification;
  classificationSource: 'assets' | 'default';
  ceiling: AiPolicyClassification | null;
};

export type AiPolicyRefusal = { title: string; description: string };

/**
 * The served `AiInputsChanged` (Phase 13 D-29, Phase 14 D-36): the notes whose AI-input mark changed, and the files whose
 * inclusion changed, since a record was last generated, by identity and change only, never their text. Either list may be
 * empty, never both. A type only, erased at build: this module ships to the risk editor.
 */
export type AiInputsChanged = {
  count: number;
  notes: { documentId: string; part: 'requestor' | 'security-analyst'; sequence: number; postedAt: string; change: 'marked' | 'unmarked' }[];
  files: { documentId: string; fileName: string; change: 'included' | 'excluded' | 'removed' }[];
};

/** §11.1: the caption under an allowed generation action, or null when the policy refuses. */
export function aiPolicyCaption(policy: AiPolicyStatus): string | null {
  if (policy.status !== 'allowed') return null;
  const caption = `This request’s information is classified ${policy.requestClassification}.`;
  return policy.classificationSource === 'default' ? `${caption} No information asset on it is classified, so Internal applies.` : caption;
}

/** §11.1: the alert shown in place of the generation action, or null when the policy allows it. */
export function aiPolicyRefusal(policy: AiPolicyStatus): AiPolicyRefusal | null {
  if (policy.status !== 'refused' || policy.reason === null) return null;
  const description = aiPolicyRefusalCopy(policy.reason, { requestClassification: policy.requestClassification, ceiling: policy.ceiling });
  return description ? { title: 'AI generation isn’t available for this request', description } : null;
}

/* §11.2: additions to Phase 10 §12.4. A Map, so a served code can never reach an inherited property. */
const aiJobFailures = new Map<string, string>([
  ['AI_CLASSIFICATION_ABOVE_CEILING', 'This request’s information is now classified above the limit the AI provider is approved for, so nothing was sent to the AI. Contact your administrator.'],
  ['AI_POLICY_NOT_CONFIGURED', 'The AI provider isn’t approved for any information classification yet, so nothing was sent to the AI. Contact your administrator.'],
  ['CONTEXT_TOO_LARGE', 'This request holds more information than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.'],
]);

/** The §11.2 sentence for a failed job's code, or null so the card keeps its Phase 10 copy. */
export function aiJobFailureCopy(code: string | null | undefined): string | null {
  return code ? aiJobFailures.get(code) ?? null : null;
}


/*
 * 16-UI-SPEC §10.3 (Phase 16 D-25): the `Assessment` group of a Suggest more risks or Rewrite this risk run, from the
 * summary's counts and closed values only (G-3). A rewrite's scope names its Risk by the number the page holds.
 */
export function sheetAssessmentRows(section: AiRunContextRiskProposals, options: { riskNumber?: string | null } = {}): { label: string; value: string }[] {
  const count = (value: number) => value.toLocaleString('en-AU');
  const rows = [
    { label: 'Scope', value: section.scope === 'assessment' ? 'Whole assessment' : options.riskNumber ? `One risk: ${options.riskNumber}` : 'One risk' },
    { label: 'Risks listed', value: count(section.risksListed) },
    { label: 'Withdrawn risks listed', value: count(section.withdrawnListed) },
    { label: 'Earlier proposals listed', value: `${count(section.rejectedListed)} rejected · ${count(section.openListed)} open` },
  ];
  if (section.scope === 'risk' && section.controlsListed !== null) rows.push({ label: 'Mitigation controls listed', value: count(section.controlsListed) });
  return rows;
}

/* D-16 (12-UI-SPEC §9.3): whether the Requestor's questionnaire offers a "Not sure" choice anywhere. */
export function offersNotSure(questions: readonly { choices?: readonly { value: string }[] | null }[]): boolean {
  return questions.some((question) => question.choices?.some((choice) => choice.value === 'not-sure') ?? false);
}

/* 12-UI-SPEC §8.2 (D-22): where a question in analyst review came from. */
export type QuestionOriginNote = 'Edited' | 'Added by analyst' | 'Confirmed AI proposal' | 'Edited AI proposal';
export type QuestionOriginMarker = { kind: 'badge' } | { kind: 'note'; label: QuestionOriginNote } | null;
export function questionOriginMarker(origin: 'generated' | 'generated-edited' | 'analyst-added' | 'proposal-confirmed' | 'proposal-edited' | null | undefined): QuestionOriginMarker {
  if (origin === 'generated') return { kind: 'badge' };
  if (origin === 'generated-edited') return { kind: 'note', label: 'Edited' };
  if (origin === 'analyst-added') return { kind: 'note', label: 'Added by analyst' };
  // Phase 15 UI-SPEC §9.2 (UI-D24): questions that came from a confirmed AI proposal.
  if (origin === 'proposal-confirmed') return { kind: 'note', label: 'Confirmed AI proposal' };
  if (origin === 'proposal-edited') return { kind: 'note', label: 'Edited AI proposal' };
  return null;
}

/** The lucide icon each origin note shows beside its label (12 §8.2; Phase 15 §9.2). */
export function questionOriginIcon(label: QuestionOriginNote): 'PenLine' | 'UserRoundPen' | 'Check' {
  if (label === 'Confirmed AI proposal') return 'Check';
  if (label === 'Added by analyst') return 'UserRoundPen';
  return 'PenLine';
}

/* 12-UI-SPEC §8.5 (D-35): releasing records that the analyst reviewed the AI-proposed questions. */
export function releaseDescriptionFor(generatedQuestions: number): string {
  const base = 'The Requestor can view this questionnaire after release.';
  if (generatedQuestions === 0) return base;
  return `${base} Releasing also records that you reviewed its ${generatedQuestions} AI-proposed ${generatedQuestions === 1 ? 'question' : 'questions'}.`;
}
