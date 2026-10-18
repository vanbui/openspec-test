import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFLICT_REASONS, type ConflictReason } from './conflict-reasons';
import { aiDecisionRefusalCopy, aiPolicyRefusalCopy, answerSaveRefusal, assessmentDraftJobFailureCopy, questionnaireJobFailureCopy, attachmentAddRefusal, attachmentAiRefusal, attachmentFileRefusal, assessmentEditRefusalMessage, downloadCheckFailedMessage, downloadFailureTitle, assignmentRefusal, noteAiInputRefusal, noteRefusal, refusalMessage, requestConflictMessage, type RefusalFamily } from './refusal-copy';

const modulePath = resolve(process.cwd(), 'src/lib/api/refusal-copy.ts');

/*
 * UI-SPEC §10.2 and §10.3, verbatim. Each family maps the served reason to its sentence; any other
 * reason, or none, reads the family's fallback, which never asks for a reload (D-22).
 */
const families: Record<RefusalFamily, { rows: Partial<Record<ConflictReason, string>>; fallback: string }> = {
  requestRevert: {
    rows: {
      REQUEST_NOT_SUBMITTED: 'Only a submitted request can return to draft, and this one is no longer submitted. Refresh the page to see where it is.',
      REQUEST_WORK_STARTED: 'Work on this request has started, so it can no longer return to draft.',
    },
    fallback: 'This request can’t return to draft in its current state.',
  },
  questionnaireRevert: {
    rows: {
      ASSESSMENT_STARTED: 'Assessment work has started, so this questionnaire can no longer return to draft.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can no longer return to draft.',
      QUESTIONNAIRE_NOT_SUBMITTED: 'Only a submitted questionnaire can return to draft, and this one isn’t submitted. Refresh the page to see where it is.',
    },
    fallback: 'This questionnaire can’t return to draft in its current state.',
  },
  questionnaireSubmit: {
    rows: {
      QUESTIONNAIRE_INCOMPLETE: 'Some required questions are unanswered. Answer them, then submit again.',
      QUESTIONNAIRE_ALREADY_SUBMITTED: 'This questionnaire has already been submitted.',
      /* 15-UI-SPEC §11.2 (UI-D25): the analyst took it back to update it. */
      QUESTIONNAIRE_NOT_ANSWERABLE: 'A Security Analyst has taken this questionnaire back to update it, so it can’t be submitted now. Your answers are kept, and you can submit when it’s sent back to you.',
      QUESTIONNAIRE_HAS_NO_QUESTIONS: 'This questionnaire has no questions to answer.',
    },
    fallback: 'This questionnaire can’t be submitted in its current state.',
  },
  questionnaireRelease: {
    rows: {
      QUESTIONNAIRE_RELEASED: 'This questionnaire has already been released.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can’t be released.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can’t be released.',
      QUESTIONNAIRE_HAS_NO_QUESTIONS: 'Add at least one question before you release this questionnaire.',
      DEFINITION_INVALID: 'Some questions in this questionnaire are inconsistent, so it can’t be released. Contact your administrator.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t be released. Contact your administrator.',
      /* 15-UI-SPEC §13, family E's addition. */
      AI_PROPOSALS_OPEN: 'This questionnaire has open AI proposals. Decide them before you release it.',
    },
    fallback: 'This questionnaire can’t be released in its current state.',
  },
  returnToReview: {
    rows: {
      ALREADY_IN_ANALYST_REVIEW: 'This questionnaire is already in analyst review. Refresh the page to see it.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can no longer return to analyst review.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can no longer return to analyst review.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t return to analyst review. Contact your administrator.',
    },
    fallback: 'This questionnaire can’t return to analyst review in its current state.',
  },
  questionChange: {
    rows: {
      DEFINITION_CONFLICT: 'Another change reached this questionnaire first, so this question couldn’t be saved where you placed it. Reload the questions, then save again.',
      QUESTIONNAIRE_RELEASED: 'This questionnaire has been released. Return it to analyst review before changing its questions.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so its questions can no longer change.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire’s questions can no longer change.',
      QUESTION_REMOVED: 'This question has been removed. Reload the questions to see the current list.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes. Contact your administrator.',
      ANSWER_DATA_INVALID: 'A stored answer to this question is invalid, so the change can’t be saved. Contact your administrator.',
    },
    fallback: 'This question can’t be saved in the questionnaire’s current state.',
  },
  questionDelete: {
    rows: {
      QUESTION_HAS_DEPENDENTS: 'Another question is shown only after this one is answered. Change or remove that question first.',
      LAST_ACTIVE_QUESTION: 'A questionnaire needs at least one question, so its last question can’t be removed.',
      QUESTION_REMOVED: 'This question has already been removed. Reload the page to see the current list.',
      /* §10.2 H: these five read as in G. */
      QUESTIONNAIRE_RELEASED: 'This questionnaire has been released. Return it to analyst review before changing its questions.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so its questions can no longer change.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire’s questions can no longer change.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes. Contact your administrator.',
      ANSWER_DATA_INVALID: 'A stored answer to this question is invalid, so the change can’t be saved. Contact your administrator.',
    },
    fallback: 'This question can’t be removed in the questionnaire’s current state.',
  },
  questionnaireGeneration: {
    rows: {
      AI_CLASSIFICATION_ABOVE_CEILING: 'This request’s information is classified above the limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.',
      AI_POLICY_NOT_CONFIGURED: 'The AI provider hasn’t been approved for any information classification yet, so nothing can be sent to it. Contact your administrator.',
      REQUEST_NOT_ELIGIBLE: 'A questionnaire can be generated only while the request is submitted, and this request has moved on.',
      QUESTIONNAIRE_RELEASED: 'This questionnaire has been released to the Requestor, so it can’t be replaced. Return it to analyst review first.',
      /* 15-UI-SPEC §13, family I's additions (§8.3's lines). */
      AI_PROPOSALS_OPEN: 'This questionnaire has open AI proposals, so it can’t be replaced. Decide them first.',
      QUESTIONNAIRE_HAS_ANALYST_CHANGES: 'Analysts have changed this questionnaire since it was generated, so replacing it would discard their work. Use AI proposals to change it instead.',
      QUESTIONNAIRE_ANSWERED: 'The Requestor has answered this questionnaire, so it can’t be replaced. Ask the AI for follow-up questions instead.',
      OWN_REQUEST: 'A Security Analyst can’t give the AI an instruction on a request they raised. Generate without one, or ask another Security Analyst.',
    },
    fallback: 'A questionnaire can’t be generated for this request in its current state.',
  },
  /*
   * WR-205: generating an assessment draft (start or retry). Not a UI-SPEC §10.2 family: its refusals read the
   * card's own precondition (§12.2) and the §10.2 E and F wording for an assessment that already exists, and the
   * fallback follows §10.2's pattern, so a draft refusal never says the assessment changed (D-22).
   */
  assessmentDraft: {
    rows: {
      AI_CLASSIFICATION_ABOVE_CEILING: 'This request’s information is classified above the limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.',
      AI_POLICY_NOT_CONFIGURED: 'The AI provider hasn’t been approved for any information classification yet, so nothing can be sent to it. Contact your administrator.',
      QUESTIONNAIRE_NOT_SUBMITTED: 'Draft generation can begin only after the linked questionnaire is submitted.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so a draft can’t be generated.',
      /* 15-UI-SPEC §13, the draft card's addition. */
      AI_PROPOSALS_OPEN: 'The questionnaire has open AI proposals. Decide them before you generate the draft.',
    },
    fallback: 'An assessment draft can’t be generated for this questionnaire in its current state.',
  },
  /* K. Request assignment (13-UI-SPEC §7.4): the sentences that name nobody; assignmentRefusal fills the names. */
  requestAssignment: {
    rows: {
      OWN_REQUEST: 'A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.',
      REQUEST_NOT_SUBMITTED: 'This request is a draft now, so its assignment can’t change. Refresh the page to see where it is.',
      ASSIGNMENT_REQUIRED: 'A released request keeps an assigned Security Analyst. Reassign it instead.',
    },
    fallback: 'This request’s assignment can’t change in its current state.',
  },
  /* L. Add a note (13-UI-SPEC §9.5): the two refusals that name a rule; noteRefusal adds the status sentences. */
  requestNotes: {
    rows: {
      NOTES_CLOSED: 'Notes are closed on this request now, so your note wasn’t added. Your text is kept below.',
      NOTES_LIMIT_REACHED: 'This request has reached its limit of 500 notes, so your note wasn’t added.',
    },
    fallback: 'You can’t add notes to this request.',
  },
  /* M. Mark a note as changing the AI inputs (13-UI-SPEC §10.4): OWN_REQUEST names its rule; every 409 reads the fallback. */
  noteAiInput: {
    rows: {
      OWN_REQUEST: 'A Security Analyst can’t change the AI inputs of a request they raised.',
    },
    fallback: 'This note’s mark can’t change now. Refresh the page.',
  },
};

