import assert from "node:assert/strict";
import test from "node:test";
import { ASSESSMENT_AI_FIELDS, RISK_AI_FIELDS, applyAiFieldEdit, emptyRiskAiProvenance, fieldRunId, markEditedFields, markFieldsConfirmedFromRun, parseAssessmentAiProvenance, parseRiskAiProvenance, projectAssessmentAiProvenance, projectRiskAiProvenance, proposedFieldsOf, reconcileSuggestion, restoreSuggestionsOfRemovedImplementation, sourceCatalogueFromContextSummary } from "../src/api/csrm-assessment/services/ai-provenance";
import { currentQuestionLabels, parseContextSummary, parseRunDecisions, parseRunProposal, projectAiRun } from "../src/api/csrm-ai-run/services/ai-run-record";
import { buildAssessmentContext, type ContextSummaryV1 } from "../src/csrm/ai/assessment-context";
import { uatALikeRecords } from "./fixtures/uat-a-like-context";

test("closed provenance parsers accept valid records and fail safely on malformed values", () => {
  assert.equal(RISK_AI_FIELDS.length, 20);
  assert.equal(ASSESSMENT_AI_FIELDS.length, 4);
  const risk = { schemaVersion: 1, runId: "run-1", proposalKey: "risk-1", fields: { riskStatement: { state: "proposed", sources: ["request.title"] }, treatmentAction: { state: "accepted" } }, uncitedClaims: ["One claim"], suggestions: [], adjustments: [] };
  const assessment = { schemaVersion: 1, runId: "run-1", proposalKey: "assessment", fields: { summary: { state: "proposed", sources: ["request.title"] } } };
  assert.deepEqual(parseRiskAiProvenance(risk), risk);
  assert.deepEqual(parseAssessmentAiProvenance(assessment), assessment);
  for (const bad of [null, undefined, "invalid", { ...risk, schemaVersion: 2 }, { ...risk, unknown: true }, { ...risk, fields: { comments: { state: "proposed" } } }, { ...risk, fields: { riskStatement: { state: "unknown" } } }, { ...risk, uncitedClaims: Array(6).fill("x") }, { ...risk, uncitedClaims: ["x".repeat(301)] }]) assert.equal(parseRiskAiProvenance(bad), null);
  for (const bad of [null, "invalid", { ...assessment, schemaVersion: 2 }, { ...assessment, fields: { comments: { state: "proposed" } } }]) assert.equal(parseAssessmentAiProvenance(bad), null);
  assert.deepEqual(proposedFieldsOf(parseRiskAiProvenance(risk)), ["riskStatement"]);
  const edited = markEditedFields(parseRiskAiProvenance(risk)!, ["riskStatement", "comments"], "analyst-1", "2026-10-05T00:00:00.000Z");
  assert.deepEqual(edited.fields.riskStatement, { state: "edited", sources: ["request.title"], by: "analyst-1", at: "2026-10-05T00:00:00.000Z" });
  assert.equal("comments" in edited.fields, false);
  assert.equal(markEditedFields(edited, ["riskStatement"], "analyst-2", "2026-10-06T00:00:00.000Z").fields.riskStatement?.by, "analyst-2");
});

/*
 * Verifier W-3 (D-21, G-1): only a human Security Analyst's edit moves an AI field out of proposed. A human analyst's edit
 * marks a proposed or confirmed field edited, by that analyst, and names nothing for a field already edited. Any other
 * editor (the analyst service agent) leaves a changed AI field proposed, or returns it there from confirmed or edited, by
 * that editor. A changed field with no AI fact is never named.
 */
