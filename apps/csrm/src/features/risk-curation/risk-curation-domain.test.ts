import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  acceptPreCheck,
  aiInputsChangedHeadingFor,
  assessmentStateLine,
  changeUnitLabel,
  confirmableCount,
  decidedNote,
  decisionFailureTitle,
  decisionToast,
  discardToast,
  historyCountLine,
  historyEntryPresentation,
  honestStartLine,
  latestSuggestionsAskedAt,
  leftOutCount,
  leftOutLines,
  overallRatingHint,
  partitionByWithdrawal,
  proposalsStatusLine,
  reinstateToast,
  RISK_FIELD_LABELS,
  rewriteDecidedSummary,
  showCounts,
  showsHonestStart,
  similarityNote,
  undoneToast,
  withdrawToast,
  wordDiff,
  type RiskAiProposalItem,
  type RiskHistoryEvent,
} from './risk-curation-domain';
import { historyPageFixture, proposalsFixture } from './test-fixtures';

const withdrawal = { at: '2026-10-14T03:00:00.000Z', by: null, reason: 'Duplicate' };
const risk = (residualRating: string | null, withdrawn = false) => ({ residualRating, withdrawal: withdrawn ? withdrawal : null });

describe('the Show counts (D-08; UI-SPEC §6.3)', () => {
  it('counts and partitions active and withdrawn risks', () => {
    const risks = [risk('Low'), risk('High', true), risk(null)];
    expect(showCounts(risks)).toEqual({ active: 2, withdrawn: 1 });
    const { active, withdrawn } = partitionByWithdrawal(risks);
    expect(active).toEqual([risks[0], risks[2]]);
    expect(withdrawn).toEqual([risks[1]]);
    expect(showCounts([])).toEqual({ active: 0, withdrawn: 0 });
  });
});

describe('overallRatingHint (D-15; UI-SPEC §9.2)', () => {
  it('names the highest active residual and the overall rating when they differ', () => {
    expect(overallRatingHint({ editable: true, overallRating: 'Moderate', risks: [risk('Low'), risk('High')] })).toEqual({
      highest: 'High',
      line: 'The highest residual rating among the active risks is High. The overall rating is Moderate.',
      actionLabel: 'Use High',
    });
  });

  it('omits the overall rating’s sentence when none is set', () => {
    expect(overallRatingHint({ editable: true, overallRating: null, risks: [risk('Moderate')] })).toEqual({
      highest: 'Moderate',
      line: 'The highest residual rating among the active risks is Moderate.',
      actionLabel: 'Use Moderate',
    });
  });

  it('shows nothing when they match, when no active risk is rated, or when not editable', () => {
    expect(overallRatingHint({ editable: true, overallRating: 'High', risks: [risk('High'), risk('Low')] })).toBeNull();
    expect(overallRatingHint({ editable: true, overallRating: 'Low', risks: [risk(null), risk('Critical', true)] })).toBeNull();
    expect(overallRatingHint({ editable: false, overallRating: 'Low', risks: [risk('High')] })).toBeNull();
  });

  it('is not raised by a withdrawn Critical risk', () => {
    expect(overallRatingHint({ editable: true, overallRating: 'Moderate', risks: [risk('Moderate'), risk('Critical', true)] })).toBeNull();
    expect(overallRatingHint({ editable: true, overallRating: 'Low', risks: [risk('Moderate'), risk('Critical', true)] })?.highest).toBe('Moderate');
  });
});