const familyNames = Object.keys(families) as RefusalFamily[];

describe('AI data policy refusal copy', () => {
  it('names the request classification and approved limit when served', () => {
    expect(aiPolicyRefusalCopy('AI_CLASSIFICATION_ABOVE_CEILING', { requestClassification: 'Restricted', ceiling: 'Public' }))
      .toBe('This request’s information is classified Restricted, above the Public limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.');
  });
  /*
   * WR-408, IN-303 (12-UI-SPEC §11.3, D-28): a refusal at enqueue reads §11.1's description, never the §11.2 sentence
   * of a job that ran ("now classified", "nothing was sent"). Without the policy's details it keeps §11.1's words,
   * and the cards supply the details from the policy as it stands (see the card tests).
   */
  it('uses §11.1’s fixed refusal, never the job failure sentence, when policy details are absent', () => {
    expect(aiPolicyRefusalCopy('AI_CLASSIFICATION_ABOVE_CEILING')).toBe('This request’s information is classified above the limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.');
    expect(aiPolicyRefusalCopy('AI_CLASSIFICATION_ABOVE_CEILING', { requestClassification: 'Restricted', ceiling: null })).toBe(aiPolicyRefusalCopy('AI_CLASSIFICATION_ABOVE_CEILING'));
    expect(aiPolicyRefusalCopy('AI_CLASSIFICATION_ABOVE_CEILING')).not.toMatch(/now classified|nothing was sent/);
    for (const family of ['questionnaireGeneration', 'assessmentDraft'] as const) {
      expect(refusalMessage(family, 'AI_CLASSIFICATION_ABOVE_CEILING')).toBe(aiPolicyRefusalCopy('AI_CLASSIFICATION_ABOVE_CEILING'));
      expect(refusalMessage(family, 'AI_POLICY_NOT_CONFIGURED')).toBe(aiPolicyRefusalCopy('AI_POLICY_NOT_CONFIGURED'));
    }
    expect(aiPolicyRefusalCopy('AI_POLICY_NOT_CONFIGURED')).toBe(families.assessmentDraft.rows.AI_POLICY_NOT_CONFIGURED);
  });
});

describe('refusal copy by action and reason (UI-SPEC §10.2)', () => {
  for (const family of familyNames) {
    const { rows, fallback } = families[family];

    it.each(Object.entries(rows) as [ConflictReason, string][])(`${family}: %s reads its §10.2 sentence`, (reason, copy) => {
      expect(refusalMessage(family, reason)).toBe(copy);
    });

    it(`${family}: no reason, or a reason the family does not list, reads the fallback`, () => {
      expect(refusalMessage(family)).toBe(fallback);
      expect(refusalMessage(family, undefined)).toBe(fallback);
      for (const reason of CONFLICT_REASONS.filter((code) => !(code in rows))) {
        expect(refusalMessage(family, reason), `${family} ${reason}`).toBe(fallback);
      }
    });
  }

  it('reads the request revert sentences the tracer names', () => {
    expect(refusalMessage('requestRevert', 'REQUEST_WORK_STARTED')).toBe('Work on this request has started, so it can no longer return to draft.');
    expect(refusalMessage('requestRevert')).toBe('This request can’t return to draft in its current state.');
  });

  it('gives a request conflict outside the D-22 families the §10.3 sentence', () => {
    expect(requestConflictMessage).toBe('This request can’t be saved in its current state.');
  });
});