test("only a human analyst's edit moves an AI field out of proposed", () => {
  const at = "2026-10-08T00:00:00.000Z";
  const before = "2026-10-07T00:00:00.000Z";
  const envelope = parseRiskAiProvenance({ schemaVersion: 1, runId: "run-1", proposalKey: "risk-1", uncitedClaims: [], suggestions: [], adjustments: [], fields: {
    riskStatement: { state: "proposed", sources: ["request.title"] },
    riskCategory: { state: "accepted", by: "analyst-1", at: before },
    issueStatement: { state: "edited", sources: [], by: "analyst-1", at: before },
  } })!;
  const changed = ["riskStatement", "riskCategory", "issueStatement", "comments"];
  const human = applyAiFieldEdit(envelope, changed, { documentId: "analyst-2", humanAnalyst: true }, at);
  assert.deepEqual(human.fields, ["riskStatement", "riskCategory"], "HUMAN_EDIT_FIELDS");
  assert.deepEqual(human.provenance.fields, {
    riskStatement: { state: "edited", sources: ["request.title"], by: "analyst-2", at },
    riskCategory: { state: "edited", by: "analyst-2", at },
    issueStatement: { state: "edited", sources: [], by: "analyst-1", at: before },
  }, "HUMAN_EDIT_STATES");
  const agent = applyAiFieldEdit(envelope, changed, { documentId: "agent-1", humanAnalyst: false }, at);
  assert.deepEqual(agent.fields, ["riskStatement", "riskCategory", "issueStatement"], "AUTOMATION_EDIT_FIELDS");
  assert.deepEqual(agent.provenance.fields, {
    riskStatement: { state: "proposed", sources: ["request.title"], by: "agent-1", at },
    riskCategory: { state: "proposed", by: "agent-1", at },
    issueStatement: { state: "proposed", sources: [], by: "agent-1", at },
  }, "AUTOMATION_EDIT_STATES");
  assert.deepEqual(proposedFieldsOf(agent.provenance), ["riskStatement", "riskCategory", "issueStatement"]);
  assert.deepEqual(parseRiskAiProvenance(agent.provenance), agent.provenance, "the envelope stays readable");
  assert.deepEqual(applyAiFieldEdit(envelope, ["comments"], { documentId: "agent-1", humanAnalyst: false }, at).fields, [], "A_FIELD_WITHOUT_AN_AI_FACT_WAS_NAMED");
});

test("run envelopes parse closed and never throw on read", () => {
  const summary = buildAssessmentContext(uatALikeRecords(), { operation: "questionnaire-generation" }).summary;
  const proposal = { schemaVersion: 2, proposal: { risks: [] }, adjustments: [] };
  const event = { schemaVersion: 1, at: "2026-10-05T00:00:00.000Z", by: "analyst-1", target: "assessment", kind: "accepted" };
  assert.deepEqual(parseContextSummary(summary), summary);
  assert.deepEqual(parseRunProposal(proposal), proposal);
  assert.deepEqual(parseRunDecisions([event]), [event]);
  for (const bad of [null, undefined, "invalid", { ...summary, unknown: 1 }, { ...summary, request: { fields: [], unknown: 1 } }, { ...summary, schemaVersion: 6 }, { ...summary, schemaVersion: 4 }, { ...summary, schemaVersion: 3 }, { ...summary, schemaVersion: 2 }, { ...summary, schemaVersion: 1 }]) assert.equal(parseContextSummary(bad), null);
  const circular: Record<string, unknown> = { ...summary }; circular.request = circular;
  assert.equal(parseContextSummary(circular), null);
  for (const bad of [null, "invalid", { ...proposal, unknown: 1 }, { ...proposal, schemaVersion: 1 }]) assert.equal(parseRunProposal(bad), null);
  assert.equal(parseRunProposal({ ...proposal, proposal: { text: "x".repeat(1_048_576) } }), null);
  for (const bad of [null, "invalid", [{ ...event, unknown: 1 }], [{ ...event, kind: "unknown" }]]) assert.equal(parseRunDecisions(bad), null);
});

