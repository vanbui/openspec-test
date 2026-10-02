import type {
  ActiveUser,
  AnalystAssessmentDetail,
  AnalystRisk,
  AssessmentRating,
  AssessmentRiskListItem,
  AssessmentStatus,
  ReleaseReadinessRequirement,
} from './assessment-schema';

type ReleaseFacts = Pick<AnalystAssessmentDetail, 'assessmentStatus' | 'assessmentDate' | 'approvalDate' | 'approvedBy'>;

/**
 * Whether the analyst may still change an assessment: a draft or in-review assessment with no release fact.
 * The review page and the editor share it, so the page reads the released list items exactly when the editor
 * renders read-only. Presentation only: Strapi refuses every mutation of a released assessment itself.
 */
export function canMutateAssessment(assessment: ReleaseFacts): boolean {
  const hasAnyReleaseFact = assessment.assessmentDate !== null || assessment.approvalDate !== null || assessment.approvedBy !== null;
  return (assessment.assessmentStatus === 'draft' || assessment.assessmentStatus === 'in-review') && !hasAnyReleaseFact;
}

type NamedRecord = { readonly documentId: string; readonly name: string };

/**
 * The read-only Risk for the analyst's editor when the served list item is missing: the analyst detail's Risk,
 * with each relation named from the labels the page already loaded. A relation whose label is unknown reads as
 * not recorded, never as its id (D-34).
 */
export function assessmentRiskListItemFromAnalystRisk(
  risk: AnalystRisk,
  labels: { users: readonly ActiveUser[]; systems: readonly NamedRecord[]; assets: readonly NamedRecord[] },
): AssessmentRiskListItem {
  const person = (documentId: string | null) => {
    const user = documentId ? labels.users.find((candidate) => candidate.documentId === documentId) : undefined;
    return user ? { documentId: user.documentId, displayName: user.displayName } : null;
  };
  const record = (records: readonly NamedRecord[], documentId: string | null) => {
    const found = documentId ? records.find((candidate) => candidate.documentId === documentId) : undefined;
    return found ? { documentId: found.documentId, name: found.name } : null;
  };
  return {
    documentId: risk.documentId,
    riskNumber: risk.riskNumber,
    riskStatement: risk.riskStatement,
    informationSystemImpacted: record(labels.systems, risk.informationSystemImpacted),
    informationAssetImpacted: record(labels.assets, risk.informationAssetImpacted),
    inherentLikelihood: risk.inherentLikelihood,
    highestInherentConsequence: risk.highestInherentConsequence,
    inherentRating: risk.inherentRating,
    residualLikelihood: risk.residualLikelihood,
    highestResidualConsequence: risk.highestResidualConsequence,
    residualRating: risk.residualRating,
    treatmentAction: risk.treatmentAction,
    treatmentPlan: risk.treatmentPlan,
    treatmentStatus: risk.treatmentStatus,
    riskOwner: person(risk.riskOwner),
    treatmentOwner: person(risk.treatmentOwner),
    targetDate: risk.targetDate,
  };
}

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
