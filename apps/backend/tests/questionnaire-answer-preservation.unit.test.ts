import assert from "node:assert/strict";
import test from "node:test";
import { parseQuestionnaireDefinition, type QuestionnaireDefinitionQuestion } from "../src/api/csrm-questionnaire/services/questionnaire-definition";
import {
  isAnsweredValue,
  keepsControllerValues,
  preservesAnswers,
  type PreservationRow,
} from "../src/api/csrm-questionnaire/services/questionnaire-answer-preservation";

/*
 * Phase 15 D-05 (QUES-12 criterion 2): no AI proposal changes or removes an answered question, directly or by hiding
 * it. "Answered" is one rule, the progress count's: an active question holding a non-empty answer value, draft or
 * submitted.
 */

const draft = (value: unknown) => ({ schemaVersion: 1, value, state: "draft", updatedAt: "2026-10-11T08:00:00.000Z" });

test("the answered rule is the progress count's", () => {
  assert.equal(isAnsweredValue({ value: "x" }), true);
  assert.equal(isAnsweredValue({ value: "  " }), true, "A_WHITESPACE_DRAFT_IS_ANSWERED_BY_THE_PROGRESS_RULE");
  assert.equal(isAnsweredValue({ value: false }), true);
  assert.equal(isAnsweredValue({ value: ["a"] }), true);
  assert.equal(isAnsweredValue(draft("Sydney")), true);
  assert.equal(isAnsweredValue({ value: "" }), false);
  assert.equal(isAnsweredValue({ value: [] }), false);
  assert.equal(isAnsweredValue({ value: null }), false);
  assert.equal(isAnsweredValue(null), false);
  assert.equal(isAnsweredValue("x"), false);
});

type RawQuestion = {
  key: string;
  text: string;
  type: QuestionnaireDefinitionQuestion["answerType"];
  order: number;
  choices?: Array<{ value: string; label: string }>;
  visibility?: { questionKey: string; operator: string; value: string | boolean };
  required?: boolean;
  removed?: boolean;
  answer?: unknown;
  helpText?: string | null;
};

const GENERAL = { key: "general", title: "General", order: 0 };
const YES_NO = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not-sure", label: "Not sure" }];
const HOSTING = [{ value: "cloud", label: "Cloud" }, { value: "on-prem", label: "On premises" }, { value: "not-sure", label: "Not sure" }];

const baseQuestions = (): RawQuestion[] => [
  { key: "mfa", text: "Is MFA enforced?", type: "Single select", order: 0, choices: YES_NO, answer: draft("yes") },
  { key: "hosting", text: "Where is the service hosted?", type: "Single select", order: 1, choices: HOSTING },
  // Answered while the hosting answer read "cloud"; that answer has since been cleared, so it is hidden today.
  { key: "cloud-provider", text: "Which cloud provider?", type: "Text", order: 2, visibility: { questionKey: "hosting", operator: "equals", value: "cloud" }, answer: draft("AWS") },
  { key: "backup", text: "How is data backed up?", type: "Text", order: 3, visibility: { questionKey: "hosting", operator: "notEquals", value: "on-prem" }, answer: draft("Nightly") },
  { key: "data-location", text: "Where is data stored?", type: "Text", order: 4, answer: draft("Sydney"), helpText: "Name the city." },
  { key: "team-size", text: "How big is the team?", type: "Text", order: 5 },
];

function rows(questions: readonly RawQuestion[]): PreservationRow[] {
  const definition = parseQuestionnaireDefinition(questions.map((question) => ({
    documentId: `doc-${question.key}`,
    questionText: question.text,
    answerType: question.type,
    options: {
      schemaVersion: 2,
      questionKey: question.key,
      section: GENERAL,
      order: question.order,
      required: question.required ?? true,
      ...(question.visibility ? { visibility: question.visibility } : {}),
      ...(question.choices ? { choices: question.choices } : {}),
      ...(question.removed ? { deleted: { deletedAt: "2026-10-11T08:00:00.000Z", deletedBy: "analyst-1" } } : {}),
    },
    answer: question.answer ?? null,
  })));
  return definition.map((question) => {
    const raw = questions.find((entry) => entry.key === question.questionKey);
    return { question, helpText: raw?.helpText ?? null, answer: raw?.answer ?? null };
  });
}

const changed = (key: string, change: Partial<RawQuestion>): RawQuestion[] => baseQuestions().map((question) => (question.key === key ? { ...question, ...change } : question));

