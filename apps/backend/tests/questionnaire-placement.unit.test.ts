import assert from "node:assert/strict";
import test from "node:test";
import { parseQuestionnaireDefinition, type QuestionnaireDefinitionQuestion } from "../src/api/csrm-questionnaire/services/questionnaire-definition";
import {
  allocateQuestionKey,
  createBatchAllocation,
  newSectionKey,
  placeAddition,
} from "../src/api/csrm-questionnaire/services/questionnaire-placement";

/*
 * Phase 15 D-13 and D-22: a confirmed addition lands at the end of its section, or in a new section after the last
 * one, counting removed questions, and never moves an existing question. Keys are unique among every question key,
 * removed ones included, and every key allocated earlier in the same batch. The rules equal the browser module's
 * (apps/csrm/src/features/questionnaires/questionnaire-placement.ts, plan 10-09), whose case table is copied below.
 */

type Section = { key: string; title: string; description?: string; order: number };
type Raw = { key: string; section: Section; order: number; removed?: boolean; text?: string };

function definition(questions: readonly Raw[]): QuestionnaireDefinitionQuestion[] {
  return parseQuestionnaireDefinition(questions.map((question) => ({
    documentId: `doc-${question.key}`,
    questionText: question.text ?? `Question ${question.key}?`,
    answerType: "Text",
    options: {
      schemaVersion: 2,
      questionKey: question.key,
      section: question.section,
      order: question.order,
      required: true,
      ...(question.removed ? { deleted: { deletedAt: "2026-10-11T08:00:00.000Z", deletedBy: "analyst-1" } } : {}),
    },
    answer: null,
  })));
}

const general: Section = { key: "general", title: "General", description: "About the service.", order: 0 };
const hostingSection: Section = { key: "section-hosting", title: "Hosting", order: 1 };
const archived: Section = { key: "archived", title: "Archived", order: 3 };
const questionnaire = (): QuestionnaireDefinitionQuestion[] => definition([
  { key: "service-name", section: general, order: 0 },
  { key: "service-owner", section: general, order: 3 },
  { key: "who-supports-it", section: general, order: 7, removed: true, text: "Who supports it?" },
  { key: "hosting-model", section: hostingSection, order: 0 },
  { key: "old-question", section: archived, order: 0, removed: true },
]);

test("an addition to an existing section goes one past its highest order, a removed question counted, with the stored metadata", () => {
  assert.deepEqual(placeAddition(createBatchAllocation(questionnaire()), { kind: "existing", key: "general" }), { section: general, order: 8 });
});

test("two additions to one existing section in a batch take consecutive orders", () => {
  const allocation = createBatchAllocation(questionnaire());
  assert.equal(placeAddition(allocation, { kind: "existing", key: "general" })?.order, 8);
  assert.equal(placeAddition(allocation, { kind: "existing", key: "general" })?.order, 9);
});

test("a section no question holds offers no placement", () => {
  assert.equal(placeAddition(createBatchAllocation(questionnaire()), { kind: "existing", key: "missing" }), null);
});

test("a new section goes after the highest section order, a removed question's counted, and its question at order 0", () => {
  assert.deepEqual(placeAddition(createBatchAllocation(questionnaire()), { kind: "new", title: "Offshore support" }), {
    section: { key: "section-offshore-support", title: "Offshore support", order: 4 },
    order: 0,
  });
});

test("a second addition to the same new title in a batch reuses that section at its next order", () => {
  const allocation = createBatchAllocation(questionnaire());
  placeAddition(allocation, { kind: "new", title: "Offshore support" });
  assert.deepEqual(placeAddition(allocation, { kind: "new", title: "  offshore SUPPORT " }), {
    section: { key: "section-offshore-support", title: "Offshore support", order: 4 },
    order: 1,
  });
  assert.deepEqual(placeAddition(allocation, { kind: "new", title: "Data handling" }), {
    section: { key: "section-data-handling", title: "Data handling", order: 5 },
    order: 0,
  }, "A_SECOND_NEW_SECTION_DID_NOT_FOLLOW_THE_FIRST");
});

test("a title that slugs to a section key a question holds is numbered", () => {
  assert.equal(placeAddition(createBatchAllocation(questionnaire()), { kind: "new", title: "Hosting!" })?.section.key, "section-hosting-2");
});

