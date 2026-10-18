import assert from "node:assert/strict";
import test from "node:test";

import {
  appendGovernanceEvent,
  countAnalystChangesSinceGeneration,
  GOVERNANCE_EVENT_KINDS,
  GOVERNANCE_LOG_MAX_ENTRIES,
  GOVERNANCE_LOG_SCHEMA_VERSION,
  GovernanceLogError,
  MAX_QUESTION_TEXT_LENGTH,
  parseGovernanceEvent,
  parseGovernanceLog,
  projectGovernanceEventsForRequestor,
  questionTextSnapshot,
  summariseGovernanceLog,
} from "../src/api/csrm-questionnaire/services/questionnaire-governance-log";
import {
  buildQuestionnaireCollectionQuery,
  governanceActorIds,
  projectAnalystRevision,
  projectGovernanceEvents,
  questionnaireState,
  projectQuestionnaire,
} from "../src/api/csrm-questionnaire/services/questionnaire-scope";
import {
  activeQuestionnaireDefinition,
  getVisibleQuestionKeys,
  parseQuestionnaireDefinition,
} from "../src/api/csrm-questionnaire/services/questionnaire-definition";
import {
  assertQuestionnaireInAnalystReview,
  QuestionnaireGovernanceError,
  returnAnswersToDraft,
} from "../src/api/csrm-questionnaire/services/questionnaire-governance-workflow";
import { parseAnswerEnvelope } from "../src/api/csrm-questionnaire/services/questionnaire-workflow";

const ACTOR = "analyst-document-id";
const AT = "2026-09-01T00:00:00.000Z";

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { schemaVersion: 1, kind: "released", at: AT, by: ACTOR, ...overrides };
}

function question(answer: unknown = null): Record<string, unknown> {
  return {
    documentId: "question-1",
    questionText: "What is the name of the service?",
    answerType: "Text",
    options: {
      schemaVersion: 1,
      questionKey: "service-name",
      section: { key: "context", title: "Context", order: 1 },
      order: 1,
      required: true,
    },
    answer,
  };
}

function questionnaire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    documentId: "questionnaire-1",
    questionnaireNumber: "QUES-UNIT-001",
    title: "Unit questionnaire",
    questions: [question()],
    assessmentRequest: { documentId: "request-1", requestNumber: "RAR-UNIT-001", title: "Unit request", requestStatus: "questionnaire-in-progress" },
    updatedAt: AT,
    ...overrides,
  };
}

test("the governance event kinds are a frozen closed vocabulary", () => {
  assert.deepEqual([...GOVERNANCE_EVENT_KINDS], [
    "released",
    "returned-to-review",
    "question-added",
    "question-edited",
    "question-deleted",
    "answer-cleared",
    "regenerated",
    "ai-proposal",
    "question-restored",
  ]);
  assert.equal(Object.isFrozen(GOVERNANCE_EVENT_KINDS), true, "GOVERNANCE_EVENT_KINDS_MUTABLE");
});

test("parseGovernanceLog accepts an absent, empty and single-entry log", () => {
  assert.deepEqual(parseGovernanceLog(null), []);
  assert.deepEqual(parseGovernanceLog(undefined), []);
  assert.deepEqual(parseGovernanceLog([]), []);
  assert.deepEqual(parseGovernanceLog([event()]), [{ schemaVersion: 1, kind: "released", at: AT, by: ACTOR }]);
  assert.deepEqual(
    parseGovernanceLog([event({ kind: "returned-to-review", reason: "Needs a clearer hosting question." })]),
    [{ schemaVersion: 1, kind: "returned-to-review", at: AT, by: ACTOR, reason: "Needs a clearer hosting question." }],
  );
  assert.deepEqual(
    parseGovernanceLog([event({ kind: "answer-cleared", questionKey: "hosting-model", explanation: "The choices changed." })]),
    [{ schemaVersion: 1, kind: "answer-cleared", at: AT, by: ACTOR, questionKey: "hosting-model", explanation: "The choices changed." }],
  );
});

test("parseGovernanceLog rejects anything the closed schema does not declare", () => {
  const rejected: Array<[string, unknown]> = [
    ["UNKNOWN_KEY", [event({ actor: ACTOR })]],
    ["UNKNOWN_KIND", [event({ kind: "released-to-everyone" })]],
    ["NON_INTEGER_SCHEMA_VERSION", [event({ schemaVersion: 1.5 })]],
    ["WRONG_SCHEMA_VERSION", [event({ schemaVersion: 2 })]],
    ["STRING_SCHEMA_VERSION", [event({ schemaVersion: "1" })]],
    ["NON_ISO_INSTANT", [event({ at: "the first of September" })]],
    ["EMPTY_INSTANT", [event({ at: "" })]],
    ["EMPTY_ACTOR", [event({ by: "   " })]],
    ["OVERLONG_ACTOR", [event({ by: "a".repeat(256) })]],
    ["OVERLONG_REASON", [event({ kind: "returned-to-review", reason: "a".repeat(501) })]],
    ["OVERLONG_QUESTION_KEY", [event({ kind: "question-edited", questionKey: "a".repeat(121) })]],
    ["OVERLONG_EXPLANATION", [event({ kind: "answer-cleared", explanation: "a".repeat(501) })]],
    ["NOT_AN_ARRAY", { events: [event()] }],
    ["ENTRY_NOT_AN_OBJECT", ["released"]],
    ["NESTED_ARRAY_ENTRY", [[event()]]],
    ["OVER_LIMIT", Array.from({ length: GOVERNANCE_LOG_MAX_ENTRIES + 1 }, () => event())],
  ];
  for (const [diagnostic, value] of rejected) {
    assert.throws(() => parseGovernanceLog(value), GovernanceLogError, `GOVERNANCE_LOG_ACCEPTED_${diagnostic}`);
  }
  assert.equal(parseGovernanceLog(Array.from({ length: GOVERNANCE_LOG_MAX_ENTRIES }, () => event())).length, GOVERNANCE_LOG_MAX_ENTRIES);
  assert.throws(() => parseGovernanceEvent(event({ kind: "question-added", reason: "" })), GovernanceLogError, "EMPTY_REASON_ACCEPTED");
});

