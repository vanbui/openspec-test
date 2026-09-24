import { CheckCircle2Icon, CircleDashedIcon, CircleDotIcon, LockKeyholeIcon, type LucideIcon } from 'lucide-react';

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

export const assessmentStatusPresentation = {
  draft: { label: 'Draft', icon: CircleDashedIcon },
  'in-review': { label: 'In review', icon: CircleDotIcon },
  approved: { label: 'Approved', icon: CheckCircle2Icon },
  closed: { label: 'Closed', icon: LockKeyholeIcon },
} satisfies Record<AssessmentStatus, { label: string; icon: LucideIcon }>;

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
