import assert from "node:assert/strict";
import test from "node:test";
import { foldItemStates } from "../src/csrm/ai/proposal-items";
import {
  addBase,
  ADJUSTMENT_CODES,
  changeBase,
  isItemStale,
  parseQuestionnaireDecisionEvents,
  parseQuestionnaireProposal,
  questionFingerprint,
  QUESTIONNAIRE_PROPOSAL_OPERATIONS,
  SOURCE_KINDS,
  type LiveQuestion,
  type LiveQuestionnaire,
  type ProposedSection,
  type ProposedVisibility,
  type QuestionFingerprintInput,
  type QuestionnaireProposalItem,
} from "../src/api/csrm-questionnaire/services/questionnaire-proposal-envelope";

/*
 * Phase 15 D-20 and the approved amendment "Questionnaire proposal envelope v1" and "Decision event v2 and item
 * states" (docs/contract-gaps/phase-12-ai-run-record-and-provenance.md): the stored proposal and its decisions parse
 * closed, and anything malformed reads as null without throwing.
 */
const FINGERPRINT_A = `sha256:${"a".repeat(64)}`;
const FINGERPRINT_B = `sha256:${"b".repeat(64)}`;
const FINGERPRINT_C = `sha256:${"c".repeat(64)}`;

const addItem = {
  key: "i-1",
  kind: "add",
  proposed: {
    questionText: "Which country is the offshore support team based in?",
    helpText: "Name the country where the people who support the service work.",
    answerType: "Single select",
    choices: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not-sure", label: "Not sure" }],
    required: true,
    section: { kind: "new", title: "Offshore support" },
    visibility: { questionKey: "uses-offshore-support", operator: "equals", value: "yes" },
  },
  rationale: "The request mentions an offshore support arrangement.",
  sources: [{ kind: "request-field", ref: "request.description" }, { kind: "note", ref: "note-1" }],
  base: {
    kind: "placement",
    generatedAt: "2026-10-10T09:00:00.000Z",
    section: { kind: "new", title: "Offshore support" },
    controller: { questionKey: "uses-offshore-support", fingerprint: FINGERPRINT_A },
  },
};

const changeItem = {
  key: "i-2",
  kind: "change",
  target: { questionDocumentId: "question-2", questionKey: "data-location", textSnapshot: "Where is data stored?" },
  proposed: {
    questionText: "Where is the service's data stored?",
    helpText: null,
    answerType: "Text",
    choices: [],
    required: false,
  },
  rationale: "The question did not say which data it means.",
  sources: [{ kind: "instruction", ref: "instruction" }],
  base: { kind: "question", fingerprint: FINGERPRINT_B, unanswered: true },
};

const removeItem = {
  key: "i-3",
  kind: "remove",
  target: { questionDocumentId: "question-3", questionKey: "fax-usage", textSnapshot: "Do you use a fax machine?" },
  rationale: "The request has no paper channel.",
  sources: [{ kind: "answered-question", ref: "Q2" }, { kind: "file", ref: "file-1" }],
  base: { kind: "question", fingerprint: FINGERPRINT_C, unanswered: true },
};

const envelope = {
  schemaVersion: 1,
  operation: "questionnaire-proposals",
  outcome: "items",
  items: [addItem, changeItem, removeItem],
  adjustments: [
    { code: "near-duplicate", wireIndex: 3, detail: "A proposed question repeated an existing question and was left out." },
    { code: "over-limit", count: 4, detail: "Four proposed additions above the limit were left out." },
  ],
};

const clone = <T>(value: T): T => structuredClone(value);
type Mutable = Record<string, unknown> & { items: Array<Record<string, unknown>>; adjustments: Array<Record<string, unknown>> };
const variant = (mutate: (value: Mutable) => void): unknown => {
  const value = clone(envelope) as unknown as Mutable;
  mutate(value);
  return value;
};

test("the closed vocabularies are the amendment's", () => {
  assert.deepEqual([...QUESTIONNAIRE_PROPOSAL_OPERATIONS], ["questionnaire-proposals", "question-rewrite"]);
  assert.deepEqual([...SOURCE_KINDS], ["request-field", "note", "file", "answered-question", "instruction"]);
  assert.deepEqual([...ADJUSTMENT_CODES], [
    "answered-target", "removed-target", "unknown-target", "duplicate-target", "invalid-item", "near-duplicate", "no-change",
    "definition-invalid", "answers-affected", "rewrite-out-of-scope", "over-limit", "ignored-field", "sources-dropped",
  ]);
});

