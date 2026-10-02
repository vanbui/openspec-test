import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ReleaseReadinessRequirement } from './assessment-schema';
import { missingCaption, summarizeReleaseReadiness } from './release-readiness-summary';

/** The fourteen Risk-level requirements, in the order the server lists them for each Risk. */
const riskRequirementLabels = [
  ['riskStatement', 'Risk statement'],
  ['riskType', 'Risk type'],
  ['inherentLikelihood', 'Inherent likelihood'],
  ['highestInherentConsequence', 'Highest inherent consequence'],
  ['inherentRating', 'Inherent rating'],
  ['residualLikelihood', 'Residual likelihood'],
  ['highestResidualConsequence', 'Highest residual consequence'],
  ['residualRating', 'Residual rating'],
  ['riskOwner', 'Risk owner'],
  ['treatmentAction', 'Treatment action'],
  ['targetDate', 'Target date'],
  ['treatmentPlan', 'Treatment plan'],
  ['treatmentOwner', 'Treatment owner'],
  ['controlImplementations', 'At least one mitigation control'],
] as const;

function riskRequirements(riskNumber: string, destination: string, outstandingKeys: readonly string[]): ReleaseReadinessRequirement[] {
  return riskRequirementLabels.map(([key, label]) => ({
    scope: 'risk',
    key,
    label,
    riskNumber,
    destination,
    state: outstandingKeys.includes(key) ? 'outstanding' : 'met',
  }));
}

const allRiskKeys = riskRequirementLabels.map(([key]) => key);

/** Five assessment items, three before the Risks and two after, so served order is observable. */
const requirements: ReleaseReadinessRequirement[] = [
  { scope: 'assessment', key: 'summary', label: 'Summary', state: 'met' },
  { scope: 'assessment', key: 'overallRating', label: 'Overall rating', state: 'outstanding' },
  { scope: 'assessment', key: 'reviewedBy', label: 'Reviewer', state: 'outstanding' },
  ...riskRequirements('RSK-0001', 'risk-a', allRiskKeys),
  ...riskRequirements('RSK-0002', 'risk-b', []),
  ...riskRequirements('RSK-0003', 'risk-c', ['riskOwner', 'targetDate']),
  { scope: 'assessment', key: 'risks', label: 'At least one Risk', state: 'met' },
  { scope: 'assessment', key: 'recommendationsSummary', label: 'Recommendations', state: 'outstanding', destination: 'assessment-details' },
];

describe('summarizeReleaseReadiness (D-35, UI-SPEC §14.1)', () => {
  it('counts the served requirements and keeps the served ready flag', () => {
    const summary = summarizeReleaseReadiness({ ready: false, requirements });

    expect(summary.total).toBe(47);
    // 2 assessment items, 14 + 12 Risk items.
    expect(summary.met).toBe(28);
    expect(summary.ready).toBe(false);
    expect(summarizeReleaseReadiness({ ready: true, requirements: riskRequirements('RSK-0002', 'risk-b', []) }).ready).toBe(true);
  });

  it('lists the outstanding assessment items in served order with their destinations', () => {
    const summary = summarizeReleaseReadiness({ ready: false, requirements });

    expect(summary.outstandingAssessment).toEqual([
      { key: 'overallRating', label: 'Overall rating', href: '#assessment-details' },
      { key: 'reviewedBy', label: 'Reviewer', href: '#assessment-details' },
      { key: 'recommendationsSummary', label: 'Recommendations', href: '#assessment-details' },
    ]);
    expect(summary.metAssessment).toEqual([
      { key: 'summary', label: 'Summary', href: '#assessment-details' },
      { key: 'risks', label: 'At least one Risk', href: '#identified-risks' },
    ]);
  });

  it('gives one outstanding row per Risk that has outstanding items, in Risk order, with what is missing', () => {
    const summary = summarizeReleaseReadiness({ ready: false, requirements });

    expect(summary.outstandingRisks).toEqual([
      { riskNumber: 'RSK-0001', href: '#risk-a', outstanding: 14, missing: riskRequirementLabels.map(([, label]) => label) },
      { riskNumber: 'RSK-0003', href: '#risk-c', outstanding: 2, missing: ['Risk owner', 'Target date'] },
    ]);
  });

  it('gives one met row per Risk that has met items, in the same Risk order', () => {
    const summary = summarizeReleaseReadiness({ ready: false, requirements });

    expect(summary.metRisks).toEqual([
      { riskNumber: 'RSK-0002', href: '#risk-b', met: 14 },
      { riskNumber: 'RSK-0003', href: '#risk-c', met: 12 },
    ]);
  });

  it('orders Risks by where each first appears, even when its met items are served before another Risk', () => {
    const interleaved: ReleaseReadinessRequirement[] = [
      { scope: 'risk', key: 'riskOwner', label: 'Risk owner', state: 'met', riskNumber: 'RSK-0009', destination: 'risk-z' },
      { scope: 'risk', key: 'riskOwner', label: 'Risk owner', state: 'outstanding', riskNumber: 'RSK-0001', destination: 'risk-a' },
      { scope: 'risk', key: 'targetDate', label: 'Target date', state: 'outstanding', riskNumber: 'RSK-0009', destination: 'risk-z' },
    ];

    const summary = summarizeReleaseReadiness({ ready: false, requirements: interleaved });

    expect(summary.outstandingRisks.map((row) => row.riskNumber)).toEqual(['RSK-0009', 'RSK-0001']);
  });

  it('keeps a ten-Risk all-outstanding assessment to fifteen rows (UAT-011)', () => {
    const tenRisks = Array.from({ length: 10 }, (_, index) => riskRequirements(`RSK-${String(index + 1).padStart(4, '0')}`, `risk-${index}`, allRiskKeys)).flat();
    const fiveItems: ReleaseReadinessRequirement[] = ['summary', 'overallRating', 'overallControlEffectiveness', 'reviewedBy', 'risks']
      .map((key) => ({ scope: 'assessment', key, label: key, state: 'outstanding' }));

    const summary = summarizeReleaseReadiness({ ready: false, requirements: [...fiveItems, ...tenRisks] });

    expect(summary.total).toBe(145);
    expect(summary.outstandingAssessment.length + summary.outstandingRisks.length).toBe(15);
    expect(summary.metAssessment).toEqual([]);
    expect(summary.metRisks).toEqual([]);
  });
});