test("appendGovernanceEvent only ever appends, leaving prior entries untouched and in order", () => {
  const existing = [
    event({ at: "2026-09-01T00:00:00.000Z" }),
    event({ kind: "returned-to-review", at: "2026-09-02T00:00:00.000Z", reason: "Clarify hosting." }),
  ];
  const frozen = JSON.stringify(existing);
  const appended = appendGovernanceEvent(existing, event({ at: "2026-09-03T00:00:00.000Z" }));

  assert.equal(appended.length, 3, "UNEXPECTED_APPENDED_LENGTH");
  assert.notEqual(appended, existing, "APPEND_RETURNED_THE_SAME_ARRAY");
  assert.equal(JSON.stringify(existing), frozen, "APPEND_MUTATED_THE_EXISTING_LOG");
  assert.deepEqual(
    appended.slice(0, 2).map((entry) => entry.at),
    ["2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z"],
    "APPEND_REORDERED_PRIOR_ENTRIES",
  );
  assert.deepEqual(appended.slice(0, 2), parseGovernanceLog(existing), "APPEND_REWROTE_PRIOR_ENTRIES");
  assert.equal(appended.at(-1)?.at, "2026-09-03T00:00:00.000Z", "APPEND_DID_NOT_PUT_THE_EVENT_LAST");

  assert.deepEqual(appendGovernanceEvent(null, event()), [{ schemaVersion: 1, kind: "released", at: AT, by: ACTOR }]);
  assert.throws(() => appendGovernanceEvent([event()], event({ kind: "unknown" })), GovernanceLogError, "APPEND_ACCEPTED_INVALID_EVENT");
  assert.throws(() => appendGovernanceEvent([event({ actor: ACTOR })], event()), GovernanceLogError, "APPEND_ACCEPTED_MALFORMED_HISTORY");
  assert.throws(
    () => appendGovernanceEvent(Array.from({ length: GOVERNANCE_LOG_MAX_ENTRIES }, () => event()), event()),
    GovernanceLogError,
    "APPEND_EXCEEDED_THE_LIMIT",
  );
});

/*
 * D-18: a question event keeps the question's own words, bounded like an explanation. The snapshot
 * is what the analyst timeline names the question by after the question changes again (D-17).
 */
test("questionTextSnapshot keeps short text and cuts long text to the event bound with an ellipsis", () => {
  assert.equal(MAX_QUESTION_TEXT_LENGTH, 500);
  assert.equal(questionTextSnapshot("  Where will the service be hosted?  "), "Where will the service be hosted?", "SNAPSHOT_NOT_TRIMMED");
  assert.equal(questionTextSnapshot("a".repeat(500)), "a".repeat(500), "SNAPSHOT_CUT_TEXT_WITHIN_THE_BOUND");
  const cut = questionTextSnapshot("a".repeat(600));
  assert.equal(cut.length, 500, "SNAPSHOT_NOT_CUT_TO_THE_BOUND");
  assert.equal(cut, `${"a".repeat(499)}…`, "SNAPSHOT_NOT_ENDED_WITH_AN_ELLIPSIS");
  // Whatever the snapshot returns, the closed parser accepts.
  assert.equal(parseGovernanceEvent(event({ kind: "question-edited", questionKey: "hosting", questionText: cut })).questionText, cut);
});

test("a question event carries its question text up to 500 characters and older events stay readable", () => {
  const added = appendGovernanceEvent([event()], event({ kind: "question-added", questionKey: "hosting", questionText: "Where will the service be hosted?" }));
  assert.equal(added.at(-1)?.questionText, "Where will the service be hosted?", "QUESTION_TEXT_NOT_APPENDED");
  assert.equal(appendGovernanceEvent(null, event({ kind: "question-edited", questionKey: "hosting", questionText: "a".repeat(500) })).at(-1)?.questionText, "a".repeat(500));
  assert.throws(
    () => appendGovernanceEvent(null, event({ kind: "question-edited", questionKey: "hosting", questionText: "a".repeat(501) })),
    GovernanceLogError,
    "OVERLONG_QUESTION_TEXT_ACCEPTED",
  );
  assert.throws(() => parseGovernanceEvent(event({ kind: "question-deleted", questionText: "   " })), GovernanceLogError, "BLANK_QUESTION_TEXT_ACCEPTED");
  assert.throws(() => parseGovernanceEvent(event({ kind: "question-deleted", questionText: 42 })), GovernanceLogError, "NON_STRING_QUESTION_TEXT_ACCEPTED");
  // Events written before the snapshot existed carry no text and still parse unchanged.
  assert.deepEqual(
    parseGovernanceLog([event({ kind: "question-edited", questionKey: "hosting" })]),
    [{ schemaVersion: 1, kind: "question-edited", at: AT, by: ACTOR, questionKey: "hosting" }],
  );
});

test("the governance log module exports no way to remove, reorder or rewrite an entry", async () => {
  const module = await import("../src/api/csrm-questionnaire/services/questionnaire-governance-log");
  const writers = Object.keys(module).filter((name) => /remove|delete|reorder|rewrite|replace|splice|sort|clear|set|update/i.test(name));
  assert.deepEqual(writers, [], `GOVERNANCE_LOG_EXPOSES_A_DESTRUCTIVE_WRITER_${writers.join(",")}`);
});

test("a malformed stored log summarises as empty rather than throwing out of a read", () => {
  assert.deepEqual(summariseGovernanceLog([event({ actor: ACTOR })]), { eventCount: 0, lastEventAt: null });
  assert.deepEqual(summariseGovernanceLog("not a log"), { eventCount: 0, lastEventAt: null });
  assert.deepEqual(summariseGovernanceLog(null), { eventCount: 0, lastEventAt: null });
  assert.deepEqual(
    summariseGovernanceLog([event({ at: "2026-09-01T00:00:00.000Z" }), event({ at: "2026-09-04T00:00:00.000Z" })]),
    { eventCount: 2, lastEventAt: "2026-09-04T00:00:00.000Z" },
  );

  const projected = projectQuestionnaire(questionnaire({ governanceLog: [{ kind: "released" }] }));
  assert.deepEqual(projected.revision, { eventCount: 0, lastEventAt: null }, "MALFORMED_LOG_BROKE_THE_READ_PATH");
});