describe('wordDiff (UI-D21; UI-SPEC §4.3)', () => {
  it('marks the inserted words and keeps the rest the same', () => {
    const segments = wordDiff('unsigned files reconciled', 'unsigned payment files reconciled by hand');
    expect(segments).not.toBeNull();
    expect(segments!.filter((segment) => segment.kind === 'ins').map((segment) => segment.text.trim())).toEqual(['payment', 'by hand']);
    expect(segments!.filter((segment) => segment.kind === 'del')).toEqual([]);
    expect(segments!.filter((segment) => segment.kind !== 'ins').map((segment) => segment.text).join('')).toBe('unsigned files reconciled');
    expect(segments!.filter((segment) => segment.kind !== 'del').map((segment) => segment.text).join('')).toBe('unsigned payment files reconciled by hand');
  });

  it('marks a replaced word as deleted then inserted, and reads a missing value as empty', () => {
    expect(wordDiff('Files are reconciled weekly', 'Files are reconciled daily')).toEqual([
      { kind: 'same', text: 'Files are reconciled ' },
      { kind: 'del', text: 'weekly' },
      { kind: 'ins', text: 'daily' },
    ]);
    expect(wordDiff(null, 'New text')).toEqual([{ kind: 'ins', text: 'New text' }]);
    expect(wordDiff('Same', 'Same')).toEqual([{ kind: 'same', text: 'Same' }]);
    expect(wordDiff(null, null)).toEqual([]);
  });

  it('shows no marks when either value is over 2,000 characters', () => {
    const long = 'word '.repeat(400).concat('x');
    expect(long.length).toBe(2_001);
    expect(wordDiff(long, 'short')).toBeNull();
    expect(wordDiff('short', long)).toBeNull();
    expect(wordDiff('x'.repeat(2_000), 'y')).not.toBeNull();
  });
});

describe('the change labels (UI-SPEC §4.3)', () => {
  it('names a multi-field change by its own label and a one-field change by the editor’s label', () => {
    expect(changeUnitLabel('u-information-asset')).toBe('Information asset and data classification');
    expect(changeUnitLabel('u-inherent-rating')).toBe('Inherent rating');
    expect(changeUnitLabel('u-residual-rating')).toBe('Residual rating');
    expect(changeUnitLabel('u-treatment')).toBe('Treatment action and plan');
    expect(changeUnitLabel('u-risk-statement')).toBe('Risk statement');
    expect(changeUnitLabel('u-risk-sub-category')).toBe('Risk sub-category');
    expect(changeUnitLabel('u-information-system')).toBe('Information system impacted');
    expect(changeUnitLabel('u-unknown-unit', ['potentialImpact'])).toBe('Potential impact');
    expect(changeUnitLabel('u-unknown-unit')).toBe('AI change');
  });

  it('holds the editor’s labels', () => {
    expect(RISK_FIELD_LABELS.riskType).toBe('Risk type');
    expect(RISK_FIELD_LABELS.highestInherentConsequence).toBe('Highest inherent consequence');
    expect(RISK_FIELD_LABELS.treatmentPlan).toBe('Treatment plan');
  });
});

const changeItem = proposalsFixture.items[0] as RiskAiProposalItem;
const acceptItem: RiskAiProposalItem = {
  ...changeItem,
  itemKey: 'u-treatment',
  unitKey: 'u-treatment',
  fields: ['treatmentAction', 'treatmentPlan'],
  current: { treatmentAction: 'Treat', treatmentPlan: null },
  proposed: { treatmentAction: 'Accept', treatmentPlan: 'Accept the residual risk until the vendor patches.' },
  aiAccept: true,
};