test("the analyst projection resolves sources, actors and suggestions, and fails safe", () => {
  const context = buildAssessmentContext(uatALikeRecords(), { operation: "assessment-draft" });
  const lookups = {
    sources: new Map([["run-1", sourceCatalogueFromContextSummary(context.summary)]]),
    actors: new Map([["analyst-1", "Morgan Analyst"]]),
    controls: new Map([["control-1", { documentId: "control-1", controlNumber: "CTL-001", name: "File integrity verification", description: null }]]),
  };
  const stored = {
    schemaVersion: 1, runId: "run-1", proposalKey: "risk-1",
    fields: {
      riskStatement: { state: "edited", by: "analyst-1", at: "2026-10-05T00:00:00.000Z", sources: ["system-1", "request.regulatoryRequirements", "answer.gone"] },
      residualRating: { state: "proposed" },
      treatmentAction: { state: "accepted", by: "inactive-analyst", at: "2026-10-05T00:00:00.000Z" },
    },
    uncitedClaims: ["Payment files are exchanged daily."],
    suggestions: [
      { key: "s-1", control: "control-1", controlNumber: "CTL-001", rationale: "Signing prevents tampering.", state: "proposed" },
      { key: "s-2", control: "control-gone", controlNumber: "CTL-404", rationale: "Removed control.", state: "dismissed", by: "analyst-1", at: "2026-10-05T00:00:00.000Z" },
    ],
    adjustments: ["accept-with-suggested-controls"],
  };
  const projected = projectRiskAiProvenance(stored, lookups, new Set(["control-1"]));
  assert.ok(projected);
  assert.deepEqual(projected.fields.map((field) => field.field), ["riskStatement", "residualRating", "treatmentAction"]);
  const statement = projected.fields[0];
  assert.deepEqual(statement.by, { documentId: "analyst-1", displayName: "Morgan Analyst" });
  assert.deepEqual(statement.sources?.map((source) => [source.kind, source.label]), [
    ["system", "Finance system"], ["request", "Regulatory requirements"], ["answer", "Source no longer available"],
  ]);
  assert.equal(projected.fields[1].sources, null, "a rating carries no sources");
  assert.equal(projected.fields[2].by, null, "an inactive actor is not named");
  assert.equal(projected.outstanding, 1);
  assert.equal(projected.suggestions[0].state, "present", "a proposed suggestion already mitigating the risk is present");
  assert.equal(projected.suggestions[0].control.name, "File integrity verification");
  assert.deepEqual(projected.suggestions[1].control, { documentId: "control-gone", controlNumber: "CTL-404", name: "CTL-404", description: null });
  assert.equal(projectRiskAiProvenance(stored, lookups)?.suggestions[0].state, "proposed");
  assert.equal(projectRiskAiProvenance({ ...stored, schemaVersion: 2 }, lookups), null);
  assert.equal(projectRiskAiProvenance(null, lookups), null);

  const assessment = projectAssessmentAiProvenance({ schemaVersion: 1, runId: "run-missing", proposalKey: "assessment", fields: { summary: { state: "proposed", sources: ["system-1"] }, overallRating: { state: "proposed" } } }, lookups);
  assert.ok(assessment);
  assert.equal(assessment.outstanding, 2);
  assert.equal(assessment.fields[0].sources?.[0].label, "Source no longer available", "a run that cannot be read resolves nothing");
});

/*
 * CR-02: a suggestion is `added` while the planned control it created exists on the risk. A record kept `added` after
 * that control was removed (legacy, from before removals restored their suggestion), or with no implementation
 * recorded, projects as proposed again with no implementation, actor or time, so the page offers Add and Dismiss; or as
 * present when the risk holds the control through another implementation. Without the risk's implementations the
 * projection reads the record as stored.
 */
