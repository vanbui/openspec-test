import assert from "node:assert/strict";
import test from "node:test";
import { AssessmentContextTooLargeError } from "../src/csrm/ai/assessment-context";
import { renderReferenceDataBlock, renderRequestorDataBlock } from "../src/csrm/ai/prompt-sections";
import {
  buildQuestionnaireProposalContext,
  QUESTIONNAIRE_CONTEXT_BOUNDS,
  type QuestionnaireContextQuestion,
  type QuestionnaireProposalContextInput,
} from "../src/api/csrm-questionnaire/services/questionnaire-proposal-context";

/*
 * Phase 15 D-14 and D-30 (Phase 12 D-04 and D-06; the approved amendment, "Context summary" and "Bounds"): the questionnaire
 * part of a proposal or rewrite context. Questions render as Q1…Qn in display order with whether each is answered (the
 * AI treats an answered question as fixed); answer content only for a submitted batch, by Qn, in the untrusted block;
 * open items as P1… (already proposed), rejected items as X1… with their reasons (the 100 most recent), removed
 * questions as R1…. No documentId, question key, name or date reaches the rendered text.
 */

const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not-sure", label: "Not sure" }];
function question(index: number, overrides: Partial<QuestionnaireContextQuestion> = {}): QuestionnaireContextQuestion {
  return {
    documentId: `doc-q${index}`,
    questionKey: `key-q${index}`,
    section: { key: "payment-section", title: "Payment processing", order: 1 },
    order: index,
    questionText: `Question text ${index}?`,
    helpText: null,
    answerType: "Long text",
    choices: null,
    required: true,
    visibility: null,
    removed: false,
    answered: false,
    ...overrides,
  };
}
const questions = (): QuestionnaireContextQuestion[] => [
  question(1, { questionText: "Are payment files signed?", helpText: "Describe the integrity control.", answered: true, answerLabel: "Unsigned payment files" }),
  question(2, { questionText: "Does a third party process payroll?", answerType: "Single select", choices: yesNo, answered: true, answerLabel: "Yes" }),
  question(3, { questionText: "Which country hosts the processor?", answerType: "Text", required: false, visibility: { questionKey: "key-q2", operator: "equals", value: "yes" } }),
  question(4, { questionText: "Was the old signing step retired?", removed: true }),
  question(5, { questionText: "Other recovery notes?", section: { key: "resilience-section", title: "Resilience", order: 2 }, required: false }),
];
function input(overrides: Partial<QuestionnaireProposalContextInput> = {}): QuestionnaireProposalContextInput {
  return {
    scope: "questionnaire",
    questions: questions(),
    answerContent: "included",
    openItems: [{ kind: "add", questionText: "Who administers the offshore support team?" }],
    rejectedItems: [{ kind: "remove", questionText: "Other recovery notes?", reason: "The Requestor needs this field.", decidedAt: "2026-10-10T00:00:00.000Z" }],
    instructionSource: "analyst",
    contextSourceRefs: ["request.title", "request.description", "note-1", "file-1"],
    ...overrides,
  };
}
function rendered(part: ReturnType<typeof buildQuestionnaireProposalContext>): string {
  return [renderReferenceDataBlock(part.reference), part.answers ? renderRequestorDataBlock([part.answers]) : ""].join("\n");
}
const value = (label: string, text: string): string => `<field>${label}</field><value>${text}</value>`;