describe('confirmableCount and acceptPreCheck (UI-D19, D-38)', () => {
  it('counts the open changes that may be confirmed now, leaving out changed and blocked ones', () => {
    const stale = { ...changeItem, itemKey: 'u-risk-cause', stale: true };
    const blocked = { ...acceptItem, acceptBlocked: 'accept-not-permitted' as const };
    const decided = { ...changeItem, itemKey: 'u-potential-impact', state: 'accepted' as const };
    expect(confirmableCount([changeItem, stale, blocked, decided, proposalsFixture.items[1] as RiskAiProposalItem])).toBe(1);
  });

  it('returns AI_ACCEPT_NOT_PERMITTED for a High residual and AI_ACCEPT_WITH_PLANNED_CONTROL with a planned control', () => {
    expect(acceptPreCheck({ item: acceptItem, riskNow: { residualRating: 'High' }, controlImplementations: [] })).toBe('AI_ACCEPT_NOT_PERMITTED');
    expect(acceptPreCheck({ item: acceptItem, riskNow: { residualRating: 'Low' }, controlImplementations: [{ controlStatus: 'Planned' }] })).toBe('AI_ACCEPT_WITH_PLANNED_CONTROL');
    expect(acceptPreCheck({ item: acceptItem, riskNow: { residualRating: 'Moderate' }, controlImplementations: [{ controlStatus: 'Implemented' }] })).toBeNull();
  });

  it('derives the residual rating from likelihood and consequence as the server does, and needs a plan', () => {
    expect(acceptPreCheck({ item: acceptItem, riskNow: { residualRating: 'Low', residualLikelihood: 'Likely', highestResidualConsequence: 'Major' }, controlImplementations: [] })).toBe('AI_ACCEPT_NOT_PERMITTED');
    const noPlan = { ...acceptItem, proposed: { treatmentAction: 'Accept', treatmentPlan: null } };
    expect(acceptPreCheck({ item: noPlan, riskNow: { residualRating: 'Low', treatmentPlan: '  ' }, controlImplementations: [] })).toBe('AI_ACCEPT_NOT_PERMITTED');
    expect(acceptPreCheck({ item: changeItem, riskNow: { residualRating: 'Critical' }, controlImplementations: [] })).toBeNull();
  });

  it('refuses a residual change that leaves a High or Critical rating under an Accept confirmed from an AI proposal (FE4-07)', () => {
    const residualChange = {
      ...changeItem,
      itemKey: 'u-residual-rating',
      unitKey: 'u-residual-rating',
      fields: ['residualLikelihood', 'highestResidualConsequence', 'residualRating'],
      current: { residualLikelihood: 'Possible', highestResidualConsequence: 'Minor', residualRating: 'Moderate' },
      proposed: { residualLikelihood: 'Likely', highestResidualConsequence: 'Major', residualRating: 'High' },
      aiAccept: false,
    };
    const riskNow = { treatmentAction: 'Accept', aiAcceptConfirmed: true, residualRating: 'Moderate', residualLikelihood: 'Possible', highestResidualConsequence: 'Minor', treatmentPlan: 'Accept until the vendor patches.' };
    expect(acceptPreCheck({ item: residualChange, riskNow, controlImplementations: [] })).toBe('AI_ACCEPT_NOT_PERMITTED');
    // An Accept a person chose, another treatment, or a residual rating that stays Low or Moderate may stand.
    expect(acceptPreCheck({ item: residualChange, riskNow: { ...riskNow, aiAcceptConfirmed: false }, controlImplementations: [] })).toBeNull();
    expect(acceptPreCheck({ item: residualChange, riskNow: { ...riskNow, treatmentAction: 'Treat' }, controlImplementations: [] })).toBeNull();
    const lower = { ...residualChange, proposed: { residualLikelihood: 'Unlikely', highestResidualConsequence: 'Minor', residualRating: 'Low' } };
    expect(acceptPreCheck({ item: lower, riskNow, controlImplementations: [{ controlStatus: 'Planned' }] })).toBeNull();
    // Another field's change is not a residual change.
    expect(acceptPreCheck({ item: changeItem, riskNow: { ...riskNow, residualRating: 'Critical' }, controlImplementations: [] })).toBeNull();
  });

  it('reads a proposed risk’s own residual rating', () => {
    const proposedRisk = { ...(proposalsFixture.items[1] as RiskAiProposalItem), aiAccept: true, proposed: { residualRating: 'High', treatmentAction: 'Accept', treatmentPlan: 'Accept' } };
    expect(acceptPreCheck({ item: proposedRisk, riskNow: null, controlImplementations: [] })).toBe('AI_ACCEPT_NOT_PERMITTED');
  });
});

describe('leftOutLines (X-10; UI-SPEC §3.1, §4.2)', () => {
  it('aggregates repeated adjustments with a count and names the limit', () => {
    expect(leftOutLines([{ code: 'near-duplicate-active', count: 2 }, { code: 'over-limit', count: 3 }])).toEqual([
      '2 × A risk too close to one already in this assessment.',
      '3 more risks beyond the limit of 8 per request.',
    ]);
    expect(leftOutLines([{ code: 'over-limit', count: 1 }])).toEqual(['1 more risk beyond the limit of 8 per request.']);
  });

  it('writes every left-out line, and leaves out what is not a proposal left out', () => {
    expect(leftOutLines([
      { code: 'near-duplicate-withdrawn', count: 1 },
      { code: 'near-duplicate-rejected', count: 1 },
      { code: 'near-duplicate-proposed', count: 1 },
      { code: 'invalid-item', count: 1 },
      { code: 'outside-focus', count: 1 },
      { code: 'no-change', count: 2 },
      { code: 'accept-not-permitted', count: 1 },
      { code: 'sources-dropped', count: 4 },
      { code: 'suggestions-capped', count: 1 },
    ])).toEqual([
      'A risk too close to one you withdrew.',
      'A risk too close to one you rejected.',
      'A risk already proposed.',
      'A proposal that was incomplete or too long.',
      'A change outside what you asked to rewrite.',
      '2 × A change that left the value as it was.',
    ]);
    expect(leftOutCount(proposalsFixture.runs[1]!.adjustments)).toBe(5);
    expect(leftOutCount([{ code: 'sources-dropped', count: 4 }])).toBe(0);
  });
});