test("an added suggestion whose planned control is gone projects as proposed again", () => {
  const lookups = { sources: new Map(), actors: new Map([["analyst-1", "Morgan Analyst"]]), controls: new Map() };
  const added = (key: string, control: string, implementation?: string) => ({ key, control, controlNumber: control.toUpperCase(), rationale: "Added from the AI suggestion.",
    state: "added", by: "analyst-1", at: "2026-10-05T00:00:00.000Z", ...(implementation ? { implementation, implementationSnapshot: { control, controlStatus: "Planned" } } : {}) });
  const stored = { schemaVersion: 1, runId: "run-1", proposalKey: "risk-1", fields: {}, uncitedClaims: [], adjustments: [], suggestions: [
    added("kept", "control-1", "implementation-1"), added("removed", "control-2", "implementation-removed"),
    added("removed-but-present", "control-3", "implementation-removed-too"), added("unrecorded", "control-4"),
    { key: "dismissed", control: "control-5", controlNumber: "CONTROL-5", rationale: "Dismissed.", state: "dismissed", by: "analyst-1", at: "2026-10-05T00:00:00.000Z" },
  ] };
  const view = (projection: ReturnType<typeof projectRiskAiProvenance>) => projection?.suggestions.map(({ key, state, by, at, implementation }) => ({ key, state, by: by?.documentId ?? null, at, implementation }));
  const at = "2026-10-05T00:00:00.000Z";
  assert.deepEqual(view(projectRiskAiProvenance(stored, lookups, new Set(["control-1", "control-3"]), new Set(["implementation-1", "implementation-3"]))), [
    { key: "kept", state: "added", by: "analyst-1", at, implementation: "implementation-1" },
    { key: "removed", state: "proposed", by: null, at: null, implementation: null },
    { key: "removed-but-present", state: "present", by: null, at: null, implementation: null },
    { key: "unrecorded", state: "proposed", by: null, at: null, implementation: null },
    { key: "dismissed", state: "dismissed", by: "analyst-1", at, implementation: null },
  ]);
  assert.deepEqual(view(projectRiskAiProvenance(stored, lookups, new Set(["control-1", "control-3"])))?.map((item) => item.state),
    ["added", "added", "added", "added", "dismissed"], "a read without the risk's implementations reads the record as stored");
  const parsed = parseRiskAiProvenance(stored);
  assert.ok(parsed);
  assert.deepEqual(reconcileSuggestion(parsed.suggestions[1], new Set(["implementation-1"])),
    { key: "removed", control: "control-2", controlNumber: "CONTROL-2", rationale: "Added from the AI suggestion.", state: "proposed" });
  assert.equal(reconcileSuggestion(parsed.suggestions[0], new Set(["implementation-1"])), parsed.suggestions[0]);
});

/*
 * CR-02: removing a control implementation sends back to proposed each suggestion that added it, by the analyst who
 * removed it, without its implementation and snapshot, as its Undo does; other suggestions are untouched.
 */
test("removing the control a suggestion added proposes that suggestion again", () => {
  const record = parseRiskAiProvenance({ schemaVersion: 1, runId: "run-1", proposalKey: "risk-1", fields: {}, uncitedClaims: [], adjustments: [], suggestions: [
    { key: "s-1", control: "control-1", controlNumber: "C-1", rationale: "Added.", state: "added", by: "analyst-1", at: "2026-10-05T00:00:00.000Z", implementation: "implementation-1", implementationSnapshot: { control: "control-1", controlStatus: "Planned" } },
    { key: "s-2", control: "control-2", controlNumber: "C-2", rationale: "Added too.", state: "added", by: "analyst-1", at: "2026-10-05T00:00:00.000Z", implementation: "implementation-2" },
    { key: "s-3", control: "control-3", controlNumber: "C-3", rationale: "Proposed.", state: "proposed" },
  ] });
  assert.ok(record);
  const outcome = restoreSuggestionsOfRemovedImplementation(record, "implementation-1", "analyst-2", "2026-10-08T00:00:00.000Z");
  assert.ok(outcome);
  assert.deepEqual(outcome.restored, ["s-1"]);
  assert.deepEqual(outcome.provenance.suggestions, [
    { key: "s-1", control: "control-1", controlNumber: "C-1", rationale: "Added.", state: "proposed", by: "analyst-2", at: "2026-10-08T00:00:00.000Z" },
    record.suggestions[1], record.suggestions[2],
  ]);
  assert.ok(parseRiskAiProvenance(outcome.provenance), "the restored record parses closed");
  assert.equal(restoreSuggestionsOfRemovedImplementation(record, "implementation-other", "analyst-2", "2026-10-08T00:00:00.000Z"), null);
});

