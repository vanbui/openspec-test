import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { AiFieldReview } from '../assessments/assessment-schema';
import { aiJobFailureCopy, aiPolicyCaption, aiPolicyRefusal, decisionRefusalRecovery, offersNotSure, questionOriginMarker,
  questionOriginIcon, releaseDescriptionFor, confirmToastMessage, fieldMarkerState, prefillNote, reviewBarState, treatmentActionNote, undoToastMessage, type AiPolicyStatus } from './ai-assistance-domain';

const allowed: AiPolicyStatus = { status: 'allowed', reason: null, requestClassification: 'Restricted', classificationSource: 'assets', ceiling: null };

describe('AI data policy presentation (12-UI-SPEC §11)', () => {
  it('captions an allowed policy, naming the default when no asset is classified', () => {
    expect(aiPolicyCaption(allowed)).toBe('This request’s information is classified Restricted.');
    expect(aiPolicyCaption({ ...allowed, requestClassification: 'Internal', classificationSource: 'default' }))
      .toBe('This request’s information is classified Internal. No information asset on it is classified, so Internal applies.');
    expect(aiPolicyRefusal(allowed)).toBeNull();
  });

  it('turns a refused policy into the alert, never a caption', () => {
    const refused: AiPolicyStatus = { ...allowed, status: 'refused', reason: 'AI_CLASSIFICATION_ABOVE_CEILING', ceiling: 'Public' };
    expect(aiPolicyCaption(refused)).toBeNull();
    expect(aiPolicyRefusal(refused)).toEqual({
      title: 'AI generation isn’t available for this request',
      description: 'This request’s information is classified Restricted, above the Public limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.',
    });
    expect(aiPolicyRefusal({ ...allowed, status: 'refused', reason: 'AI_POLICY_NOT_CONFIGURED' })?.description)
      .toBe('The AI provider hasn’t been approved for any information classification yet, so nothing can be sent to it. Contact your administrator.');
  });

  it.each(['AI_CLASSIFICATION_ABOVE_CEILING', 'AI_POLICY_NOT_CONFIGURED', 'CONTEXT_TOO_LARGE'])('reads the %s job failure, ending in Contact your administrator.', (code) => {
    expect(aiJobFailureCopy(code)).toMatch(/Contact your administrator\.$/);
  });

  it('leaves every other failure code to the card', () => {
    for (const code of ['PROVIDER_FAILED', 'constructor', '', null, undefined]) expect(aiJobFailureCopy(code)).toBeNull();
  });

  it('stays zod-free and server-free, so client components can use it', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/ai-assistance/ai-assistance-domain.ts'), 'utf8');
    expect(source).not.toMatch(/from 'zod'|server-only/);
  });
});

const fact = (field: string, state: AiFieldReview['state'] = 'proposed', sources: AiFieldReview['sources'] = null): AiFieldReview => ({ field, state, sources, by: null, at: null });

