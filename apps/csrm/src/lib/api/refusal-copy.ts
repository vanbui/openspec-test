import type { ConflictReason } from './conflict-reasons';

export type AiPolicyRefusalDetails = { requestClassification: string; ceiling: string | null };

/*
 * 12-UI-SPEC §11.1 and §11.3 (D-28, G-20): a generation the AI data policy refuses names the request's classification,
 * the approved limit and whom to contact. Without the policy's details the sentence keeps §11.1's words and leaves
 * the values out (WR-408, IN-303); it never borrows §11.2's sentence for a job that ran ("now classified", "nothing was
 * sent"), which is aiJobFailureCopy's.
 */
export function aiPolicyRefusalCopy(reason: ConflictReason, policy?: AiPolicyRefusalDetails): string | undefined {
  if (reason === 'AI_POLICY_NOT_CONFIGURED') return 'The AI provider hasn’t been approved for any information classification yet, so nothing can be sent to it. Contact your administrator.';
  if (reason === 'AI_CLASSIFICATION_ABOVE_CEILING') return policy?.ceiling
    ? `This request’s information is classified ${policy.requestClassification}, above the ${policy.ceiling} limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.`
    : 'This request’s information is classified above the limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.';
  return undefined;
}

/*
 * What a refused workflow action tells the person who tried it (UI-SPEC §10.2 and §10.3, D-22).
 *
 * Each Server Action knows its operation, so it names its family and passes the served conflict reason;
 * one code can read differently per action. A reason the family does not list, or none, reads the
 * family's fallback, which says the action can't happen in the record's current state and never asks
 * for a reload. Only a real change by someone else asks the person to refresh the page or reload the
 * questions. The Requestor's families (A to D) say no more than the relationship state she is served.
 *
 * Plain and zod-free, so Server Actions and client components can share it.
 */

export type RefusalFamily =
  | 'requestRevert'
  | 'questionnaireRevert'
  | 'questionnaireSubmit'
  | 'questionnaireRelease'
  | 'returnToReview'
  | 'questionChange'
  | 'questionDelete'
  | 'questionnaireGeneration'
  | 'assessmentDraft'
  | 'requestAssignment'
  | 'requestNotes'
  | 'noteAiInput';

type FamilyCopy = {
  readonly reasons: Readonly<Partial<Record<ConflictReason, string>>>;
  readonly fallback: string;
};

/** §10.2 G; H reads the same sentences for the five codes the two families share. */
const questionChangeReasons = {
  DEFINITION_CONFLICT: 'Another change reached this questionnaire first, so this question couldn’t be saved where you placed it. Reload the questions, then save again.',
  QUESTIONNAIRE_RELEASED: 'This questionnaire has been released. Return it to analyst review before changing its questions.',
  ASSESSMENT_STARTED: 'An assessment already exists for this request, so its questions can no longer change.',
  REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire’s questions can no longer change.',
  QUESTION_REMOVED: 'This question has been removed. Reload the questions to see the current list.',
  HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes. Contact your administrator.',
  ANSWER_DATA_INVALID: 'A stored answer to this question is invalid, so the change can’t be saved. Contact your administrator.',
} as const satisfies Partial<Record<ConflictReason, string>>;