test("countAnalystChangesSinceGeneration counts question changes at or after the latest generation (D-16)", () => {
  const T = "2026-09-10T00:00:00.000Z";
  const log = [
    event({ kind: "question-edited", at: "2026-09-09T23:59:59.000Z", questionKey: "before" }),
    event({ kind: "question-added", at: "2026-09-10T00:00:01.000Z", questionKey: "added" }),
    event({ kind: "question-deleted", at: "2026-09-10T00:00:02.000Z", questionKey: "removed" }),
    event({ kind: "released", at: "2026-09-10T00:00:03.000Z" }),
  ];
  assert.equal(countAnalystChangesSinceGeneration(log, T), 2, "CHANGES_BEFORE_GENERATION_COUNTED");
  // An event at the generation instant itself counts.
  assert.equal(countAnalystChangesSinceGeneration([event({ kind: "question-edited", at: T, questionKey: "same-instant" })], T), 1, "CHANGE_AT_GENERATION_NOT_COUNTED");
  assert.equal(countAnalystChangesSinceGeneration(log, null), 3, "NO_GENERATION_DATE_NOT_ALL_CHANGES");
  assert.equal(countAnalystChangesSinceGeneration(log, undefined), 3, "ABSENT_GENERATION_DATE_NOT_ALL_CHANGES");
  assert.equal(countAnalystChangesSinceGeneration(log, new Date(T)), 2, "DATE_GENERATION_NOT_READ");
  // Answer-cleared events follow from an edit and are not counted on their own; a replacement is not a change.
  assert.equal(countAnalystChangesSinceGeneration([
    event({ kind: "answer-cleared", at: "2026-09-11T00:00:00.000Z", questionKey: "added", explanation: "The choices changed." }),
    event({ kind: "regenerated", at: "2026-09-11T00:00:01.000Z", explanation: "A newly generated questionnaire replaced 1 question. No analyst changes were discarded." }),
  ], T), 0, "NON_CHANGE_EVENTS_COUNTED");
  assert.equal(countAnalystChangesSinceGeneration(null, T), 0, "ABSENT_LOG_COUNTED");
});

/*
 * WR-102: a log that cannot be read says nothing about what a replacement would discard, so the count is
 * unknown (null) rather than 0. A confirmation reading 0 would tell the analyst nothing is discarded, the
 * undercount the D-16 rule calls the worse error; the analyst read omits the count, and the web says so.
 */
test("countAnalystChangesSinceGeneration fails closed on a log it cannot read (WR-102)", () => {
  const T = "2026-09-10T00:00:00.000Z";
  assert.equal(countAnalystChangesSinceGeneration("not a log", T), null, "MALFORMED_LOG_COUNTED_AS_ZERO");
  assert.equal(countAnalystChangesSinceGeneration([{ kind: "question-edited" }], T), null, "INVALID_EVENT_COUNTED_AS_ZERO");
  assert.deepEqual(
    projectAnalystRevision(questionnaire({ governanceLog: [{ kind: "question-edited" }], generatedDate: T })),
    { eventCount: 0, lastEventAt: null },
    "ANALYST_REVISION_CARRIED_A_COUNT_FOR_AN_UNREADABLE_LOG",
  );
  assert.deepEqual(
    projectAnalystRevision(questionnaire({ governanceLog: [], generatedDate: T })),
    { eventCount: 0, lastEventAt: null, analystChangesSinceGeneration: 0 },
    "ANALYST_REVISION_LOST_THE_COUNT_FOR_A_READABLE_LOG",
  );
});

test("projectGovernanceEvents preserves analyst detail and narrows requestor history", () => {
  const source = questionnaire({ governanceLog: [
    event({ kind: "released", at: "2026-09-01T00:00:00.000Z" }),
    event({ kind: "returned-to-review", at: "2026-09-02T00:00:00.000Z", reason: "Clarify ownership." }),
    event({ kind: "answer-cleared", at: "2026-09-03T00:00:00.000Z", questionKey: "service-name", explanation: "The answer no longer matches." }),
  ] });
  const analyst = projectGovernanceEvents(source, "analyst");
  const requestor = projectGovernanceEvents(source, "requestor");
  assert.deepEqual(analyst.map((entry) => entry.kind), ["released", "returned-to-review", "answer-cleared"]);
  assert.deepEqual(requestor.map((entry) => entry.kind), ["released", "returned-to-review", "answer-cleared"]);
  // The log stores only the acting documentId, so without the caller's lookup the
  // display name is unknown; reporting the identifier as one would read as a
  // person's name.
  assert.deepEqual(analyst[1]?.by, { documentId: ACTOR, displayName: null }, "TIMELINE_ACTOR_NAME_WAS_FABRICATED");
  assert.equal(analyst[1]?.reason, "Clarify ownership.");
  assert.equal(analyst[2]?.questionKey, "service-name");
  assert.equal(requestor[1]?.reason, undefined, "REQUESTOR_RECEIVED_ANALYST_REASON");
  assert.equal(requestor[1]?.by, undefined, "REQUESTOR_RECEIVED_ANALYST_IDENTITY");
  assert.equal(requestor[2]?.questionKey, undefined, "REQUESTOR_RECEIVED_INTERNAL_QUESTION_KEY");
  assert.equal(requestor[2]?.explanation, "The answer no longer matches.");
  assert.deepEqual(projectGovernanceEvents(questionnaire({ governanceLog: [{ kind: "released" }] }), "analyst"), []);
  assert.equal(projectGovernanceEvents(questionnaire({ governanceLog: Array.from({ length: 1001 }, () => event()) }), "analyst").length, 0);
  assert.deepEqual(projectGovernanceEvents(questionnaire({ governanceLog: [event(), event({ kind: "future-event" })] }), "analyst").map((entry) => entry.kind), ["released"]);
});

test("projectGovernanceEvents gives the analyst a question event's stored text and the Requestor neither text nor key", () => {
  const source = questionnaire({ governanceLog: [
    event({ kind: "question-edited", at: "2026-09-03T00:00:00.000Z", questionKey: "service-name", questionText: "What is the service called?" }),
  ] });
  const [analyst] = projectGovernanceEvents(source, "analyst");
  const [requestor] = projectGovernanceEvents(source, "requestor");
  assert.equal(analyst?.questionText, "What is the service called?", "ANALYST_TIMELINE_LOST_THE_SNAPSHOT");
  assert.equal(analyst?.questionKey, "service-name");
  assert.deepEqual(Object.keys(requestor ?? {}).sort(), ["at", "kind"], "REQUESTOR_RECEIVED_QUESTION_DETAIL");
});