test("a title with no letters or digits gives the key section", () => {
  assert.equal(placeAddition(createBatchAllocation(questionnaire()), { kind: "new", title: "¿¡ — !?" })?.section.key, "section");
  assert.equal(newSectionKey("", new Set()), "section", "AN_EMPTY_SLUG_DID_NOT_GIVE_SECTION");
});

test("a blank title offers no placement", () => {
  assert.equal(placeAddition(createBatchAllocation(questionnaire()), { kind: "new", title: "   " }), null);
});

test("a 130-character title's key, and its numbered successor, fit inside 120 characters", () => {
  const title = `${"Offshore support ".repeat(8)}abc`.slice(0, 130);
  assert.equal(title.length, 130);
  const allocation = createBatchAllocation(questionnaire());
  const first = placeAddition(allocation, { kind: "new", title });
  assert.ok(first);
  assert.ok(first.section.key.length <= 120, first.section.key);
  assert.ok(!first.section.key.endsWith("-"));
  const second = newSectionKey(title, new Set([first.section.key]));
  assert.ok(second.length <= 120, second);
  assert.ok(second.endsWith("-2"), second);
});

test("placement never moves an existing question", () => {
  const before = questionnaire();
  const snapshot = structuredClone(before);
  const allocation = createBatchAllocation(before);
  placeAddition(allocation, { kind: "existing", key: "general" });
  placeAddition(allocation, { kind: "new", title: "Offshore support" });
  allocateQuestionKey("Where is the team based?", allocation);
  assert.deepEqual(before, snapshot);
});

test("question keys follow the governance rule and skip every key taken, in the batch and by removed questions", () => {
  const allocation = createBatchAllocation(questionnaire());
  assert.equal(allocateQuestionKey("Where is the team based?", allocation), "where-is-the-team-based");
  assert.equal(allocateQuestionKey("Where is the team based?", allocation), "where-is-the-team-based-2");
  assert.equal(allocateQuestionKey("Who supports it?", allocation), "who-supports-it-2", "A_REMOVED_QUESTION_KEY_WAS_REUSED");
  assert.equal(allocateQuestionKey("¿¡ — !?", allocation), "question");
  assert.equal(allocateQuestionKey("x".repeat(200), allocation).length, 110);
});

/*
 * The 10-09 browser case table (apps/csrm/src/features/questionnaires/questionnaire-placement.test.ts), restated on
 * the server: the hosted provider's `section-N` from order 0, the deterministic provider's `context` at 0, and the
 * seeded questionnaires' sections from order 1.
 */
const hostedScope: Section = { key: "section-1", title: "Service scope", order: 0 };
const hostedData: Section = { key: "section-2", title: "Data handling", description: "How the service treats personal data.", order: 1 };
const hosted = (): Raw[] => [
  { key: "q-1", section: hostedScope, order: 0 },
  { key: "q-2", section: hostedScope, order: 1 },
  { key: "q-3", section: hostedScope, order: 2, removed: true },
  { key: "q-4", section: hostedData, order: 0 },
  { key: "q-5", section: hostedData, order: 1 },
];
const requestContext: Section = { key: "context", title: "Request context", order: 0 };
const thirdParty: Section = { key: "third-party", title: "Third-party involvement", order: 1 };
const deterministic = (): Raw[] => [
  { key: "security-objectives", section: requestContext, order: 0 },
  { key: "business-criticality", section: requestContext, order: 1, removed: true },
  { key: "third-party-involvement", section: thirdParty, order: 0 },
  { key: "third-party-details", section: thirdParty, order: 1 },
];
const service: Section = { key: "service", title: "Service", order: 1 };
const hosting: Section = { key: "hosting", title: "Hosting", order: 2 };
const seeded = (): Raw[] => [
  { key: "service-name", section: service, order: 1 },
  { key: "service-description", section: service, order: 2 },
  { key: "production-url", section: service, order: 3, removed: true },
  { key: "hosting-model", section: hosting, order: 1 },
];