const refusalCopy: Readonly<Record<RefusalFamily, FamilyCopy>> = {
  /* A. Return request to draft (both actors). */
  requestRevert: {
    reasons: {
      REQUEST_NOT_SUBMITTED: 'Only a submitted request can return to draft, and this one is no longer submitted. Refresh the page to see where it is.',
      REQUEST_WORK_STARTED: 'Work on this request has started, so it can no longer return to draft.',
    },
    fallback: 'This request can’t return to draft in its current state.',
  },
  /* B. Return questionnaire to draft (both actors). */
  questionnaireRevert: {
    reasons: {
      ASSESSMENT_STARTED: 'Assessment work has started, so this questionnaire can no longer return to draft.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can no longer return to draft.',
      QUESTIONNAIRE_NOT_SUBMITTED: 'Only a submitted questionnaire can return to draft, and this one isn’t submitted. Refresh the page to see where it is.',
    },
    fallback: 'This questionnaire can’t return to draft in its current state.',
  },
  /* D. Submit questionnaire (Requestor). */
  questionnaireSubmit: {
    reasons: {
      QUESTIONNAIRE_INCOMPLETE: 'Some required questions are unanswered. Answer them, then submit again.',
      QUESTIONNAIRE_ALREADY_SUBMITTED: 'This questionnaire has already been submitted.',
      /* 15-UI-SPEC §11.2 (UI-D25): a Security Analyst took the questionnaire back to update it; the answers are kept. */
      QUESTIONNAIRE_NOT_ANSWERABLE: 'A Security Analyst has taken this questionnaire back to update it, so it can’t be submitted now. Your answers are kept, and you can submit when it’s sent back to you.',
      QUESTIONNAIRE_HAS_NO_QUESTIONS: 'This questionnaire has no questions to answer.',
    },
    fallback: 'This questionnaire can’t be submitted in its current state.',
  },
  /* E. Release questionnaire (Security Analyst). */
  questionnaireRelease: {
    reasons: {
      QUESTIONNAIRE_RELEASED: 'This questionnaire has already been released.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can’t be released.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can’t be released.',
      QUESTIONNAIRE_HAS_NO_QUESTIONS: 'Add at least one question before you release this questionnaire.',
      DEFINITION_INVALID: 'Some questions in this questionnaire are inconsistent, so it can’t be released. Contact your administrator.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t be released. Contact your administrator.',
      /* 15-UI-SPEC §13: a release that raced an open AI proposal; the dialog adds `Go to AI proposals`. */
      AI_PROPOSALS_OPEN: 'This questionnaire has open AI proposals. Decide them before you release it.',
    },
    fallback: 'This questionnaire can’t be released in its current state.',
  },
  /* F. Return to analyst review (Security Analyst). */
  returnToReview: {
    reasons: {
      ALREADY_IN_ANALYST_REVIEW: 'This questionnaire is already in analyst review. Refresh the page to see it.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can no longer return to analyst review.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can no longer return to analyst review.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t return to analyst review. Contact your administrator.',
    },
    fallback: 'This questionnaire can’t return to analyst review in its current state.',
  },
  /* G. Add or edit a question (Security Analyst). */
  questionChange: {
    reasons: questionChangeReasons,
    fallback: 'This question can’t be saved in the questionnaire’s current state.',
  },
  /* H. Delete a question (Security Analyst). */
  questionDelete: {
    reasons: {
      QUESTION_HAS_DEPENDENTS: 'Another question is shown only after this one is answered. Change or remove that question first.',
      LAST_ACTIVE_QUESTION: 'A questionnaire needs at least one question, so its last question can’t be removed.',
      QUESTION_REMOVED: 'This question has already been removed. Reload the page to see the current list.',
      QUESTIONNAIRE_RELEASED: questionChangeReasons.QUESTIONNAIRE_RELEASED,
      ASSESSMENT_STARTED: questionChangeReasons.ASSESSMENT_STARTED,
      REQUEST_NOT_ELIGIBLE: questionChangeReasons.REQUEST_NOT_ELIGIBLE,
      HISTORY_UNAVAILABLE: questionChangeReasons.HISTORY_UNAVAILABLE,
      ANSWER_DATA_INVALID: questionChangeReasons.ANSWER_DATA_INVALID,
    },
    fallback: 'This question can’t be removed in the questionnaire’s current state.',
  },
  /* I. Generate or replace a questionnaire (Security Analyst). */
  questionnaireGeneration: {
    reasons: {
      AI_CLASSIFICATION_ABOVE_CEILING: aiPolicyRefusalCopy('AI_CLASSIFICATION_ABOVE_CEILING'),
      AI_POLICY_NOT_CONFIGURED: aiPolicyRefusalCopy('AI_POLICY_NOT_CONFIGURED'),
      REQUEST_NOT_ELIGIBLE: 'A questionnaire can be generated only while the request is submitted, and this request has moved on.',
      QUESTIONNAIRE_RELEASED: 'This questionnaire has been released to the Requestor, so it can’t be replaced. Return it to analyst review first.',
      /* 15-UI-SPEC §13 and §8.3 (D-09, D-12): the narrowed Replace, and an instruction on a request the analyst raised. */
      AI_PROPOSALS_OPEN: 'This questionnaire has open AI proposals, so it can’t be replaced. Decide them first.',
      QUESTIONNAIRE_HAS_ANALYST_CHANGES: 'Analysts have changed this questionnaire since it was generated, so replacing it would discard their work. Use AI proposals to change it instead.',
      QUESTIONNAIRE_ANSWERED: 'The Requestor has answered this questionnaire, so it can’t be replaced. Ask the AI for follow-up questions instead.',
      OWN_REQUEST: 'A Security Analyst can’t give the AI an instruction on a request they raised. Generate without one, or ask another Security Analyst.',
    },
    fallback: 'A questionnaire can’t be generated for this request in its current state.',
  },
  /*
   * Generate an assessment draft (Security Analyst; the draft card's error alert). Not a §10.2 family (WR-205): its
   * sentences are the card's own precondition (§12.2) and §10.2 E and F's wording for an assessment that already
   * exists, and its fallback follows §10.2's pattern. Strapi serves no reason for these refusals today, so the
   * fallback is what the analyst reads; it never says the assessment changed (D-22).
   */
  assessmentDraft: {
    reasons: {
      AI_CLASSIFICATION_ABOVE_CEILING: aiPolicyRefusalCopy('AI_CLASSIFICATION_ABOVE_CEILING'),
      AI_POLICY_NOT_CONFIGURED: aiPolicyRefusalCopy('AI_POLICY_NOT_CONFIGURED'),
      QUESTIONNAIRE_NOT_SUBMITTED: 'Draft generation can begin only after the linked questionnaire is submitted.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so a draft can’t be generated.',
      /* 15-UI-SPEC §13 and §8.2 (D-08): the card adds the link to the open proposals. */
      AI_PROPOSALS_OPEN: 'The questionnaire has open AI proposals. Decide them before you generate the draft.',
    },
    fallback: 'An assessment draft can’t be generated for this questionnaire in its current state.',
  },
  /*
   * K. Change who holds a request (Security Analyst; 13-UI-SPEC §7.4). The sentences that name nobody; the two that
   * name someone (ASSIGNMENT_CHANGED, ASSIGNEE_NOT_ELIGIBLE) are assignmentRefusal's, below.
   */
  requestAssignment: {
    reasons: {
      OWN_REQUEST: 'A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.',
      REQUEST_NOT_SUBMITTED: 'This request is a draft now, so its assignment can’t change. Refresh the page to see where it is.',
      ASSIGNMENT_REQUIRED: 'A released request keeps an assigned Security Analyst. Reassign it instead.',
    },
    fallback: 'This request’s assignment can’t change in its current state.',
  },
  /*
   * L. Add a note (Requestor and Security Analyst; 13-UI-SPEC §9.5). NOTES_CLOSED keeps the unsent text below the
   * closed-window line (§9.4); NOTES_LIMIT_REACHED is a field error that keeps the text in the composer. Any other
   * refusal reads §9.5's 403 sentence; noteRefusal adds the status sentences.
   */
  requestNotes: {
    reasons: {
      NOTES_CLOSED: 'Notes are closed on this request now, so your note wasn’t added. Your text is kept below.',
      NOTES_LIMIT_REACHED: 'This request has reached its limit of 500 notes, so your note wasn’t added.',
    },
    fallback: 'You can’t add notes to this request.',
  },
  /*
   * M. Mark a note as changing the AI inputs (Security Analyst; 13-UI-SPEC §10.4). OWN_REQUEST names its rule; every
   * other 409 (NOTES_CLOSED, HISTORY_UNAVAILABLE or one the family does not list) reads the blocked fallback, and
   * noteAiInputRefusal adds the status sentences.
   */
  noteAiInput: {
    reasons: {
      OWN_REQUEST: 'A Security Analyst can’t change the AI inputs of a request they raised.',
    },
    fallback: 'This note’s mark can’t change now. Refresh the page.',
  },
};