test("a v1 envelope with an addition, a change, a removal and two adjustments round-trips", () => {
  const parsed = parseQuestionnaireProposal(clone(envelope));
  assert.ok(parsed, "THE_ENVELOPE_DID_NOT_PARSE");
  assert.deepEqual(parsed, envelope);
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.items[0]));
});

test("a no-change envelope holds no item", () => {
  const noChange = { schemaVersion: 1, operation: "question-rewrite", outcome: "no-change", items: [], adjustments: [{ code: "no-change", detail: "The rewrite equals the question." }] };
  assert.deepEqual(parseQuestionnaireProposal(clone(noChange)), noChange);
  assert.equal(parseQuestionnaireProposal({ ...noChange, items: [changeItem] }), null, "A_NO_CHANGE_OUTCOME_HELD_AN_ITEM");
  assert.equal(parseQuestionnaireProposal({ ...noChange, outcome: "items" }), null, "AN_ITEMS_OUTCOME_HELD_NO_ITEM");
});

test("anything malformed reads as null and never throws", () => {
  const malformed: Array<[string, unknown]> = [
    ["schemaVersion 2", variant((value) => { value.schemaVersion = 2; })],
    ["an unknown top-level key", variant((value) => { value.extra = true; })],
    ["an unknown item key", variant((value) => { value.items[1].extra = true; })],
    ["an unknown proposed key", variant((value) => { (value.items[1].proposed as Record<string, unknown>).extra = true; })],
    ["an unknown base key", variant((value) => { (value.items[2].base as Record<string, unknown>).extra = true; })],
    ["an unknown target key", variant((value) => { (value.items[2].target as Record<string, unknown>).extra = true; })],
    ["an unknown adjustment key", variant((value) => { value.adjustments[0].extra = true; })],
    ["item key i-31", variant((value) => { value.items[2].key = "i-31"; })],
    ["a kind outside the three", variant((value) => { value.items[2].kind = "move"; })],
    ["help text of 2,001 characters", variant((value) => { (value.items[1].proposed as Record<string, unknown>).helpText = "x".repeat(2_001); })],
    ["11 sources", variant((value) => { value.items[0].sources = Array.from({ length: 11 }, (_, index) => ({ kind: "note", ref: `note-${index + 1}` })); })],
    ["a source kind outside the five", variant((value) => { value.items[0].sources = [{ kind: "web", ref: "request.title" }]; })],
    ["an adjustment code outside the thirteen", variant((value) => { value.adjustments[0].code = "silently-dropped"; })],
    ["a non-array items", variant((value) => { (value as Record<string, unknown>).items = { 0: addItem }; })],
    ["an operation outside the two", variant((value) => { value.operation = "questionnaire-generation"; })],
    ["a change without its target", variant((value) => { delete value.items[1].target; })],
    ["a removal with a proposal", variant((value) => { value.items[2].proposed = changeItem.proposed; })],
    ["a change that moves its question", variant((value) => { (value.items[1].proposed as Record<string, unknown>).section = { kind: "existing", key: "general" }; })],
    ["an addition without a section", variant((value) => { delete (value.items[0].proposed as Record<string, unknown>).section; })],
    ["an addition of a Boolean question", variant((value) => { Object.assign(value.items[0].proposed as Record<string, unknown>, { answerType: "Boolean", choices: [] }); })],
    ["a select with one choice", variant((value) => { (value.items[0].proposed as Record<string, unknown>).choices = [{ value: "yes", label: "Yes" }]; })],
    ["a text question with choices", variant((value) => { (value.items[1].proposed as Record<string, unknown>).choices = [{ value: "a", label: "A" }, { value: "b", label: "B" }]; })],
    ["labels that differ only by case", variant((value) => { (value.items[0].proposed as Record<string, unknown>).choices = [{ value: "a", label: "Yes" }, { value: "b", label: "YES" }]; })],
    ["a change with a placement base", variant((value) => { value.items[1].base = addItem.base; })],
    ["a malformed fingerprint", variant((value) => { value.items[2].base = { kind: "question", fingerprint: "sha256:ABC", unanswered: true }; })],
    ["a base that is not unanswered", variant((value) => { value.items[2].base = { kind: "question", fingerprint: FINGERPRINT_C, unanswered: false }; })],
    ["two items on one target", variant((value) => { value.items[2].target = changeItem.target; })],
    ["duplicate item keys", variant((value) => { value.items[2].key = "i-2"; })],
    ["a controller without a visibility rule", variant((value) => { delete (value.items[0].proposed as Record<string, unknown>).visibility; })],
    ["a rationale of 1,001 characters", variant((value) => { value.items[1].rationale = "x".repeat(1_001); })],
    ["an adjustment detail of 501 characters", variant((value) => { value.adjustments[0].detail = "x".repeat(501); })],
    ["61 adjustments", variant((value) => { value.adjustments = Array.from({ length: 61 }, () => ({ code: "over-limit", detail: "Left out." })); })],
    ["a string", "not an envelope"],
    ["null", null],
  ];
  for (const [name, candidate] of malformed) {
    assert.doesNotThrow(() => parseQuestionnaireProposal(candidate), name);
    assert.equal(parseQuestionnaireProposal(candidate), null, name);
  }
});