describe('similarityNote (X-28; UI-SPEC §3.3)', () => {
  const base = { riskId: null, riskNumber: null, runId: null, itemKey: null, score: 0.8 };

  it('names the similar record, its comparison and the duplicate reason', () => {
    expect(similarityNote({ ...base, kind: 'active', riskId: 'r2', riskNumber: 'R-0002' })).toEqual({
      note: 'Similar to R-0002',
      compareLabel: 'Compare with R-0002',
      columns: ['R-0002', 'Proposed'],
      duplicateReason: 'Duplicate of R-0002',
    });
    expect(similarityNote({ ...base, kind: 'withdrawn', riskId: 'r3', riskNumber: 'R-0003' })).toEqual({
      note: 'Similar to a withdrawn risk, R-0003',
      compareLabel: 'Compare with R-0003',
      columns: ['R-0003 (withdrawn)', 'Proposed'],
      duplicateReason: 'Duplicate of R-0003',
    });
    expect(similarityNote({ ...base, kind: 'rejected', runId: 'run-0', itemKey: 's-2' })).toMatchObject({
      note: 'Similar to a rejected proposal', compareLabel: 'Compare with the rejected proposal', duplicateReason: 'Duplicate of a rejected proposal',
    });
    expect(similarityNote({ ...base, kind: 'open', runId: 'run-1', itemKey: 's-3' })).toMatchObject({
      note: 'Similar to an open proposal', compareLabel: 'Compare with the open proposal', duplicateReason: 'Duplicate of an open proposal',
    });
    expect(similarityNote(null)).toBeNull();
  });
});

describe('decidedNote and the rewrite summary (UI-SPEC §3.6, §4.4)', () => {
  const by = { documentId: 'analyst-1', displayName: 'Morgan Analyst' };
  const decision = (action: 'accepted' | 'rejected' | 'superseded' | 'lapsed', extra: object = {}) => ({ action, by, at: '2026-10-14T07:00:00.000Z', reason: null, cause: null, ...extra });

  it('reads an added, a rejected and a closed proposed risk', () => {
    const proposed = proposalsFixture.items[1] as RiskAiProposalItem;
    expect(decidedNote({ ...proposed, state: 'accepted', decision: decision('accepted'), addedRisk: { riskId: 'r9', riskNumber: 'R-0009' } }))
      .toEqual({ label: 'Added as R-0009', icon: 'Plus', reasonLine: null, byName: 'Morgan Analyst', at: '2026-10-14T07:00:00.000Z' });
    expect(decidedNote({ ...proposed, state: 'rejected', decision: decision('rejected', { reason: 'Out of scope' }) }))
      .toMatchObject({ label: 'Rejected', icon: 'X', reasonLine: 'Reason: “Out of scope”' });
    expect(decidedNote({ ...proposed, state: 'lapsed', decision: decision('lapsed', { cause: { kind: 'assessment-not-editable', runId: null, riskId: null } }) }))
      .toMatchObject({ label: 'Closed without a decision: the assessment could no longer be changed.', icon: 'Lock' });
  });

  it('reads a confirmed, a replaced and a withdrawn-closed change', () => {
    expect(decidedNote({ ...changeItem, state: 'accepted', decision: decision('accepted') })).toMatchObject({ label: 'Confirmed', icon: 'Check' });
    expect(decidedNote({ ...changeItem, state: 'superseded', decision: decision('superseded', { by: null, cause: { kind: 'newer-rewrite', runId: 'run-3', riskId: 'r1' } }) }))
      .toMatchObject({ label: 'Replaced by a newer rewrite', icon: 'ListRestart', byName: null });
    expect(decidedNote({ ...changeItem, state: 'superseded', decision: decision('superseded', { cause: { kind: 'risk-withdrawn', runId: null, riskId: 'r1' } }) }, { riskNumber: 'R-0001' }))
      .toMatchObject({ label: 'Closed when R-0001 was withdrawn', icon: 'Archive' });
  });

  it('summarises a decided rewrite, omitting zero parts', () => {
    expect(rewriteDecidedSummary({ confirmed: 2, rejected: 1, closed: 0 })).toBe('2 confirmed · 1 rejected');
    expect(rewriteDecidedSummary({ confirmed: 0, rejected: 0, closed: 3 })).toBe('3 closed');
  });
});