/** The family's sentence for a served reason, or the family's fallback for none or one it does not list. */
export function refusalMessage(family: RefusalFamily, reason?: ConflictReason): string {
  const copy = refusalCopy[family];
  return (reason === undefined ? undefined : copy.reasons[reason]) ?? copy.fallback;
}

/** §10.3: a conflict on creating, editing or submitting a request, which is not a D-22 family. */
export const requestConflictMessage = 'This request can’t be saved in its current state.';

/*
 * 15-UI-SPEC §13: the Phase 15 additions to 10 §12.4 (a questionnaire job's failure) and to the draft job's failure, by
 * code; null leaves the card's own copy. Maps, so a served code can never reach an inherited property.
 */
const questionnaireJobFailures = new Map<string, string>([
  ['AI_PROPOSALS_OPEN', 'AI proposals were opened before the replacement finished, so the questionnaire wasn’t replaced.'],
  ['QUESTIONNAIRE_HAS_ANALYST_CHANGES', 'An analyst changed the questionnaire before the replacement finished, so it wasn’t replaced.'],
]);
const assessmentDraftJobFailures = new Map<string, string>([
  ['AI_PROPOSALS_OPEN', 'AI proposals were opened on the questionnaire before the draft finished, so no draft was made. Decide them, then generate the draft again.'],
]);

export function questionnaireJobFailureCopy(code: string | null | undefined): string | null {
  return code ? questionnaireJobFailures.get(code) ?? null : null;
}

export function assessmentDraftJobFailureCopy(code: string | null | undefined): string | null {
  return code ? assessmentDraftJobFailures.get(code) ?? null : null;
}

/**
 * Whether a failed answer save can succeed by trying again (§6.1). A blocked save stops autosave until the
 * page is refreshed; a retryable one tries again on the next change or on Retry save.
 */
export type AnswerSaveFailure = 'blocked' | 'retryable';

export type AnswerSaveRefusal = { message: string; failure: AnswerSaveFailure };

/** §10.2 C: some answers fail validation; the attention list (§5.3) names them. */
export const answerSaveAttentionMessage = 'Some answers need attention before they can be saved.';

/** §10.2 C. */
const answerSaveReasons: Readonly<Partial<Record<ConflictReason, string>>> = {
  /* 15-UI-SPEC §11.2 (UI-D25): the answers are kept on the page and in the session draft store (15-13). */
  QUESTIONNAIRE_NOT_ANSWERABLE: 'A Security Analyst has taken this questionnaire back to update it, so your latest answers weren’t saved. They’re kept on this page, and you can carry on when it’s sent back to you.',
  QUESTIONNAIRE_ALREADY_SUBMITTED: 'This questionnaire has already been submitted, so your latest answers weren’t saved. Refresh the page to see the submitted answers.',
  QUESTIONNAIRE_HAS_NO_QUESTIONS: 'This questionnaire has no questions to answer.',
};