test("15 additions parse and 16 do not", () => {
  const additions = (count: number) => Array.from({ length: count }, (_, index) => ({
    ...clone(addItem),
    key: `i-${index + 1}`,
    proposed: { ...clone(addItem.proposed), questionText: `Question ${index + 1}?` },
  }));
  assert.ok(parseQuestionnaireProposal({ ...clone(envelope), items: additions(15) }), "FIFTEEN_ADDITIONS_WERE_REFUSED");
  assert.equal(parseQuestionnaireProposal({ ...clone(envelope), items: additions(16) }), null);
});

test("the allowed sets gate targets and source references", () => {
  const allowed = { questionDocumentIds: new Set(["question-2", "question-3"]), sourceRefs: new Set(["request.description", "note-1", "instruction", "Q2", "file-1"]) };
  assert.ok(parseQuestionnaireProposal(clone(envelope), allowed));
  assert.equal(parseQuestionnaireProposal(clone(envelope), { ...allowed, questionDocumentIds: new Set(["question-2"]) }), null, "AN_UNKNOWN_TARGET_PARSED");
  assert.equal(parseQuestionnaireProposal(clone(envelope), { ...allowed, sourceRefs: new Set(["request.description", "note-1", "instruction", "Q2"]) }), null, "AN_UNKNOWN_SOURCE_PARSED");
});

const SNAPSHOT = {
  questionDocumentId: "question-2",
  questionKey: "data-location",
  questionText: "Where is data stored?",
  helpText: null,
  answerType: "Text",
  choices: null,
  required: false,
  section: { key: "general", title: "General", order: 0 },
  order: 2,
  visibility: null,
  removed: false,
};
const APPLIED = { questionDocumentId: "question-2", questionKey: "data-location", fingerprint: FINGERPRINT_B };
const decisionEvents = [
  { schemaVersion: 2, at: "2026-10-11T08:00:00.000Z", by: "analyst-1", item: "i-2", action: "accepted", edits: ["questionText"], before: SNAPSHOT, applied: APPLIED },
  { schemaVersion: 2, at: "2026-10-11T08:05:00.000Z", by: "analyst-1", item: "i-2", action: "restored" },
  { schemaVersion: 2, at: "2026-10-11T08:06:00.000Z", by: "analyst-1", item: "i-3", action: "rejected", reason: "The question is still needed." },
];

test("questionnaire decision events parse an accept with its snapshot, a restore and a rejection", () => {
  const events = parseQuestionnaireDecisionEvents(structuredClone(decisionEvents));
  assert.ok(events, "THE_EVENTS_DID_NOT_PARSE");
  assert.deepEqual(events, decisionEvents);
  assert.deepEqual(Object.fromEntries(foldItemStates(["i-1", "i-2", "i-3"], events) ?? []), { "i-1": "open", "i-2": "open", "i-3": "rejected" });
});