test("a submitted batch renders Q1…Qn with answered flags, answers by Qn only in the answers section, and P, X and R lists", () => {
  const part = buildQuestionnaireProposalContext(input());
  const reference = renderReferenceDataBlock(part.reference);
  // Active questions in display order; the removed question is not a Q.
  assert.ok(reference.includes(value("Q1.questionText", "Are payment files signed?")));
  assert.ok(reference.includes(value("Q2.questionText", "Does a third party process payroll?")));
  assert.ok(reference.includes(value("Q3.questionText", "Which country hosts the processor?")));
  assert.ok(reference.includes(value("Q4.questionText", "Other recovery notes?")));
  assert.ok(!reference.includes("Q5."), "A_FIFTH_ACTIVE_QUESTION");
  assert.ok(reference.includes(value("Q1.answered", "yes")) && reference.includes(value("Q2.answered", "yes")) && reference.includes(value("Q3.answered", "no")));
  assert.ok(reference.includes(value("Q1.section", "Payment processing")) && reference.includes(value("Q4.section", "Resilience")));
  assert.ok(reference.includes(value("Q1.helpText", "Describe the integrity control.")));
  assert.ok(reference.includes(value("Q2.answerType", "Single select")) && reference.includes(value("Q2.choice", "Not sure")));
  assert.ok(reference.includes(value("Q3.required", "no")) && reference.includes(value("Q3.visibility", "Q2 equals Yes")));
  // Answers never sit in the reference block, only in the untrusted answers section, by Qn.
  assert.ok(!reference.includes("Unsigned payment files"), "ANSWER_IN_REFERENCE_DATA");
  assert.equal(part.answers?.kind, "answers");
  const answers = renderRequestorDataBlock(part.answers ? [part.answers] : []);
  assert.ok(answers.includes(value("Q1.answer", "Unsigned payment files")) && answers.includes(value("Q2.answer", "Yes")));
  assert.ok(!answers.includes("Q3.answer"), "AN_UNANSWERED_QUESTION_HAS_AN_ANSWER");
  // The lists.
  assert.ok(reference.includes(value("P1.status", "already proposed")) && reference.includes(value("P1.questionText", "Who administers the offshore support team?")));
  assert.ok(reference.includes(value("X1.status", "rejected by the analyst")) && reference.includes(value("X1.reason", "The Requestor needs this field.")));
  assert.ok(reference.includes(value("R1.status", "removed by the analyst")) && reference.includes(value("R1.questionText", "Was the old signing step retired?")));
  // The allowed sets.
  assert.deepEqual([...part.allowed.refs], [["Q1", "doc-q1"], ["Q2", "doc-q2"], ["Q3", "doc-q3"], ["Q4", "doc-q5"]]);
  assert.deepEqual([...part.allowed.answeredRefs], ["Q1", "Q2"]);
  assert.deepEqual([...part.allowed.removedDocumentIds], ["doc-q4"]);
  assert.deepEqual([...part.allowed.questionDocumentIds], ["doc-q1", "doc-q2", "doc-q3", "doc-q5"]);
  assert.deepEqual([...(part.allowed.controllerChoiceLabels.get("Q2") ?? [])], ["Yes", "No", "Not sure"]);
  assert.deepEqual([...part.allowed.sourceRefs].sort(), ["Q1", "Q2", "file-1", "instruction", "note-1", "request.description", "request.title"]);
  assert.deepEqual(part.summary, { scope: "questionnaire", questionsOffered: 4, answered: 2, answerContent: "included", openItemsListed: 1, rejectedItemsListed: 1, rejectedItemsTotal: 1, removedListed: 1 });
});

test("a questionnaire in analyst review holding drafts is withheld: no answers section, answered questions still flagged", () => {
  const part = buildQuestionnaireProposalContext(input({ answerContent: "withheld", questions: questions().map(({ answerLabel: _label, ...rest }) => rest) }));
  assert.equal(part.answers, null, "WITHHELD_ANSWERS_SENT");
  const text = rendered(part);
  assert.ok(text.includes(value("Q1.answered", "yes")) && text.includes(value("Q2.answered", "yes")));
  assert.ok(!text.includes("Unsigned payment files") && !text.includes(".answer<"), "WITHHELD_ANSWER_RENDERED");
  // An answered question's content was not offered, so it cannot be cited.
  assert.ok(!part.allowed.sourceRefs.has("Q1") && !part.allowed.sourceRefs.has("Q2"), "WITHHELD_ANSWER_CITABLE");
  assert.deepEqual([...part.allowed.answeredRefs], ["Q1", "Q2"]);
  assert.equal(part.summary.answerContent, "withheld");
  assert.equal(part.summary.answered, 2);
});

test("an answer label offered with withheld content is never rendered", () => {
  const part = buildQuestionnaireProposalContext(input({ answerContent: "withheld" }));
  assert.equal(part.answers, null);
  assert.ok(!rendered(part).includes("Unsigned payment files"));
});