test("an unanswered question's text may change", () => {
  assert.deepEqual(preservesAnswers(rows(baseQuestions()), rows(changed("team-size", { text: "How many people are in the team?" }))), { ok: true });
});

test("an addition preserves every answer", () => {
  const added = [...baseQuestions(), { key: "offshore", text: "Is support offshore?", type: "Single select" as const, order: 6, choices: YES_NO }];
  assert.deepEqual(preservesAnswers(rows(baseQuestions()), rows(added)), { ok: true });
});

test("an answered question's text, help text, choices or required flag may not change", () => {
  const before = rows(baseQuestions());
  assert.deepEqual(preservesAnswers(before, rows(changed("data-location", { text: "Where is the data kept?" }))), { ok: false, questionKey: "data-location" });
  assert.deepEqual(preservesAnswers(before, rows(changed("data-location", { helpText: "Name the country." }))), { ok: false, questionKey: "data-location" });
  assert.deepEqual(preservesAnswers(before, rows(changed("mfa", { choices: [{ value: "yes", label: "Yes, always" }, YES_NO[1], YES_NO[2]] }))), { ok: false, questionKey: "mfa" });
  assert.deepEqual(preservesAnswers(before, rows(changed("data-location", { required: false }))), { ok: false, questionKey: "data-location" });
});

test("an answered question may not be removed", () => {
  const before = rows(baseQuestions());
  assert.deepEqual(preservesAnswers(before, rows(changed("data-location", { removed: true }))), { ok: false, questionKey: "data-location" });
  const gone = baseQuestions().filter((question) => question.key !== "data-location");
  assert.deepEqual(preservesAnswers(before, rows(gone)), { ok: false, questionKey: "data-location" });
});

test("a Single select answer whose value leaves the choices is refused", () => {
  const before = rows(baseQuestions());
  assert.deepEqual(preservesAnswers(before, rows(changed("mfa", { choices: [{ value: "always", label: "Always" }, YES_NO[1], YES_NO[2]] }))), { ok: false, questionKey: "mfa" });
});

test("a hidden dependent: an unanswered controller's choice change that drops the value an answered dependent's rule reads is refused", () => {
  const before = rows(baseQuestions());
  const after = rows(changed("hosting", { choices: [{ value: "saas", label: "Software as a service" }, HOSTING[1], HOSTING[2]] }));
  assert.deepEqual(preservesAnswers(before, after), { ok: false, questionKey: "cloud-provider" });
});

test("a hidden dependent: an unanswered controller's change that hides an answered, visible dependent is refused", () => {
  const before = rows(baseQuestions());
  // The hosting question now shows only when MFA reads "no"; MFA reads "yes", so hosting and its dependent are hidden.
  const after = rows(changed("hosting", { visibility: { questionKey: "mfa", operator: "equals", value: "no" } }));
  assert.deepEqual(preservesAnswers(before, after), { ok: false, questionKey: "backup" });
});

test("an unanswered controller's relabelled choices preserve every answer", () => {
  const before = rows(baseQuestions());
  const after = rows(changed("hosting", { text: "Where does the service run?", choices: [{ value: "cloud", label: "Public cloud" }, HOSTING[1], HOSTING[2]] }));
  assert.deepEqual(preservesAnswers(before, after), { ok: true });
});

test("keepsControllerValues refuses a controller whose choices drop a value a dependent's rule reads", () => {
  const after = rows(changed("hosting", { choices: [{ value: "saas", label: "Software as a service" }, HOSTING[1], HOSTING[2]] }));
  assert.deepEqual(keepsControllerValues(after), { ok: false, questionKey: "hosting" });
});

test("keepsControllerValues accepts a controller that only relabels its choices", () => {
  const after = rows(changed("hosting", { choices: [{ value: "cloud", label: "Public cloud" }, { value: "on-prem", label: "In our data centre" }, HOSTING[2]] }));
  assert.deepEqual(keepsControllerValues(after), { ok: true });
  assert.deepEqual(keepsControllerValues(rows(baseQuestions())), { ok: true });
});

test("keepsControllerValues ignores a removed dependent", () => {
  const after = rows(baseQuestions().map((question) => {
    if (question.key === "hosting") return { ...question, choices: [{ value: "saas", label: "Software as a service" }, HOSTING[1], HOSTING[2]] };
    if (question.key === "cloud-provider") return { ...question, removed: true };
    return question;
  }));
  assert.deepEqual(keepsControllerValues(after), { ok: true });
});