describe('answer save refusal (UI-SPEC §10.2 C and §6.1)', () => {
  it.each([
    ['QUESTIONNAIRE_NOT_ANSWERABLE', 'A Security Analyst has taken this questionnaire back to update it, so your latest answers weren’t saved. They’re kept on this page, and you can carry on when it’s sent back to you.'],
    ['QUESTIONNAIRE_ALREADY_SUBMITTED', 'This questionnaire has already been submitted, so your latest answers weren’t saved. Refresh the page to see the submitted answers.'],
    ['QUESTIONNAIRE_HAS_NO_QUESTIONS', 'This questionnaire has no questions to answer.'],
  ] as const)('a 409 %s is blocked with its sentence', (reason, message) => {
    expect(answerSaveRefusal(409, reason)).toEqual({ message, failure: 'blocked' });
  });

  it('a 409 with no reason, or one the save does not list, is blocked with the fallback', () => {
    const fallback = { message: 'Your answers can’t be saved in this questionnaire’s current state.', failure: 'blocked' };
    expect(answerSaveRefusal(409)).toEqual(fallback);
    expect(answerSaveRefusal(409, 'QUESTION_REMOVED')).toEqual(fallback);
  });

  it('a 403 is blocked and asks for a refresh, not a permission', () => {
    expect(answerSaveRefusal(403)).toEqual({
      message: 'You can’t save answers to this questionnaire right now. Refresh the page to see its current state.',
      failure: 'blocked',
    });
  });

  it('a 400 is retryable: the answers need attention', () => {
    expect(answerSaveRefusal(400)).toEqual({ message: 'Some answers need attention before they can be saved.', failure: 'retryable' });
  });

  it('a 404 is blocked: the questionnaire is gone, so retrying cannot help', () => {
    expect(answerSaveRefusal(404)).toEqual({ message: 'This questionnaire is no longer available.', failure: 'blocked' });
  });

  it.each([500, 502, 503, 504, undefined])('a %s or a transport failure is retryable', (status) => {
    expect(answerSaveRefusal(status)).toEqual({ message: 'The questionnaire service is unavailable. Please try again later.', failure: 'retryable' });
  });
});

