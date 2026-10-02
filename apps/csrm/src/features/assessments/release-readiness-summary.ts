import type { ReleaseReadinessRequirement } from './assessment-schema';
import { releaseReadinessPresentation } from './assessment-domain';

/*
 * The release readiness summary (10-CONTEXT D-35, UI-SPEC §14.1). It regroups the requirements the server
 * serves so the analyst sees what stands between the assessment and release at a glance: the outstanding
 * assessment items, then one row per Risk with what is missing, and the met items only on demand.
 *
 * Display only: the server's readiness decides whether release is offered, and the server checks every
 * requirement again when the analyst releases. Nothing here can release an assessment. Zod-free, because
 * the editor route keeps zod out of the browser.
 */

export type ReleaseReadinessAssessmentItem = { key: string; label: string; href: string };
export type OutstandingRiskRow = { riskNumber: string; href: string; outstanding: number; missing: readonly string[] };
export type MetRiskRow = { riskNumber: string; href: string; met: number };

export type ReleaseReadinessSummary = {
  met: number;
  total: number;
  ready: boolean;
  outstandingAssessment: readonly ReleaseReadinessAssessmentItem[];
  outstandingRisks: readonly OutstandingRiskRow[];
  metAssessment: readonly ReleaseReadinessAssessmentItem[];
  metRisks: readonly MetRiskRow[];
};

type RiskGroup = { riskNumber: string; href: string; outstanding: string[]; met: number };

/** Groups the served requirements, keeping served order for assessment items and first-appearance order for Risks. */
export function summarizeReleaseReadiness(readiness: {
  ready: boolean;
  requirements: readonly ReleaseReadinessRequirement[];
}): ReleaseReadinessSummary {
  const outstandingAssessment: ReleaseReadinessAssessmentItem[] = [];
  const metAssessment: ReleaseReadinessAssessmentItem[] = [];
  const risks = new Map<string, RiskGroup>();
  let met = 0;

  for (const requirement of readiness.requirements) {
    if (requirement.state === 'met') met += 1;
    const { href } = releaseReadinessPresentation(requirement);
    if (requirement.scope === 'assessment') {
      const item = { key: requirement.key, label: requirement.label, href };
      (requirement.state === 'met' ? metAssessment : outstandingAssessment).push(item);
      continue;
    }
    let group = risks.get(requirement.riskNumber);
    if (!group) {
      group = { riskNumber: requirement.riskNumber, href, outstanding: [], met: 0 };
      risks.set(requirement.riskNumber, group);
    }
    if (requirement.state === 'met') group.met += 1;
    else group.outstanding.push(requirement.label);
  }

  const groups = [...risks.values()];
  return {
    met,
    total: readiness.requirements.length,
    ready: readiness.ready,
    outstandingAssessment,
    outstandingRisks: groups
      .filter((group) => group.outstanding.length > 0)
      .map((group) => ({ riskNumber: group.riskNumber, href: group.href, outstanding: group.outstanding.length, missing: group.outstanding })),
    metAssessment,
    metRisks: groups
      .filter((group) => group.met > 0)
      .map((group) => ({ riskNumber: group.riskNumber, href: group.href, met: group.met })),
  };
}

/** The most labels a caption names before it counts the rest. */
const namedLabelLimit = 4;

/** `Missing:` and the labels as an English list, naming up to four and counting the rest. */
export function missingCaption(labels: readonly string[]): string {
  if (labels.length === 0) return '';
  if (labels.length > namedLabelLimit) {
    return `Missing: ${labels.slice(0, namedLabelLimit).join(', ')} and ${labels.length - namedLabelLimit} more`;
  }
  if (labels.length === 1) return `Missing: ${labels[0]}`;
  return `Missing: ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