/* IN-205: Strapi only bounds a Risk number, so two Risks can share one; each keeps its own row and link. */
describe('Risks that share a number', () => {
  it('gives each Risk its own row, keyed by the Risk and not by its number', () => {
    const summary = summarizeReleaseReadiness({
      ready: false,
      requirements: [
        ...riskRequirements('RSK-0001', 'risk-first', ['riskStatement']),
        ...riskRequirements('RSK-0001', 'risk-second', ['riskType', 'riskOwner']),
      ],
    });

    expect(summary.outstandingRisks).toEqual([
      { riskNumber: 'RSK-0001', href: '#risk-first', outstanding: 1, missing: ['Risk statement'] },
      { riskNumber: 'RSK-0001', href: '#risk-second', outstanding: 2, missing: ['Risk type', 'Risk owner'] },
    ]);
    expect(summary.metRisks.map((row) => row.href)).toEqual(['#risk-first', '#risk-second']);
  });
});

describe('missingCaption (UI-SPEC §14.1)', () => {
  it('names one, two, three and four labels as an English list', () => {
    expect(missingCaption(['Risk owner'])).toBe('Missing: Risk owner');
    expect(missingCaption(['Risk owner', 'Target date'])).toBe('Missing: Risk owner and Target date');
    expect(missingCaption(['Risk owner', 'Target date', 'Treatment plan'])).toBe('Missing: Risk owner, Target date and Treatment plan');
    expect(missingCaption(['Risk owner', 'Target date', 'Treatment plan', 'Treatment owner']))
      .toBe('Missing: Risk owner, Target date, Treatment plan and Treatment owner');
  });

  it('names the first four and counts the rest when there are more than four', () => {
    expect(missingCaption(['A1', 'B2', 'C3', 'D4', 'E5', 'F6'])).toBe('Missing: A1, B2, C3, D4 and 2 more');
    expect(missingCaption(['A1', 'B2', 'C3', 'D4', 'E5'])).toBe('Missing: A1, B2, C3, D4 and 1 more');
  });

  it('is empty when nothing is missing', () => {
    expect(missingCaption([])).toBe('');
  });
});

describe('the release readiness summary module', () => {
  it('stays zod-free, so the editor route keeps zod out of the browser', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/assessments/release-readiness-summary.ts'), 'utf8');

    expect(source).not.toMatch(/from 'zod'/);
    expect(source).not.toMatch(/^import (?!type )[^;]*from '\.\/assessment-schema'/m);
  });
});
