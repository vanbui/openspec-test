import type {
  ActiveUser,
  AnalystAssessmentDetail,
  AnalystRisk,
  AssessmentRating,
  AssessmentRiskListItem,
  AssessmentStatus,
  ReleaseReadinessRequirement,
  RiskType,
} from './assessment-schema';
import type { RelationPickerGroup, RelationPickerItem } from '@/components/csrm/relation-picker';
import { controlPickerItem } from './control-label';

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

/**
 * The exemption review date as its date field shows it (D-32; UI-SPEC §13.3): the stored instant's UTC calendar
 * date, or empty. The frozen schema stores the field as a datetime, so a legacy value with a time of day still
 * reads as the date it falls on in UTC. A value that is not an instant reads as empty.
 */
export function exemptionReviewDateFormValue(stored: string | null | undefined): string {
  if (!stored) return '';
  const instant = new Date(stored);
  return Number.isNaN(instant.getTime()) ? '' : instant.toISOString().slice(0, 10);
}

/**
 * The exemption review date to save from its date field (D-32): the chosen calendar date at 00:00 UTC, or null
 * when the field is empty. The Server Action's schema still requires an ISO datetime with an offset.
 */
export function exemptionReviewDateFromForm(value: string | null | undefined): string | null {
  const date = value?.trim();
  return date ? `${date}T00:00:00.000Z` : null;
}

/**
 * Risk values ready to save: a submitted exemption review date becomes its 00:00 UTC instant (D-32). Values that
 * do not carry the field are returned unchanged, so an untouched date is never sent.
 */
export function withExemptionReviewInstant<T extends { exemptionReviewDate?: string | null }>(values: T): T {
  return 'exemptionReviewDate' in values
    ? { ...values, exemptionReviewDate: exemptionReviewDateFromForm(values.exemptionReviewDate) }
    : values;
}

/**
 * The controls the Control picker offers first for a Risk (D-31; UI-SPEC §13.1): those that apply to the Risk's
 * saved Risk Type, named by the control label. A Risk with no Risk Type, or one whose type lists no controls,
 * has no suggested group, so the picker asks the analyst to search.
 */
export function applicableControlGroup(
  riskTypes: readonly Pick<RiskType, 'documentId' | 'name' | 'applicableControls'>[],
  riskTypeId: string | null | undefined,
): RelationPickerGroup | undefined {
  const riskType = riskTypeId ? riskTypes.find((candidate) => candidate.documentId === riskTypeId) : undefined;
  if (!riskType || riskType.applicableControls.length === 0) return undefined;
  return { label: `Applicable to ${riskType.name}`, items: riskType.applicableControls.map(controlPickerItem) };
}

/**
 * The page size of the system and asset searches: the request selector's bounded page (`selectorPageSize` in
 * request-service.ts), so a full page tells the analyst to keep typing (UI-SPEC §13.1).
 */
export const inventoryPickerPageSize = 25;

/** The page size of the control search (searchControlsAction), in both editors' Control pickers (D-29). */
export const controlPickerPageSize = 10;

/** The wording for a chosen record whose name is not served (UI-SPEC §16.4); a picker never shows the id. */
export const relationNameNotAvailable = 'Name not available';

/**
 * The originating request's selected systems or assets, offered first in their picker (D-30; UI-SPEC §13.1).
 * A request with none has no suggested group, so the picker asks the analyst to search.
 */
export function requestRelationGroup(records: readonly NamedRecord[]): RelationPickerGroup | undefined {
  if (records.length === 0) return undefined;
  return { label: 'On this request', items: records.map(({ documentId, name }) => ({ documentId, name })) };
}

/**
 * A Risk's chosen system or asset as its picker shows it (D-30): named by the request's selection, then by a
 * served relation label, else `Name not available` for a record removed since. Never its id.
 */
export function selectedRelationItem(
  documentId: string | null | undefined,
  suggestions: readonly NamedRecord[],
  labels: Readonly<Record<string, string>>,
): RelationPickerItem | null {
  if (!documentId) return null;
  const suggested = suggestions.find((candidate) => candidate.documentId === documentId)?.name;
  const served = Object.hasOwn(labels, documentId) ? labels[documentId] : undefined;
  return { documentId, name: suggested || served || relationNameNotAvailable };
}

/** The served names of the systems and assets an assessment's Risks hold, keyed by id (D-30). */
export function relationLabelsFromRiskList(items: readonly Pick<AssessmentRiskListItem, 'informationSystemImpacted' | 'informationAssetImpacted'>[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const item of items) {
    for (const relation of [item.informationSystemImpacted, item.informationAssetImpacted]) {
      if (relation) labels[relation.documentId] = relation.name;
    }
  }
  return labels;
}