/*
 * WR-105 (G-3): the summary names an answer source by the question's position, never its text. The analyst's reads, a
 * citation and the run read alike, name it by the question's current text from the questionnaire the run used (at most
 * 300 characters), and keep the position for a question no longer there or a run read without its questions.
 */
test("an answer source reads by its question's current text, else by the position the run stores", () => {
  const summary = buildAssessmentContext(uatALikeRecords(), { operation: "assessment-draft" }).summary;
  assert.deepEqual(summary.questions.sources.map(({ label }) => label), ["Question 1", "Question 2", "Question 3", "Question 4"]);
  const long = `  ${"Long question ".repeat(40)}`;
  const questionnaire = { documentId: "questionnaire-1", questions: [
    { questionText: "Are payment files signed before they leave payroll?", options: { schemaVersion: 1, questionKey: "payment-files" } },
    { questionText: long, options: { schemaVersion: 1, questionKey: "duties" } },
    { questionText: "No options", options: null }, "malformed",
  ] };
  const expected = ["Are payment files signed before they leave payroll?", long.trim().slice(0, 300), "Question 3", "Question 4"];
  const catalogue = sourceCatalogueFromContextSummary(summary, currentQuestionLabels(questionnaire));
  assert.deepEqual(summary.questions.sources.map(({ key }) => catalogue.get(key)?.label), expected, "CITATION_NOT_NAMED_BY_THE_QUESTION");
  assert.equal(catalogue.get("answer.payment-files")?.section, "Payment processing");
  assert.equal(sourceCatalogueFromContextSummary(summary).get("answer.payment-files")?.label, "Question 1", "a run with no questionnaire keeps its position label");
  const run = { documentId: "run-1", operation: "assessment-draft", status: "completed", providerName: "p", providerVersion: "1", contextSummary: summary, questionnaire };
  const read = projectAiRun(run).contextSummary as ContextSummaryV1;
  assert.deepEqual(read.questions.sources.map(({ label }) => label), expected, "RUN_READ_NOT_NAMED_BY_THE_QUESTION");
  assert.deepEqual(parseContextSummary(read), read, "the served summary keeps the closed v1 shape");
  assert.deepEqual(projectAiRun({ ...run, questionnaire: { documentId: "questionnaire-1" } }).contextSummary, summary);
  assert.equal((projectAiRun(run).targets as Record<string, unknown>).questionnaire, "questionnaire-1");
  assert.deepEqual(summary.questions.sources.map(({ label }) => label), ["Question 1", "Question 2", "Question 3", "Question 4"], "the read never rewrites the stored summary");
});

/*
 * Walk D11: a citation of a request field reads by the request form's own label (Phase 10 §9.1), the labels the web's
 * run sheet uses for "Fields sent": the description is "Description", so a citation never reads "Request: Request
 * description".
 */
test("a cited request field reads by the request form's own label", () => {
  const catalogue = sourceCatalogueFromContextSummary(buildAssessmentContext(uatALikeRecords(), { operation: "assessment-draft" }).summary);
  const requestLabels = Object.fromEntries([...catalogue.values()].filter((source) => source.kind === "request").map((source) => [source.key, source.label]));
  assert.deepEqual(requestLabels, {
    "request.title": "Request title",
    "request.description": "Description",
    "request.assessmentType": "Assessment type",
    "request.division": "Division",
    "request.businessUnit": "Business unit",
    "request.businessPurpose": "Business purpose",
    "request.businessCriticality": "Business criticality",
    "request.thirdPartyInvolvement": "Third-party involvement",
    "request.thirdPartyDetails": "Third-party details",
    "request.regulatoryRequirements": "Regulatory requirements",
  });
});

/*
 * Phase 13 D-28 (G-3; T-13-52): the context summary envelope is v1, v2 or (Phase 14 D-35) v3, closed. A v2 summary's
 * notes section names each note without its text, so a note entry with an unknown key or a `body` is refused, as are more
 * included notes than the bound of 50 or than were marked. A v1 summary reads as having included no notes, and a v1 or v2
 * summary as having included no files. Nothing malformed throws.
 */