describe('refusal copy module (UI-SPEC §10.3)', () => {
  const source = () => readFileSync(modulePath, 'utf8');

  it('never asks for a reload in the old words', () => {
    expect(source()).not.toMatch(/Reload and try again/);
    expect(source()).not.toMatch(/changed while you were editing/);
  });

  it('is zod-free, has no directive and imports only the reason type', () => {
    const text = source();
    expect(text).not.toMatch(/['"]use (server|client)['"]/);
    expect(text).not.toMatch(/from ['"]zod['"]/);
    const imports = text.match(/^import .*$/gm) ?? [];
    expect(imports).toEqual([expect.stringMatching(/^import type \{ ConflictReason \} from '\.\/conflict-reasons';$/)]);
  });

  it('uses the typographic apostrophe in every sentence', () => {
    const sentences = familyNames.flatMap((family) => [refusalMessage(family), ...CONFLICT_REASONS.map((reason) => refusalMessage(family, reason))]);
    for (const sentence of sentences) expect(sentence).not.toContain("'");
  });
});

/* 12-UI-SPEC §6.3 family J, UI-D12 and the G-14 addition, verbatim. */
describe('aiDecisionRefusalCopy', () => {
  it.each([
    [{ status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' }, 'This assessment can no longer be changed, so your review wasn’t recorded. Refresh the page to see its current state.', 'blocked'],
    /* 15-UI-SPEC §13 (UI-D29): family J reads Q2's neutral sentence. */
    [{ status: 409, reason: 'AI_PROPOSAL_ALREADY_DECIDED' }, 'This proposal is no longer open. Refresh the page to see where it stands.', 'blocked'],
    [{ status: 409, reason: 'AI_SUGGESTION_CONTROL_CHANGED' }, 'The planned control has changed since it was added, so it stays. Remove it from the risk if it should go.', 'blocked'],
    [{ status: 409, reason: 'AI_ACCEPT_WITH_PLANNED_CONTROL' }, 'This Risk has a planned control, so the AI’s proposed Accept can’t be confirmed. Change the treatment action to Treat, or remove the planned control.', 'blocked'],
    /* WR-103: the review history can't take the decision, so it is refused; retrying can't help. */
    [{ status: 409, reason: 'AI_RUN_RECORD_UNAVAILABLE' }, 'The review history of this assessment’s AI proposals can’t record more changes, so your review wasn’t recorded. Contact your administrator.', 'blocked'],
    [{ status: 400 }, 'This proposal is no longer on the assessment. Refresh the page to see the current proposals.', 'blocked'],
    [{ status: 403 }, 'You can’t review AI proposals on this assessment.', 'blocked'],
    [{ status: 404 }, 'This assessment is no longer available.', 'blocked'],
    [{ status: 409 }, 'Your review can’t be recorded in this assessment’s current state.', 'blocked'],
    [{ status: 409, reason: 'REQUEST_WORK_STARTED' }, 'Your review can’t be recorded in this assessment’s current state.', 'blocked'],
    [{}, 'We couldn’t record your review. Try again.', 'retryable'],
    [{ status: 503 }, 'We couldn’t record your review. Try again.', 'retryable'],
  ] as const)('maps %j to its sentence and kind', (failure, text, kind) => {
    expect(aiDecisionRefusalCopy(failure)).toEqual({ text, kind });
  });
});

/*
 * WR-103: an edit of an AI-proposed field is recorded in the review history of the assessment's AI proposals, so a
 * history that can't take the record refuses the save. The analyst is told why and whom to contact, never that the
 * assessment changed; any other conflict keeps the save's own sentence.
 */
/* 15-UI-SPEC §13: the additions to 10 §12.4 (the questionnaire job) and the draft job's failure. */
describe('generation job failure additions', () => {
  it('reads the questionnaire job’s two Phase 15 codes', () => {
    expect(questionnaireJobFailureCopy('AI_PROPOSALS_OPEN')).toBe('AI proposals were opened before the replacement finished, so the questionnaire wasn’t replaced.');
    expect(questionnaireJobFailureCopy('QUESTIONNAIRE_HAS_ANALYST_CHANGES')).toBe('An analyst changed the questionnaire before the replacement finished, so it wasn’t replaced.');
    expect(questionnaireJobFailureCopy('QUESTIONNAIRE_ANSWERED')).toBeNull();
    expect(questionnaireJobFailureCopy(null)).toBeNull();
  });

  it('reads the draft job’s Phase 15 code', () => {
    expect(assessmentDraftJobFailureCopy('AI_PROPOSALS_OPEN')).toBe('AI proposals were opened on the questionnaire before the draft finished, so no draft was made. Decide them, then generate the draft again.');
    expect(assessmentDraftJobFailureCopy('constructor')).toBeNull();
  });

  it('never imports the Phase 15 module, so families Q1 to Q3 stay off the Requestor’s request page (B-1)', () => {
    expect(readFileSync(modulePath, 'utf8')).not.toMatch(/questionnaire-ai/);
  });

  it('never imports or repeats Phase 16’s family R, so the Requestor’s request page does not grow (B-1)', () => {
    const source = readFileSync(modulePath, 'utf8');
    expect(source).not.toMatch(/risk-curation/);
    expect(source).not.toContain('This risk has been withdrawn');
  });
});

describe('assessmentEditRefusalMessage', () => {
  it('names the review history and whom to contact for AI_RUN_RECORD_UNAVAILABLE', () => {
    expect(assessmentEditRefusalMessage('AI_RUN_RECORD_UNAVAILABLE'))
      .toBe('The review history of this assessment’s AI proposals can’t record more changes, so your changes weren’t saved. Contact your administrator.');
  });

  it('leaves every other conflict, or none, to the save’s own sentence', () => {
    expect(assessmentEditRefusalMessage()).toBeUndefined();
    for (const reason of CONFLICT_REASONS.filter((code) => code !== 'AI_RUN_RECORD_UNAVAILABLE')) {
      expect(assessmentEditRefusalMessage(reason), reason).toBeUndefined();
    }
  });
});

/* 13-UI-SPEC §7.4, family K, verbatim: each sentence with its kind. */
describe('assignmentRefusal (family K)', () => {
  const blocked = (message: string) => ({ message, kind: 'blocked' });

  it('names who holds the request now when the assignment changed, or says it went back to the queue', () => {
    expect(assignmentRefusal('ASSIGNMENT_CHANGED', { holderName: 'Second Analyst' }, 409))
      .toEqual(blocked('Second Analyst now holds this request, so your change wasn’t made.'));
    expect(assignmentRefusal('ASSIGNMENT_CHANGED', { holderName: null }, 409))
      .toEqual(blocked('This request was returned to the queue, so your change wasn’t made.'));
  });

  it('names the analyst who can’t be assigned', () => {
    expect(assignmentRefusal('ASSIGNEE_NOT_ELIGIBLE', { targetName: 'Inactive Analyst' }, 409))
      .toEqual(blocked('Inactive Analyst can’t be assigned this request. Choose another Security Analyst.'));
  });

  it.each([
    ['OWN_REQUEST', 403, 'A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.'],
    ['REQUEST_NOT_SUBMITTED', 409, 'This request is a draft now, so its assignment can’t change. Refresh the page to see where it is.'],
    ['ASSIGNMENT_REQUIRED', 409, 'A released request keeps an assigned Security Analyst. Reassign it instead.'],
  ] as const)('reads %s’s sentence', (reason, status, message) => {
    expect(assignmentRefusal(reason, {}, status)).toEqual(blocked(message));
  });

  it('reads the status sentences when no assignment reason was served', () => {
    expect(assignmentRefusal(undefined, {}, 403)).toEqual(blocked('You can’t change who this request is assigned to.'));
    expect(assignmentRefusal(undefined, {}, 404)).toEqual(blocked('This request is no longer available.'));
    expect(assignmentRefusal(undefined, {}, 409)).toEqual(blocked('This request’s assignment can’t change in its current state.'));
    expect(assignmentRefusal('QUESTION_REMOVED', {}, 409)).toEqual(blocked('This request’s assignment can’t change in its current state.'));
    for (const status of [undefined, 500, 502, 503]) {
      expect(assignmentRefusal(undefined, {}, status)).toEqual({ message: 'We couldn’t change the assignment. Try again.', kind: 'retryable' });
    }
  });

  it('never speaks of accepting or releasing an assessment, and uses the typographic apostrophe', () => {
    const sentences = [
      ...CONFLICT_REASONS.map((reason) => assignmentRefusal(reason, { holderName: 'Bob Doe', targetName: 'Bob Doe' }, 409).message),
      ...CONFLICT_REASONS.map((reason) => assignmentRefusal(reason, { holderName: null }, 403).message),
      ...[undefined, 403, 404, 409, 500].map((status) => assignmentRefusal(undefined, {}, status).message),
    ];
    /*
     * IN-503: any case and any form (accept, accepted, Release, released, Releasing), less the one sanctioned phrase
     * (13-UI-SPEC §7.4, ASSIGNMENT_REQUIRED), which names a released request rather than releasing anything.
     */
    const sanctioned = 'A released request keeps an assigned Security Analyst';
    expect(sentences).toContain('A released request keeps an assigned Security Analyst. Reassign it instead.');
    for (const sentence of sentences) {
      expect(sentence.split(sanctioned).join(' ')).not.toMatch(/accept|releas/i);
      expect(sentence).not.toContain("'");
    }
  });
});

/* 13-UI-SPEC §9.5, family L, verbatim: each sentence with its kind. */
describe('noteRefusal (family L)', () => {
  it('reads the closed-window sentence, which keeps the text below, and the limit sentence', () => {
    expect(noteRefusal('NOTES_CLOSED', 409)).toEqual({ kind: 'blocked', message: 'Notes are closed on this request now, so your note wasn’t added. Your text is kept below.' });
    expect(noteRefusal('NOTES_LIMIT_REACHED', 409)).toEqual({ kind: 'blocked', message: 'This request has reached its limit of 500 notes, so your note wasn’t added.' });
  });

  /*
   * IN-401 (13-UI-SPEC §9.5): a 400 is about the note's text, so it reads as a field error under the composer, which the
   * person can fix, never as the 403 permission sentence.
   */
  it('reads a 400 as a field error about the note’s text, not the permission sentence (IN-401)', () => {
    expect(noteRefusal(undefined, 400)).toEqual({
      kind: 'field', message: 'This note can’t be added as written. Check its length and remove any hidden formatting characters.',
    });
  });

  it('reads the status sentences when no notes reason was served', () => {
    expect(noteRefusal(undefined, 403)).toEqual({ kind: 'blocked', message: 'You can’t add notes to this request.' });
    expect(noteRefusal('OWN_REQUEST', 403)).toEqual({ kind: 'blocked', message: 'You can’t add notes to this request.' });
    expect(noteRefusal(undefined, 404)).toEqual({ kind: 'not-found', message: 'This request is no longer available.' });
    expect(noteRefusal(undefined, 409)).toEqual({ kind: 'blocked', message: 'You can’t add notes to this request.' });
    expect(noteRefusal('QUESTION_REMOVED', 409)).toEqual({ kind: 'blocked', message: 'You can’t add notes to this request.' });
    for (const status of [undefined, 500, 502, 503]) {
      expect(noteRefusal(undefined, status)).toEqual({ kind: 'retryable', message: 'We couldn’t add your note. Try again.' });
    }
  });

  it('uses the typographic apostrophe', () => {
    for (const status of [undefined, 400, 403, 404, 409, 500]) {
      for (const reason of [undefined, ...CONFLICT_REASONS]) expect(noteRefusal(reason, status).message).not.toContain("'");
    }
  });
});

/* 13-UI-SPEC §10.4, family M, verbatim: each sentence with its kind. */
describe('noteAiInputRefusal (family M)', () => {
  it('reads the requesting analyst’s sentence for OWN_REQUEST', () => {
    expect(noteAiInputRefusal('OWN_REQUEST', 403)).toEqual({ kind: 'blocked', message: 'A Security Analyst can’t change the AI inputs of a request they raised.' });
  });

  it('reads the status sentences, with every 409 the blocked sentence', () => {
    expect(noteAiInputRefusal(undefined, 403)).toEqual({ kind: 'blocked', message: 'You can’t change the AI inputs on this request.' });
    expect(noteAiInputRefusal(undefined, 404)).toEqual({ kind: 'blocked', message: 'This note is no longer available. Refresh the page.' });
    for (const reason of ['NOTES_CLOSED', 'HISTORY_UNAVAILABLE', 'QUESTION_REMOVED', undefined] as const) {
      expect(noteAiInputRefusal(reason, 409)).toEqual({ kind: 'blocked', message: 'This note’s mark can’t change now. Refresh the page.' });
    }
    for (const status of [undefined, 500, 502, 503]) {
      expect(noteAiInputRefusal(undefined, status)).toEqual({ kind: 'retryable', message: 'We couldn’t change the mark. Try again.' });
    }
  });

  it('uses the typographic apostrophe', () => {
    for (const status of [undefined, 400, 403, 404, 409, 500]) {
      for (const reason of [undefined, ...CONFLICT_REASONS]) expect(noteAiInputRefusal(reason, status).message).not.toContain("'");
    }
  });
});

/*
 * 14-UI-SPEC §8.1, family N: a refused file names what is wrong and what to do next. The malware row carries the
 * detection name the transport kept from the 422 (Orchestrator Confirmations).
 */
describe('attachmentAddRefusal (family N)', () => {
  it('names the malware a 422 found, verbatim, as a refusal', () => {
    expect(attachmentAddRefusal({ status: 422, reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Csrm.Test.Signature' })).toEqual({
      message: 'This file contains malware (Csrm.Test.Signature) and wasn’t added. Don’t open it again, and contact your IT service desk, because your device may be affected.',
      kind: 'refused',
      offerNewNote: false,
    });
  });
});

/* 14-UI-SPEC §1.2's lines, which family N reads for the lifetime bound and an unconfigured file store. */
const lifetimeLimitLine = 'This request has reached the most files it can keep, counting removed ones, so no more can be added.';
const notConfiguredLine = 'Files can’t be added right now because file storage isn’t set up. Contact your administrator.';

/* 14-UI-SPEC §8.1, family N, every row verbatim. */
describe('attachmentAddRefusal (family N, every row)', () => {
  const tooLarge = 'Files can be up to 25 MB, and this one is 30.0 MB. Make it smaller or split it, then add it again.';

  it.each([
    [415, 'ATTACHMENT_TYPE_NOT_ALLOWED', 'This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.'],
    [415, 'ATTACHMENT_CONTENT_MISMATCH', 'This file’s content doesn’t match its name. Check it’s the file you meant, save it in its real format and add it again.'],
    [415, 'ATTACHMENT_MACRO_ENABLED', 'This file contains macros, so it can’t be added. Save it as .docx, .xlsx or .pptx and add it again.'],
    [415, 'ATTACHMENT_ENCRYPTED', 'This file is password-protected, so it can’t be checked for malware. Remove the password and add it again.'],
    [415, 'ATTACHMENT_LEGACY_OFFICE', 'This is an older Office format. Save it as .docx, .xlsx or .pptx and add it again.'],
    [413, 'ATTACHMENT_TOO_LARGE', tooLarge],
    [400, 'ATTACHMENT_EMPTY', 'This file is empty. Check it’s the file you meant and choose it again.'],
    [409, 'ATTACHMENT_LIMIT_REACHED', 'This request already has 20 files. Remove a file to add another.'],
    [409, 'ATTACHMENT_LIFETIME_LIMIT_REACHED', lifetimeLimitLine],
    [409, 'ATTACHMENTS_NOT_CONFIGURED', notConfiguredLine],
    [409, 'ATTACHMENTS_CLOSED', 'Files closed when the assessment was released, so this file wasn’t added.'],
    [409, 'REQUEST_NOT_SUBMITTED', 'This request is a draft now, so files can’t be added. Refresh the page to see where it is.'],
  ] as const)('a %s %s reads its sentence as a refusal', (status, reason, message) => {
    expect(attachmentAddRefusal({ status, reason, sizeLabel: '30.0 MB' })).toEqual({ message, kind: 'refused', offerNewNote: false });
  });

  it.each([
    ['ATTACHMENT_NOTE_REQUIRED', 'This request has been submitted, so files are added with a note. Add the file from the note box.'],
    ['ATTACHMENT_NOTE_INVALID', 'This note can no longer take files. Add the file with a new note.'],
  ] as const)('%s offers Add with a new note', (reason, message) => {
    expect(attachmentAddRefusal({ status: 409, reason })).toEqual({ message, kind: 'refused', offerNewNote: true });
  });

  it('reads an unreasoned 413 as the too-large sentence (14-RESEARCH Pitfall 9)', () => {
    expect(attachmentAddRefusal({ status: 413, sizeLabel: '30.0 MB' })).toEqual({ message: tooLarge, kind: 'refused', offerNewNote: false });
  });

  it('keeps the too-large and malware words when the size or the detection is unknown', () => {
    expect(attachmentAddRefusal({ status: 413 }).message).toBe('Files can be up to 25 MB. Make it smaller or split it, then add it again.');
    expect(attachmentAddRefusal({ status: 422, reason: 'ATTACHMENT_MALWARE_FOUND' }).message).toBe(
      'This file contains malware and wasn’t added. Don’t open it again, and contact your IT service desk, because your device may be affected.',
    );
  });

  it('reads the 400, 403 and 404 rows by status', () => {
    expect(attachmentAddRefusal({ status: 400 })).toEqual({ message: 'This file couldn’t be added. Choose it again.', kind: 'refused', offerNewNote: false });
    expect(attachmentAddRefusal({ status: 403 })).toEqual({ message: 'You can’t add files to this request.', kind: 'refused', offerNewNote: false });
    expect(attachmentAddRefusal({ status: 403, reason: 'OWN_REQUEST' })).toEqual({ message: 'You can’t add files to this request.', kind: 'refused', offerNewNote: false });
    /* The request is gone: the page shows its not-found state on refresh. */
    expect(attachmentAddRefusal({ status: 404 })).toEqual({ message: 'This request is no longer available.', kind: 'blocked', offerNewNote: false });
  });

  it('reads an unlisted 409 as the 403 sentence and any other unreasoned 4xx as the 400 sentence', () => {
    expect(attachmentAddRefusal({ status: 409 }).message).toBe('You can’t add files to this request.');
    expect(attachmentAddRefusal({ status: 409, reason: 'NOTES_CLOSED' }).message).toBe('You can’t add files to this request.');
    expect(attachmentAddRefusal({ status: 415 }).message).toBe('This file couldn’t be added. Choose it again.');
    expect(attachmentAddRefusal({ status: 422 }).message).toBe('This file couldn’t be added. Choose it again.');
  });

  it.each([undefined, 500, 502, 503, 504])('a %s or a transport failure is retryable', (status) => {
    expect(attachmentAddRefusal({ status })).toEqual({ message: 'We couldn’t add this file. Try again.', kind: 'retryable', offerNewNote: false });
  });

  /* The stage B amendment (2026-10-11; 14-UI-SPEC §8.1's dated rows): two refusals with a next step, and a busy queue to retry. */
  it.each([
    ['ATTACHMENT_UNSUPPORTED_STRUCTURE', 'This file is packaged in a way CSRM can’t check. Open it, save a fresh copy, then add the new copy.'],
    ['ATTACHMENT_ACTIVE_CONTENT', 'This file contains active content, such as linked objects or ActiveX controls, so it can’t be added. Remove it, save the file and add it again.'],
  ] as const)('a 415 %s reads its sentence as a refusal', (reason, message) => {
    expect(attachmentAddRefusal({ status: 415, reason })).toEqual({ message, kind: 'refused', offerNewNote: false });
  });

  it('reads a 503 ATTACHMENT_BUSY as the busy sentence, retryable with Retry', () => {
    expect(attachmentAddRefusal({ status: 503, reason: 'ATTACHMENT_BUSY' })).toEqual({ message: 'CSRM is busy checking other files. Try again in a moment.', kind: 'retryable', offerNewNote: false });
  });
});

/*
 * 14-UI-SPEC §8.2, family O, every row verbatim, pinned per action (IN-606): a refused download, removal or restore reads
 * a sentence that answers the action taken (WR-503; amended on 2026-10-11 in stage B). Each action's rows are the reasons
 * Strapi serves for it (request-attachments.ts): the download 409 ATTACHMENT_QUARANTINED, ATTACHMENT_BLOCKED,
 * ATTACHMENT_REMOVED, ATTACHMENT_INTEGRITY_FAILED and ATTACHMENT_UNAVAILABLE; the removal 403 NOT_UPLOADER and 409
 * ATTACHMENTS_CLOSED and REQUEST_NOT_SUBMITTED; the restore 403 NOT_REMOVER and 409 ATTACHMENTS_CLOSED,
 * REQUEST_NOT_SUBMITTED, ATTACHMENT_BLOCKED, ATTACHMENT_LIMIT_REACHED and HISTORY_UNAVAILABLE; and for each a reasonless
 * 403 from the policy, a 404, and a 400 for a malformed call.
 */
describe('attachmentFileRefusal (family O)', () => {
  const statuses = [undefined, 400, 403, 404, 409, 413, 415, 422, 500, 503];
  const everySentence = (action: 'download' | 'remove' | 'restore') =>
    statuses.flatMap((status) => [undefined, ...CONFLICT_REASONS].map((reason) => attachmentFileRefusal(action, { status, reason }).message));

  describe('a refused download', () => {
    it.each([
      ['ATTACHMENT_QUARANTINED', 'This file is still waiting for its malware check. Try again later.'],
      ['ATTACHMENT_BLOCKED', 'Malware was found in this file, so it can’t be downloaded.'],
      ['ATTACHMENT_REMOVED', 'This file was removed, so it can’t be downloaded. Refresh the page.'],
      ['ATTACHMENT_INTEGRITY_FAILED', 'This file doesn’t match the one that was added, so CSRM won’t download it. Contact your administrator.'],
      /* 14-UI-SPEC §3.4's unavailable line: the stored bytes are gone. */
      ['ATTACHMENT_UNAVAILABLE', 'This file can’t be downloaded. Contact your administrator.'],
    ] as const)('a 409 %s reads its sentence, blocked', (reason, message) => {
      expect(attachmentFileRefusal('download', { status: 409, reason })).toEqual({ message, kind: 'blocked' });
    });

    it('reads a 403 as a download the person may not make, never as a change (WR-503, IN-606)', () => {
      expect(attachmentFileRefusal('download', { status: 403 })).toEqual({ message: 'You can’t download this request’s files.', kind: 'blocked' });
    });

    it('reads a 404 as a file that is gone', () => {
      expect(attachmentFileRefusal('download', { status: 404 })).toEqual({ message: 'This file is no longer available. Refresh the page.', kind: 'blocked' });
    });

    it('reads a malformed call, or a 409 it does not list, as a download to try again after a refresh, never as a permission (WR-503)', () => {
      for (const failure of [{ status: 400 }, { status: 409 }, { status: 409, reason: 'NOT_UPLOADER' as const }, { status: 413 }]) {
        expect(attachmentFileRefusal('download', failure), JSON.stringify(failure)).toEqual({ message: 'We couldn’t download the file. Refresh the page, then try again.', kind: 'blocked' });
      }
    });

    it('never speaks of changing, removing or restoring the file, whatever it is refused with', () => {
      for (const sentence of everySentence('download')) expect(sentence).not.toMatch(/\bchange|can’t (be )?remov|restor/i);
    });
  });

  describe('a refused removal', () => {
    it.each([
      [403, 'NOT_UPLOADER', 'Only the person who added this file, or a Security Analyst, can remove it.'],
      [409, 'ATTACHMENTS_CLOSED', 'Files closed when the assessment was released, so this file can’t change.'],
      [409, 'REQUEST_NOT_SUBMITTED', 'This request is a draft now, so its files can’t change. Refresh the page to see where it is.'],
      /* Added to §8.2 on 2026-10-01 during planning (plan 14-05); since WR-101 Strapi never refuses a removal by its history. */
      [409, 'HISTORY_UNAVAILABLE', 'This file’s history is full, so it can’t change any more. Contact your administrator.'],
      /* Strapi answers a removal already made as it is (200); were one refused this way, the sentence answers the removal. */
      [409, 'ATTACHMENT_REMOVED', 'This file was already removed. Refresh the page.'],
    ] as const)('a %s %s reads its sentence, blocked', (status, reason, message) => {
      expect(attachmentFileRefusal('remove', { status, reason })).toEqual({ message, kind: 'blocked' });
    });

    it('reads a 403 and a 404 by status', () => {
      expect(attachmentFileRefusal('remove', { status: 403 })).toEqual({ message: 'You can’t change this request’s files.', kind: 'blocked' });
      expect(attachmentFileRefusal('remove', { status: 404 })).toEqual({ message: 'This file is no longer available. Refresh the page.', kind: 'blocked' });
    });

    it('reads a malformed call, or a 409 it does not list, as a removal to try again after a refresh, never as a permission (WR-503)', () => {
      for (const failure of [{ status: 400 }, { status: 409 }, { status: 409, reason: 'ATTACHMENT_LIMIT_REACHED' as const }]) {
        expect(attachmentFileRefusal('remove', failure), JSON.stringify(failure)).toEqual({ message: 'We couldn’t remove the file. Refresh the page, then try again.', kind: 'blocked' });
      }
    });

    it('never says the file can’t be downloaded or restored, whatever it is refused with', () => {
      for (const sentence of everySentence('remove')) expect(sentence).not.toMatch(/download|restor/i);
    });
  });

  describe('a refused restore', () => {
    it.each([
      [403, 'NOT_REMOVER', 'Only the person who removed this file can restore it.'],
      [409, 'ATTACHMENTS_CLOSED', 'Files closed when the assessment was released, so this file can’t change.'],
      [409, 'REQUEST_NOT_SUBMITTED', 'This request is a draft now, so its files can’t change. Refresh the page to see where it is.'],
      [409, 'ATTACHMENT_LIMIT_REACHED', 'This request already has 20 files. Remove another file before restoring this one.'],
      /* WR-503: a re-scan blocked the file after it was removed, for example between Remove and the toast’s Undo. */
      [409, 'ATTACHMENT_BLOCKED', 'Malware was found in this file, so it can’t be restored.'],
      /* WR-101: a restore adds to the file’s history, so a history within its reserve refuses it. */
      [409, 'HISTORY_UNAVAILABLE', 'This file’s history is full, so it can’t be restored. Contact your administrator.'],
    ] as const)('a %s %s reads its sentence, blocked', (status, reason, message) => {
      expect(attachmentFileRefusal('restore', { status, reason })).toEqual({ message, kind: 'blocked' });
    });

    it('reads a 403 and a 404 by status', () => {
      expect(attachmentFileRefusal('restore', { status: 403 })).toEqual({ message: 'You can’t change this request’s files.', kind: 'blocked' });
      expect(attachmentFileRefusal('restore', { status: 404 })).toEqual({ message: 'This file is no longer available. Refresh the page.', kind: 'blocked' });
    });

    it('reads a malformed call, or a 409 it does not list, as a restore to try again after a refresh, never as a permission (WR-503)', () => {
      for (const failure of [{ status: 400 }, { status: 409 }, { status: 409, reason: 'ATTACHMENT_QUARANTINED' as const }]) {
        expect(attachmentFileRefusal('restore', failure), JSON.stringify(failure)).toEqual({ message: 'We couldn’t restore the file. Refresh the page, then try again.', kind: 'blocked' });
      }
    });

    it('never says the file can’t be downloaded, whatever it is refused with', () => {
      for (const sentence of everySentence('restore')) expect(sentence).not.toMatch(/download/i);
    });
  });

  it.each([undefined, 500, 503])('a %s or a transport failure reads each action’s own retry sentence', (status) => {
    expect(attachmentFileRefusal('download', { status })).toEqual({ message: 'We couldn’t download the file. Try again.', kind: 'retryable' });
    expect(attachmentFileRefusal('remove', { status })).toEqual({ message: 'We couldn’t remove the file. Try again.', kind: 'retryable' });
    expect(attachmentFileRefusal('restore', { status })).toEqual({ message: 'We couldn’t restore the file. Try again.', kind: 'retryable' });
  });

  it('words the web’s own download check and the download toast’s title', () => {
    expect(downloadCheckFailedMessage).toBe('This download didn’t look right, so CSRM stopped it. Try again, or contact your administrator.');
    expect(downloadFailureTitle).toBe('File not downloaded');
  });
});

/* 14-UI-SPEC §8.3, family P, every row verbatim. */
describe('attachmentAiRefusal (family P)', () => {
  it.each([
    [403, 'OWN_REQUEST', 'A Security Analyst can’t change the AI inputs of a request they raised.'],
    [409, 'ATTACHMENT_TEXT_UNAVAILABLE', 'CSRM couldn’t find text in this file, so it can’t be included. A scanned document needs a text layer.'],
    [409, 'ATTACHMENT_NOT_TEXT_BEARING', 'Images can’t be included, because the AI reads text only.'],
    [409, 'ATTACHMENT_QUARANTINED', 'It can be included once it passes the malware check.'],
    [409, 'ATTACHMENT_BLOCKED', 'This file can’t be included any more. Refresh the page.'],
    [409, 'ATTACHMENT_REMOVED', 'This file can’t be included any more. Refresh the page.'],
    [409, 'AI_POLICY_NOT_CONFIGURED', 'Files can’t be included in the AI inputs, because the AI provider hasn’t been approved for any information classification yet. Contact your administrator.'],
    [409, 'ATTACHMENTS_CLOSED', 'The assessment has been released, so what the AI uses can’t change.'],
    [409, 'REQUEST_NOT_SUBMITTED', 'This request is a draft now, so its AI inputs can’t change.'],
    /*
     * Added to §8.3 on 2026-10-11 in stage B (WR-502): an inclusion adds to the file’s history, so a history within its
     * reserve refuses it (WR-101); its stored bytes no longer match their digest (the warning-level integrity event); or
     * the stored bytes are gone, which no refresh can help.
     */
    [409, 'HISTORY_UNAVAILABLE', 'This file’s history is full, so it can’t be included any more. Contact your administrator.'],
    [409, 'ATTACHMENT_INTEGRITY_FAILED', 'This file doesn’t match the one that was added, so CSRM won’t read it. Contact your administrator.'],
    [409, 'ATTACHMENT_UNAVAILABLE', 'This file can’t be read. Contact your administrator.'],
  ] as const)('a %s %s reads its sentence, blocked', (status, reason, message) => {
    expect(attachmentAiRefusal({ status, reason })).toEqual({ message, kind: 'blocked' });
  });

  it('names the classification and the approved limit', () => {
    expect(attachmentAiRefusal({ status: 409, reason: 'AI_CLASSIFICATION_ABOVE_CEILING', classification: 'Confidential', ceiling: 'Official' })).toEqual({
      message: 'Files can’t be included in the AI inputs: this request’s information is classified Confidential, above the Official limit the AI provider is approved for.',
      kind: 'blocked',
    });
  });

  it('keeps the classification sentence’s words when the values are unknown', () => {
    for (const values of [{}, { classification: 'Confidential' }, { classification: 'Confidential', ceiling: null }]) {
      expect(attachmentAiRefusal({ status: 409, reason: 'AI_CLASSIFICATION_ABOVE_CEILING', ...values }).message).toBe(
        'Files can’t be included in the AI inputs: this request’s information is classified above the limit the AI provider is approved for.',
      );
    }
  });

  it('reads the 403 row and a 404 as family O’s', () => {
    expect(attachmentAiRefusal({ status: 403 })).toEqual({ message: 'You can’t change the AI inputs on this request.', kind: 'blocked' });
    expect(attachmentAiRefusal({ status: 404 })).toEqual({ message: 'This file is no longer available. Refresh the page.', kind: 'blocked' });
  });

  /* WR-502: a malformed call, or a 409 the family does not list, is not a permission refusal. */
  it('reads a malformed call, or a 409 it does not list, as a change to try again after a refresh', () => {
    for (const failure of [{ status: 400 }, { status: 409 }, { status: 409, reason: 'NOT_REMOVER' as const }, { status: 413 }]) {
      expect(attachmentAiRefusal(failure), JSON.stringify(failure)).toEqual({ message: 'We couldn’t change whether this file is included. Refresh the page, then try again.', kind: 'blocked' });
    }
  });

  /*
   * WR-502: every reason Strapi serves for the AI inclusion and the preview (request-attachments.ts, attachment-rules.ts):
   * none reads the permission sentence, which only a reasonless 403 (the policy's) reads.
   */
  it.each([
    [403, 'OWN_REQUEST'], [409, 'REQUEST_NOT_SUBMITTED'], [409, 'ATTACHMENTS_CLOSED'], [409, 'ATTACHMENT_REMOVED'], [409, 'ATTACHMENT_BLOCKED'],
    [409, 'ATTACHMENT_QUARANTINED'], [409, 'ATTACHMENT_UNAVAILABLE'], [409, 'ATTACHMENT_NOT_TEXT_BEARING'], [409, 'AI_CLASSIFICATION_ABOVE_CEILING'],
    [409, 'AI_POLICY_NOT_CONFIGURED'], [409, 'HISTORY_UNAVAILABLE'], [409, 'ATTACHMENT_INTEGRITY_FAILED'], [409, 'ATTACHMENT_TEXT_UNAVAILABLE'],
    [503, 'ATTACHMENT_BUSY'], [400, undefined], [404, undefined],
  ] as const)('a %s %s served for the AI inclusion or the preview never reads the permission sentence', (status, reason) => {
    expect(attachmentAiRefusal({ status, ...(reason ? { reason } : {}) }).message).not.toBe('You can’t change the AI inputs on this request.');
  });

  it('reads the permission sentence for a reasonless 403 alone, whatever else is refused', () => {
    for (const status of [undefined, 400, 404, 409, 413, 415, 422, 500, 503]) {
      for (const reason of [undefined, ...CONFLICT_REASONS]) {
        expect(attachmentAiRefusal({ status, reason }).message, `${status} ${reason}`).not.toBe('You can’t change the AI inputs on this request.');
      }
    }
  });

  it.each([undefined, 500, 503])('a %s or a transport failure is retryable', (status) => {
    expect(attachmentAiRefusal({ status })).toEqual({ message: 'We couldn’t change whether this file is included. Try again.', kind: 'retryable' });
  });

  /* The stage B amendment (2026-10-11; 14-UI-SPEC §8.3's dated row): a busy extraction queue, retryable with Try again. */
  it('reads a 503 ATTACHMENT_BUSY as the busy sentence, retryable', () => {
    expect(attachmentAiRefusal({ status: 503, reason: 'ATTACHMENT_BUSY' })).toEqual({ message: 'CSRM is busy reading other files. Try again in a moment.', kind: 'retryable' });
  });
});

/* UI-D33 and the shared copy rules: no file refusal says Accept, and every sentence uses the typographic apostrophe. */
describe('file refusals (families N, O and P)', () => {
  const statuses = [undefined, 400, 403, 404, 409, 413, 415, 422, 500, 503];
  const reasons = [undefined, ...CONFLICT_REASONS];
  const sentences = () => statuses.flatMap((status) => reasons.flatMap((reason) => [
    attachmentAddRefusal({ status, reason, sizeLabel: '2.4 MB', detection: 'Csrm.Test.Signature' }).message,
    attachmentAddRefusal({ status, reason }).message,
    ...(['download', 'remove', 'restore'] as const).map((action) => attachmentFileRefusal(action, { status, reason }).message),
    attachmentAiRefusal({ status, reason, classification: 'Confidential', ceiling: 'Official' }).message,
    attachmentAiRefusal({ status, reason }).message,
  ])).concat(downloadCheckFailedMessage, downloadFailureTitle);

  it('never says Accept', () => {
    for (const sentence of sentences()) expect(sentence).not.toMatch(/accept/i);
  });

  it('never uses a straight apostrophe or the words the copy rules forbid', () => {
    for (const sentence of sentences()) {
      expect(sentence).not.toContain("'");
      expect(sentence).not.toMatch(/attachment|upload|quarantine|scan(?!ned)|extracted text/i);
    }
  });
});
