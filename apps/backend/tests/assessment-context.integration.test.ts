import assert from "node:assert/strict";
import test, { after } from "node:test";
import { EXTRACTOR_VERSION } from "../src/csrm/files/extraction";
import { promptDataTag } from "../src/csrm/prompt-data";
import { UAT_A_LIKE_NOTE_SENTINELS, uatALikeNotes } from "./fixtures/uat-a-like-context";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

test("mounted UAT-A-like request produces one minimised questionnaire context and policy decision", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeFixture();
  const { context, policy } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: fixture.requestId });
  assert.equal(policy.status, "allowed");
  assert.deepEqual(context.summary.classification, { level: "Restricted", source: "assets", ceiling: null, decision: "allowed" });
  assert.equal(context.summary.systems.length, 3);
  assert.equal(context.summary.assets.length, 1);
  assert.match(context.userPrompt, /Privacy Act 1988/);
  assert.match(context.userPrompt, /HR and payroll platform/);
  assert.match(context.userPrompt, /Restricted/);
  for (const secret of [harness.developmentEmails.jane, "UATA-SECRET-001", "2026-08-30", "Private asset comment", "Jane Doe"]) {
    assert.ok(!context.userPrompt.includes(secret), secret);
    assert.ok(!JSON.stringify(context.summary).includes(secret), secret);
  }
});

test("mounted draft includes every visible submitted answer and bounded reference libraries", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeFixture();
  const { context } = await harness.buildAssessmentContextFixture({ operation: "assessment-draft", requestId: fixture.requestId, questionnaireId: fixture.questionnaireId });
  for (const value of ["Are payment files signed?", "Describe the integrity control.", "Unsigned payment files", "Partial segregation of duties", "Has the pay-run fallback been tested?", "Not answered"]) assert.ok(context.userPrompt.includes(value), value);
  // The fallback is a choice question (WR-204), so its answer is sent by its choice's label.
  assert.ok(context.userPrompt.includes("<field>answer.value</field><value>No</value>"), "CHOICE_ANSWER_NOT_SENT_BY_ITS_LABEL");
  assert.equal(context.summary.questions.included, 4);
  assert.equal(context.summary.questions.answered, 3);
  assert.equal(context.summary.riskTypes.offered, 4);
  assert.ok(context.summary.controlCandidates.total >= 12);
  assert.equal(context.summary.characters, context.userPrompt.length);
  /*
   * IN-207: the UAT-A-like library's own Risk Types are offered by the names the deterministic draft maps, so their six
   * applicable controls are candidates; the seeded library's lexical shortlist (at most 80) adds the rest.
   */
  assert.deepEqual(context.summary.riskTypes.names, ["Internet Exposure", "Payment Integrity", "Personal Information Handling", "Third-Party Dependency"], "UAT_A_RISK_TYPES_NOT_OFFERED_BY_NAME");
  const candidates = Object.keys(context.allowed.controlCandidates);
  assert.equal(context.summary.controlCandidates.offered, candidates.length);
  for (let index = 1; index <= 6; index += 1) assert.ok(candidates.includes(`UATA-${String(index).padStart(3, "0")}`), `APPLICABLE_UATA-${String(index).padStart(3, "0")}_NOT_OFFERED`);
  assert.ok(candidates.length > 6 && candidates.length <= 6 + 80, `CANDIDATES_ARE_NOT_THE_APPLICABLE_CONTROLS_AND_THE_SHORTLIST: ${candidates.length}`);
  // IN-209 (D-04): the draft context, which sends the answers, sends and keeps no identity, number, date or comment.
  for (const secret of [harness.developmentEmails.jane, "UATA-SECRET-001", "UATA-QUES-001", "2026-08-30", "2026-08-15", "Private asset comment", "Jane Doe"]) {
    assert.ok(!context.userPrompt.includes(secret), `DRAFT_PROMPT_SENT_${secret}`);
    assert.ok(!JSON.stringify(context.summary).includes(secret), `DRAFT_SUMMARY_KEPT_${secret}`);
  }
});

/*
 * Phase 13 D-27 and D-28 (COLLAB-01 criterion 3; G-3): only the notes a Security Analyst marked as changing the AI
 * inputs reach the context, each as its own escaped value inside the untrusted Requestor data block under constant
 * labels, and the run summary names each by documentId, part, sequence, posting time and length, never its text.
 */