describe('assessmentStateLine (UI-SPEC §2.4)', () => {
  it('reads each state’s line, and none while editable', () => {
    expect(assessmentStateLine('editable')).toBeNull();
    expect(assessmentStateLine('released')).toBe('This assessment has been released, so the AI can no longer propose changes and its risks can’t be withdrawn or reinstated.');
    expect(assessmentStateLine('not-editable')).toBe('This assessment can’t be changed now, so the AI can’t be asked and proposals can’t be decided.');
    expect(assessmentStateLine('own-request')).toBe('You raised this request, so another Security Analyst asks the AI about this assessment and decides its proposals. You can still edit, withdraw and reinstate its risks.');
  });
});

const event = (overrides: Partial<RiskHistoryEvent>): RiskHistoryEvent => ({
  id: 'event-x',
  kind: 'updated',
  occurredAt: '2026-10-14T02:00:00.000Z',
  actor: { documentId: 'analyst-1', displayName: 'Morgan Analyst' },
  sourceKind: 'analyst',
  aiRunId: null,
  proposalItem: null,
  reason: null,
  undo: false,
  changes: { schemaVersion: 1, fields: [] },
  ...overrides,
});

describe('historyEntryPresentation (X-29; UI-SPEC §8.3)', () => {
  it('reads every creation', () => {
    expect(historyEntryPresentation(event({ kind: 'created' }))).toMatchObject({ label: 'Risk added', icon: 'Plus', lines: [] });
    expect(historyEntryPresentation(event({ kind: 'created', sourceKind: 'ai-run', aiRunId: 'run-0' })))
      .toMatchObject({ label: 'Risk added by the AI draft', icon: 'Sparkles', lines: ['Source: AI draft requested by Morgan Analyst'], showInProposals: false });
    expect(historyEntryPresentation(event({ kind: 'created', sourceKind: 'ai-run', aiRunId: 'run-1', proposalItem: 's-1' })))
      .toMatchObject({ label: 'Risk added from an AI proposal', icon: 'Sparkles', lines: ['Source: proposed risk, added by Morgan Analyst'], showInProposals: true });
  });

  it('reads every change, an AI change’s Undo included, with its comparison', () => {
    const fields = [{ field: 'riskStatement', from: 'a', to: 'b' }];
    expect(historyEntryPresentation(event({ changes: { schemaVersion: 1, fields } }))).toMatchObject({ label: 'Risk changed', icon: 'FilePenLine', lines: [], comparison: fields, comparisonKind: 'compare' });
    expect(historyEntryPresentation(event({ sourceKind: 'ai-run', aiRunId: 'run-2', proposalItem: 'u-risk-statement', changes: { schemaVersion: 1, fields } })))
      .toMatchObject({ label: 'Risk changed by a confirmed AI rewrite', icon: 'Sparkles', lines: ['Source: AI rewrite, confirmed'], comparison: fields });
    expect(historyEntryPresentation(event({ sourceKind: 'ai-run', aiRunId: 'run-2', undo: true, changes: { schemaVersion: 1, fields } })))
      .toMatchObject({ label: 'AI change undone', icon: 'Undo2', lines: [], comparison: fields });
  });

  it('reads withdrawals and reinstatements, with their Undo variants', () => {
    expect(historyEntryPresentation(event({ kind: 'withdrawn', reason: 'Duplicate' }))).toMatchObject({ label: 'Risk withdrawn', icon: 'Archive', lines: ['Reason: “Duplicate”'], comparison: null });
    expect(historyEntryPresentation(event({ kind: 'withdrawn', reason: 'Duplicate', undo: true }))).toMatchObject({ label: 'Reinstatement undone', icon: 'Undo2', lines: ['Reason: “Duplicate”'] });
    expect(historyEntryPresentation(event({ kind: 'reinstated', reason: 'Still applies' }))).toMatchObject({ label: 'Risk reinstated', icon: 'ArchiveRestore', lines: ['Reason: “Still applies”'] });
    expect(historyEntryPresentation(event({ kind: 'reinstated', reason: 'Withdrawal undone', undo: true }))).toMatchObject({ label: 'Withdrawal undone', icon: 'Undo2', lines: [] });
  });

  it('reads the three control changes with the control’s label', () => {
    const control = { documentId: 'c1', controlNumber: 'ISM-1234', name: 'ISM-1234 — Sign payment files' };
    const fields = [{ field: 'controlStatus', from: null, to: 'Planned' }];
    expect(historyEntryPresentation(event({ kind: 'control-implementation-added', changes: { schemaVersion: 1, fields, control } })))
      .toMatchObject({ label: 'Mitigation control added', icon: 'Plus', lines: ['Control: ISM-1234 · Sign payment files'], comparison: fields, comparisonKind: 'compare' });
    expect(historyEntryPresentation(event({ kind: 'control-implementation-updated', changes: { schemaVersion: 1, fields, control } })))
      .toMatchObject({ label: 'Mitigation control changed', icon: 'FilePenLine', comparisonKind: 'compare' });
    expect(historyEntryPresentation(event({ kind: 'control-implementation-removed', changes: { schemaVersion: 1, fields, control } })))
      .toMatchObject({ label: 'Mitigation control taken off this risk', icon: 'CircleMinus', lines: ['Control: ISM-1234 · Sign payment files'], comparisonKind: 'values' });
  });

  it('reads an unknown kind as Change recorded, and a malformed entry with its label and the unreadable line', () => {
    expect(historyEntryPresentation({ ...event({}), kind: 'reassessed' as RiskHistoryEvent['kind'] })).toMatchObject({ label: 'Change recorded', icon: 'History' });
    const malformed = historyEntryPresentation(historyPageFixture.data[2] as RiskHistoryEvent);
    expect(malformed).toMatchObject({ label: 'Mitigation control added', icon: 'Plus', lines: ['The details of this change couldn’t be read.'], comparison: null, malformed: true });
    expect(malformed.actorName).toBe('a Security Analyst');
  });
});

