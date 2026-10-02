import { describe, expect, it } from 'vitest';

import {
  canReturnToAnalystReview,
  canRevertQuestionnaireToDraft,
  submittedNoticeVariant,
} from './questionnaire-workflow-rules';
import type { QuestionnaireSummary } from './questionnaire-service';

type Facts = Pick<QuestionnaireSummary, 'state' | 'release' | 'assessmentRequest'>;

function request(requestStatus: string): QuestionnaireSummary['assessmentRequest'] {
  return { availability: 'available', documentId: 'request-1', requestNumber: 'RAR-2026-X7K4Q2', title: 'Customer portal review', requestStatus };
}

const release = { releasedAt: '2026-09-01T00:00:00.000Z', releasedBy: { documentId: 'analyst-1', displayName: 'Morgan Analyst' } };

function facts(overrides: Partial<Facts>): Facts {
  return { state: 'submitted', release, assessmentRequest: request('questionnaire-in-progress'), ...overrides };
}

describe('canRevertQuestionnaireToDraft (UI-SPEC §10.1)', () => {
  it.each([
    ['submitted, request questionnaire-in-progress', facts({}), true],
    ['submitted, request risk-assessment-drafted', facts({ assessmentRequest: request('risk-assessment-drafted') }), false],
    ['submitted, request under-review', facts({ assessmentRequest: request('under-review') }), false],
    ['submitted, request closed', facts({ assessmentRequest: request('closed') }), false],
    ['draft, request questionnaire-in-progress', facts({ state: 'draft' }), false],
    ['not started, request submitted', facts({ state: 'not-started', assessmentRequest: request('submitted') }), false],
    ['submitted, request relation absent', facts({ assessmentRequest: { availability: 'absent' } }), false],
    ['submitted, request relation unavailable', facts({ assessmentRequest: { availability: 'unavailable' } }), false],
    ['submitted, an unknown request status', facts({ assessmentRequest: request('archived') }), false],
  ])('%s → %s', (_label, questionnaire, expected) => {
    expect(canRevertQuestionnaireToDraft(questionnaire)).toBe(expected);
  });

  it('fails closed on an unknown questionnaire state', () => {
    expect(canRevertQuestionnaireToDraft({ ...facts({}), state: 'archived' as Facts['state'] })).toBe(false);
  });
});

describe('canReturnToAnalystReview (UI-SPEC §10.1)', () => {
  it.each([
    ['released, request submitted', facts({ state: 'not-started', assessmentRequest: request('submitted') }), true],
    ['released, request questionnaire-in-progress', facts({ state: 'draft' }), true],
    ['released and submitted, request questionnaire-in-progress', facts({}), true],
    ['released, request risk-assessment-drafted', facts({ assessmentRequest: request('risk-assessment-drafted') }), false],
    ['released, request under-review', facts({ assessmentRequest: request('under-review') }), false],
    ['not released (null)', facts({ state: 'not-started', release: null, assessmentRequest: request('submitted') }), false],
    ['not released (not served)', facts({ state: 'not-started', release: undefined, assessmentRequest: request('submitted') }), false],
    ['released, request relation absent', facts({ assessmentRequest: { availability: 'absent' } }), false],
    ['released, request relation unavailable', facts({ assessmentRequest: { availability: 'unavailable' } }), false],
  ])('%s → %s', (_label, questionnaire, expected) => {
    expect(canReturnToAnalystReview(questionnaire)).toBe(expected);
  });
});

describe('submittedNoticeVariant (UI-SPEC §8.2)', () => {
  it('tells the Requestor she can still return the questionnaire to draft while the server allows it', () => {
    expect(submittedNoticeVariant('requestor', facts({}))).toBe('requestor-revertible');
  });

  it('tells the Requestor her answers are fixed once the assessment has started', () => {
    expect(submittedNoticeVariant('requestor', facts({ assessmentRequest: request('risk-assessment-drafted') }))).toBe('requestor-locked');
    expect(submittedNoticeVariant('requestor', facts({ assessmentRequest: request('under-review') }))).toBe('requestor-locked');
  });

  it('promises nothing it cannot back when the request is not served', () => {
    expect(submittedNoticeVariant('requestor', facts({ assessmentRequest: { availability: 'unavailable' } }))).toBe('requestor-locked');
    expect(submittedNoticeVariant('requestor', facts({ assessmentRequest: { availability: 'absent' } }))).toBe('requestor-locked');
  });

  it('describes the questionnaire as it will be once submitted, so an in-page submit before the refreshed read gets the right notice', () => {
    expect(submittedNoticeVariant('requestor', facts({ state: 'draft' }))).toBe('requestor-revertible');
  });

  it('gives the Security Analyst the read-only review notice whatever the request status', () => {
    expect(submittedNoticeVariant('analyst', facts({}))).toBe('analyst');
    expect(submittedNoticeVariant('analyst', facts({ assessmentRequest: request('risk-assessment-drafted') }))).toBe('analyst');
  });
});
