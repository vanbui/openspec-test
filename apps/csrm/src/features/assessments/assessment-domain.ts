import type { AssessmentRating, AssessmentStatus, ReleaseReadinessRequirement } from './assessment-schema';

export const assessmentLifecycleStepKeys = ['draft', 'in-review', 'approved', 'closed'] as const;
export type AssessmentLifecycleStepKey = (typeof assessmentLifecycleStepKeys)[number];
export type AssessmentLifecycleStepState = 'completed' | 'current' | 'future';
export type AssessmentLifecycleStep = {
  key: AssessmentLifecycleStepKey;
  label: string;
  state: AssessmentLifecycleStepState;
};
export type AssessmentLifecycle = {
  currentLabel: string;
  terminal: boolean;
  steps: readonly AssessmentLifecycleStep[];
};

/*
 * An assessment status badge, filter option or label reads the shared status mapping
 * (`statusPresentation.assessment` in components/csrm/status-badge.tsx), which labels
 * the stored value approved as Released.
 */
const assessmentLifecycleLabels: Record<AssessmentLifecycleStepKey, string> = {
  draft: 'Drafted',
  'in-review': 'In review',
  approved: 'Released',
  closed: 'Closed',
};

export function deriveAssessmentLifecycle(status: AssessmentStatus): AssessmentLifecycle {
  const currentIndex = assessmentLifecycleStepKeys.indexOf(status);

  return {
    currentLabel: assessmentLifecycleLabels[status],
    terminal: status === 'closed',
    steps: assessmentLifecycleStepKeys.map((key, index) => ({
      key,
      label: assessmentLifecycleLabels[key],
      state: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'future',
    })),
  };
}

export function assessmentRequestHref(actor: 'analyst' | 'requestor', documentId: string): string {
  const prefix = actor === 'analyst' ? '/app/review/requests' : '/app/requests';
  return `${prefix}/${encodeURIComponent(documentId)}`;
}

export function releaseReadinessPresentation(requirement: ReleaseReadinessRequirement): { href: string; label: string } {
  if (requirement.scope === 'risk') {
    return { href: `#${requirement.destination}`, label: `Risk ${requirement.riskNumber} — ${requirement.label}` };
  }
  return {
    href: requirement.destination ? `#${requirement.destination}` : (requirement.key === 'risks' ? '#identified-risks' : '#assessment-details'),
    label: requirement.label,
  };
}

export const assessmentRatingPresentation = {
  Low: { label: 'Low', order: 0 },
  Moderate: { label: 'Moderate', order: 1 },
  High: { label: 'High', order: 2 },
  Critical: { label: 'Critical', order: 3 },
} satisfies Record<AssessmentRating, { label: string; order: number }>;

/*
 * The stored assessment statuses, and the fields an analyst writes on a Risk and on a Control
 * Implementation in the order of their input schemas. They live here, free of zod, because the review
 * list and the editors that read them run in the browser, where nothing validates with zod (plan 08-13,
 * D-24). assessment-schema.ts builds on them and re-exports all three; assessment-service.test.ts
 * holds each writable-field list to its input schema's keys.
 */
export const assessmentStatuses = ['draft', 'in-review', 'approved', 'closed'] as const;

export const riskWritableFields = [
  'issueStatement',
  'riskStatement',
  'riskCategory',
  'riskSubCategory',
  'riskCause',
  'potentialImpact',
  'riskType',
  'riskOwner',
  'informationSystemImpacted',
  'informationAssetImpacted',
  'dataClassification',
  'inherentLikelihood',
  'highestInherentConsequence',
  'inherentRating',
  'inherentRatingRationale',
  'residualLikelihood',
  'highestResidualConsequence',
  'residualRating',
  'residualRatingRationale',
  'controlEffectiveness',
  'riskVelocity',
  'identifiedDate',
  'targetDate',
  'closureDate',
  'isExempted',
  'exemptionReviewDate',
  'escalationDetails',
  'comments',
  'riskCommunicationDate',
  'treatmentAction',
  'treatmentPlan',
  'treatmentOwner',
  'treatmentResolveDate',
  'treatmentStatus',
] as const;

export const controlImplementationWritableFields = [
  'control',
  'controlOwner',
  'controlStatus',
  'effectivenessRating',
  'evidence',
  'implementationDueDate',
  'implementedDate',
  'reviewDate',
] as const;
