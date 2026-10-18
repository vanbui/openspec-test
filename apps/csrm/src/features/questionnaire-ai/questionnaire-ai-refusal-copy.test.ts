import { describe, expect, it } from 'vitest';

import { aiPolicyRefusalCopy, refusalMessage } from '../../lib/api/refusal-copy';
import { aiProposalDecisionRefusalCopy, aiProposalJobFailureCopy, aiProposalStartRefusalCopy } from './questionnaire-ai-refusal-copy';

/* 15-UI-SPEC §13, families Q1 to Q3: every row, verbatim, with its kind. */
describe('Q1, asking the AI', () => {
  const rows = [
    [400, 'INSTRUCTION_CHARACTERS_NOT_ALLOWED', 'The instruction contains hidden formatting characters CSRM can’t send. Type it again, or paste it as plain text.', 'field'],
    [400, 'INSTRUCTION_REPEATS_REQUESTOR_TEXT', 'The instruction repeats a long passage of the Requestor’s own words. The AI already reads the request and the marked notes and files, so say what to focus on in your own words.', 'field'],
    [409, 'QUESTIONNAIRE_NOT_SUBMITTED', 'The Requestor is still answering this questionnaire. Wait for them to submit it, or return it to analyst review.', 'blocked'],
    [409, 'ASSESSMENT_STARTED', 'An assessment has been drafted from this questionnaire, so its questions can no longer change.', 'blocked'],
    [409, 'ASSESSMENT_DRAFT_IN_PROGRESS', 'An assessment draft is being generated, so this questionnaire can’t change.', 'blocked'],
    [409, 'QUESTION_ANSWERED', 'This question has been answered, so the AI can’t rewrite it. Refresh the page to see it.', 'blocked'],
    [409, 'QUESTION_REMOVED', 'This question has been removed. Refresh the page to see the current list.', 'blocked'],
    [409, 'AI_PROPOSAL_RUN_LIMIT', 'This questionnaire has reached the most AI requests it can keep, so the AI can’t be asked again. Contact your administrator.', 'blocked'],
    [409, 'HISTORY_UNAVAILABLE', 'This questionnaire’s change history can’t record more changes, so the AI can’t be asked. Contact your administrator.', 'blocked'],
    [403, 'OWN_REQUEST', 'A Security Analyst can’t steer the AI on a request they raised. Another Security Analyst handles it.', 'blocked'],
  ] as const;

  it.each(rows)('%s %s', (status, reason, text, kind) => {
    expect(aiProposalStartRefusalCopy({ status, reason })).toEqual({ text, kind });
  });

  it('fills the instruction’s length into the too-long sentence', () => {
    expect(aiProposalStartRefusalCopy({ status: 400, reason: 'INSTRUCTION_TOO_LONG' }, { instructionLength: 512 })).toEqual({
      text: 'Keep the instruction to 500 characters or fewer. It has 512.', kind: 'field',
    });
    expect(aiProposalStartRefusalCopy({ status: 400, reason: 'INSTRUCTION_TOO_LONG' }, { instructionLength: 1_234 }).text).toBe('Keep the instruction to 500 characters or fewer. It has 1,234.');
  });

  it('reads the AI policy refusals with 12 §11.1’s descriptions', () => {
    for (const reason of ['AI_CLASSIFICATION_ABOVE_CEILING', 'AI_POLICY_NOT_CONFIGURED'] as const) {
      expect(aiProposalStartRefusalCopy({ status: 409, reason })).toEqual({ text: aiPolicyRefusalCopy(reason), kind: 'blocked' });
    }
  });

  it('reads the status rows: 403, 404, a 409 without a listed reason, and a network failure or 5xx', () => {
    expect(aiProposalStartRefusalCopy({ status: 403 })).toEqual({ text: 'You can’t ask the AI for proposals on this questionnaire.', kind: 'blocked' });
    expect(aiProposalStartRefusalCopy({ status: 404 })).toEqual({ text: 'This questionnaire is no longer available.', kind: 'blocked' });
    expect(aiProposalStartRefusalCopy({ status: 409 })).toEqual({ text: 'The AI can’t be asked in this questionnaire’s current state.', kind: 'blocked' });
    expect(aiProposalStartRefusalCopy({ status: 409, reason: 'NOTES_CLOSED' })).toEqual({ text: 'The AI can’t be asked in this questionnaire’s current state.', kind: 'blocked' });
    for (const status of [undefined, 500, 503]) {
      expect(aiProposalStartRefusalCopy(status === undefined ? {} : { status })).toEqual({ text: 'We couldn’t ask the AI. Try again.', kind: 'retryable' });
    }
  });
});