test("questionnaire decision events refuse anything outside the closed shape", () => {
  const [accepted, , rejected] = decisionEvents;
  const malformed: Array<[string, unknown]> = [
    ["schemaVersion 1", [{ ...accepted, schemaVersion: 1 }]],
    ["a reason of 501 characters", [{ ...rejected, reason: "x".repeat(501) }]],
    ["an empty by", [{ ...rejected, by: "" }]],
    ["an edit outside the six field names", [{ ...accepted, edits: ["visibility"] }]],
    ["an unknown key", [{ ...rejected, note: "extra" }]],
    ["a snapshot with an unknown key", [{ ...accepted, before: { ...SNAPSHOT, answer: "x" } }]],
    ["a snapshot without its question key", [{ ...accepted, before: { ...SNAPSHOT, questionKey: undefined } }]],
    ["an applied fact with a malformed fingerprint", [{ ...accepted, applied: { ...APPLIED, fingerprint: "md5:abc" } }]],
  ];
  for (const [name, candidate] of malformed) assert.equal(parseQuestionnaireDecisionEvents(structuredClone(candidate)), null, name);
});

/*
 * Task 2 (D-20, D-25; the amendment's "Bases and staleness"): a base records what an item was proposed against,
 * and an item is stale exactly when that basis no longer holds.
 */
const fingerprintInput = (): QuestionFingerprintInput => ({
  questionText: "Where is data stored?",
  helpText: "Name the country or the cloud region.",
  answerType: "Single select",
  choices: [{ value: "onshore", label: "Onshore" }, { value: "offshore", label: "Offshore" }, { value: "not-sure", label: "Not sure" }],
  required: true,
  section: { key: "general", title: "General", order: 0 },
  order: 2,
  visibility: { questionKey: "stores-data", operator: "equals", value: "yes" },
  removed: false,
});

test("a fingerprint ignores object key order and reads sha256 with 64 lowercase hex characters", () => {
  const input = fingerprintInput();
  const reordered = Object.fromEntries(Object.entries(input).reverse()) as QuestionFingerprintInput;
  reordered.section = { order: 0, title: "General", key: "general" };
  reordered.visibility = { value: "yes", operator: "equals", questionKey: "stores-data" };
  reordered.choices = input.choices?.map(({ value, label }) => ({ label, value })) ?? null;
  assert.match(questionFingerprint(input), /^sha256:[0-9a-f]{64}$/);
  assert.equal(questionFingerprint(reordered), questionFingerprint(input));
});

test("a fingerprint changes when any one of its nine fields changes", () => {
  const original = questionFingerprint(fingerprintInput());
  const changes: Array<[string, (input: QuestionFingerprintInput) => void]> = [
    ["questionText", (input) => { input.questionText = "Where is the data kept?"; }],
    ["helpText", (input) => { input.helpText = null; }],
    ["answerType", (input) => { input.answerType = "Multi select"; }],
    ["choices", (input) => { input.choices = [{ value: "onshore", label: "In Australia" }, { value: "offshore", label: "Offshore" }, { value: "not-sure", label: "Not sure" }]; }],
    ["required", (input) => { input.required = false; }],
    ["section", (input) => { input.section = { key: "general", title: "General", order: 1 }; }],
    ["order", (input) => { input.order = 3; }],
    ["visibility", (input) => { input.visibility = null; }],
    ["removed", (input) => { input.removed = true; }],
  ];
  for (const [field, change] of changes) {
    const input = fingerprintInput();
    change(input);
    assert.notEqual(questionFingerprint(input), original, field);
  }
});

test("blank help text fingerprints as null help text", () => {
  assert.equal(questionFingerprint({ ...fingerprintInput(), helpText: "   " }), questionFingerprint({ ...fingerprintInput(), helpText: null }));
});

const liveQuestion = (documentId: string, questionKey: string, overrides: Partial<LiveQuestion> = {}): LiveQuestion => ({
  ...fingerprintInput(),
  visibility: null,
  documentId,
  questionKey,
  answered: false,
  ...overrides,
});

