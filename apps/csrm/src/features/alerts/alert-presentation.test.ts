import { describe, expect, it } from 'vitest';

import {
  alertConditionSentence,
  alertDateLabel,
  alertKindLabels,
  alertReleasedNote,
  alertResidualDisplay,
  alertsClearedDescription,
  alertSourceHref,
  alertSourceSecondaryText,
  alertUrgencyLabels,
  formatAlertDate,
} from './alert-presentation';
import { alertKinds, type AlertItem, type AlertKind, type AlertUrgency } from './alert-schema';

type AlertOverrides = Partial<Omit<AlertItem, 'source' | 'link'>> & {
  source?: Partial<AlertItem['source']>;
  link?: Partial<AlertItem['link']>;
};

function alertOf(overrides: AlertOverrides = {}): AlertItem {
  const { source, link, ...rest } = overrides;
  return {
    id: 'risk-treatment-overdue:risk-1',
    kind: 'risk-treatment-overdue',
    urgency: 'overdue',
    governingDate: '2026-09-12',
    dayOffset: -12,
    residualRating: 'High',
    ...rest,
    source: {
      type: 'risk',
      documentId: 'risk-1',
      identifier: 'RSK-2026-001',
      title: 'Customer identity data may be disclosed.',
      released: false,
      ...source,
    },
    link: { type: 'risk', documentId: 'risk-1', ...link },
  };
}

/*
 * The UI-SPEC §3.2 sentences, with {n} the whole-day distance the server sends. Every kind is
 * covered at zero, one and many days where the kind is dated, so a missing singular form shows up.
 */
const sentenceCases: readonly (readonly [AlertKind, AlertUrgency, number | null, string])[] = [
  ['risk-treatment-overdue', 'overdue', -12, 'Treatment overdue by 12 days'],
  ['risk-treatment-overdue', 'overdue', -1, 'Treatment overdue by 1 day'],
  ['risk-treatment-due-soon', 'due-soon', 0, 'Treatment due today'],
  ['risk-treatment-due-soon', 'due-soon', 1, 'Treatment due in 1 day'],
  ['risk-treatment-due-soon', 'due-soon', 5, 'Treatment due in 5 days'],
  ['request-overdue', 'overdue', -10, 'Request overdue by 10 days'],
  ['request-overdue', 'overdue', -1, 'Request overdue by 1 day'],
  ['request-due-soon', 'due-soon', 0, 'Request due today'],
  ['request-due-soon', 'due-soon', 1, 'Request due in 1 day'],
  ['request-due-soon', 'due-soon', 14, 'Request due in 14 days'],
  ['control-implementation-overdue', 'overdue', -10, 'Control Implementation overdue by 10 days'],
  ['control-implementation-overdue', 'overdue', -1, 'Control Implementation overdue by 1 day'],
  ['assessment-review-due', 'overdue', -3, 'Review overdue by 3 days'],
  ['assessment-review-due', 'overdue', -1, 'Review overdue by 1 day'],
  ['assessment-review-due', 'due-soon', 0, 'Review due today'],
  ['assessment-review-due', 'due-soon', 1, 'Review due in 1 day'],
  ['assessment-review-due', 'due-soon', 9, 'Review due in 9 days'],
  ['critical-residual-risk-untreated', 'attention', -20, 'Critical residual Risk with treatment not started'],
  ['critical-residual-risk-untreated', 'attention', null, 'Critical residual Risk with treatment not started'],
  ['ineffective-control', 'attention', -15, 'Control Implementation rated Ineffective'],
  ['ineffective-control', 'attention', null, 'Control Implementation rated Ineffective'],
];

describe('alertConditionSentence', () => {
  it.each(sentenceCases)('words %s (%s) at day offset %s as "%s"', (kind, urgency, dayOffset, expected) => {
    expect(alertConditionSentence(alertOf({ kind, urgency, dayOffset }))).toBe(expected);
  });

  it('covers every alert kind', () => {
    expect(new Set(sentenceCases.map(([kind]) => kind))).toEqual(new Set(alertKinds));
  });

  it('never writes "1 days" or a negative number of days', () => {
    for (const kind of alertKinds) {
      for (const urgency of ['overdue', 'due-soon', 'attention'] as const) {
        for (const dayOffset of [-1, 1]) {
          const sentence = alertConditionSentence(alertOf({ kind, urgency, dayOffset }));
          expect(sentence, `${kind} ${urgency} ${dayOffset}`).not.toMatch(/\b1 days\b/);
          expect(sentence, `${kind} ${urgency} ${dayOffset}`).not.toMatch(/-\d/);
        }
      }
    }
  });

  it('says only what it knows when a dated kind arrives without a day offset', () => {
    expect(alertConditionSentence(alertOf({ kind: 'risk-treatment-overdue', urgency: 'overdue', dayOffset: null }))).toBe('Treatment overdue');
    expect(alertConditionSentence(alertOf({ kind: 'request-due-soon', urgency: 'due-soon', dayOffset: null }))).toBe('Request due soon');
    expect(alertConditionSentence(alertOf({ kind: 'assessment-review-due', urgency: 'due-soon', dayOffset: null }))).toBe('Risk Assessment review due');
  });
});

describe('alert vocabulary labels', () => {
  it('labels every alert type for the filter and its chip, in the §3.2 order', () => {
    expect(Object.keys(alertKindLabels)).toEqual([...alertKinds]);
    expect(Object.values(alertKindLabels)).toEqual([
      'Treatment overdue',
      'Treatment due soon',
      'Request overdue',
      'Request due soon',
      'Control Implementation overdue',
      'Risk Assessment review due',
      'Critical Risk not treated',
      'Ineffective Control Implementation',
    ]);
  });

  it('labels every urgency', () => {
    expect(alertUrgencyLabels).toEqual({ overdue: 'Overdue', 'due-soon': 'Due soon', attention: 'Needs attention' });
  });
});