test("mounted questionnaire context sends Jane's marked note as untrusted data, never Bob's unmarked reply, and keeps no note text", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeRequest("NOTES-CONTEXT");
  const [jane, bob] = uatALikeNotes();
  const [janeId] = await harness.seedRequestNotes(fixture.requestId, [jane, bob]);
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: fixture.requestId });
  const requestorData = context.userPrompt.slice(context.userPrompt.indexOf("<requestorData>"), context.userPrompt.indexOf("</requestorData>"));
  const fragment = ["<sectionKind>notes</sectionKind>", "<field>note.part</field><value>requestor</value>", "<field>note.sequence</field><value>1</value>", `<field>note.body</field>${promptDataTag("value", jane.body)}`].join("\n");
  assert.equal(requestorData.split(fragment).length - 1, 1, "MARKED_NOTE_NOT_SENT_ONCE_AS_DELIMITED_DATA");
  assert.equal(context.userPrompt.split("<sectionKind>notes</sectionKind>").length - 1, 1, "NOTES_SECTION_NOT_ONCE");
  assert.ok(!context.userPrompt.includes(jane.body), "MARKED_NOTE_SENT_UNESCAPED");
  assert.ok(!context.userPrompt.includes(UAT_A_LIKE_NOTE_SENTINELS.bob), "UNMARKED_NOTE_REACHED_THE_PROMPT");
  assert.equal(context.summary.schemaVersion, 5, "SUMMARY_NOT_V5");
  assert.deepEqual((context.summary as unknown as Record<string, unknown>).notes, { included: [{ documentId: janeId, part: "requestor", sequence: 1, postedAt: jane.postedAt, characters: jane.body.length }], marked: 1, bound: 50 }, "SUMMARY_NOTES");
  const stored = JSON.stringify(context.summary);
  for (const sentinel of Object.values(UAT_A_LIKE_NOTE_SENTINELS)) assert.ok(!stored.includes(sentinel), `SUMMARY_KEPT_NOTE_TEXT_${sentinel}`);
  for (const secret of [harness.developmentEmails.jane, harness.developmentEmails.bob, janeId, jane.postedAt, "UATA-SECRET-NOTES-CONTEXT"]) assert.ok(!context.userPrompt.includes(secret), `PROMPT_SENT_${secret}`);
});

/*
 * IN-101 (Phase 13 IN-103's fail-visible rule, applied to files; D-34): an included, clean, unremoved file whose stored
 * text is null or empty fails the context and is named by its documentId, as a malformed one already did, so what
 * reaches a provider is never silently less than the analyst included, and the signal, the counts and what is sent
 * agree. Before the fix the query left a null text out without a word.
 */
test("an included file whose stored text is null or empty fails the context and is named, never silently left out (IN-101)", async () => {
  const harness = await harnessPromise;
  for (const [label, aiText] of [["NULL", null], ["EMPTY", ""]] as const) {
    const fixture = await harness.seedUatALikeRequest(`FILES-${label}`);
    const [file] = await harness.seedRequestAttachments(fixture.requestId, 1);
    const facts = { available: 44, kept: 44, truncated: false, extractor: EXTRACTOR_VERSION, extractedAt: "2026-10-05T00:00:00.000Z" };
    await harness.updateFixtureDocument("api::csrm-request-attachment.csrm-request-attachment", String(file), { aiTextIncluded: true, aiText, aiTextFacts: facts });
    for (const operation of ["questionnaire-generation", "assessment-draft"] as const) {
      await assert.rejects(
        harness.buildAssessmentContextFixture({ operation, requestId: fixture.requestId, ...(operation === "assessment-draft" ? { questionnaireId: fixture.questionnaireId } : {}) }),
        (error: unknown) => error instanceof Error && error.message === `CSRM request attachment ${String(file)} is invalid.`,
        `THE_INCLUDED_FILE_WAS_NOT_NAMED_OR_WAS_LEFT_OUT_${label}_${operation}`,
      );
    }
  }
});

/*
 * Phase 15 D-14, D-29 and D-30 (QUES-12 criterion 1; T-15-10): a questionnaire proposal context holds the request part,
 * the selected systems and assets, the Risk Type library, the marked notes as untrusted data and every active question
 * with whether it is answered. Answer content is sent only while the whole active batch is submitted; after a return to
 * analyst review turns the answers back into drafts, it is withheld and no answer text reaches the prompt.
 */
type QuestionRow = { documentId: string; options: { questionKey: string }; answer: Record<string, unknown> | null };
async function questionRows(harness: Awaited<ReturnType<typeof startAuthorizationHttpHarness>>, questionnaireId: string): Promise<QuestionRow[]> {
  return ((await harness.getQuestionnaire(questionnaireId))?.questions ?? []) as QuestionRow[];
}
const questionByKey = (rows: QuestionRow[], key: string): QuestionRow => {
  const row = rows.find(({ options }) => options.questionKey === key);
  assert.ok(row, `QUESTION_${key}_NOT_SEEDED`);
  return row;
};