const live = (): LiveQuestionnaire => ({
  generatedDate: "2026-10-10T09:00:00.000Z",
  questions: [
    liveQuestion("question-1", "stores-data", {
      questionText: "Does the service store data?",
      choices: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not-sure", label: "Not sure" }],
      order: 0,
    }),
    liveQuestion("question-2", "data-location", { order: 1, visibility: { questionKey: "stores-data", operator: "equals", value: "yes" } }),
    liveQuestion("question-3", "fax-usage", { questionText: "Do you use a fax machine?", answerType: "Text", choices: null, helpText: null, order: 2 }),
    liveQuestion("question-4", "old-question", { questionText: "An old question?", answerType: "Text", choices: null, order: 3, removed: true }),
  ],
});

const questionOf = (questionnaire: LiveQuestionnaire, documentId: string): LiveQuestion => {
  const question = questionnaire.questions.find((entry) => entry.documentId === documentId);
  assert.ok(question, documentId);
  return question;
};

const changeOf = (questionnaire: LiveQuestionnaire, documentId: string): QuestionnaireProposalItem => {
  const question = questionOf(questionnaire, documentId);
  return {
    key: "i-1",
    kind: "change",
    target: { questionDocumentId: documentId, questionKey: question.questionKey, textSnapshot: question.questionText },
    proposed: { questionText: "A clearer question?", helpText: null, answerType: "Text", choices: [], required: false },
    rationale: "Clearer.",
    sources: [],
    base: changeBase(question),
  };
};

const removalOf = (questionnaire: LiveQuestionnaire, documentId: string): QuestionnaireProposalItem => {
  const question = questionOf(questionnaire, documentId);
  return {
    key: "i-2",
    kind: "remove",
    target: { questionDocumentId: documentId, questionKey: question.questionKey, textSnapshot: question.questionText },
    rationale: "Not needed.",
    sources: [],
    base: changeBase(question),
  };
};

const additionOf = (questionnaire: LiveQuestionnaire, placement: { section: ProposedSection; visibility?: ProposedVisibility }): QuestionnaireProposalItem => {
  const base = addBase(questionnaire, placement);
  assert.ok(base, "THE_ADDITION_HAD_NO_BASE");
  return {
    key: "i-3",
    kind: "add",
    proposed: { questionText: "Who supports the service?", helpText: null, answerType: "Text", choices: [], required: false, ...placement },
    rationale: "Support is not covered.",
    sources: [],
    base,
  };
};

test("a change or removal base is the question's fingerprint and the unanswered fact", () => {
  const question = questionOf(live(), "question-3");
  assert.deepEqual(changeBase(question), { kind: "question", fingerprint: questionFingerprint(question), unanswered: true });
});

test("an addition base records its placement, with the controller's fingerprint only under a visibility rule", () => {
  const questionnaire = live();
  const controller = questionOf(questionnaire, "question-1");
  assert.deepEqual(addBase(questionnaire, { section: { kind: "existing", key: "general" }, visibility: { questionKey: "stores-data", operator: "equals", value: "yes" } }), {
    kind: "placement",
    generatedAt: "2026-10-10T09:00:00.000Z",
    section: { kind: "existing", key: "general", title: "General", order: 0 },
    controller: { questionKey: "stores-data", fingerprint: questionFingerprint(controller) },
  });
  assert.deepEqual(addBase(questionnaire, { section: { kind: "new", title: "Offshore support" } }), {
    kind: "placement",
    generatedAt: "2026-10-10T09:00:00.000Z",
    section: { kind: "new", title: "Offshore support" },
    controller: null,
  });
  assert.equal(addBase(questionnaire, { section: { kind: "existing", key: "missing" } }), null, "A_MISSING_SECTION_HAD_A_BASE");
  assert.equal(addBase(questionnaire, { section: { kind: "new", title: "Later" }, visibility: { questionKey: "old-question", operator: "equals", value: "x" } }), null, "A_REMOVED_CONTROLLER_HAD_A_BASE");
});