describe('the history sheet’s lines (UI-SPEC §8.2, §8.4)', () => {
  it('counts what is shown, with plurals written out', () => {
    expect(historyCountLine(1, 1)).toBe('1 of 1 change');
    expect(historyCountLine(25, 1_204)).toBe('25 of 1,204 changes');
  });

  it('ends an incomplete record honestly', () => {
    expect(honestStartLine('14 Oct 2026')).toBe('History recorded from 14 Oct 2026. Earlier changes to this risk weren’t recorded.');
    const events = historyPageFixture.data as readonly RiskHistoryEvent[];
    expect(showsHonestStart({ events, lastPage: true, recordedFrom: '2026-10-14T01:00:00.000Z' })).toBe(true);
    expect(showsHonestStart({ events, lastPage: false, recordedFrom: '2026-10-14T01:00:00.000Z' })).toBe(false);
    expect(showsHonestStart({ events: [...events, event({ kind: 'created' })], lastPage: true, recordedFrom: '2026-10-14T01:00:00.000Z' })).toBe(false);
    expect(showsHonestStart({ events: [], lastPage: true, recordedFrom: null })).toBe(false);
  });
});

describe('the section’s status line and the AI inputs heading (UI-SPEC §2.1, §10.2)', () => {
  it('writes the open count out', () => {
    expect(proposalsStatusLine(0)).toBe('No open AI proposals');
    expect(proposalsStatusLine(1)).toBe('1 open proposal');
    expect(proposalsStatusLine(2)).toBe('2 open proposals');
  });

  it('reads the Phase 16 heading once a suggestion request completed after the draft was generated (UI-D26)', () => {
    const asked = latestSuggestionsAskedAt(proposalsFixture.runs);
    expect(asked).toBe('2026-10-14T05:00:00.000Z');
    expect(aiInputsChangedHeadingFor({ askedAt: asked, generatedAt: '2026-10-13T00:00:00.000Z' })).toBe('AI inputs changed since the AI was last asked about this assessment');
    expect(aiInputsChangedHeadingFor({ askedAt: asked, generatedAt: '2026-10-15T00:00:00.000Z' })).toBe('AI inputs changed since this draft was generated');
    expect(aiInputsChangedHeadingFor({ askedAt: null, generatedAt: '2026-10-13T00:00:00.000Z' })).toBe('AI inputs changed since this draft was generated');
    expect(latestSuggestionsAskedAt([])).toBeNull();
  });
});

