import type { ReleaseReadinessRequirement } from './assessment-schema';
import { releaseReadinessHref } from './assessment-domain';

/*
 * The release readiness summary (10-CONTEXT D-35, UI-SPEC §14.1). It regroups the requirements the server
 * serves so the analyst sees what stands between the assessment and release at a glance: the outstanding
 * assessment items, then one row per Risk with what is missing, and the met items only on demand.
 *
 * Display only: the server's readiness decides whether release is offered, and the server checks every
 * requirement again when the analyst releases. Nothing here can release an assessment. Zod-free, because
 * the editor route keeps zod out of the browser.
 */

/**
 * An assessment-scope item. `href` is null when the item is not a link (the requesting analyst's `Decisions on AI
 * proposals`, 16-UI-SPEC §9.1); `caption` is the line under it (`{n} open`, or the requesting analyst's sentence).
 */
export type ReleaseReadinessAssessmentItem = { key: string; label: string; href: string | null; caption?: string };
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

/** Phase 16 D-42 (16-UI-SPEC §9.1): the served requirement that every risk AI proposal has a human decision. */
export const AI_PROPOSALS_DECIDED_KEY = 'aiProposalsDecided';

/** §9.1 (15 §8.1's wording): the requesting analyst's caption, with no link and no count. */
export const REQUESTING_ANALYST_DECISIONS_CAPTION = 'This assessment has open AI proposals. Another Security Analyst decides them before release.';

/** What the page knows of the AI proposals beside the served readiness (16-UI-SPEC §9.1). */
export type ReleaseReadinessProposals = {
  /** The open proposals the proposals read counts; null when the read is unavailable or not served to this viewer. */
  openCount?: number | null;
  /** The viewer raised the originating request (OWN_REQUEST): the item has no link and no count. */
  viewerRaisedRequest?: boolean;
};

/*
 * §9.1: while outstanding, `Decisions on AI proposals` links to the section with `{n} open` under it; for the analyst who
 * raised the request it is plain text with their sentence. Met, it is listed as any met item. Only the presentation
 * changes: the served state decides whether it is met, and Strapi refuses a release with open proposals.
 */
function presentAiDecisions(item: ReleaseReadinessAssessmentItem, outstanding: boolean, proposals: ReleaseReadinessProposals): ReleaseReadinessAssessmentItem {
  if (item.key !== AI_PROPOSALS_DECIDED_KEY || !outstanding) return item;
  if (proposals.viewerRaisedRequest) return { ...item, href: null, caption: REQUESTING_ANALYST_DECISIONS_CAPTION };
  const count = proposals.openCount;
  return typeof count === 'number' && count > 0 ? { ...item, caption: `${count.toLocaleString('en-AU')} open` } : item;
}

/** Groups the served requirements, keeping served order for assessment items and first-appearance order for Risks. */
export function summarizeReleaseReadiness(readiness: {
  ready: boolean;
  requirements: readonly ReleaseReadinessRequirement[];
}, proposals: ReleaseReadinessProposals = {}): ReleaseReadinessSummary {
  const outstandingAssessment: ReleaseReadinessAssessmentItem[] = [];
  const metAssessment: ReleaseReadinessAssessmentItem[] = [];
  const risks = new Map<string, RiskGroup>();
  let met = 0;

  for (const requirement of readiness.requirements) {
    if (requirement.state === 'met') met += 1;
    const href = releaseReadinessHref(requirement);
    if (requirement.scope === 'assessment') {
      const outstanding = requirement.state !== 'met';
      const item = presentAiDecisions({ key: requirement.key, label: requirement.label, href }, outstanding, proposals);
      (outstanding ? outstandingAssessment : metAssessment).push(item);
      continue;
    }
    // Keyed by the Risk's destination, unique per Risk: Strapi only bounds a Risk number, so two may share one (IN-205).
    let group = risks.get(requirement.destination);
    if (!group) {
      group = { riskNumber: requirement.riskNumber, href, outstanding: [], met: 0 };
      risks.set(requirement.destination, group);
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
