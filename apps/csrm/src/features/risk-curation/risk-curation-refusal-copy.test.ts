import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { requestDeletionRefusal, riskAiStartRefusal, riskCurationRefusal, riskDecisionRefusal, riskProposalJobFailureCopy } from './risk-curation-refusal-copy';

describe('family R1: withdraw, reinstate, history and edits on a withdrawn Risk (UI-SPEC §13)', () => {
  it('names what did not happen when the assessment can no longer change', () => {
    expect(riskCurationRefusal({ status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' }, 'withdraw')).toEqual({
      message: 'This assessment can no longer be changed, so the risk wasn’t withdrawn. Refresh the page to see its current state.',
      kind: 'blocked',
    });
    expect(riskCurationRefusal({ status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' }, 'reinstate').message)
      .toBe('This assessment can no longer be changed, so the risk wasn’t reinstated. Refresh the page to see its current state.');
  });

  it('reads RISK_WITHDRAWN the same for an edit, a withdrawal or a reinstatement', () => {
    for (const act of ['edit', 'withdraw', 'reinstate'] as const) {
      expect(riskCurationRefusal({ status: 409, reason: 'RISK_WITHDRAWN' }, act)).toEqual({
        message: 'This risk has been withdrawn, so it can’t be changed. Reinstate it to change it.',
        kind: 'blocked',
      });
    }
  });

  it('reads RISK_NOT_WITHDRAWN, 403, 404 and an unknown 409 as blocked', () => {
    expect(riskCurationRefusal({ status: 409, reason: 'RISK_NOT_WITHDRAWN' }, 'reinstate'))
      .toEqual({ message: 'This risk is already in the assessment. Refresh the page to see it.', kind: 'blocked' });
    expect(riskCurationRefusal({ status: 403 }, 'withdraw'))
      .toEqual({ message: 'You can’t withdraw or reinstate risks on this assessment.', kind: 'blocked' });
    expect(riskCurationRefusal({ status: 404 }, 'reinstate'))
      .toEqual({ message: 'This risk is no longer on this assessment. Refresh the page.', kind: 'blocked' });
    expect(riskCurationRefusal({ status: 409 }, 'withdraw'))
      .toEqual({ message: 'This change can’t be made in the assessment’s current state.', kind: 'blocked' });
    expect(riskCurationRefusal({ status: 409, reason: 'NOTES_CLOSED' }, 'withdraw'))
      .toEqual({ message: 'This change can’t be made in the assessment’s current state.', kind: 'blocked' });
  });

  it('reads RISK_CURATION_UNDO_UNAVAILABLE on an Undo either way as blocked, pointing to the reasoned act (BE1-03)', () => {
    for (const act of ['withdraw', 'reinstate'] as const) {
      expect(riskCurationRefusal({ status: 409, reason: 'RISK_CURATION_UNDO_UNAVAILABLE' }, act, { undo: true })).toEqual({
        message: 'This can no longer be undone. Withdraw or reinstate the risk with a reason instead.',
        kind: 'blocked',
      });
    }
  });

  it('offers Try again for a network failure, a timeout or a 5xx', () => {
    expect(riskCurationRefusal({}, 'withdraw')).toEqual({ message: 'We couldn’t withdraw the risk. Try again.', kind: 'retryable' });
    expect(riskCurationRefusal({ status: 503 }, 'reinstate')).toEqual({ message: 'We couldn’t reinstate the risk. Try again.', kind: 'retryable' });
  });

  it('reads a 400 as the reason field’s error, with the count when the reason is too long', () => {
    expect(riskCurationRefusal({ status: 400 }, 'withdraw')).toEqual({ message: 'Give a reason for withdrawing this risk.', kind: 'field' });
    expect(riskCurationRefusal({ status: 400 }, 'reinstate', { reasonLength: 612 }))
      .toEqual({ message: 'Keep the reason to 500 characters or fewer. It has 612.', kind: 'field' });
  });

  it('reads the history read’s 403, 404 and failure as §8.5 states', () => {
    expect(riskCurationRefusal({ status: 403 }, 'history')).toEqual({
      message: 'You don’t have access to this history',
      detail: 'Ask a Security Analyst working on this assessment if you need to see how this risk changed.',
      kind: 'blocked',
    });
    expect(riskCurationRefusal({ status: 404 }, 'history')).toEqual({ message: 'This risk’s history isn’t available.', kind: 'blocked' });
    expect(riskCurationRefusal({ status: 500 }, 'history')).toEqual({
      message: 'We couldn’t load the history',
      detail: 'Please try again. If the problem continues, contact your administrator.',
      kind: 'retryable',
    });
  });
});

describe('family R2: asking the AI to suggest or rewrite (UI-SPEC §13)', () => {
  it('reads the instruction reasons as Q1’s field errors, word for word', () => {
    expect(riskAiStartRefusal({ status: 400, reason: 'INSTRUCTION_TOO_LONG' }, { instructionLength: 1_234 }))
      .toEqual({ message: 'Keep the instruction to 500 characters or fewer. It has 1,234.', kind: 'field', field: 'instruction' });
    expect(riskAiStartRefusal({ status: 400, reason: 'INSTRUCTION_CHARACTERS_NOT_ALLOWED' }))
      .toEqual({ message: 'The instruction contains hidden formatting characters CSRM can’t send. Type it again, or paste it as plain text.', kind: 'field', field: 'instruction' });
    expect(riskAiStartRefusal({ status: 400, reason: 'INSTRUCTION_REPEATS_REQUESTOR_TEXT' }).kind).toBe('field');
  });

  it('reads each blocking reason in R2’s words', () => {
    expect(riskAiStartRefusal({ status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' }))
      .toEqual({ message: 'This assessment can no longer be changed, so the AI can’t be asked about it.', kind: 'blocked' });
    expect(riskAiStartRefusal({ status: 409, reason: 'RISK_WITHDRAWN' }))
      .toEqual({ message: 'This risk has been withdrawn, so the AI can’t rewrite it. Reinstate it first.', kind: 'blocked' });
    expect(riskAiStartRefusal({ status: 409, reason: 'CONTEXT_TOO_LARGE' }))
      .toEqual({ message: 'This assessment holds more risks and earlier proposals than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.', kind: 'blocked' });
    expect(riskAiStartRefusal({ status: 409, reason: 'AI_PROPOSAL_RUN_LIMIT' }))
      .toEqual({ message: 'This assessment has reached the most AI requests it can keep, so the AI can’t be asked again. Contact your administrator.', kind: 'blocked' });
    expect(riskAiStartRefusal({ status: 403, reason: 'OWN_REQUEST' }))
      .toEqual({ message: 'A Security Analyst can’t steer the AI on a request they raised. Another Security Analyst handles it.', kind: 'blocked' });
    expect(riskAiStartRefusal({ status: 409, reason: 'AI_POLICY_NOT_CONFIGURED' }).kind).toBe('blocked');
    expect(riskAiStartRefusal({ status: 409, reason: 'AI_POLICY_NOT_CONFIGURED' }).message).not.toBe('The AI can’t be asked in this assessment’s current state.');
  });

  it('reads the focus 400, 403, 404, an unknown 409 and a failure', () => {
    expect(riskAiStartRefusal({ status: 400 }, { operation: 'rewrite' })).toEqual({ message: 'Choose at least one part to rewrite.', kind: 'field', field: 'focus' });
    expect(riskAiStartRefusal({ status: 403 })).toEqual({ message: 'You can’t ask the AI about this assessment.', kind: 'blocked' });
    expect(riskAiStartRefusal({ status: 404 })).toEqual({ message: 'This assessment is no longer available.', kind: 'blocked' });
    expect(riskAiStartRefusal({ status: 409 })).toEqual({ message: 'The AI can’t be asked in this assessment’s current state.', kind: 'blocked' });
    expect(riskAiStartRefusal({ status: 400 }, { operation: 'suggest' })).toEqual({ message: 'The AI can’t be asked in this assessment’s current state.', kind: 'blocked' });
    expect(riskAiStartRefusal({})).toEqual({ message: 'We couldn’t ask the AI. Try again.', kind: 'retryable' });
  });
});

describe('family R3: deciding a proposal (UI-SPEC §13)', () => {
  const context = { riskNumber: 'R-0001', label: 'Risk statement' };

  it('reads each listed reason in R3’s words, filling the Risk number and the label', () => {
    expect(riskDecisionRefusal({ status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' }, context))
      .toEqual({ message: 'This assessment can no longer be changed, so your review wasn’t recorded. Refresh the page to see its current state.', kind: 'blocked' });
    expect(riskDecisionRefusal({ status: 409, reason: 'RISK_WITHDRAWN' }, context))
      .toEqual({ message: 'R-0001 has been withdrawn, so its AI changes can’t be confirmed. Reinstate it first.', kind: 'blocked' });
    expect(riskDecisionRefusal({ status: 409, reason: 'AI_PROPOSAL_STALE' }, context))
      .toEqual({ message: 'Risk statement has changed since the AI proposed this, so it can’t be confirmed. Reject it, or rewrite the risk again.', kind: 'blocked' });
    expect(riskDecisionRefusal({ status: 409, reason: 'AI_PROPOSAL_ALREADY_DECIDED' }, context))
      .toEqual({ message: 'This proposal is no longer open. Refresh the page to see where it stands.', kind: 'blocked' });
    expect(riskDecisionRefusal({ status: 409, reason: 'AI_ACCEPT_NOT_PERMITTED' }, context)).toEqual({
      message: 'Accept can be confirmed only while the residual rating is Low or Moderate and the risk has no planned mitigation control, so it wasn’t applied. Reject it, or change the treatment yourself.',
      kind: 'blocked',
    });
    expect(riskDecisionRefusal({ status: 403, reason: 'OWN_REQUEST' }, context))
      .toEqual({ message: 'A Security Analyst can’t steer the AI on a request they raised. Another Security Analyst handles it.', kind: 'blocked' });
  });

  it('reads a refused Undo by what it would have undone, a stale restore included', () => {
    expect(riskDecisionRefusal({ status: 409, reason: 'AI_PROPOSAL_UNDO_UNAVAILABLE' }, { ...context, intent: 'undo-confirmation' }))
      .toEqual({ message: 'Risk statement has changed since the change was confirmed, so it can’t be undone here. Change it in the risk form instead.', kind: 'blocked' });
    expect(riskDecisionRefusal({ status: 409, reason: 'AI_PROPOSAL_STALE' }, { ...context, intent: 'undo-confirmation' }).message)
      .toBe('Risk statement has changed since the change was confirmed, so it can’t be undone here. Change it in the risk form instead.');
    expect(riskDecisionRefusal({ status: 409, reason: 'AI_PROPOSAL_UNDO_UNAVAILABLE' }, { ...context, intent: 'undo-rejection' }))
      .toEqual({ message: 'This proposal can no longer be reopened, because the assessment has moved on.', kind: 'blocked' });
  });

  it('reads a 400, 403, 404, an unknown 409 and a failure', () => {
    expect(riskDecisionRefusal({ status: 400 }, context)).toEqual({ message: 'This proposal is no longer on the assessment. Refresh the page to see the current proposals.', kind: 'blocked' });
    expect(riskDecisionRefusal({ status: 403 }, context)).toEqual({ message: 'You can’t decide AI proposals on this assessment.', kind: 'blocked' });
    expect(riskDecisionRefusal({ status: 404 }, context)).toEqual({ message: 'These proposals couldn’t be found. Refresh the page.', kind: 'blocked' });
    expect(riskDecisionRefusal({ status: 409 }, context)).toEqual({ message: 'Your decision can’t be recorded in this assessment’s current state.', kind: 'blocked' });
    expect(riskDecisionRefusal({ status: 502 }, context)).toEqual({ message: 'We couldn’t record your decision. Try again.', kind: 'retryable' });
  });
});

describe('family R4: a failed proposal job (UI-SPEC §13)', () => {
  const job = (failureCode: string | null, failureMessage: string | null = 'The served message.') => ({ failureCode, failureMessage });

  it('reads each code in R4’s words, filling the Risk number', () => {
    expect(riskProposalJobFailureCopy(job('PROVIDER_OUTPUT_INVALID'), 'R-0001')).toBe('The AI’s reply couldn’t be read, so nothing was proposed. Try again.');
    expect(riskProposalJobFailureCopy(job('ASSESSMENT_NOT_MUTABLE'), null)).toBe('The assessment stopped being editable before the AI started, so nothing was sent.');
    expect(riskProposalJobFailureCopy(job('RISK_WITHDRAWN'), 'R-0001')).toBe('R-0001 was withdrawn before the AI started, so nothing was sent.');
    expect(riskProposalJobFailureCopy(job('CONTEXT_TOO_LARGE'), null))
      .toBe('This assessment holds more risks and earlier proposals than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.');
    expect(riskProposalJobFailureCopy(job('AI_PROPOSAL_RUN_LIMIT'), null))
      .toBe('This assessment has reached the most AI requests it can keep, so the AI can’t be asked again. Contact your administrator.');
  });

  it('reads the policy codes, any other code and no code', () => {
    expect(riskProposalJobFailureCopy(job('AI_POLICY_NOT_CONFIGURED'), null)).not.toBe('The served message.');
    expect(riskProposalJobFailureCopy(job('AI_POLICY_NOT_CONFIGURED'), null)).toBeTruthy();
    expect(riskProposalJobFailureCopy(job('SOMETHING_ELSE'), null)).toBe('The served message.');
    expect(riskProposalJobFailureCopy(job('constructor'), null)).toBe('The served message.');
    expect(riskProposalJobFailureCopy(job(null, null), null)).toBeNull();
  });
});

describe('the request-deletion line (UI-SPEC §13 R1; UI-D34)', () => {
  it('reads REQUEST_HAS_ASSESSMENT, and nothing for any other refusal', () => {
    expect(requestDeletionRefusal({ status: 409, reason: 'REQUEST_HAS_ASSESSMENT' }))
      .toEqual({ message: 'This request has a risk assessment, so it can’t be deleted. The assessment and its risks are kept.', kind: 'blocked' });
    expect(requestDeletionRefusal({ status: 409, reason: 'REQUEST_HAS_NOTES' })).toBeNull();
    expect(requestDeletionRefusal({ status: 500 })).toBeNull();
  });
});

describe('the family R module', () => {
  it('imports no zod and carries no directive, so Server Actions and client components share it', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/risk-curation/risk-curation-refusal-copy.ts'), 'utf8');
    expect(source).not.toMatch(/from 'zod'/);
    expect(source).not.toMatch(/^'use (client|server)'/m);
  });
});