/** The sentence and failure kind of a refused answer save, from its status and served reason (§10.2 C). */
export function answerSaveRefusal(status?: number, reason?: ConflictReason): AnswerSaveRefusal {
  if (status === 409) {
    return {
      message: (reason === undefined ? undefined : answerSaveReasons[reason]) ?? 'Your answers can’t be saved in this questionnaire’s current state.',
      failure: 'blocked',
    };
  }
  if (status === 403) {
    return { message: 'You can’t save answers to this questionnaire right now. Refresh the page to see its current state.', failure: 'blocked' };
  }
  if (status === 400) return { message: answerSaveAttentionMessage, failure: 'retryable' };
  /* The questionnaire is gone: trying the same save again cannot help (§10.3 keeps the sentence). */
  if (status === 404) return { message: 'This questionnaire is no longer available.', failure: 'blocked' };
  /* A network failure, a timeout or a 5xx: the next change or Retry save may succeed. */
  return { message: 'The questionnaire service is unavailable. Please try again later.', failure: 'retryable' };
}

/**
 * Whether a refused review decision can succeed by trying again (12-UI-SPEC §6.3): a blocked one offers
 * Refresh page, a retryable one Try again.
 */
export type AiDecisionRefusal = { text: string; kind: 'blocked' | 'retryable' };

/*
 * WR-103: every decision on an AI proposal, and every edit of an AI-proposed or confirmed field, is recorded in the
 * review history of the assessment's AI proposals in the same change. When that history can't take the record, the
 * change is refused and nothing is saved, so the sentence says what didn't happen and whom to contact.
 */
function aiReviewHistoryUnavailable(outcome: string): string {
  return `The review history of this assessment’s AI proposals can’t record more changes, so ${outcome}. Contact your administrator.`;
}

/**
 * The sentence for a refused assessment or Risk save, when the served reason has one of its own (WR-103); otherwise
 * undefined, and the save keeps its own conflict sentence.
 */
export function assessmentEditRefusalMessage(reason?: ConflictReason): string | undefined {
  return reason === 'AI_RUN_RECORD_UNAVAILABLE' ? aiReviewHistoryUnavailable('your changes weren’t saved') : undefined;
}

/** 12-UI-SPEC §6.3, family J: a refused decision on AI proposals (confirm, restore, add or dismiss a suggestion). */
const aiDecisionReasons: Readonly<Partial<Record<ConflictReason, string>>> = {
  ASSESSMENT_NOT_MUTABLE: 'This assessment can no longer be changed, so your review wasn’t recorded. Refresh the page to see its current state.',
  /* 15-UI-SPEC §13 (UI-D29): reworded neutrally; the proposal may also have closed without anyone deciding it. */
  AI_PROPOSAL_ALREADY_DECIDED: 'This proposal is no longer open. Refresh the page to see where it stands.',
  /* 12-UI-SPEC UI-D12: the guarded Undo of a suggested control. */
  AI_SUGGESTION_CONTROL_CHANGED: 'The planned control has changed since it was added, so it stays. Remove it from the risk if it should go.',
  /* G-14 addition, not in 12-UI-SPEC §6.3 (2026-10-01 confirmation). "Accept" names the treatment action value. */
  AI_ACCEPT_WITH_PLANNED_CONTROL: 'This Risk has a planned control, so the AI’s proposed Accept can’t be confirmed. Change the treatment action to Treat, or remove the planned control.',
  /* WR-103 addition: the review history can't take the decision, so it was refused; only an administrator can repair it. */
  AI_RUN_RECORD_UNAVAILABLE: aiReviewHistoryUnavailable('your review wasn’t recorded'),
};

/** The sentence and kind of a refused review decision, from its status and served reason (family J). */
export function aiDecisionRefusalCopy(failure: { status?: number; reason?: ConflictReason }): AiDecisionRefusal {
  const { status, reason } = failure;
  if (status === 409) {
    return {
      text: (reason === undefined ? undefined : aiDecisionReasons[reason]) ?? 'Your review can’t be recorded in this assessment’s current state.',
      kind: 'blocked',
    };
  }
  if (status === 400) return { text: 'This proposal is no longer on the assessment. Refresh the page to see the current proposals.', kind: 'blocked' };
  if (status === 403) return { text: 'You can’t review AI proposals on this assessment.', kind: 'blocked' };
  /* Phase 10's locked assessment refusal. */
  if (status === 404) return { text: 'This assessment is no longer available.', kind: 'blocked' };
  /* A network failure, a timeout or a 5xx. */
  return { text: 'We couldn’t record your review. Try again.', kind: 'retryable' };
}

/*
 * 13-UI-SPEC §7.4, family K: a refused change to who holds a request, read from its served reason and status. The
 * sentences that name someone take the name the caller knows: who holds the request now (the Server Action re-reads
 * it on ASSIGNMENT_CHANGED; null when nobody does) and the analyst the change named. A blocked refusal offers
 * Refresh page, a retryable one Try again (§7.2).
 */
export type AssignmentRefusal = { message: string; kind: 'blocked' | 'retryable' };