describe('field review presentation', () => {
  it('protects an unsaved edit and returns to the proposed marker when the value is restored', () => {
    expect(fieldMarkerState(fact('issueStatement'), 'changed', 'loaded')).toBe('changed');
    expect(fieldMarkerState(fact('issueStatement'), 'loaded', 'loaded')).toBe('proposed');
    expect(fieldMarkerState(fact('issueStatement', 'accepted'), 'loaded', 'loaded')).toBe('accepted');
    expect(fieldMarkerState(fact('issueStatement', 'accepted'), 'changed', 'loaded')).toBe('changed');
    expect(fieldMarkerState(undefined, 'loaded', 'loaded')).toBeNull();
  });

  it('counts unchanged proposals and uncited statements for one record only', () => {
    const state = reviewBarState({ fields: [fact('issueStatement', 'proposed', []), fact('riskStatement', 'proposed', []), fact('riskType'), fact('treatmentAction'), fact('residualRating')] }, new Set(['riskStatement', 'riskType']));
    expect(state).toMatchObject({ fields: ['issueStatement', 'treatmentAction', 'residualRating'], count: 3, changed: 2, uncited: 1 });
    expect(state.caption).toBe('Confirm remaining skips the 2 fields you’ve changed. Save to record your edits.');
  });

  it('explains prefilled values and treatment adjustments only while proposed', () => {
    expect(prefillNote('dataClassification', true, 'Restricted', 'Customer records')).toBe('Taken from Customer records.');
    expect(prefillNote('riskType', true, null)).toBe('The AI found no Risk Type that fits this Risk. Choose one, or confirm to leave it unset.');
    expect(treatmentActionNote(true, 'Accept', 'Moderate', [])).toBe('Proposed because the residual rating is Moderate. The treatment plan holds the AI’s reason.');
    expect(treatmentActionNote(true, 'Treat', 'High', ['accept-not-permitted'])).toContain('which it may suggest only for a Low or Moderate residual rating');
    expect(treatmentActionNote(true, 'Treat', 'Moderate', ['accept-with-suggested-controls'])).toBe('The AI proposed Accept and also suggested controls to plan, so Treat is proposed instead. Accept fits only a Risk with no planned control.');
    expect(treatmentActionNote(false, 'Accept', 'Moderate', [])).toBeNull();
  });

  /*
   * D-11 (stage B WR-203): the adapter turns an AI-proposed Accept with no rationale into Treat and records
   * `accept-without-rationale` (12-UI-SPEC §3.5, amended 2026-10-08). A Risk shows one note, the first that applies:
   * suggested controls, then the rating, then the missing reason.
   */
  it('explains a Treat the adapter proposed because the AI gave its Accept no reason, only while proposed', () => {
    const noReason = 'The AI proposed Accept without giving a reason, so Treat is proposed instead. Accept needs its reason in the treatment plan.';
    expect(treatmentActionNote(true, 'Treat', 'Moderate', ['accept-without-rationale'])).toBe(noReason);
    expect(treatmentActionNote(true, 'Treat', 'Low', ['uncited-claims-capped', 'accept-without-rationale'])).toBe(noReason);
    expect(treatmentActionNote(true, 'Treat', 'High', ['accept-not-permitted', 'accept-without-rationale'])).toBe('The AI proposed Accept, which it may suggest only for a Low or Moderate residual rating, so Treat is proposed instead.');
    expect(treatmentActionNote(true, 'Treat', 'Moderate', ['accept-without-rationale', 'accept-with-suggested-controls'])).toBe('The AI proposed Accept and also suggested controls to plan, so Treat is proposed instead. Accept fits only a Risk with no planned control.');
    expect(treatmentActionNote(false, 'Treat', 'Moderate', ['accept-without-rationale'])).toBeNull();
  });

  it('uses the visible field label in confirmation and undo copy', () => {
    expect(confirmToastMessage(['issueStatement'], 'on RSK-001')).toBe('Issue statement confirmed on RSK-001.');
    expect(confirmToastMessage(['issueStatement', 'riskStatement'], 'on RSK-001')).toBe('2 AI-proposed fields confirmed on RSK-001.');
    expect(undoToastMessage(1)).toBe('Confirmation undone.');
    expect(undoToastMessage(2)).toBe('Confirmations undone.');
  });

  /* IN-304: Confirm remaining is always counted (12-UI-SPEC §6.1), even when it confirms one field. */
  it('counts the fields of a Confirm remaining, one or many', () => {
    expect(confirmToastMessage(['issueStatement'], 'on RSK-001', 'remaining')).toBe('1 AI-proposed field confirmed on RSK-001.');
    expect(confirmToastMessage(['summary', 'overallRating'], 'in the assessment details', 'remaining')).toBe('2 AI-proposed fields confirmed in the assessment details.');
    expect(confirmToastMessage(['summary'], 'in the assessment details', 'one')).toBe('Summary confirmed in the assessment details.');
  });

  /* 12-UI-SPEC §6.1 and §6.3; WR-303: what a refused decision's danger toast offers. */
  it('offers Try again for a retryable refusal, Refresh page for a blocked one, and nothing when the fix is on the page', () => {
    expect(decisionRefusalRecovery(null)).toBe('try-again');
    expect(decisionRefusalRecovery({ kind: 'retryable' })).toBe('try-again');
    expect(decisionRefusalRecovery({ kind: 'blocked', reason: 'ASSESSMENT_NOT_MUTABLE' })).toBe('refresh');
    expect(decisionRefusalRecovery({ kind: 'blocked', reason: 'AI_PROPOSAL_ALREADY_DECIDED' })).toBe('refresh');
    expect(decisionRefusalRecovery({ kind: 'blocked' })).toBe('refresh');
    expect(decisionRefusalRecovery({ kind: 'blocked', reason: 'AI_ACCEPT_WITH_PLANNED_CONTROL' })).toBeNull();
    expect(decisionRefusalRecovery({ kind: 'blocked', reason: 'AI_SUGGESTION_CONTROL_CHANGED' })).toBeNull();
  });
});

describe('questionnaire AI presentation (12-UI-SPEC §8, §9)', () => {
  it('marks each question origin', () => {
    expect(questionOriginMarker('generated')).toEqual({ kind: 'badge' });
    expect(questionOriginMarker('generated-edited')).toEqual({ kind: 'note', label: 'Edited' });
    expect(questionOriginMarker('analyst-added')).toEqual({ kind: 'note', label: 'Added by analyst' });
    // Phase 15 UI-SPEC §9.2 (UI-D24): the confirmed AI proposal origins.
    expect(questionOriginMarker('proposal-confirmed')).toEqual({ kind: 'note', label: 'Confirmed AI proposal' });
    expect(questionOriginMarker('proposal-edited')).toEqual({ kind: 'note', label: 'Edited AI proposal' });
    expect(questionOriginIcon('Confirmed AI proposal')).toBe('Check');
    expect(questionOriginIcon('Edited AI proposal')).toBe('PenLine');
    expect(questionOriginIcon('Edited')).toBe('PenLine');
    expect(questionOriginIcon('Added by analyst')).toBe('UserRoundPen');
    expect(questionOriginMarker(null)).toBeNull();
    expect(questionOriginMarker(undefined)).toBeNull();
  });

  it('describes release with the count of AI-proposed questions', () => {
    expect(releaseDescriptionFor(0)).toBe('The Requestor can view this questionnaire after release.');
    expect(releaseDescriptionFor(1)).toBe('The Requestor can view this questionnaire after release. Releasing also records that you reviewed its 1 AI-proposed question.');
    expect(releaseDescriptionFor(3)).toBe('The Requestor can view this questionnaire after release. Releasing also records that you reviewed its 3 AI-proposed questions.');
  });

  it('knows when a Not sure choice is offered', () => {
    expect(offersNotSure([{ choices: [{ value: 'yes' }, { value: 'not-sure' }] }])).toBe(true);
    expect(offersNotSure([{ choices: [{ value: 'yes' }] }, { choices: null }, {}])).toBe(false);
  });
});