describe('alert dates', () => {
  it.each([
    ['risk-treatment-overdue', 'Target date'],
    ['risk-treatment-due-soon', 'Target date'],
    ['request-overdue', 'Due date'],
    ['request-due-soon', 'Due date'],
    ['control-implementation-overdue', 'Implementation due'],
    ['assessment-review-due', 'Next review'],
    ['critical-residual-risk-untreated', 'Identified'],
    ['ineffective-control', 'Last reviewed'],
  ] as const)('labels the governing date of %s "%s"', (kind, label) => {
    expect(alertDateLabel(kind)).toBe(label);
  });

  it('formats a governing date in en-AU at UTC, and says when there is none', () => {
    expect(formatAlertDate('2026-10-30')).toBe('30 Oct 2026');
    expect(formatAlertDate('2026-09-04')).toBe('4 Sept 2026');
    expect(formatAlertDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatAlertDate(null)).toBe('No date recorded');
  });
});

describe('alert source presentation', () => {
  const riskAlert = alertOf({ source: { type: 'risk', documentId: 'risk/1 ?' }, link: { type: 'risk', documentId: 'risk/1 ?' } });
  const controlAlert = alertOf({
    id: 'control-implementation-overdue:implementation-1',
    kind: 'control-implementation-overdue',
    source: { type: 'control-implementation', documentId: 'implementation-1', identifier: 'RSK-2026-001', title: 'E8-PATCH_OPERATING_SYSTEMS-001 Patch operating systems' },
    link: { type: 'risk', documentId: 'risk parent/1' },
  });
  const requestAlert = alertOf({
    id: 'request-overdue:request-7',
    kind: 'request-overdue',
    residualRating: null,
    source: { type: 'assessment-request', documentId: 'request-7', identifier: 'RAR-2026-007', title: 'Phase 7 overdue review request' },
    link: { type: 'assessment-request', documentId: 'request-7' },
  });
  const assessmentAlert = alertOf({
    id: 'assessment-review-due:assessment-2',
    kind: 'assessment-review-due',
    residualRating: null,
    source: { type: 'assessment', documentId: 'assessment 2', identifier: 'ASM-2026-002', title: null, released: true },
    link: { type: 'assessment', documentId: 'assessment 2' },
  });

  it('links every source to its Security Analyst route, escaping the document id', () => {
    expect(alertSourceHref(riskAlert)).toBe('/app/risks/risk%2F1%20%3F');
    expect(alertSourceHref(controlAlert)).toBe('/app/risks/risk%20parent%2F1#mitigation-controls');
    expect(alertSourceHref(requestAlert)).toBe('/app/review/requests/request-7');
    expect(alertSourceHref(assessmentAlert)).toBe('/app/review/assessments/assessment%202');
    for (const alert of [riskAlert, controlAlert, requestAlert, assessmentAlert]) {
      // Never a Requestor route: alerts are an analyst surface.
      expect(alertSourceHref(alert)).not.toMatch(/^\/app\/(requests|assessments|questionnaires)\//);
    }
  });

  it('names the record type beside its title, or alone when there is no title', () => {
    expect(alertSourceSecondaryText(riskAlert)).toBe('Risk · Customer identity data may be disclosed.');
    expect(alertSourceSecondaryText(controlAlert)).toBe('Control Implementation · E8-PATCH_OPERATING_SYSTEMS-001 Patch operating systems');
    expect(alertSourceSecondaryText(requestAlert)).toBe('Assessment Request · Phase 7 overdue review request');
    expect(alertSourceSecondaryText(assessmentAlert)).toBe('Risk Assessment');
    expect(alertSourceSecondaryText(alertOf({ source: { title: null } }))).toBe('Risk');
    expect(alertSourceSecondaryText(alertOf({ source: { type: 'assessment', title: 'Customer portal review' } }))).toBe('Risk Assessment · Customer portal review');
  });

  it('shows the Risk residual rating beside urgency, never merged into it', () => {
    expect(alertResidualDisplay(riskAlert)).toEqual({ kind: 'rating', rating: 'High' });
    expect(alertResidualDisplay(alertOf({ residualRating: null }))).toEqual({ kind: 'not-rated', text: 'Not rated' });
    expect(alertResidualDisplay({ ...controlAlert, residualRating: 'Critical' })).toEqual({ kind: 'rating', rating: 'Critical' });
    expect(alertResidualDisplay({ ...controlAlert, residualRating: null })).toEqual({ kind: 'not-rated', text: 'Not rated' });
    expect(alertResidualDisplay(requestAlert)).toEqual({ kind: 'not-applicable', text: 'Not applicable' });
    expect(alertResidualDisplay(assessmentAlert)).toEqual({ kind: 'not-applicable', text: 'Not applicable' });
  });

  it('marks released work read-only and nothing else', () => {
    expect(alertReleasedNote(assessmentAlert)).toBe('Released · read-only');
    expect(alertReleasedNote(alertOf({ source: { released: true } }))).toBe('Released · read-only');
    expect(alertReleasedNote(riskAlert)).toBeNull();
  });
});

describe('alertsClearedDescription', () => {
  it('states the due-soon window the server sent', () => {
    expect(alertsClearedDescription(14)).toBe('Nothing is overdue, due within 14 days, or flagged for attention.');
    expect(alertsClearedDescription(21)).toBe('Nothing is overdue, due within 21 days, or flagged for attention.');
    expect(alertsClearedDescription(1)).toBe('Nothing is overdue, due within 1 day, or flagged for attention.');
  });
});