export type AssignmentRefusalNames = {
  /** Who holds the request now, by display name; null when nobody does; absent when unknown. */
  holderName?: string | null;
  /** The analyst the refused change named, by display name. */
  targetName?: string | null;
};

const assignmentFallback = refusalCopy.requestAssignment.fallback;

/** The sentence and kind of a refused assignment change or eligible-analyst read (family K). */
export function assignmentRefusal(reason: ConflictReason | undefined, names: AssignmentRefusalNames, status?: number): AssignmentRefusal {
  const blocked = (message: string): AssignmentRefusal => ({ message, kind: 'blocked' });
  if (reason === 'ASSIGNMENT_CHANGED') {
    if (typeof names.holderName === 'string' && names.holderName.length > 0) return blocked(`${names.holderName} now holds this request, so your change wasn’t made.`);
    if (names.holderName === null) return blocked('This request was returned to the queue, so your change wasn’t made.');
    return blocked(assignmentFallback);
  }
  if (reason === 'ASSIGNEE_NOT_ELIGIBLE') {
    const name = typeof names.targetName === 'string' && names.targetName.length > 0 ? names.targetName : 'This Security Analyst';
    return blocked(`${name} can’t be assigned this request. Choose another Security Analyst.`);
  }
  const listed = reason === undefined ? undefined : refusalCopy.requestAssignment.reasons[reason];
  if (listed) return blocked(listed);
  if (status === 403) return blocked('You can’t change who this request is assigned to.');
  /* Phase 10's locked request refusal. */
  if (status === 404) return blocked('This request is no longer available.');
  if (status === 400 || status === 409) return blocked(assignmentFallback);
  /* A network failure, a timeout or a 5xx. */
  return { message: 'We couldn’t change the assignment. Try again.', kind: 'retryable' };
}

/*
 * 13-UI-SPEC §9.5, family L: a refused note, read from its served reason and status. `not-found` sends the page to its
 * own not-found state on refresh; `retryable` offers Try again beside Add note (§9.1). A 400 is the composer's own
 * validation (§8.3), which the Server Action reads before it calls Strapi.
 */
export type NoteRefusal = { message: string; kind: 'field' | 'blocked' | 'retryable' | 'not-found' };

/** The sentence and kind of a refused note (family L). */
export function noteRefusal(reason?: ConflictReason, status?: number): NoteRefusal {
  const listed = reason === undefined ? undefined : refusalCopy.requestNotes.reasons[reason];
  if (listed) return { message: listed, kind: 'blocked' };
  /* Phase 10's locked request refusal; the page shows its not-found state on refresh. */
  if (status === 404) return { message: 'This request is no longer available.', kind: 'not-found' };
  /*
   * §9.5: a 400 is about the note's text, so it is a field error the person can fix. The composer checks Strapi's rules
   * first (validateNoteDraft), so this names every rule rather than guess which one (IN-401; copy recorded in §9.5).
   */
  if (status === 400) return { message: 'This note can’t be added as written. Check its length and remove any hidden formatting characters.', kind: 'field' };
  if (status === 403 || status === 409) return { message: refusalCopy.requestNotes.fallback, kind: 'blocked' };
  /* A network failure, a timeout or a 5xx. */
  return { message: 'We couldn’t add your note. Try again.', kind: 'retryable' };
}

/*
 * 13-UI-SPEC §10.4, family M: a refused change of a note's AI-input mark, read from its served reason and status. The
 * switch rolls back; a blocked refusal offers Refresh page, a retryable one Try again.
 */
export type NoteAiInputRefusal = { message: string; kind: 'blocked' | 'retryable' };

/** The sentence and kind of a refused AI-input mark change (family M). */
export function noteAiInputRefusal(reason?: ConflictReason, status?: number): NoteAiInputRefusal {
  const listed = reason === undefined ? undefined : refusalCopy.noteAiInput.reasons[reason];
  if (listed) return { message: listed, kind: 'blocked' };
  if (status === 403) return { message: 'You can’t change the AI inputs on this request.', kind: 'blocked' };
  if (status === 404) return { message: 'This note is no longer available. Refresh the page.', kind: 'blocked' };
  if (status === 400 || status === 409) return { message: refusalCopy.noteAiInput.fallback, kind: 'blocked' };
  /* A network failure, a timeout or a 5xx. */
  return { message: 'We couldn’t change the mark. Try again.', kind: 'retryable' };
}

/*
 * 14-UI-SPEC §8, families N, O and P: a refused file action, read from its served reason and status. A `refused` file
 * row offers Choose another file, a `blocked` refusal is resolved only by a change elsewhere (a refresh, an
 * administrator), and a `retryable` one offers Retry or Try again. No sentence echoes a file name, a URL or a served
 * message (Phase 10 D-22, T-14-18); the detection name is data the transport validated against the contract.
 *
 * A reason the family does not list reads its status row. Family N reads a 403 or 409 without a listed reason as its 403
 * sentence (family L's pattern) and any other unreasoned 4xx as its 400 row. Families O and P keep the permission
 * sentence for a 403 alone, and read a 400, or a 409 without a listed reason, as the action to try again after a refresh
 * (WR-502, WR-503). A network failure, a timeout or a 5xx is retryable.
 */