test("the context summary parser reads v1 as no notes, accepts v2 and refuses a note's text or a section past its bound", () => {
  const note = (sequence: number) => ({ documentId: `note-${sequence}`, part: "requestor" as const, sequence, postedAt: "2026-09-01T00:00:00.000Z", body: `Marked note ${sequence}.` });
  // Phase 16: the builder writes v5; v4 is v5 without the risk proposal section, read with it null, and v3 is v4 without
  // the questionnaire and instruction sections, read with all three null.
  const v5 = buildAssessmentContext({ ...uatALikeRecords(), notes: [note(1), { ...note(2), part: "security-analyst" }] }, { operation: "questionnaire-generation" }).summary;
  assert.equal(v5.schemaVersion, 5);
  assert.deepEqual(parseContextSummary(v5), v5, "V5_SUMMARY_NOT_READ");
  const { riskProposals: _riskProposals, ...v4Fields } = v5;
  const v4 = { ...v4Fields, schemaVersion: 4 as const };
  assert.deepEqual(parseContextSummary(v4), { ...v4, riskProposals: null }, "V4_SUMMARY_NOT_READ");
  const none = { questionnaire: null, instruction: null, riskProposals: null };
  const { questionnaire: _questionnaire, instruction: _instruction, ...v3Fields } = v4;
  const v3 = { ...v3Fields, schemaVersion: 3 as const };
  assert.deepEqual(parseContextSummary(v3), { ...v3, ...none }, "V3_SUMMARY_NOT_READ");
  const noFiles = { included: [], bound: 30_000 };
  const { attachments: _attachments, ...v2Fields } = v3;
  const v2 = { ...v2Fields, schemaVersion: 2 as const };
  assert.deepEqual(parseContextSummary(v2), { ...v2, attachments: noFiles, ...none }, "V2_SUMMARY_NOT_READ");
  const { notes: _notes, ...v1Fields } = v2;
  const v1 = { ...v1Fields, schemaVersion: 1 };
  assert.deepEqual(parseContextSummary(v1), { ...v1, notes: { included: [], marked: 0, bound: 50 }, attachments: noFiles, ...none }, "V1_SUMMARY_NOT_READ_AS_NO_NOTES");
  const entry = v2.notes.included[0];
  const included = (items: unknown[]) => ({ ...v2, notes: { ...v2.notes, included: items } });
  const fiftyOne = Array.from({ length: 51 }, (_, index) => ({ ...entry, documentId: `note-${index + 1}`, sequence: index + 1 }));
  for (const [label, bad] of [
    ["NOTE_UNKNOWN_KEY", included([{ ...entry, author: "Jane Doe" }])],
    ["NOTE_BODY", included([{ ...entry, body: "Marked note 1." }])],
    ["NOTE_MISSING_KEY", included([{ documentId: entry.documentId, part: entry.part, sequence: entry.sequence, postedAt: entry.postedAt }])],
    ["NOTE_UNKNOWN_PART", included([{ ...entry, part: "service-agent" }])],
    ["NOTE_SEQUENCE_ZERO", included([{ ...entry, sequence: 0 }])],
    ["NOTE_POSTED_AT", included([{ ...entry, postedAt: "yesterday" }])],
    ["FIFTY_ONE_INCLUDED", { ...v2, notes: { included: fiftyOne, marked: 51, bound: 50 } }],
    ["MORE_INCLUDED_THAN_MARKED", { ...v2, notes: { ...v2.notes, marked: 1 } }],
    ["BOUND_NOT_FIFTY", { ...v2, notes: { ...v2.notes, bound: 51 } }],
    ["NOTES_UNKNOWN_KEY", { ...v2, notes: { ...v2.notes, text: "Marked note 1." } }],
    ["V2_WITHOUT_NOTES", { ...v1Fields, schemaVersion: 2 }],
    ["V1_WITH_NOTES", { ...v2, schemaVersion: 1 }],
    ["NOTES_NOT_AN_OBJECT", { ...v2, notes: [] }],
  ] as const) assert.doesNotThrow(() => assert.equal(parseContextSummary(bad), null, label), label);
});