test("mounted questionnaire proposals context sends the submitted answers, and once they are drafts again their content is withheld", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeRequest("PROPOSALS-CONTEXT");
  const [jane, bob] = uatALikeNotes();
  await harness.seedRequestNotes(fixture.requestId, [jane, bob]);
  const build = () => harness.buildAssessmentContextFixture({ operation: "questionnaire-proposals", requestId: fixture.requestId, questionnaireId: fixture.questionnaireId });
  const { context } = await build();
  const prompt = context.userPrompt;
  const requestorData = prompt.slice(prompt.indexOf("<requestorData>"), prompt.indexOf("</requestorData>"));
  assert.match(prompt, /Privacy Act 1988/, "REQUEST_PART_NOT_SENT");
  assert.match(prompt, /HR and payroll platform/, "SYSTEMS_NOT_SENT");
  assert.match(prompt, /Employee payment details/, "ASSETS_NOT_SENT");
  assert.ok(prompt.includes("<field>riskType.name</field>"), "RISK_TYPE_LIBRARY_NOT_OFFERED");
  assert.ok(requestorData.includes(promptDataTag("value", jane.body)), "MARKED_NOTE_NOT_IN_THE_UNTRUSTED_BLOCK");
  assert.ok(!prompt.includes(UAT_A_LIKE_NOTE_SENTINELS.bob), "UNMARKED_NOTE_REACHED_THE_PROMPT");
  assert.ok(prompt.includes("<field>Q1.questionText</field><value>Are payment files signed?</value>") && prompt.includes("<field>Q1.answered</field><value>yes</value>"), "QUESTIONS_NOT_SENT_WITH_ANSWERED_FLAGS");
  assert.ok(prompt.includes("<field>Q4.answered</field><value>no</value>"), "UNANSWERED_QUESTION_NOT_FLAGGED");
  assert.ok(requestorData.includes("<field>Q1.answer</field><value>Unsigned payment files</value>"), "SUBMITTED_ANSWER_NOT_IN_THE_UNTRUSTED_BLOCK");
  assert.equal(context.summary.schemaVersion, 5);
  const { answerSources, ...questionnaireSummary } = context.summary.questionnaire ?? {};
  assert.deepEqual(questionnaireSummary, { scope: "questionnaire", questionsOffered: 4, answered: 3, answerContent: "included", openItemsListed: 0, rejectedItemsListed: 0, rejectedItemsTotal: 0, removedListed: 0 });
  assert.deepEqual(
    answerSources,
    (await questionRows(harness, fixture.questionnaireId))
      .filter((row) => row.answer?.state === "submitted" && row.answer.value !== null && row.answer.value !== undefined)
      .map((row, index) => ({ ref: `Q${index + 1}`, questionDocumentId: row.documentId })),
    "ANSWER_SOURCE_IDENTIFIERS_DO_NOT_MATCH_SUBMITTED_QUESTIONS",
  );
  assert.deepEqual(context.summary.instruction, { source: "default-task" });
  assert.ok(context.questionnaire?.sourceRefs.has("note-1") && context.questionnaire.sourceRefs.has("Q1") && context.questionnaire.sourceRefs.has("request.title"), "SOURCE_REFS");
  for (const secret of [fixture.questionnaireId, "payment-files", "UATA-SECRET-PROPOSALS-CONTEXT", "2026-08-30"]) assert.ok(!prompt.includes(secret), `PROMPT_SENT_${secret}`);

  // A return to analyst review turns the submitted answers back into drafts (D-30): withheld, with no answer text sent.
  for (const row of await questionRows(harness, fixture.questionnaireId)) {
    if (row.answer) await harness.updateFixtureDocument("api::csrm-question.csrm-question", row.documentId, { answer: { ...row.answer, state: "draft", submittedAt: null } });
  }
  const { context: withheld } = await build();
  assert.equal(withheld.summary.questionnaire?.answerContent, "withheld", "DRAFTS_NOT_WITHHELD");
  assert.equal(withheld.summary.questionnaire?.answered, 3, "ANSWERED_FLAGS_LOST_WITH_DRAFTS");
  // The request description itself reads "Unsigned payment files could be altered.", so the check is on the answer values.
  for (const draft of ["<value>Unsigned payment files</value>", "Partial segregation of duties", ".answer</field>"]) assert.ok(!withheld.userPrompt.includes(draft), `DRAFT_ANSWER_SENT_${draft}`);
  assert.ok(withheld.userPrompt.includes("<field>Q1.answered</field><value>yes</value>"), "WITHHELD_CONTEXT_LOST_THE_ANSWERED_FLAG");
});

/*
 * D-14 (the proposal history): the questionnaire's completed proposal runs list their open items as already proposed
 * and their rejected items with the reason; a damaged run contributes nothing and the context still builds.
 */