/*
 * D-17: an event written before snapshots existed is named by resolving its key against every
 * question, removed ones included, but only when it is not older than the latest generation. An
 * older event's key may belong to a replaced question set, so it names no question at all.
 */
test("projectGovernanceEvents resolves an older event's question text only from the latest generation on", () => {
  const removed = {
    documentId: "question-2",
    questionText: "Where was the service hosted?",
    answerType: "Text",
    options: {
      schemaVersion: 2,
      questionKey: "legacy-hosting",
      section: { key: "context", title: "Context", order: 1 },
      order: 2,
      required: false,
      deleted: { deletedAt: "2026-09-04T00:00:00.000Z", deletedBy: ACTOR },
    },
    answer: null,
  };
  const generatedDate = "2026-09-02T00:00:00.000Z";
  const source = questionnaire({ generatedDate, questions: [question(), removed], governanceLog: [
    event({ kind: "question-edited", at: "2026-09-03T00:00:00.000Z", questionKey: "service-name" }),
    event({ kind: "question-deleted", at: "2026-09-04T00:00:00.000Z", questionKey: "legacy-hosting" }),
    event({ kind: "question-edited", at: "2026-09-01T00:00:00.000Z", questionKey: "service-name" }),
    event({ kind: "answer-cleared", at: generatedDate, questionKey: "service-name", explanation: "The choices changed." }),
    event({ kind: "question-added", at: "2026-09-03T00:00:00.000Z", questionKey: "never-stored" }),
    event({ kind: "question-edited", at: "2026-09-01T00:00:00.000Z", questionKey: "service-name", questionText: "What was the service called?" }),
  ] });
  const analyst = projectGovernanceEvents(source, "analyst");
  assert.equal(analyst[0]?.questionText, "What is the name of the service?", "CURRENT_QUESTION_NOT_RESOLVED_BY_KEY");
  assert.equal(analyst[1]?.questionText, "Where was the service hosted?", "REMOVED_QUESTION_NOT_RESOLVED_BY_KEY");
  assert.equal("questionText" in (analyst[2] ?? {}), false, "EVENT_OLDER_THAN_THE_GENERATION_WAS_RESOLVED");
  assert.equal(analyst[2]?.questionKey, "service-name", "OLDER_EVENT_LOST_ITS_KEY");
  assert.equal(analyst[3]?.questionText, "What is the name of the service?", "EVENT_AT_THE_GENERATION_NOT_RESOLVED");
  assert.equal("questionText" in (analyst[4] ?? {}), false, "UNKNOWN_KEY_WAS_GIVEN_A_TEXT");
  assert.equal(analyst[5]?.questionText, "What was the service called?", "SNAPSHOT_NOT_PREFERRED_OVER_RESOLUTION");
  for (const [index, entry] of projectGovernanceEvents(source, "requestor").entries()) {
    assert.equal("questionText" in entry, false, `REQUESTOR_RECEIVED_RESOLVED_TEXT_${index}`);
  }

  // With no generation recorded, every key resolves.
  const ungenerated = projectGovernanceEvents(questionnaire({ questions: [question(), removed], governanceLog: [
    event({ kind: "question-edited", at: "2026-08-01T00:00:00.000Z", questionKey: "service-name" }),
  ] }), "analyst");
  assert.equal(ungenerated[0]?.questionText, "What is the name of the service?", "KEY_NOT_RESOLVED_WITHOUT_A_GENERATION");

  // A resolved text is bounded like a snapshot.
  const long = { ...question(), questionText: "b".repeat(600) };
  const bounded = projectGovernanceEvents(questionnaire({ generatedDate, questions: [long], governanceLog: [
    event({ kind: "question-edited", at: "2026-09-03T00:00:00.000Z", questionKey: "service-name" }),
  ] }), "analyst");
  assert.equal(bounded[0]?.questionText, `${"b".repeat(499)}…`, "RESOLVED_TEXT_NOT_BOUNDED");
});

/*
 * D-31 (Phase 8): the projection stays pure. It names an analyst actor only
 * through the resolver its caller built from one lookup, keeps a null name for
 * an id the resolver cannot name, and never consults it for a Requestor.
 */
test("projectGovernanceEvents names analyst actors only through the caller's resolver", () => {
  const source = questionnaire({ governanceLog: [
    event({ kind: "released", at: "2026-09-01T00:00:00.000Z" }),
    event({ kind: "returned-to-review", at: "2026-09-02T00:00:00.000Z", by: "retired-analyst", reason: "Clarify ownership." }),
    event({ kind: "released", at: "2026-09-03T00:00:00.000Z" }),
  ] });
  const consulted: string[] = [];
  const resolve = (documentId: string) => {
    consulted.push(documentId);
    return documentId === ACTOR ? "Morgan Analyst" : null;
  };

  assert.deepEqual(projectGovernanceEvents(source, "analyst", resolve).map((entry) => entry.by), [
    { documentId: ACTOR, displayName: "Morgan Analyst" },
    { documentId: "retired-analyst", displayName: null },
    { documentId: ACTOR, displayName: "Morgan Analyst" },
  ], "TIMELINE_ACTOR_NOT_NAMED_THROUGH_THE_RESOLVER");
  assert.deepEqual(consulted, [ACTOR, "retired-analyst", ACTOR]);

  consulted.length = 0;
  const requestor = projectGovernanceEvents(source, "requestor", resolve);
  assert.equal(requestor.length, 3);
  assert.ok(requestor.every((entry) => !("by" in entry)), "REQUESTOR_RECEIVED_THE_ACTOR");
  assert.deepEqual(consulted, [], "REQUESTOR_PROJECTION_CONSULTED_THE_RESOLVER");

  // Without a resolver every analyst actor keeps the neutral null name.
  assert.deepEqual(projectGovernanceEvents(source, "analyst").map((entry) => entry.by), [
    { documentId: ACTOR, displayName: null },
    { documentId: "retired-analyst", displayName: null },
    { documentId: ACTOR, displayName: null },
  ]);

  // The ids to look up are exactly the distinct actors of the events the projection emits.
  assert.deepEqual(governanceActorIds(source), [ACTOR, "retired-analyst"]);
  assert.deepEqual(governanceActorIds(questionnaire({ governanceLog: [event(), event({ kind: "future-event", by: "future-actor" })] })), [ACTOR]);
  assert.deepEqual(governanceActorIds(questionnaire({ governanceLog: [{ kind: "released" }] })), []);
  assert.deepEqual(governanceActorIds(questionnaire()), []);
});

