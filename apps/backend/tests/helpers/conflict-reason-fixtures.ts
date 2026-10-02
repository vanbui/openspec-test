import assert from "node:assert/strict";

import type { AuthorizationHttpHarness } from "./strapi-http-harness";

/*
 * Builds the exact stored state a conflict reason needs, one questionnaire per case, so each refusal
 * is proved on its own record and no shared fixture's counts move. Every fixture belongs to the
 * owning Requestor, and the released ones carry the release facts and their one governance event.
 */

export type ConflictReasonQuestion = {
  key: string;
  order: number;
  required?: boolean;
  answerType?: "Text" | "Boolean";
  section?: { key: string; title: string; order: number };
  answer?: unknown;
  visibility?: Record<string, unknown>;
  deleted?: boolean;
};

export type ConflictReasonFixtureInput = {
  label: string;
  requestStatus: string;
  released: boolean;
  questions: ConflictReasonQuestion[];
  /** Replaces the governance log the release facts would otherwise write. */
  governanceLog?: unknown[];
  assessment?: boolean;
};

export type ConflictReasonFixture = {
  requestId: string;
  questionnaireId: string;
  questionIds: Record<string, string>;
};

const RELEASED_AT = "2026-08-15T00:00:00.000Z";
const CONTEXT_SECTION = { key: "context", title: "Context", order: 1 };
let sequence = 0;

export const draftAnswer = (value: unknown) => ({ schemaVersion: 1, value, state: "draft", updatedAt: "2026-08-01T00:00:00.000Z" });
export const submittedAnswer = (value: unknown) => ({
  schemaVersion: 1, value, state: "submitted", updatedAt: "2026-08-02T00:00:00.000Z", submittedAt: "2026-08-02T00:00:00.000Z",
});

export async function createConflictReasonFixture(
  harness: AuthorizationHttpHarness,
  input: ConflictReasonFixtureInput,
): Promise<ConflictReasonFixture> {
  const number = `${input.label}-${String(++sequence).padStart(3, "0")}`;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: `REASON-${number}`,
    title: `Conflict reason request ${number}`,
    requestStatus: input.requestStatus,
    requestor: "owner",
  });
  const releasedEvent = { schemaVersion: 1, kind: "released", at: RELEASED_AT, by: harness.users.analyst };
  const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: `QUES-REASON-${number}`,
    title: `Conflict reason questionnaire ${number}`,
    assessmentRequest: requestId,
    ...(input.released ? { releasedAt: RELEASED_AT, releasedBy: harness.users.analyst } : {}),
    governanceLog: input.governanceLog ?? (input.released ? [releasedEvent] : []),
  });
  const questionIds: Record<string, string> = {};
  for (const question of input.questions) {
    questionIds[question.key] = await harness.createFixtureDocument("api::csrm-question.csrm-question", {
      questionText: `Conflict reason question ${question.key} ${number}`,
      answerType: question.answerType ?? "Text",
      options: {
        schemaVersion: question.deleted ? 2 : 1,
        questionKey: question.key,
        section: question.section ?? CONTEXT_SECTION,
        order: question.order,
        required: question.required ?? true,
        ...(question.visibility ? { visibility: question.visibility } : {}),
        ...(question.deleted ? { deleted: { deletedAt: RELEASED_AT, deletedBy: harness.users.analyst } } : {}),
      },
      answer: question.answer ?? null,
      questionnaire: questionnaireId,
    });
  }
  if (input.assessment) {
    await harness.createAssessmentFixture({
      assessmentNumber: `ASM-REASON-${number}`,
      assessmentStatus: "draft",
      assessmentRequest: requestId,
      summary: "Conflict reason assessment fixture",
    });
  }
  return { requestId, questionnaireId, questionIds };
}

/** A governance log already at its 1,000-entry ceiling: one more event cannot be appended. */
export function fullGovernanceLog(analystDocumentId: string): unknown[] {
  return Array.from({ length: 1_000 }, () => ({ schemaVersion: 1, kind: "released", at: RELEASED_AT, by: analystDocumentId }));
}

/** Everything a refusal could write: the questionnaire with its questions, and its request. */
export async function conflictReasonSnapshot(harness: AuthorizationHttpHarness, fixture: ConflictReasonFixture): Promise<unknown[]> {
  return harness.snapshot([
    () => harness.getQuestionnaire(fixture.questionnaireId),
    () => harness.getRequest(fixture.requestId),
  ]);
}

/**
 * Sends the refused operation and proves the whole refusal: 409, `error.details` exactly the one
 * reason, and the stored questionnaire, questions and request deep-equal before and after.
 */
export async function assertConflictReason(
  harness: AuthorizationHttpHarness,
  fixture: ConflictReasonFixture,
  send: () => Promise<Response>,
  reason: string,
  diagnostic: string,
): Promise<void> {
  const before = await conflictReasonSnapshot(harness, fixture);
  const response = await send();
  const body = await response.json() as { error?: { details?: unknown } };
  assert.equal(response.status, 409, `${diagnostic}_STATUS`);
  assert.deepEqual(body.error?.details, { reason }, `${diagnostic}_REASON`);
  assert.deepEqual(await conflictReasonSnapshot(harness, fixture), before, `${diagnostic}_WRITE`);
}