test("a rewrite holds the target and its section in full and other active question texts only, with no answers and no lists", () => {
  const part = buildQuestionnaireProposalContext(input({ scope: "question", targetQuestionDocumentId: "doc-q3", instructionSource: "plain-language-preset" }));
  const text = rendered(part);
  assert.equal(part.answers, null, "REWRITE_SENT_ANSWERS");
  assert.ok(text.includes(value("Q3.questionText", "Which country hosts the processor?")) && text.includes(value("Q3.section", "Payment processing")));
  assert.ok(text.includes(value("Q3.answerType", "Text")) && text.includes(value("Q3.visibility", "Q2 equals Yes")) && text.includes(value("Q3.target", "yes")));
  assert.ok(text.includes(value("Q1.questionText", "Are payment files signed?")) && text.includes(value("Q4.questionText", "Other recovery notes?")));
  for (const absent of ["Q1.helpText", "Q1.answered", "Q2.choice", "Q4.section", "P1.", "X1.", "R1.", "Unsigned payment files", "Was the old signing step retired?"]) assert.ok(!text.includes(absent), `REWRITE_RENDERED_${absent}`);
  assert.deepEqual([...part.allowed.questionDocumentIds], ["doc-q3"]);
  assert.deepEqual([...part.allowed.sourceRefs].sort(), ["file-1", "instruction", "note-1", "request.description", "request.title"]);
  assert.deepEqual(part.summary, { scope: "question", questionsOffered: 4, answered: 0, answerContent: "withheld", openItemsListed: 0, rejectedItemsListed: 0, rejectedItemsTotal: 0, removedListed: 0 });
  assert.throws(() => buildQuestionnaireProposalContext(input({ scope: "question", targetQuestionDocumentId: "doc-q4" })), "A_REMOVED_TARGET_WAS_OFFERED");
  assert.throws(() => buildQuestionnaireProposalContext(input({ scope: "question" })), "A_REWRITE_WITHOUT_A_TARGET_WAS_BUILT");
});

test("no instruction offers no instruction source", () => {
  const part = buildQuestionnaireProposalContext(input({ instructionSource: "default-task" }));
  assert.ok(!part.allowed.sourceRefs.has("instruction"));
});

test("over its bounds the part is too large, never silently cut; the rejected list is ranked with its total", () => {
  const many = (count: number, removed = false) => Array.from({ length: count }, (_, index) => question(index + 1, { removed }));
  assert.equal(QUESTIONNAIRE_CONTEXT_BOUNDS.activeQuestions, 150);
  assert.doesNotThrow(() => buildQuestionnaireProposalContext(input({ questions: many(150), openItems: [], rejectedItems: [] })));
  assert.throws(() => buildQuestionnaireProposalContext(input({ questions: many(151), openItems: [], rejectedItems: [] })), AssessmentContextTooLargeError);
  const openItems = Array.from({ length: 201 }, (_, index) => ({ kind: "add" as const, questionText: `Open item ${index}?` }));
  assert.doesNotThrow(() => buildQuestionnaireProposalContext(input({ openItems: openItems.slice(0, 200) })));
  assert.throws(() => buildQuestionnaireProposalContext(input({ openItems })), AssessmentContextTooLargeError);
  assert.throws(() => buildQuestionnaireProposalContext(input({ questions: [...questions(), ...many(201, true).map((row, index) => ({ ...row, documentId: `removed-${index}` }))] })), AssessmentContextTooLargeError);

  const day = (index: number) => new Date(Date.UTC(2026, 0, 1) + index * 3_600_000).toISOString();
  const rejectedItems = Array.from({ length: 150 }, (_, index) => ({ kind: "add" as const, questionText: `Rejected item ${index}?`, reason: `Reason ${index}.`, decidedAt: day(index) }));
  const part = buildQuestionnaireProposalContext(input({ rejectedItems }));
  assert.equal(part.summary.rejectedItemsListed, 100);
  assert.equal(part.summary.rejectedItemsTotal, 150);
  const reference = renderReferenceDataBlock(part.reference);
  // The most recent first: item 149 is X1, item 50 is X100, item 49 is left out and counted.
  assert.ok(reference.includes(value("X1.questionText", "Rejected item 149?")) && reference.includes(value("X100.questionText", "Rejected item 50?")));
  assert.ok(!reference.includes("Rejected item 49?") && !reference.includes("X101."));
});

test("no rendered text carries a documentId, a question key, a section key, a choice value, a person's name or an ISO date", () => {
  const part = buildQuestionnaireProposalContext(input({ rejectedItems: [{ kind: "change", questionText: "Is the vendor reviewed?", reason: "Covered by Q1.", decidedAt: "2026-10-10T08:30:00.000Z" }] }));
  const text = rendered(part);
  for (const leaked of ["doc-q", "key-q", "payment-section", "resilience-section", "not-sure", "2026-10-10", "decidedAt", "Morgan"]) assert.ok(!text.includes(leaked), `RENDERED_${leaked}`);
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(text), "RENDERED_AN_ISO_DATE");
});