test("mounted questionnaire proposals context lists one open and one rejected item, and a damaged run contributes nothing", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeRequest("PROPOSALS-HISTORY");
  const build = () => harness.buildAssessmentContextFixture({ operation: "questionnaire-proposals", requestId: fixture.requestId, questionnaireId: fixture.questionnaireId });
  const { context } = await build();
  const rows = await questionRows(harness, fixture.questionnaireId);
  const removal = (key: string, row: QuestionRow, text: string) => ({ key, kind: "remove" as const, target: { questionDocumentId: row.documentId, questionKey: row.options.questionKey, textSnapshot: text }, rationale: "Covered elsewhere.", sources: [], base: { kind: "question" as const, fingerprint: `sha256:${"d".repeat(64)}`, unanswered: true as const } });
  const proposal = { schemaVersion: 1 as const, operation: "questionnaire-proposals" as const, outcome: "items" as const, adjustments: [],
    items: [removal("i-1", questionByKey(rows, "optional"), "Other recovery notes?"), removal("i-2", questionByKey(rows, "duties"), "Are duties segregated?")] };
  const runInput = { operation: "questionnaire-proposals" as const, initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire-proposals", providerVersion: "1", assessmentRequest: fixture.requestId, questionnaire: fixture.questionnaireId, contextSummary: context.summary };
  const runId = await harness.createAiRunFixture(runInput);
  await harness.completeAiRunFixture(runId, proposal);
  await harness.appendAiRunDecisionsFixture(runId, [{ schemaVersion: 2, at: "2026-10-11T00:00:00.000Z", by: harness.users.analyst, item: "i-2", action: "rejected", reason: "Segregation is already answered." }]);
  const damagedId = await harness.createAiRunFixture(runInput);
  await harness.completeAiRunFixture(damagedId, { ...proposal, items: [removal("i-1", questionByKey(rows, "recovery-tested"), "DAMAGED-RUN-SENTINEL")] });
  await harness.updateAiRunFixture(damagedId, { decisions: [{ schemaVersion: 1, at: "2026-10-11T00:00:00.000Z", by: harness.users.analyst, target: "assessment", kind: "accepted" }] });

  const { context: listed } = await build();
  const prompt = listed.userPrompt;
  assert.ok(prompt.includes("<field>P1.status</field><value>already proposed</value>") && prompt.includes("<field>P1.questionText</field><value>Other recovery notes?</value>"), "OPEN_ITEM_NOT_LISTED");
  assert.ok(!prompt.includes("<field>P2."), "MORE_THAN_ONE_OPEN_ITEM");
  assert.ok(prompt.includes("<field>X1.questionText</field><value>Are duties segregated?</value>") && prompt.includes("<field>X1.reason</field><value>Segregation is already answered.</value>"), "REJECTED_ITEM_NOT_LISTED_WITH_ITS_REASON");
  assert.ok(!prompt.includes("DAMAGED-RUN-SENTINEL"), "DAMAGED_RUN_CONTRIBUTED");
  assert.deepEqual({ open: listed.summary.questionnaire?.openItemsListed, rejected: listed.summary.questionnaire?.rejectedItemsListed, total: listed.summary.questionnaire?.rejectedItemsTotal }, { open: 1, rejected: 1, total: 1 });
});

/* D-14: a rewrite holds the target question, no Risk Type library and no answers, on CSRM's plain-language preset. */
test("mounted question rewrite context holds the target question, no Risk Type library and no answers", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeRequest("REWRITE-CONTEXT");
  const target = questionByKey(await questionRows(harness, fixture.questionnaireId), "optional");
  const { context } = await harness.buildAssessmentContextFixture({ operation: "question-rewrite", requestId: fixture.requestId, questionnaireId: fixture.questionnaireId, targetQuestionId: target.documentId });
  const prompt = context.userPrompt;
  assert.ok(prompt.includes("<field>Q4.questionText</field><value>Other recovery notes?</value>") && prompt.includes("<field>Q4.target</field><value>yes</value>"), "TARGET_NOT_SENT");
  assert.ok(!prompt.includes("riskType."), "REWRITE_OFFERED_THE_RISK_TYPE_LIBRARY");
  assert.equal(context.summary.riskTypes.offered, 0);
  assert.deepEqual(context.summary.riskTypes.names, []);
  for (const answer of ["<value>Unsigned payment files</value>", "Partial segregation of duties", ".answer</field>"]) assert.ok(!prompt.includes(answer), `REWRITE_SENT_AN_ANSWER_${answer}`);
  assert.equal(context.summary.questionnaire?.scope, "question");
  assert.equal(context.summary.questionnaire?.answerContent, "withheld");
  assert.deepEqual(context.summary.instruction, { source: "plain-language-preset" });
  assert.ok(prompt.startsWith("<analystInstruction>"), "PRESET_NOT_IN_THE_SLOT");
});