export type AttachmentRefusalKind = 'refused' | 'retryable' | 'blocked';

export type AttachmentAddRefusal = { message: string; kind: AttachmentRefusalKind; offerNewNote: boolean };

export type AttachmentAddFailure = {
  status?: number;
  reason?: ConflictReason;
  /** The file's size in X-23's 1,024-byte units (`30.0 MB`), formatted by the caller. */
  sizeLabel?: string;
  /** The scanner's name for the malware, which the transport keeps only beside ATTACHMENT_MALWARE_FOUND. */
  detection?: string;
};

function isRetryableStatus(status?: number): boolean {
  return status === undefined || status < 400 || status >= 500;
}

/** §8.1: the size limit, naming the file's size when the caller knows it. */
function tooLargeMessage(sizeLabel?: string): string {
  return sizeLabel
    ? `Files can be up to 25 MB, and this one is ${sizeLabel}. Make it smaller or split it, then add it again.`
    : 'Files can be up to 25 MB. Make it smaller or split it, then add it again.';
}

/** §8.1: the malware a 422 found, named as data when the detection is known. */
function malwareFoundMessage(detection?: string): string {
  const named = detection ? ` (${detection})` : '';
  return `This file contains malware${named} and wasn’t added. Don’t open it again, and contact your IT service desk, because your device may be affected.`;
}

/** §8.1, the rows whose sentence takes no value. ATTACHMENT_LIFETIME_LIMIT_REACHED and ATTACHMENTS_NOT_CONFIGURED read §1.2's lines. */
const attachmentAddReasons: Readonly<Partial<Record<ConflictReason, string>>> = {
  ATTACHMENT_TYPE_NOT_ALLOWED: 'This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.',
  ATTACHMENT_CONTENT_MISMATCH: 'This file’s content doesn’t match its name. Check it’s the file you meant, save it in its real format and add it again.',
  ATTACHMENT_MACRO_ENABLED: 'This file contains macros, so it can’t be added. Save it as .docx, .xlsx or .pptx and add it again.',
  ATTACHMENT_ENCRYPTED: 'This file is password-protected, so it can’t be checked for malware. Remove the password and add it again.',
  ATTACHMENT_LEGACY_OFFICE: 'This is an older Office format. Save it as .docx, .xlsx or .pptx and add it again.',
  /* Added to §8.1 on 2026-10-11 in stage B (the amendment's contract item 5; IN-202 and WR-205). */
  ATTACHMENT_UNSUPPORTED_STRUCTURE: 'This file is packaged in a way CSRM can’t check. Open it, save a fresh copy, then add the new copy.',
  ATTACHMENT_ACTIVE_CONTENT: 'This file contains active content, such as linked objects or ActiveX controls, so it can’t be added. Remove it, save the file and add it again.',
  ATTACHMENT_EMPTY: 'This file is empty. Check it’s the file you meant and choose it again.',
  ATTACHMENT_LIMIT_REACHED: 'This request already has 20 files. Remove a file to add another.',
  ATTACHMENT_LIFETIME_LIMIT_REACHED: 'This request has reached the most files it can keep, counting removed ones, so no more can be added.',
  ATTACHMENTS_NOT_CONFIGURED: 'Files can’t be added right now because file storage isn’t set up. Contact your administrator.',
  ATTACHMENTS_CLOSED: 'Files closed when the assessment was released, so this file wasn’t added.',
  REQUEST_NOT_SUBMITTED: 'This request is a draft now, so files can’t be added. Refresh the page to see where it is.',
  ATTACHMENT_NOTE_REQUIRED: 'This request has been submitted, so files are added with a note. Add the file from the note box.',
  ATTACHMENT_NOTE_INVALID: 'This note can no longer take files. Add the file with a new note.',
};

/** The two refusals that offer `Add with a new note`. */
const newNoteReasons: ReadonlySet<ConflictReason> = new Set(['ATTACHMENT_NOTE_REQUIRED', 'ATTACHMENT_NOTE_INVALID']);

/* Added to §8.1 and §8.3 on 2026-10-11 in stage B (WR-204): a full queue is refused at once, so the person may retry. */
const attachmentAddBusy = 'CSRM is busy checking other files. Try again in a moment.';
const attachmentAiBusy = 'CSRM is busy reading other files. Try again in a moment.';

