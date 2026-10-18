import assert from "node:assert/strict";
import test from "node:test";
import knex from "knex";
import controller from "../src/api/csrm-assessment-request/controllers/my-request-status-summary";

test("the owner summary reads status and holder counts in one statement snapshot", async () => {
  const connection = knex({ client: "better-sqlite3", connection: { filename: ":memory:", options: { nativeBinding: require.resolve("better-sqlite3/build/Release/better_sqlite3.node") } }, useNullAsDefault: true });
  const previous = globalThis.strapi;
  try {
    await connection.schema.createTable("csrm_assessment_requests", (t) => { t.integer("id"); t.string("request_status"); });
    await connection.schema.createTable("csrm_assessment_requests_requestor_lnk", (t) => { t.increments("id"); t.integer("csrm_assessment_request_id"); t.integer("idambox_user_id"); });
    await connection.schema.createTable("csrm_questionnaires_assessment_request_lnk", (t) => { t.integer("id"); t.integer("csrm_assessment_request_id"); t.integer("csrm_questionnaire_id"); });
    await connection.schema.createTable("csrm_questionnaires", (t) => { t.integer("id"); t.string("released_at"); });
    await connection.schema.createTable("csrm_assessments_assessment_request_lnk", (t) => { t.integer("id"); t.integer("csrm_assessment_request_id"); });
    await connection.schema.createTable("csrm_questions_questionnaire_lnk", (t) => { t.integer("id"); t.integer("csrm_questionnaire_id"); t.integer("csrm_question_id"); });
    await connection.schema.createTable("csrm_questions", (t) => { t.integer("id"); t.json("answer"); });
    await connection("csrm_assessment_requests").insert([{ id: 1, request_status: "draft" }, { id: 2, request_status: "submitted" }, { id: 3, request_status: "approved" }, { id: 4, request_status: "draft" }]);
    await connection("csrm_assessment_requests_requestor_lnk").insert([1, 2, 3, 4].map((id) => ({ csrm_assessment_request_id: id, idambox_user_id: id === 4 ? 9 : 7 })));
    // D-24: the notes, their authors and the read states, as the unread rule reads them.
    await connection.schema.createTable("csrm_request_notes", (t) => { t.integer("id"); t.string("author_part"); t.integer("sequence"); });
    await connection.schema.createTable("csrm_request_notes_assessment_request_lnk", (t) => { t.integer("id"); t.integer("csrm_request_note_id"); t.integer("csrm_assessment_request_id"); });
    await connection.schema.createTable("csrm_request_notes_author_lnk", (t) => { t.integer("id"); t.integer("csrm_request_note_id"); t.integer("idambox_user_id"); });
    await connection.schema.createTable("csrm_request_note_read_states", (t) => { t.integer("id"); t.integer("last_read_sequence"); });
    await connection.schema.createTable("csrm_request_note_read_states_reader_lnk", (t) => { t.integer("id"); t.integer("csrm_request_note_read_state_id"); t.integer("idambox_user_id"); });
    await connection.schema.createTable("csrm_request_note_read_states_assessment_request_lnk", (t) => { t.integer("id"); t.integer("csrm_request_note_read_state_id"); t.integer("csrm_assessment_request_id"); });
    // An analyst (5) writes twice on the owner's request 2 and once on another Requestor's request 4; the owner writes on 1.
    await connection("csrm_request_notes").insert([
      { id: 1, author_part: "security-analyst", sequence: 1 }, { id: 2, author_part: "security-analyst", sequence: 2 },
      { id: 3, author_part: "security-analyst", sequence: 1 }, { id: 4, author_part: "requestor", sequence: 1 },
    ]);
    await connection("csrm_request_notes_assessment_request_lnk").insert([
      { id: 1, csrm_request_note_id: 1, csrm_assessment_request_id: 2 }, { id: 2, csrm_request_note_id: 2, csrm_assessment_request_id: 2 },
      { id: 3, csrm_request_note_id: 3, csrm_assessment_request_id: 4 }, { id: 4, csrm_request_note_id: 4, csrm_assessment_request_id: 1 },
    ]);
    await connection("csrm_request_notes_author_lnk").insert([
      { id: 1, csrm_request_note_id: 1, idambox_user_id: 5 }, { id: 2, csrm_request_note_id: 2, idambox_user_id: 5 },
      { id: 3, csrm_request_note_id: 3, idambox_user_id: 5 }, { id: 4, csrm_request_note_id: 4, idambox_user_id: 7 },
    ]);
    globalThis.strapi = { db: { connection } } as unknown as typeof globalThis.strapi;
    const statements: string[] = [];
    connection.on("query", (q: { sql: string }) => { statements.push(q.sql); });
    const response = await controller.statusSummary({ query: {}, state: { csrmAuthorization: { assessmentRequestCollectionScope: "own", assessmentRequestRequestorId: 7 } } });
    // One request with new notes, however many notes it holds; another Requestor's and the owner's own notes are not counted.
    assert.deepEqual(response, { data: { draft: 1, submitted: 1, questionnaireInProgress: 0, riskAssessmentDrafted: 0, underReview: 0, approved: 1, closed: 0, total: 3, byHolder: { requestor: 1, analyst: 1, none: 1 }, withUnreadNotes: 1 } });
    assert.equal(statements.length, 1, "SUMMARY_COUNTS_REQUIRE_ONE_STATEMENT_SNAPSHOT");
  } finally {
    globalThis.strapi = previous;
    await connection.destroy();
  }
});