describe('the toasts (UI-SPEC §5.1, §6.1, §6.2, §7)', () => {
  it('reads withdrawal, reinstatement, their Undos and a discarded new risk', () => {
    expect(withdrawToast('R-0004')).toBe('R-0004 withdrawn.');
    expect(reinstateToast('R-0004')).toBe('R-0004 reinstated.');
    expect(undoneToast({ undone: 'withdrawal', riskNumber: 'R-0004' })).toBe('Withdrawal undone. R-0004 is back in the assessment.');
    expect(undoneToast({ undone: 'reinstatement', riskNumber: 'R-0004' })).toBe('Reinstatement undone. R-0004 is withdrawn again.');
    expect(discardToast()).toBe('New risk discarded.');
  });

  it('reads every decision’s toast and its Undo', () => {
    expect(decisionToast({ act: 'add', riskNumber: 'R-0009' })).toEqual({ message: 'R-0009 added to the assessment. Review its AI-proposed fields.', actionLabel: 'Open R-0009', undoable: false });
    expect(decisionToast({ act: 'confirm', label: 'Risk statement', riskNumber: 'R-0001' })).toEqual({ message: 'Risk statement confirmed on R-0001.', undoable: true });
    expect(decisionToast({ act: 'confirm-all', count: 1, riskNumber: 'R-0001' }).message).toBe('1 AI change confirmed on R-0001.');
    expect(decisionToast({ act: 'confirm-all', count: 3, riskNumber: 'R-0001' }).message).toBe('3 AI changes confirmed on R-0001.');
    expect(decisionToast({ act: 'reject' }).message).toBe('Proposal rejected.');
    expect(decisionToast({ act: 'reject', label: 'Residual rating' }).message).toBe('Residual rating change rejected.');
    expect(decisionToast({ act: 'reject-duplicate', riskNumber: 'R-0002' }).message).toBe('Proposal rejected as a duplicate of R-0002.');
    expect(decisionToast({ act: 'reject-remaining', count: 4, target: 'proposals' }).message).toBe('4 proposals rejected.');
    expect(decisionToast({ act: 'reject-remaining', count: 1, target: 'changes' }).message).toBe('1 change rejected.');
    expect(undoneToast({ undone: 'confirmation', label: 'Risk statement' })).toBe('Confirmation undone. Risk statement is back to its earlier value.');
    expect(undoneToast({ undone: 'confirmations' })).toBe('Confirmations undone.');
    expect(undoneToast({ undone: 'rejection' })).toBe('Rejection undone. The proposal is open again.');
    expect(undoneToast({ undone: 'rejections' })).toBe('Rejections undone.');
  });

  it('titles every failed decision', () => {
    expect(decisionFailureTitle('add')).toBe('Risk not added');
    expect(decisionFailureTitle('confirm')).toBe('Change not confirmed');
    expect(decisionFailureTitle('confirm-all')).toBe('Changes not confirmed');
    expect(decisionFailureTitle('reject')).toBe('Proposal not rejected');
    expect(decisionFailureTitle('reject-duplicate')).toBe('Proposal not rejected');
    expect(decisionFailureTitle('reject-remaining')).toBe('Proposals not rejected');
    expect(decisionFailureTitle('undo')).toBe('Couldn’t undo');
  });
});

describe('the domain module', () => {
  it('imports nothing from zod and carries no directive (plan 08-13, D-24)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/risk-curation/risk-curation-domain.ts'), 'utf8');
    expect(source).not.toMatch(/from 'zod'/);
    expect(source).not.toMatch(/^'use (client|server)'/m);
  });
});