/*
 * Phase 16 D-25 (the approved Phase 16 amendment, "Per-field run references"): a Risk's per-field fact may name the run
 * that proposed its value. A fact without one resolves to the envelope's run, so a drafted field still names the draft
 * run; a confirmed rewrite unit's fields name the rewrite run, and only the fields named change. The assessment's own
 * facts take no runId.
 */
test("a Risk's per-field fact may carry its runId, fieldRunId falls back to the envelope's run, and markFieldsConfirmedFromRun sets only the fields named", () => {
  const at = "2026-10-15T00:00:00.000Z";
  const stored = { schemaVersion: 1, runId: "draft-run", proposalKey: "risk-1", uncitedClaims: [], suggestions: [], adjustments: [], fields: {
    riskStatement: { state: "proposed", sources: ["request.title"] },
    riskCause: { state: "accepted", sources: [], by: "analyst-1", at, runId: "rewrite-run" },
    residualRating: { state: "proposed" },
  } };
  assert.deepEqual(parseRiskAiProvenance(stored), stored, "A_FACT_WITH_A_RUN_ID_IS_REFUSED");
  for (const runId of ["", "x".repeat(256), 7, null]) {
    assert.equal(parseRiskAiProvenance({ ...stored, fields: { riskCause: { state: "proposed", runId } } }), null, `RUN_ID_${JSON.stringify(runId)}_ACCEPTED`);
  }
  assert.equal(parseAssessmentAiProvenance({ schemaVersion: 1, runId: "draft-run", proposalKey: "assessment", fields: { summary: { state: "proposed", runId: "other" } } }), null, "ASSESSMENT_FACT_TOOK_A_RUN_ID");

  const envelope = parseRiskAiProvenance(stored)!;
  assert.equal(fieldRunId(envelope, "riskStatement"), "draft-run");
  assert.equal(fieldRunId(envelope, "riskCause"), "rewrite-run");
  assert.equal(fieldRunId(envelope, "potentialImpact"), "draft-run", "A_FIELD_WITHOUT_A_FACT_DOES_NOT_NAME_THE_ENVELOPE_RUN");

  const confirmed = markFieldsConfirmedFromRun(envelope, ["riskStatement", "residualRating"], "rewrite-2", "bob", at, { sources: ["answer.q-1"] });
  assert.deepEqual(confirmed.fields.riskStatement, { state: "accepted", sources: ["answer.q-1"], by: "bob", at, runId: "rewrite-2" });
  assert.deepEqual(confirmed.fields.residualRating, { state: "accepted", by: "bob", at, runId: "rewrite-2" }, "A_RATING_TOOK_SOURCES");
  assert.deepEqual(confirmed.fields.riskCause, envelope.fields.riskCause, "AN_UNNAMED_FIELD_CHANGED");
  assert.equal(confirmed.runId, "draft-run", "THE_ENVELOPE_RUN_MOVED");
  assert.deepEqual(parseRiskAiProvenance(confirmed), confirmed);
  assert.equal(fieldRunId(confirmed, "riskStatement"), "rewrite-2");
  assert.equal(fieldRunId(confirmed, "potentialImpact"), "draft-run");
  assert.deepEqual(envelope.fields.riskStatement, { state: "proposed", sources: ["request.title"] }, "THE_INPUT_WAS_MUTATED");

  // A Risk created by hand gains the envelope at its first confirmed rewrite unit, naming that run and unit.
  const fresh = markFieldsConfirmedFromRun(emptyRiskAiProvenance("rewrite-3", "u-risk-cause"), ["riskCause"], "rewrite-3", "bob", at);
  assert.deepEqual(fresh, { schemaVersion: 1, runId: "rewrite-3", proposalKey: "u-risk-cause", uncitedClaims: [], suggestions: [], adjustments: [],
    fields: { riskCause: { state: "accepted", sources: [], by: "bob", at, runId: "rewrite-3" } } });
  assert.deepEqual(parseRiskAiProvenance(fresh), fresh);
});