describe('Q2, deciding', () => {
  const confirm = { decision: 'confirm' } as const;
  const rows = [
    ['QUESTIONNAIRE_RELEASED', 'This questionnaire has been released. Return it to analyst review before you confirm proposals.'],
    ['AI_PROPOSAL_STALE', 'This question has changed since the AI proposed this, so it can’t be confirmed. Reject it, or ask the AI again.'],
    ['AI_PROPOSAL_ALREADY_DECIDED', 'This proposal is no longer open. Refresh the page to see where it stands.'],
    ['ANSWERED_QUESTION_AFFECTED', 'Confirming this would change or hide an answered question, so it wasn’t applied. Reject it, or edit it so answered questions stay as they are.'],
    ['DEFINITION_INVALID', 'Confirming this would make the questionnaire inconsistent, so it wasn’t applied. Edit it before confirming, or reject it.'],
    ['ASSESSMENT_STARTED', 'An assessment has been drafted from this questionnaire, so its questions can no longer change.'],
    ['ASSESSMENT_DRAFT_IN_PROGRESS', 'An assessment draft is being generated, so this questionnaire can’t change.'],
    ['HISTORY_UNAVAILABLE', 'This questionnaire’s change history can’t record more changes, so your decision wasn’t recorded. Contact your administrator.'],
  ] as const;

  it.each(rows)('409 %s', (reason, text) => {
    expect(aiProposalDecisionRefusalCopy({ status: 409, reason }, confirm)).toEqual({ text, kind: 'blocked' });
  });

  it('reads OWN_REQUEST with Q1’s sentence, and the two dependency rules with family H’s', () => {
    expect(aiProposalDecisionRefusalCopy({ status: 403, reason: 'OWN_REQUEST' }, confirm)).toEqual({ text: 'A Security Analyst can’t steer the AI on a request they raised. Another Security Analyst handles it.', kind: 'blocked' });
    for (const reason of ['QUESTION_HAS_DEPENDENTS', 'LAST_ACTIVE_QUESTION'] as const) {
      expect(aiProposalDecisionRefusalCopy({ status: 409, reason }, confirm)).toEqual({ text: refusalMessage('questionDelete', reason), kind: 'blocked' });
    }
  });

  it('words an unavailable Undo by what it would undo', () => {
    expect(aiProposalDecisionRefusalCopy({ status: 409, reason: 'AI_PROPOSAL_UNDO_UNAVAILABLE' }, { decision: 'undo-confirmation' }).text)
      .toBe('This question has changed since the proposal was confirmed, so it can’t be undone here. Change it in the question editor instead.');
    expect(aiProposalDecisionRefusalCopy({ status: 409, reason: 'AI_PROPOSAL_UNDO_UNAVAILABLE' }, { decision: 'undo-rejection' }).text)
      .toBe('This proposal can no longer be reopened, because the questionnaire has moved on.');
  });

  it('reads the status rows: 400, 403, 404, a 409 without a listed reason, and a network failure or 5xx', () => {
    expect(aiProposalDecisionRefusalCopy({ status: 400 }, confirm)).toEqual({ text: 'This proposal is no longer on the questionnaire. Refresh the page to see the current proposals.', kind: 'blocked' });
    expect(aiProposalDecisionRefusalCopy({ status: 403 }, confirm)).toEqual({ text: 'You can’t decide AI proposals on this questionnaire.', kind: 'blocked' });
    expect(aiProposalDecisionRefusalCopy({ status: 404 }, confirm)).toEqual({ text: 'These proposals couldn’t be found. Refresh the page.', kind: 'blocked' });
    expect(aiProposalDecisionRefusalCopy({ status: 409 }, { decision: 'reject' })).toEqual({ text: 'Your decision can’t be recorded in this questionnaire’s current state.', kind: 'blocked' });
    expect(aiProposalDecisionRefusalCopy({ status: 502 }, confirm)).toEqual({ text: 'We couldn’t record your decision. Try again.', kind: 'retryable' });
    expect(aiProposalDecisionRefusalCopy({}, confirm)).toEqual({ text: 'We couldn’t record your decision. Try again.', kind: 'retryable' });
  });
});