test("10-09 cases: an existing section's next order counts the removed question and keeps the stored section", () => {
  const cases: Array<[string, Raw[], Section, number]> = [["hosted", hosted(), hostedScope, 3], ["deterministic", deterministic(), requestContext, 2], ["seeded", seeded(), service, 4]];
  for (const [shape, questions, section, order] of cases) {
    assert.deepEqual(placeAddition(createBatchAllocation(definition(questions)), { kind: "existing", key: section.key }), { section, order }, shape);
  }
  assert.deepEqual(placeAddition(createBatchAllocation(definition(hosted())), { kind: "existing", key: "section-2" }), { section: hostedData, order: 2 }, "THE_DESCRIPTION_WAS_NOT_KEPT");
  const withArchive = definition([...seeded(), { key: "old", section: { key: "archived", title: "Archived", order: 3 }, order: 4, removed: true }]);
  assert.deepEqual(placeAddition(createBatchAllocation(withArchive), { kind: "existing", key: "archived" }), { section: { key: "archived", title: "Archived", order: 3 }, order: 5 });
  assert.equal(placeAddition(createBatchAllocation(definition(seeded())), { kind: "existing", key: "general" }), null);
});

test("10-09 cases: a new section opens at the next free section order", () => {
  const cases: Array<[string, Raw[], number]> = [["hosted", hosted(), 2], ["deterministic", deterministic(), 2], ["seeded", seeded(), 3]];
  for (const [shape, questions, sectionOrder] of cases) {
    assert.deepEqual(placeAddition(createBatchAllocation(definition(questions)), { kind: "new", title: "Offshore support" }), {
      section: { key: "section-offshore-support", title: "Offshore support", order: sectionOrder },
      order: 0,
    }, shape);
  }
});

test("10-09 cases: new section keys skip removed and taken keys, trim the title, and fall back to section", () => {
  const offshore: Section = { key: "section-offshore-support", title: "Offshore support", order: 4 };
  assert.deepEqual(placeAddition(createBatchAllocation(definition([...seeded(), { key: "removed-offshore", section: offshore, order: 0, removed: true }])), { kind: "new", title: "Offshore support" }), {
    section: { key: "section-offshore-support-2", title: "Offshore support", order: 5 },
    order: 0,
  });
  const taken = [1, 2, 3].map((n): Raw => ({ key: `offshore-${n}`, section: { key: n === 1 ? "section-offshore-support" : `section-offshore-support-${n}`, title: "Offshore support", order: 2 + n }, order: 0 }));
  assert.equal(placeAddition(createBatchAllocation(definition([...seeded(), ...taken])), { kind: "new", title: "Offshore support" })?.section.key, "section-offshore-support-4");
  assert.deepEqual(placeAddition(createBatchAllocation(definition(seeded())), { kind: "new", title: "  Cloud & On-premises (2026)  " })?.section, { key: "section-cloud-on-premises-2026", title: "Cloud & On-premises (2026)", order: 3 });
  assert.equal(placeAddition(createBatchAllocation(definition(seeded())), { kind: "new", title: "¿¡ — !?" })?.section.key, "section");
  assert.equal(placeAddition(createBatchAllocation(definition([...seeded(), { key: "x", section: { key: "section", title: "—", order: 3 }, order: 0 }])), { kind: "new", title: "—" })?.section.key, "section-2");
});

test("10-09 cases: a long title's key and its numbered successor stay within 120 characters", () => {
  const title = "Offshore support ".repeat(12);
  const first = placeAddition(createBatchAllocation(definition(seeded())), { kind: "new", title });
  assert.ok(first);
  assert.ok(first.section.key.length <= 120);
  assert.match(first.section.key, /^section-offshore-support-offshore/);
  assert.ok(!first.section.key.endsWith("-"));
  const second = placeAddition(createBatchAllocation(definition([...seeded(), { key: "long", section: first.section, order: 0 }])), { kind: "new", title });
  assert.ok(second);
  assert.ok(second.section.key.length <= 120);
  assert.ok(second.section.key.endsWith("-2"));
  assert.notEqual(second.section.key, first.section.key);
});

test("10-09 cases: the first section of an empty set opens at order 0", () => {
  assert.deepEqual(placeAddition(createBatchAllocation([]), { kind: "new", title: "General" }), { section: { key: "section-general", title: "General", order: 0 }, order: 0 });
});