test("projectQuestionnaire emits a null release for a never-released record and a narrow identity for a released one", () => {
  const never = projectQuestionnaire(questionnaire());
  assert.equal(never.release, null, "UNEXPECTED_RELEASE_FOR_NEVER_RELEASED_RECORD");
  assert.deepEqual(never.revision, { eventCount: 0, lastEventAt: null });

  const released = projectQuestionnaire(questionnaire({
    releasedAt: AT,
    releasedBy: {
      documentId: "analyst-1",
      displayName: "Bob Doe",
      email: "bob.doe@idambox.com",
      accountStatus: "active",
      roles: [{ name: "Security Analyst" }],
    },
    governanceLog: [event()],
  }));
  assert.deepEqual(
    released.release,
    { releasedAt: AT, releasedBy: { documentId: "analyst-1", displayName: "Bob Doe" } },
    "UNEXPECTED_RELEASE_PROJECTION",
  );
  assert.deepEqual(released.revision, { eventCount: 1, lastEventAt: AT });

  const withoutIdentity = projectQuestionnaire(questionnaire({ releasedAt: AT }));
  assert.deepEqual(withoutIdentity.release, { releasedAt: AT, releasedBy: null }, "UNEXPECTED_MISSING_ACTOR_PROJECTION");
  const blankTimestamp = projectQuestionnaire(questionnaire({ releasedAt: "" }));
  assert.equal(blankTimestamp.release, null, "BLANK_RELEASE_TIMESTAMP_TREATED_AS_RELEASED");
});

function collectionState(actor: "requestor" | "analyst", scope: "own" | "all"): Record<string, unknown> {
  return {
    csrmAuthorization: {
      questionnaireActor: actor,
      questionnaireCollectionScope: scope,
      ...(scope === "own" ? { questionnaireRequestorId: 42 } : {}),
    },
  };
}

test("the owner-scoped collection filter requires a release fact only for a Requestor", () => {
  const requestor = buildQuestionnaireCollectionQuery({}, collectionState("requestor", "own"));
  const requestorClauses = (requestor.dataQuery.filters as { $and: Array<Record<string, unknown>> }).$and;
  assert.deepEqual(
    requestorClauses.at(-1),
    { releasedAt: { $notNull: true } },
    "REQUESTOR_COLLECTION_MISSING_RELEASE_REQUIREMENT",
  );
  assert.ok(
    requestorClauses.some((clause) => JSON.stringify(clause).includes("requestor")),
    "REQUESTOR_COLLECTION_LOST_ITS_OWNER_SCOPE",
  );

  const review = buildQuestionnaireCollectionQuery({}, collectionState("analyst", "all"));
  assert.equal(
    JSON.stringify(review.dataQuery.filters).includes("releasedAt"),
    false,
    "ANALYST_REVIEW_COLLECTION_GAINED_A_RELEASE_REQUIREMENT",
  );

  // An analyst reading their own My list keeps the wider grant: the release
  // requirement belongs to the Requestor actor, not to the owner scope.
  const analystOwnList = buildQuestionnaireCollectionQuery({}, collectionState("analyst", "own"));
  assert.equal(
    JSON.stringify(analystOwnList.dataQuery.filters).includes("releasedAt"),
    false,
    "ANALYST_OWN_LIST_GAINED_A_RELEASE_REQUIREMENT",
  );

  const searched = buildQuestionnaireCollectionQuery({ q: "portal" }, collectionState("requestor", "own"));
  const searchedClauses = (searched.dataQuery.filters as { $and: Array<Record<string, unknown>> }).$and;
  assert.equal(searchedClauses.length, 3, "UNEXPECTED_SEARCHED_CLAUSE_COUNT");
  assert.deepEqual(searchedClauses.at(-1), { releasedAt: { $notNull: true } }, "SEARCH_DROPPED_THE_RELEASE_REQUIREMENT");
});

test("the analyst-review gate accepts only the editable questionnaire stage", () => {
  for (const requestStatus of ["submitted", "questionnaire-in-progress"]) {
    assert.doesNotThrow(() => assertQuestionnaireInAnalystReview(
      { releasedAt: null },
      { requestStatus },
    ), `ANALYST_REVIEW_GATE_REJECTED_${requestStatus}`);
  }
  // Each refusal names the one rule behind it (D-22): a release, work on the assessment, or a stage
  // the questionnaire cannot be governed at.
  const refusingCases: Array<[string, Record<string, unknown>, Record<string, unknown>, string]> = [
    ["RELEASED", { releasedAt: AT }, { requestStatus: "questionnaire-in-progress" }, "QUESTIONNAIRE_RELEASED"],
    ...["risk-assessment-drafted", "under-review", "approved", "closed"].map((requestStatus) =>
      [`STATUS_${requestStatus}`, { releasedAt: null }, { requestStatus }, "ASSESSMENT_STARTED"] as [string, Record<string, unknown>, Record<string, unknown>, string]),
    ["STATUS_draft", { releasedAt: null }, { requestStatus: "draft" }, "REQUEST_NOT_ELIGIBLE"],
    ["ASSESSMENT", { releasedAt: null }, { requestStatus: "questionnaire-in-progress", assessment: { documentId: "assessment-1" } }, "ASSESSMENT_STARTED"],
  ];
  for (const [diagnostic, questionnaireValue, requestValue, reason] of refusingCases) {
    assert.throws(
      () => assertQuestionnaireInAnalystReview(questionnaireValue, requestValue),
      (error: unknown) => error instanceof QuestionnaireGovernanceError && error.status === 409 && error.reason === reason,
      `ANALYST_REVIEW_GATE_ACCEPTED_${diagnostic}`,
    );
  }
});