test("a change is stale when its target's text changed, it became answered or it was removed, and fresh otherwise", () => {
  const item = changeOf(live(), "question-3");
  assert.equal(isItemStale(item, live()), false, "AN_UNCHANGED_TARGET_READ_STALE");
  const textChanged = live();
  questionOf(textChanged, "question-3").questionText = "Do you still use a fax machine?";
  assert.equal(isItemStale(item, textChanged), true, "A_CHANGED_TEXT_READ_FRESH");
  const answered = live();
  questionOf(answered, "question-3").answered = true;
  assert.equal(isItemStale(item, answered), true, "AN_ANSWERED_TARGET_READ_FRESH");
  const removed = live();
  questionOf(removed, "question-3").removed = true;
  assert.equal(isItemStale(item, removed), true, "A_REMOVED_TARGET_READ_FRESH");
  const gone = { ...live(), questions: live().questions.filter((question) => question.documentId !== "question-3") };
  assert.equal(isItemStale(item, gone), true, "A_MISSING_TARGET_READ_FRESH");
});

test("a removal is stale when its target is already removed or answered, and fresh while it is unchanged", () => {
  assert.equal(isItemStale(removalOf(live(), "question-3"), live()), false, "AN_UNCHANGED_REMOVAL_READ_STALE");
  const removed = live();
  questionOf(removed, "question-3").removed = true;
  assert.equal(isItemStale(removalOf(live(), "question-3"), removed), true, "A_REMOVAL_OF_A_REMOVED_QUESTION_READ_FRESH");
  const answered = live();
  questionOf(answered, "question-3").answered = true;
  assert.equal(isItemStale(removalOf(live(), "question-3"), answered), true, "A_REMOVAL_OF_AN_ANSWERED_QUESTION_READ_FRESH");
});

test("an addition is stale when the generation, its section or its controller moved, and fresh otherwise", () => {
  const toExisting = additionOf(live(), { section: { kind: "existing", key: "general" }, visibility: { questionKey: "stores-data", operator: "equals", value: "yes" } });
  const toNew = additionOf(live(), { section: { kind: "new", title: "Offshore support" } });
  assert.equal(isItemStale(toExisting, live()), false, "AN_UNCHANGED_ADDITION_READ_STALE");
  assert.equal(isItemStale(toNew, live()), false, "AN_ADDITION_TO_A_NEW_SECTION_READ_STALE");

  const regenerated = { ...live(), generatedDate: "2026-10-11T09:00:00.000Z" };
  assert.equal(isItemStale(toExisting, regenerated), true, "A_NEW_GENERATION_READ_FRESH");
  assert.equal(isItemStale(toNew, regenerated), true, "A_NEW_GENERATION_READ_FRESH_FOR_A_NEW_SECTION");

  const sectionRenamed = live();
  for (const question of sectionRenamed.questions) question.section = { key: "general", title: "About the service", order: 0 };
  // An addition with no visibility rule, so only its section can make it stale.
  const toExistingWithoutRule = additionOf(live(), { section: { kind: "existing", key: "general" } });
  assert.equal(isItemStale(toExistingWithoutRule, live()), false, "AN_UNCHANGED_ADDITION_WITHOUT_A_RULE_READ_STALE");
  assert.equal(isItemStale(toExistingWithoutRule, sectionRenamed), true, "A_RENAMED_SECTION_READ_FRESH");

  const sectionEmptied = live();
  for (const question of sectionEmptied.questions) question.removed = true;
  assert.equal(isItemStale(toNew, sectionEmptied), false, "A_NEW_SECTION_DEPENDS_ON_EXISTING_QUESTIONS");
  assert.equal(isItemStale(additionOf(live(), { section: { kind: "existing", key: "general" } }), sectionEmptied), true, "A_SECTION_WITH_NO_ACTIVE_QUESTION_READ_FRESH");

  const controllerChanged = live();
  questionOf(controllerChanged, "question-1").choices = [{ value: "yes", label: "Yes" }, { value: "not-sure", label: "Not sure" }];
  assert.equal(isItemStale(toExisting, controllerChanged), true, "A_CHANGED_CONTROLLER_READ_FRESH");

  const controllerRemoved = live();
  questionOf(controllerRemoved, "question-1").removed = true;
  assert.equal(isItemStale(toExisting, controllerRemoved), true, "A_REMOVED_CONTROLLER_READ_FRESH");
});

test("an equal generation date written another way is not a new generation", () => {
  const item = additionOf(live(), { section: { kind: "new", title: "Offshore support" } });
  assert.equal(isItemStale(item, { ...live(), generatedDate: "2026-10-10T09:00:00Z" }), false);
});