/** The sentence and kind of a refused file add (family N, 14-UI-SPEC §8.1). */
export function attachmentAddRefusal(failure: AttachmentAddFailure): AttachmentAddRefusal {
  const { status, reason, sizeLabel, detection } = failure;
  const refused = (message: string, offerNewNote = false): AttachmentAddRefusal => ({ message, kind: 'refused', offerNewNote });
  if (reason === 'ATTACHMENT_BUSY') return { message: attachmentAddBusy, kind: 'retryable', offerNewNote: false };
  if (reason === 'ATTACHMENT_MALWARE_FOUND') return refused(malwareFoundMessage(detection));
  /* 14-RESEARCH Pitfall 9: the upload parser's own 413 carries no CSRM reason, so a reasonless 413 is the size limit too. */
  if (reason === 'ATTACHMENT_TOO_LARGE' || (reason === undefined && status === 413)) return refused(tooLargeMessage(sizeLabel));
  const listed = reason === undefined ? undefined : attachmentAddReasons[reason];
  if (listed) return refused(listed, reason !== undefined && newNoteReasons.has(reason));
  if (isRetryableStatus(status)) return { message: 'We couldn’t add this file. Try again.', kind: 'retryable', offerNewNote: false };
  /* Phase 10's locked request refusal; the request page shows its not-found state on refresh. */
  if (status === 404) return { message: 'This request is no longer available.', kind: 'blocked', offerNewNote: false };
  if (status === 403 || status === 409) return refused('You can’t add files to this request.');
  return refused('This file couldn’t be added. Choose it again.');
}

/** The three file actions family O words; each has its own retry sentence. */
export type AttachmentFileAction = 'download' | 'remove' | 'restore';

export type AttachmentFileRefusal = { message: string; kind: AttachmentRefusalKind };

/** §8.2: download refusals show as a danger toast with this title. */
export const downloadFailureTitle = 'File not downloaded';

/** §8.2: the downloaded bytes fail the web's own check (D-24); trying again may succeed. */
export const downloadCheckFailedMessage = 'This download didn’t look right, so CSRM stopped it. Try again, or contact your administrator.';

/*
 * §8.2, keyed per action (amended on 2026-10-11 in stage B, WR-503): each action reads only the reasons Strapi serves for
 * it, in words that answer that action, so a refused restore never says "downloaded" and a refused download never says
 * "change". The sentences a removal and a restore share name no single action, and live once, here.
 */
const attachmentChangeReasons: Readonly<Partial<Record<ConflictReason, string>>> = {
  ATTACHMENTS_CLOSED: 'Files closed when the assessment was released, so this file can’t change.',
  REQUEST_NOT_SUBMITTED: 'This request is a draft now, so its files can’t change. Refresh the page to see where it is.',
  /* Added to §8.2 on 2026-10-01 during planning (plan 14-05): the file's change history can take no more entries. */
  HISTORY_UNAVAILABLE: 'This file’s history is full, so it can’t change any more. Contact your administrator.',
};

const attachmentFileReasons: Readonly<Record<AttachmentFileAction, Readonly<Partial<Record<ConflictReason, string>>>>> = {
  download: {
    ATTACHMENT_QUARANTINED: 'This file is still waiting for its malware check. Try again later.',
    ATTACHMENT_BLOCKED: 'Malware was found in this file, so it can’t be downloaded.',
    ATTACHMENT_REMOVED: 'This file was removed, so it can’t be downloaded. Refresh the page.',
    ATTACHMENT_INTEGRITY_FAILED: 'This file doesn’t match the one that was added, so CSRM won’t download it. Contact your administrator.',
    /* §8.2 lists no row for the stored bytes being gone, so it reads §3.4's unavailable line. */
    ATTACHMENT_UNAVAILABLE: 'This file can’t be downloaded. Contact your administrator.',
  },
  remove: {
    ...attachmentChangeReasons,
    NOT_UPLOADER: 'Only the person who added this file, or a Security Analyst, can remove it.',
    /* Strapi answers a removal already made as it is; were one refused this way, the sentence answers the removal. */
    ATTACHMENT_REMOVED: 'This file was already removed. Refresh the page.',
  },
  restore: {
    ...attachmentChangeReasons,
    NOT_REMOVER: 'Only the person who removed this file can restore it.',
    ATTACHMENT_LIMIT_REACHED: 'This request already has 20 files. Remove another file before restoring this one.',
    /* A re-scan blocked the file after it was removed, for example between Remove and the toast's Undo. */
    ATTACHMENT_BLOCKED: 'Malware was found in this file, so it can’t be restored.',
    /* WR-101: a restore adds to the file's history, so a history within its reserve refuses it. */
    HISTORY_UNAVAILABLE: 'This file’s history is full, so it can’t be restored. Contact your administrator.',
  },
};

/** The policy's reasonless 403: the person may not take this action on the request's files. */
const attachmentFileForbidden: Readonly<Record<AttachmentFileAction, string>> = {
  download: 'You can’t download this request’s files.',
  remove: 'You can’t change this request’s files.',
  restore: 'You can’t change this request’s files.',
};

const attachmentFileRetry: Readonly<Record<AttachmentFileAction, string>> = {
  download: 'We couldn’t download the file. Try again.',
  remove: 'We couldn’t remove the file. Try again.',
  restore: 'We couldn’t restore the file. Try again.',
};

/** A malformed call (400), or a 409 the action does not list: the page is out of date, so a refresh comes first. */
const attachmentFileRefresh: Readonly<Record<AttachmentFileAction, string>> = {
  download: 'We couldn’t download the file. Refresh the page, then try again.',
  remove: 'We couldn’t remove the file. Refresh the page, then try again.',
  restore: 'We couldn’t restore the file. Refresh the page, then try again.',
};