test("returning answers preserves valid values as draft envelopes readable by the answer parser", () => {
  const definition = [{ questionKey: "submitted" }, { questionKey: "draft" }, { questionKey: "empty" }];
  const submitted = { schemaVersion: 1 as const, value: "Retained value", state: "submitted" as const, updatedAt: AT, submittedAt: AT };
  const draft = { schemaVersion: 1 as const, value: "Existing draft", state: "draft" as const, updatedAt: AT };
  const result = returnAnswersToDraft(definition, { submitted, draft, empty: null }, new Date("2026-09-02T00:00:00.000Z"));

  assert.deepEqual(result.submitted, {
    schemaVersion: 1,
    value: "Retained value",
    state: "draft",
    updatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(result.draft, draft, "EXISTING_DRAFT_WAS_REWRITTEN");
  assert.equal(result.empty, null, "NULL_ANSWER_WAS_CHANGED");
  for (const answer of Object.values(result)) {
    if (answer !== null) assert.notEqual(parseAnswerEnvelope(answer), null, "RETURNED_ENVELOPE_IS_NOT_READABLE");
  }
});

test("versioned deleted questions remain parseable history but leave every active calculation", () => {
  const first = question({ schemaVersion: 1, value: "yes", state: "submitted", updatedAt: AT, submittedAt: AT });
  const removed = question(null);
  removed.documentId = "question-2";
  removed.options = {
    schemaVersion: 2,
    questionKey: "retired-question",
    section: { key: "context", title: "Context", order: 1 },
    order: 2,
    required: true,
    deleted: { deletedAt: AT, deletedBy: ACTOR },
  };
  const definition = parseQuestionnaireDefinition([first, removed]);
  assert.deepEqual(activeQuestionnaireDefinition(definition).map((entry) => entry.questionKey), ["service-name"]);
  assert.deepEqual(getVisibleQuestionKeys(definition, { "service-name": "yes", "retired-question": null }), ["service-name"]);
  assert.equal(questionnaireState(questionnaire({ questions: [first, removed] })), "submitted", "DELETED_REQUIRED_QUESTION_BLOCKED_SUBMISSION_STATE");
});

/*
 * Phase 15 (D-26, the approved 06.8 amendment): an `ai-proposal` event records that a Security Analyst asked the AI for
 * proposals. It carries the run, its scope, exactly one of the instruction or its source, the provider and the number of
 * items the run kept; the closed parser refuses any AI key on a kind that may not carry it.
 */
const RUN_ID = "run-document-id";
const INSTRUCTION = "Add questions about the offshore support team";

function aiProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return defined(event({
    kind: "ai-proposal",
    runId: RUN_ID,
    scope: "questionnaire",
    instruction: INSTRUCTION,
    providerName: "deterministic-questionnaire-proposals",
    providerVersion: "1",
    itemCount: 3,
    ...overrides,
  }));
}

/* An override of undefined leaves the key out, as a writer that omits it would. */
function defined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

/* The parsed event read as plain keys, so a case can name a key the event type does not declare yet. */
function keysOf(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

test("an ai-proposal event appends frozen with every key, at schemaVersion 1 (D-26)", () => {
  const [appended, ...rest] = appendGovernanceEvent([], aiProposal());
  assert.equal(rest.length, 0);
  assert.deepEqual(appended, {
    schemaVersion: 1,
    kind: "ai-proposal",
    at: AT,
    by: ACTOR,
    runId: RUN_ID,
    scope: "questionnaire",
    instruction: INSTRUCTION,
    providerName: "deterministic-questionnaire-proposals",
    providerVersion: "1",
    itemCount: 3,
  });
  assert.equal(Object.isFrozen(appended), true, "AI_PROPOSAL_EVENT_MUTABLE");
  assert.equal(GOVERNANCE_LOG_SCHEMA_VERSION, 1, "SCHEMA_VERSION_BUMPED");
  // The default task and the plain-language preset stand in for an instruction; nothing proposed is a result too.
  assert.equal(keysOf(parseGovernanceEvent(aiProposal({ instruction: undefined, instructionSource: "default-task", itemCount: 0 }))).instructionSource, "default-task");
  const rewrite = keysOf(parseGovernanceEvent(aiProposal({
    scope: "question",
    instruction: undefined,
    instructionSource: "plain-language-preset",
    questionKey: "hosting",
    questionText: "Where will the service be hosted?",
    itemCount: 1,
  })));
  assert.equal(rewrite.questionKey, "hosting");
  assert.equal(rewrite.instructionSource, "plain-language-preset");
  assert.equal(String(keysOf(parseGovernanceEvent(aiProposal({ instruction: "a".repeat(500), itemCount: 30 }))).instruction).length, 500);
});

test("the closed parser refuses an ai-proposal outside the amendment's bounds and AI keys on kinds that may not carry them", () => {
  const refused: Array<[string, Record<string, unknown>]> = [
    ["BOTH_INSTRUCTION_AND_SOURCE", aiProposal({ instructionSource: "default-task" })],
    ["NEITHER_INSTRUCTION_NOR_SOURCE", aiProposal({ instruction: undefined })],
    ["UNKNOWN_INSTRUCTION_SOURCE", aiProposal({ instruction: undefined, instructionSource: "analyst" })],
    ["OVERLONG_INSTRUCTION", aiProposal({ instruction: "a".repeat(501) })],
    ["BLANK_INSTRUCTION", aiProposal({ instruction: "   " })],
    ["ITEM_COUNT_ABOVE_30", aiProposal({ itemCount: 31 })],
    ["NEGATIVE_ITEM_COUNT", aiProposal({ itemCount: -1 })],
    ["FRACTIONAL_ITEM_COUNT", aiProposal({ itemCount: 1.5 })],
    ["MISSING_ITEM_COUNT", aiProposal({ itemCount: undefined })],
    ["MISSING_RUN", aiProposal({ runId: undefined })],
    ["OVERLONG_RUN", aiProposal({ runId: "a".repeat(256) })],
    ["UNKNOWN_SCOPE", aiProposal({ scope: "assessment" })],
    ["MISSING_PROVIDER", aiProposal({ providerName: undefined })],
    ["OVERLONG_PROVIDER_VERSION", aiProposal({ providerVersion: "a".repeat(256) })],
    ["QUESTION_SCOPE_WITHOUT_QUESTION", aiProposal({ scope: "question" })],
    ["QUESTION_SCOPE_WITHOUT_TEXT", aiProposal({ scope: "question", questionKey: "hosting" })],
    ["QUESTIONNAIRE_SCOPE_NAMING_A_QUESTION", aiProposal({ questionKey: "hosting", questionText: "Where?" })],
    ["AI_EDITED_ON_AI_PROPOSAL", aiProposal({ aiEdited: false })],
    ["ITEM_KEY_ON_AI_PROPOSAL", aiProposal({ itemKey: "i-1" })],
    ["RUN_ON_RELEASED", event({ runId: RUN_ID })],
    ["ITEM_COUNT_ON_RELEASED", event({ itemCount: 1 })],
    ["INSTRUCTION_ON_RETURNED", event({ kind: "returned-to-review", reason: "Clarify.", instruction: INSTRUCTION })],
    ["PROVIDER_ON_QUESTION_ADDED", event({ kind: "question-added", questionKey: "hosting", providerName: "deterministic" })],
  ];
  for (const [diagnostic, value] of refused) {
    assert.throws(() => appendGovernanceEvent([], JSON.parse(JSON.stringify(value))), GovernanceLogError, `GOVERNANCE_EVENT_ACCEPTED_${diagnostic}`);
  }
});

test("the analyst projection of an ai-proposal carries every AI key and the initiating analyst's name", () => {
  const source = questionnaire({ governanceLog: [
    aiProposal({ at: "2026-09-03T00:00:00.000Z" }),
    aiProposal({
      at: "2026-09-04T00:00:00.000Z",
      scope: "question",
      instruction: undefined,
      instructionSource: "plain-language-preset",
      questionKey: "service-name",
      questionText: "What is the name of the service?",
      itemCount: 1,
    }),
  ] });
  const [requested, rewrite] = projectGovernanceEvents(source, "analyst", (documentId) => (documentId === ACTOR ? "Bob Doe" : null));
  assert.deepEqual(requested, {
    kind: "ai-proposal",
    at: "2026-09-03T00:00:00.000Z",
    by: { documentId: ACTOR, displayName: "Bob Doe" },
    runId: RUN_ID,
    scope: "questionnaire",
    instruction: INSTRUCTION,
    providerName: "deterministic-questionnaire-proposals",
    providerVersion: "1",
    itemCount: 3,
  }, "ANALYST_PROJECTION_LOST_AN_AI_KEY");
  assert.deepEqual(rewrite, {
    kind: "ai-proposal",
    at: "2026-09-04T00:00:00.000Z",
    by: { documentId: ACTOR, displayName: "Bob Doe" },
    questionKey: "service-name",
    questionText: "What is the name of the service?",
    runId: RUN_ID,
    scope: "question",
    instructionSource: "plain-language-preset",
    providerName: "deterministic-questionnaire-proposals",
    providerVersion: "1",
    itemCount: 1,
  }, "ANALYST_PROJECTION_LOST_A_REWRITE_KEY");
});

/*
 * Phase 15 (D-26, D-07, D-09): a confirmation names its run, item and whether the analyst edited it; an Undo adds
 * `aiUndo`; an undone removal restores the question. The Requestor's history never carries an AI kind or key, and a
 * confirmation and its Undo inside one analyst-review round leave no trace there.
 */
function confirmation(kind: string, itemKey: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return event({ kind, questionKey: `question-${itemKey}`, questionText: "Who supports the service offshore?", runId: RUN_ID, itemKey, aiEdited: false, ...overrides });
}

/* The pure Requestor projection of a stored log, read as plain keys. */
function projectForRequestor(events: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return projectGovernanceEventsForRequestor(parseGovernanceLog(events)).map(keysOf);
}

test("a confirmation's question change carries its run, item and edit flag together, and a restored question its key", () => {
  assert.equal(keysOf(parseGovernanceEvent(confirmation("question-added", "i-1"))).aiEdited, false);
  assert.equal(keysOf(parseGovernanceEvent(confirmation("question-edited", "i-2", { aiEdited: true, aiUndo: true }))).aiUndo, true);
  assert.equal(parseGovernanceEvent(event({ kind: "question-restored", questionKey: "hosting" })).kind, "question-restored");
  assert.equal(keysOf(parseGovernanceEvent(event({ kind: "question-restored", questionKey: "hosting", questionText: "Where?", runId: RUN_ID, itemKey: "i-3", aiEdited: false, aiUndo: true }))).itemKey, "i-3");
  assert.equal(keysOf(parseGovernanceEvent(event({ kind: "regenerated", instruction: INSTRUCTION }))).instruction, INSTRUCTION);
  assert.equal(keysOf(parseGovernanceEvent(event({ kind: "regenerated", instructionSource: "default-task" }))).instructionSource, "default-task");
  const refused: Array<[string, Record<string, unknown>]> = [
    ["ITEM_WITHOUT_RUN", defined(confirmation("question-added", "i-1", { runId: undefined }))],
    ["RUN_WITHOUT_ITEM", defined(confirmation("question-added", "i-1", { itemKey: undefined }))],
    ["CONFIRMATION_WITHOUT_EDIT_FLAG", defined(confirmation("question-deleted", "i-1", { aiEdited: undefined }))],
    ["ITEM_KEY_OUTSIDE_I_1_TO_I_30", confirmation("question-edited", "i-31")],
    ["UNDO_FALSE", confirmation("question-edited", "i-1", { aiUndo: false })],
    ["UNDO_ALONE", event({ kind: "question-edited", questionKey: "hosting", aiUndo: true })],
    ["RESTORED_WITHOUT_QUESTION", event({ kind: "question-restored" })],
    ["RESTORED_ITEM_WITHOUT_RUN", event({ kind: "question-restored", questionKey: "hosting", itemKey: "i-1", aiUndo: true })],
    ["REGENERATED_WITH_BOTH", event({ kind: "regenerated", instruction: INSTRUCTION, instructionSource: "default-task" })],
    ["REGENERATED_WITH_PRESET", event({ kind: "regenerated", instructionSource: "plain-language-preset" })],
    ["REGENERATED_WITH_RUN", event({ kind: "regenerated", runId: RUN_ID })],
  ];
  for (const [diagnostic, value] of refused) {
    assert.throws(() => parseGovernanceEvent(value), GovernanceLogError, `GOVERNANCE_EVENT_ACCEPTED_${diagnostic}`);
  }
});

test("the Requestor projection drops AI requests, every AI key and a confirmation undone in the same round", () => {
  const projected = projectForRequestor([
    event({ kind: "released", at: "2026-09-01T00:00:00.000Z" }),
    aiProposal({ at: "2026-09-02T00:00:00.000Z" }),
    confirmation("question-added", "i-1", { at: "2026-09-03T00:00:00.000Z" }),
    confirmation("question-deleted", "i-1", { at: "2026-09-04T00:00:00.000Z", aiUndo: true }),
    confirmation("question-edited", "i-2", { at: "2026-09-05T00:00:00.000Z", aiEdited: true }),
    event({ kind: "released", at: "2026-09-06T00:00:00.000Z" }),
  ]);
  assert.deepEqual(projected.map((entry) => entry.kind), ["released", "question-edited", "released"], "SAME_ROUND_PAIR_OR_AI_REQUEST_REACHED_THE_REQUESTOR");
  for (const entry of projected) {
    for (const key of ["runId", "itemKey", "aiEdited", "aiUndo", "scope", "instruction", "instructionSource", "providerName", "providerVersion", "itemCount"]) {
      assert.equal(key in entry, false, `REQUESTOR_RECEIVED_AI_KEY_${key}`);
    }
  }
  assert.equal(projected[1]?.questionKey, "question-i-2", "REQUESTOR_PROJECTION_DROPPED_A_KEPT_EVENT'S_OWN_KEYS");
});

test("the Requestor projection keeps a confirmation and its Undo when a release lies between them, not just the same round", () => {
  const projected = projectForRequestor([
    confirmation("question-added", "i-1", { at: "2026-09-03T00:00:00.000Z" }),
    event({ kind: "released", at: "2026-09-04T00:00:00.000Z" }),
    event({ kind: "returned-to-review", at: "2026-09-05T00:00:00.000Z", reason: "Undo the addition." }),
    confirmation("question-deleted", "i-1", { at: "2026-09-06T00:00:00.000Z", aiUndo: true }),
    // A second confirmation of the same item, undone before any release, leaves no trace.
    confirmation("question-added", "i-1", { at: "2026-09-07T00:00:00.000Z", aiEdited: true }),
    confirmation("question-deleted", "i-1", { at: "2026-09-08T00:00:00.000Z", aiEdited: true, aiUndo: true }),
    // An Undo of another run's item does not pair.
    confirmation("question-edited", "i-2", { at: "2026-09-09T00:00:00.000Z" }),
    confirmation("question-edited", "i-2", { at: "2026-09-10T00:00:00.000Z", runId: "other-run", aiUndo: true }),
  ]);
  assert.deepEqual(projected.map((entry) => `${entry.kind}@${String(entry.at).slice(0, 10)}`), [
    "question-added@2026-09-03",
    "released@2026-09-04",
    "returned-to-review@2026-09-05",
    "question-deleted@2026-09-06",
    "question-edited@2026-09-09",
    "question-edited@2026-09-10",
  ], "PAIRING_ACROSS_A_RELEASE_OR_ACROSS_RUNS");
});

test("an unpaired question-restored reaches the Requestor as a question change with kind and at only", () => {
  const source = questionnaire({ governanceLog: [
    confirmation("question-deleted", "i-1", { at: "2026-09-03T00:00:00.000Z" }),
    event({ kind: "released", at: "2026-09-04T00:00:00.000Z" }),
    event({ kind: "returned-to-review", at: "2026-09-05T00:00:00.000Z", reason: "Restore the question." }),
    event({ kind: "question-restored", at: "2026-09-06T00:00:00.000Z", questionKey: "question-i-1", questionText: "Who supports the service offshore?", runId: RUN_ID, itemKey: "i-1", aiEdited: false, aiUndo: true }),
    aiProposal({ at: "2026-09-07T00:00:00.000Z" }),
  ] });
  const requestor = projectGovernanceEvents(source, "requestor");
  assert.deepEqual(requestor, [
    { kind: "question-deleted", at: "2026-09-03T00:00:00.000Z" },
    { kind: "released", at: "2026-09-04T00:00:00.000Z" },
    { kind: "returned-to-review", at: "2026-09-05T00:00:00.000Z" },
    { kind: "question-restored", at: "2026-09-06T00:00:00.000Z" },
  ], "REQUESTOR_PROJECTION_OF_AI_EVENTS");
  // The analyst keeps every event and every key.
  const analyst = projectGovernanceEvents(source, "analyst");
  assert.deepEqual(analyst.map((entry) => entry.kind), ["question-deleted", "released", "returned-to-review", "question-restored", "ai-proposal"]);
  assert.deepEqual([analyst[3]?.runId, analyst[3]?.itemKey, analyst[3]?.aiEdited, analyst[3]?.aiUndo], [RUN_ID, "i-1", false, true], "ANALYST_LOST_THE_UNDO_SOURCE");
  assert.equal(analyst[0]?.aiEdited, false, "ANALYST_LOST_THE_CONFIRMATION_SOURCE");
});

test("countAnalystChangesSinceGeneration counts a question-restored beside added, edited and deleted (D-09)", () => {
  const T = "2026-09-10T00:00:00.000Z";
  assert.equal(countAnalystChangesSinceGeneration([
    event({ kind: "question-restored", at: "2026-09-09T00:00:00.000Z", questionKey: "before" }),
    event({ kind: "question-restored", at: "2026-09-11T00:00:00.000Z", questionKey: "hosting", runId: RUN_ID, itemKey: "i-1", aiEdited: false, aiUndo: true }),
    aiProposal({ at: "2026-09-11T00:00:01.000Z" }),
  ], T), 1, "QUESTION_RESTORED_NOT_COUNTED_OR_AI_REQUEST_COUNTED");
  assert.deepEqual(
    projectAnalystRevision(questionnaire({ generatedDate: T, governanceLog: [
      confirmation("question-added", "i-1", { at: "2026-09-11T00:00:00.000Z" }),
      confirmation("question-deleted", "i-1", { at: "2026-09-11T00:00:01.000Z", aiUndo: true }),
      event({ kind: "question-restored", at: "2026-09-11T00:00:02.000Z", questionKey: "hosting" }),
    ] })).analystChangesSinceGeneration,
    3,
    "CONFIRMATIONS_AND_UNDOS_NOT_ANALYST_CHANGES",
  );
});