describe('Q3, job failure codes', () => {
  it('reads each code’s sentence', () => {
    expect(aiProposalJobFailureCopy('PROVIDER_OUTPUT_INVALID', null)).toBe('The AI’s reply couldn’t be read, so nothing was proposed. Try again.');
    for (const code of ['QUESTIONNAIRE_NOT_SUBMITTED', 'QUESTIONNAIRE_RELEASED']) {
      expect(aiProposalJobFailureCopy(code, null)).toBe('The questionnaire changed before the AI started, so nothing was sent. Refresh the page to see where it stands.');
    }
    for (const code of ['ASSESSMENT_STARTED', 'ASSESSMENT_DRAFT_IN_PROGRESS']) {
      expect(aiProposalJobFailureCopy(code, null)).toBe('An assessment draft was started, so the questionnaire can no longer change and nothing was sent.');
    }
    for (const code of ['QUESTION_ANSWERED', 'QUESTION_REMOVED']) {
      expect(aiProposalJobFailureCopy(code, null)).toBe('The question was answered or removed before the AI started, so nothing was sent.');
    }
    expect(aiProposalJobFailureCopy('AI_PROPOSAL_RUN_LIMIT', null)).toBe(aiProposalStartRefusalCopy({ status: 409, reason: 'AI_PROPOSAL_RUN_LIMIT' }).text);
    expect(aiProposalJobFailureCopy('HISTORY_UNAVAILABLE', null)).toBe(aiProposalStartRefusalCopy({ status: 409, reason: 'HISTORY_UNAVAILABLE' }).text);
  });

  it('reads a restart’s interruption, whatever the code', () => {
    expect(aiProposalJobFailureCopy(null, null, { interrupted: true })).toBe('The AI request stopped when CSRM restarted, so nothing was proposed. Try again.');
  });

  it('reads the policy codes with 12 §11.2, CONTEXT_TOO_LARGE with Q1’s sentence (the shared rule’s case c), and any other code with the served message', () => {
    expect(aiProposalJobFailureCopy('AI_POLICY_NOT_CONFIGURED', 'served')).toBe('The AI provider isn’t approved for any information classification yet, so nothing was sent to the AI. Contact your administrator.');
    expect(aiProposalJobFailureCopy('AI_CLASSIFICATION_ABOVE_CEILING', 'served')).toBe('This request’s information is now classified above the limit the AI provider is approved for, so nothing was sent to the AI. Contact your administrator.');
    expect(aiProposalJobFailureCopy('CONTEXT_TOO_LARGE', 'The request is too large for this operation.')).toBe('This questionnaire and its request hold more than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.');
    expect(aiProposalJobFailureCopy('SOMETHING_NEW', 'The provider timed out.')).toBe('The provider timed out.');
    expect(aiProposalJobFailureCopy('constructor', null)).toBeNull();
  });
});