const fileNoLongerAvailable = 'This file is no longer available. Refresh the page.';

/** The sentence and kind of a refused download, remove or restore (family O, 14-UI-SPEC §8.2). */
export function attachmentFileRefusal(action: AttachmentFileAction, failure: { status?: number; reason?: ConflictReason }): AttachmentFileRefusal {
  const { status, reason } = failure;
  const blocked = (message: string): AttachmentFileRefusal => ({ message, kind: 'blocked' });
  const listed = reason === undefined ? undefined : attachmentFileReasons[action][reason];
  if (listed) return blocked(listed);
  if (isRetryableStatus(status)) return { message: attachmentFileRetry[action], kind: 'retryable' };
  if (status === 404) return blocked(fileNoLongerAvailable);
  if (status === 403) return blocked(attachmentFileForbidden[action]);
  return blocked(attachmentFileRefresh[action]);
}

export type AttachmentAiFailure = {
  status?: number;
  reason?: ConflictReason;
  /** The request's information classification, from the served `aiPolicy`. */
  classification?: string;
  /** The highest classification the AI provider is approved for; null when none is. */
  ceiling?: string | null;
};

/** §5.1's section-level line for a classification above the approved limit, without the values when they are unknown. */
function aiCeilingMessage(classification?: string, ceiling?: string | null): string {
  return classification && ceiling
    ? `Files can’t be included in the AI inputs: this request’s information is classified ${classification}, above the ${ceiling} limit the AI provider is approved for.`
    : 'Files can’t be included in the AI inputs: this request’s information is classified above the limit the AI provider is approved for.';
}

const notIncludedAnyMore = 'This file can’t be included any more. Refresh the page.';

/** §8.3, the rows whose sentence takes no value. */
const attachmentAiReasons: Readonly<Partial<Record<ConflictReason, string>>> = {
  /* Family M's words. */
  OWN_REQUEST: refusalCopy.noteAiInput.reasons.OWN_REQUEST,
  ATTACHMENT_TEXT_UNAVAILABLE: 'CSRM couldn’t find text in this file, so it can’t be included. A scanned document needs a text layer.',
  /* §5.1's image line and pending line. */
  ATTACHMENT_NOT_TEXT_BEARING: 'Images can’t be included, because the AI reads text only.',
  ATTACHMENT_QUARANTINED: 'It can be included once it passes the malware check.',
  ATTACHMENT_BLOCKED: notIncludedAnyMore,
  ATTACHMENT_REMOVED: notIncludedAnyMore,
  /* §5.1's section-level line. */
  AI_POLICY_NOT_CONFIGURED: 'Files can’t be included in the AI inputs, because the AI provider hasn’t been approved for any information classification yet. Contact your administrator.',
  ATTACHMENTS_CLOSED: 'The assessment has been released, so what the AI uses can’t change.',
  REQUEST_NOT_SUBMITTED: 'This request is a draft now, so its AI inputs can’t change.',
  /*
   * Added to §8.3 on 2026-10-11 in stage B (WR-502), the reasons an inclusion meets after the rule: a history within its
   * reserve (WR-101), stored bytes that no longer match their digest (tamper evidence, D-23), and stored bytes that are
   * gone, which no refresh can help.
   */
  HISTORY_UNAVAILABLE: 'This file’s history is full, so it can’t be included any more. Contact your administrator.',
  ATTACHMENT_INTEGRITY_FAILED: 'This file doesn’t match the one that was added, so CSRM won’t read it. Contact your administrator.',
  ATTACHMENT_UNAVAILABLE: 'This file can’t be read. Contact your administrator.',
};

/** The sentence and kind of a refused AI inclusion or text preview (family P, 14-UI-SPEC §8.3). */
export function attachmentAiRefusal(failure: AttachmentAiFailure): AttachmentFileRefusal {
  const { status, reason, classification, ceiling } = failure;
  const blocked = (message: string): AttachmentFileRefusal => ({ message, kind: 'blocked' });
  if (reason === 'ATTACHMENT_BUSY') return { message: attachmentAiBusy, kind: 'retryable' };
  if (reason === 'AI_CLASSIFICATION_ABOVE_CEILING') return blocked(aiCeilingMessage(classification, ceiling));
  const listed = reason === undefined ? undefined : attachmentAiReasons[reason];
  if (listed) return blocked(listed);
  if (isRetryableStatus(status)) return { message: 'We couldn’t change whether this file is included. Try again.', kind: 'retryable' };
  /* Family O's 404 row: the file is gone. */
  if (status === 404) return blocked(fileNoLongerAvailable);
  /* Only the policy's reasonless 403 is a permission refusal (WR-502). */
  if (status === 403) return blocked('You can’t change the AI inputs on this request.');
  /* A malformed call (400), or a 409 the family does not list: the page is out of date, so a refresh comes first. */
  return blocked('We couldn’t change whether this file is included. Refresh the page, then try again.');
}
