import { CSRM_ANALYST_INSIGHT_OPERATIONS } from "../../src/api/csrm-analyst-insight/operations";
import type { AdministrationFixtureKind, AuthorizationHttpHarness } from "../helpers/strapi-http-harness";

/*
 * Phase 8 D-16: one row per served operation, keyed by the catalogue URL that
 * docs/references/served-operations.json records for the mounted route, plus one
 * row per plugin route the inventory lists. Each row states the outcome for six
 * callers of the mounted HTTP surface:
 *
 *   owner        Jane, the harness's seeded Requestor, who owns every "owner" record
 *   other        the second Requestor (Maya's counterpart), who owns the "other" records
 *   analyst      Bob, the human Security Analyst
 *   serviceAgent the seeded Security Analyst Agent role holder
 *   noIdentity   the API token with no x-csrm-test-identity header
 *   noToken      the analyst identity with no API token
 *
 * Conventions the rows encode: a policy denial is 403; an unauthorised
 * assessment read is 404 by design; a request with no identity is 403 on every
 * application route; a request with no token answers per token family (D-51,
 * observed on the first run and asserted since). Every denial is issued. A
 * success the row does not issue, because it would spend a fixture another row
 * or test depends on, cites a mounted test through `provenBy` for that actor,
 * and the matrix checks that the cited test sends a request as that actor
 * (SR-02, tests/helpers/matrix-provenance.ts). `seeAlso` keeps related proofs
 * for traceability only.
 */

export type MatrixActor = "owner" | "other" | "analyst" | "serviceAgent" | "noIdentity" | "noToken";
export const MATRIX_ACTORS: readonly MatrixActor[] = ["owner", "other", "analyst", "serviceAgent", "noIdentity", "noToken"];

export type MatrixFamily =
  | "assessment-requests"
  | "questionnaires"
  | "assessments"
  | "risks"
  | "control-implementations"
  | "administration"
  | "reference-data"
  | "analyst-insights"
  | "current-user"
  | "identity-provisioning"
  | "plugin";

/**
 * How a served route authenticates the API token, as the inventory's
 * `authStrategies` records it: `["content-api-token"]` restricts the route to
 * the token; `null` leaves Strapi's default content-API strategies in place.
 */
export type TokenFamily = "content-api-token" | "default-strategies";

/**
 * D-51: the status a request without the API token receives, per token family.
 * Recorded from the first matrix run on 2026-09-25 and asserted since: a
 * token-only route has no strategy left to answer and is 401; a default-strategy
 * route falls through to the users-permissions public role, which holds no
 * permission for any CSRM action, and is 403.
 */
export const MISSING_TOKEN_STATUS_BY_FAMILY: Readonly<Record<TokenFamily, number>> = {
  "content-api-token": 401,
  "default-strategies": 403,
};

export function tokenFamilyOf(authStrategies: readonly string[] | null | undefined): TokenFamily {
  return Array.isArray(authStrategies) && authStrategies.length === 1 && authStrategies[0] === "content-api-token"
    ? "content-api-token"
    : "default-strategies";
}

/*
 * The operations no automation identity may reach (csrm-authorization.ts
 * HUMAN_ANALYST_ONLY_OPERATIONS): the assessment release, the five questionnaire
 * governance operations, the read of a request's current generation jobs (Phase
 * 10 D-25), the five analyst insight operations, and Phase 12's draft generation, its
 * job read and retry, the AI run read and the proposal decisions (D-24, D-25, D-32), and Phase 13's assignment,
 * eligible-analyst read and AI-input mark on a request note (G-1, D-06, D-26, D-30), and Phase 14's AI inclusion of a
 * request attachment and its text preview (D-30, D-31, D-38), and Phase 16's risk curation (D-43) and risk AI proposal
 * operations (D-26, D-41, D-43), and Phase 19's analyst exports (D-13), each the policy literal (an export's catalogue
 * URL carries its query; the served and row lookups strip it, as the inventory does). The matrix test
 * checks each literal is still in the policy source and that its row denies the
 * service agent, the owner and the other Requestor.
 */
export const HUMAN_ANALYST_ONLY_OPERATIONS: readonly string[] = [
  "POST:/api/v1/risk_assessments/{assessmentId}/release",
  "POST:/api/v1/questionnaires/{questionnaireId}/release",
  "POST:/api/v1/questionnaires/{questionnaireId}/return_to_review",
  "POST:/api/v1/questionnaires/{questionnaireId}/questions",
  "PATCH:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}",
  "DELETE:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}",
  "GET:/api/v1/assessment_requests/{requestId}/generation_jobs",
  "POST:/api/v1/questionnaires/{questionnaireId}/generate_assessment",
  "GET:/api/v1/assessment_draft_jobs/{jobId}",
  "POST:/api/v1/assessment_draft_jobs/{jobId}/retry",
  "GET:/api/v1/ai_runs/{runId}",
  "POST:/api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions",
  // Phase 13 (G-1, D-30): a request's accountable analyst is a human, and only a human assigns one.
  "PUT:/api/v1/assessment_requests/{requestId}/assignee",
  // Phase 13 (D-06, D-07): the eligible-analyst read names people, so only a human analyst reads it.
  "GET:/api/v1/assessment_requests/{requestId}/assignable_analysts",
  // Phase 13 (D-26, D-30, G-1): choosing which notes reach the AI is a human analyst decision, never automation's.
  "PUT:/api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input",
  // Phase 14 (D-30, D-31, D-38, G-1): choosing which file text reaches the AI, and reading it, is a human analyst's alone.
  "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input",
  "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text",
  // Phase 15 (D-31, D-32): asking the AI about a questionnaire and deciding its proposals is human analyst work.
  "GET:/api/v1/questionnaires/{questionnaireId}/ai_proposals",
  "POST:/api/v1/questionnaires/{questionnaireId}/ai_proposals",
  "POST:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite",
  "GET:/api/v1/questionnaire_proposal_jobs/{jobId}",
  "POST:/api/v1/questionnaire_proposal_jobs/{jobId}/retry",
  "POST:/api/v1/questionnaires/{questionnaireId}/ai_proposal_decisions",
  // Phase 16 (D-43): withdrawing a Risk, reinstating it and reading its history are human analyst work.
  "POST:/api/v1/risk_assessments/{assessmentId}/risk_withdrawals",
  "POST:/api/v1/risk_assessments/{assessmentId}/risk_reinstatements",
  "GET:/api/v1/risks/{riskId}/history",
  // Phase 16 (D-26, D-41, D-43; G-3): asking the AI about Risks, following and retrying its jobs and reading its proposals.
  "POST:/api/v1/risk_assessments/{assessmentId}/risk_suggestions",
  "POST:/api/v1/risks/{riskId}/rewrite",
  "GET:/api/v1/risk_proposal_jobs/{jobId}",
  "POST:/api/v1/risk_proposal_jobs/{jobId}/retry",
  "GET:/api/v1/risk_assessments/{assessmentId}/ai_proposals",
  // Phase 19 (D-13): the analyst exports are human analyst work; the register export first (19-05).
  "GET:/api/v1/risks/export?format={format}",
  // 19-07: the review queue's export. The My requests export is the birthright's, so it is not listed here.
  "GET:/api/v1/assessment_requests/export",
  // 19-08: the questionnaire review list's export, and the alert list's, each its own literal: the alert export is not
  // one of the insight operations spread below. The My questionnaires export is the birthright's, so it is not listed.
  "GET:/api/v1/questionnaires/export",
  "GET:/api/v1/alerts/export",
  // 19-09: the reserved report export, its own literal for the same reason as the alert export's.
  "POST:/api/v1/reports/{reportKey}/export",
  // 19-10: the analyst Risk assessments list's export. The released assessment's export and My risk assessments' are
  // reachable through the Requestor's grants (the released row's other is 404), so neither is listed here.
  "GET:/api/v1/risk_assessments/export",
  // 19-14: the four reference-list exports, through the Administration Functions. The templates and error reports are
  // human-only through the Administration scope, as every Administration operation is, so they are not listed here.
  "GET:/api/v1/risk_types/export?format={format}",
  "GET:/api/v1/controls/export?format={format}",
  "GET:/api/v1/information_systems/export?format={format}",
  "GET:/api/v1/information_assets/export?format={format}",
  ...Object.values(CSRM_ANALYST_INSIGHT_OPERATIONS),
];

/*
 * The operations the service identity is refused whatever it holds (csrm-authorization.ts
 * SERVICE_IDENTITY_REFUSED_OPERATIONS; Phase 19 D-13, G-1): every export, as the policy literal. The matrix test checks
 * each literal is still in the policy source, that it is served and that its row denies the service agent. Phases 19.1
 * and 17 add their members here as they add them to the policy.
 */
export const SERVICE_IDENTITY_REFUSED_OPERATIONS: readonly string[] = [
  "GET:/api/v1/risks/export?format={format}",
  // 19-07: the request lists' exports.
  "GET:/api/v1/assessment_requests/export",
  "GET:/api/v1/my_requests/export",
  // 19-08: the questionnaire lists' exports and the alert list's.
  "GET:/api/v1/questionnaires/export",
  "GET:/api/v1/my_questionnaires/export",
  "GET:/api/v1/alerts/export",
  // 19-09: the report export.
  "POST:/api/v1/reports/{reportKey}/export",
  // 19-10: the released risk assessment's export and the two assessment lists' exports.
  "GET:/api/v1/risk_assessments/{assessmentId}/export",
  "GET:/api/v1/risk_assessments/export",
  "GET:/api/v1/my_risk_assessments/export",
  // 19-14: the four reference-list exports.
  "GET:/api/v1/risk_types/export?format={format}",
  "GET:/api/v1/controls/export?format={format}",
  "GET:/api/v1/information_systems/export?format={format}",
  "GET:/api/v1/information_assets/export?format={format}",
];

/** Seeded titles and values no denial may echo (the alerts-test pattern, widened to every fixture family). */
export const FIXTURE_TITLE_PATTERN =
  /Owner request|Other request|Submitted request|secret draft|Must never leak|Owner draft questionnaire|Owner submitted questionnaire|Other Requestor questionnaire|Governance (unreleased|released|returnable|editable) questionnaire|Assessment release fixture|Mounted aggregate|Administration (update|unchanged)|Matrix notes request|Matrix note on the request|Matrix attachments draft/;

/** Internals no response may echo. */
export const LEAK_PATTERN = /SQL|stack|database/i;

export type MatrixFixtures = {
  harness: AuthorizationHttpHarness;
  users: AuthorizationHttpHarness["users"];
  requests: AuthorizationHttpHarness["requests"];
  workflow: Awaited<ReturnType<AuthorizationHttpHarness["seedRequestWorkflowFixtures"]>>;
  questionnaires: Awaited<ReturnType<AuthorizationHttpHarness["seedQuestionnaireWorkflowFixtures"]>>;
  governance: Awaited<ReturnType<AuthorizationHttpHarness["seedQuestionnaireGovernanceFixtures"]>>;
  assessments: Awaited<ReturnType<AuthorizationHttpHarness["seedAssessmentWorkflowFixtures"]>>;
  administration: Awaited<ReturnType<AuthorizationHttpHarness["seedAdministrationFixtures"]>>;
  /**
   * IN-204: a draft assessment whose one Risk holds a readable AI record over a run that can take its decisions: the
   * risk statement confirmed, the issue statement still proposed.
   */
  aiDecision: { assessment: string; risk: string; run: string };
  /**
   * WR-203: a submitted request of Jane's holding one real note of hers, so the mark-read and AI-input rows name a note
   * that exists: a caller canUseRequestNotes wrongly admitted would then succeed, and the row's 404 can fail.
   */
  notes: { request: string; note: string };
  /**
   * 14-06 (D-16, D-18): a draft of Jane's of its own, so the attachment rows add to and list a request no other row
   * changes: an upload a guard failed to refuse would be stored and seen. 14-07 (D-23): one clean file on it, with
   * real stored bytes, so a download a guard failed to refuse would send them.
   */
  attachments: { draft: string; attachment: string };
  /**
   * Phase 15 (15-09): Jane's UAT-A-like request with its released, submitted questionnaire, which a human analyst may
   * ask the AI about and read the proposals of.
   */
  questionnaireAi: { request: string; questionnaire: string; optionalQuestion: string };
  /**
   * Phase 16 (16-05): a draft assessment on Jane's request with one active Risk, for the curation rows. A curation a
   * guard failed to refuse would withdraw it and write a history row, and the row's persistence would see both.
   */
  curation: { assessment: string; risk: string };
  /**
   * Phase 16 (16-09): a draft assessment on Jane's request with one active Risk and one failed "Suggest more risks" job,
   * for the risk AI proposal rows. A start, rewrite or retry a guard failed to refuse would queue a job and record a run,
   * and the rows' persistence would see the run and the job's attempt.
   */
  riskAiProposals: { assessment: string; risk: string; failedJob: string };
};

export type MatrixRequest = { path: string; init?: RequestInit };

export type MatrixExpectation = {
  owner: number;
  other: number;
  analyst: number;
  serviceAgent: number;
  noIdentity: number;
  /**
   * A served row leaves this out and takes MISSING_TOKEN_STATUS_BY_FAMILY for
   * the route's token family; a plugin row records what it observed.
   */
  noToken?: number;
};

export type MatrixProbe = {
  /** Builds the request for one actor; a plugin mutation that needs a unique body uses the actor. */
  request: (f: MatrixFixtures, actor: MatrixActor) => MatrixRequest;
  expect: MatrixExpectation;
  /**
   * Per actor, the mounted tests (`<file> › <test title>`) that prove a success this probe does not
   * issue. Every actor the probe allows needs one unless the probe issues its allowed requests, and
   * each cited test must send a request as that actor (SR-02).
   */
  provenBy?: Partial<Record<MatrixActor, readonly string[]>>;
  /** Related mounted proofs kept for traceability; each must exist, and none stands in for a success. */
  seeAlso?: readonly string[];
  /** Issue the requests expected to succeed as well (a read, or a mutation the row may make). */
  exercisesAllowed?: boolean;
};

export type MatrixVariant = MatrixProbe & {
  /** A second query shape on the same route with its own outcome (the dual picker and Administration routes). */
  label: string;
};

export type MatrixRow = MatrixProbe & {
  /** `<METHOD>:<catalogue URL>` for a served operation, or `<METHOD>:<mounted path>` for a plugin route. */
  operation: string;
  family: MatrixFamily;
  /** The records a denial must leave untouched, snapshotted before and after every non-2xx mutation. */
  persistence?: (f: MatrixFixtures) => Promise<unknown[]>;
  /** Strings the actor's response body must not carry, whatever its status. */
  mustNotDisclose?: (f: MatrixFixtures, actor: MatrixActor) => readonly string[];
  /**
   * A count-only "My" summary carries no record identifier for `mustNotDisclose`
   * to find, so its owner scoping is read from `data.total` instead: "none" for an
   * actor who owns no seeded record, "some" for one who does. A "My" list is read
   * the same way from `meta.pagination.total`, beside its `mustNotDisclose`.
   * Checked on every successful response the row issues.
   */
  ownedRecordTotal?: (actor: MatrixActor) => "none" | "some";
  variants?: readonly MatrixVariant[];
  /** A route mounted by a plugin (the inventory's `pluginRoutes`), outside the CSRM policy. */
  plugin?: true;
  /**
   * A route the application unmounts: a plugin route (14-04, D-08), which must be absent from the inventory's
   * `pluginRoutes`, or an application path no router serves (Phase 16 D-16, the Risk deletes), which must be absent from
   * its `served` rows. Every caller gets the unmounted-path answer (strapi-http-hardening.md, "Unmounted paths").
   */
  unmounted?: true;
};

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(method: string, body: unknown): RequestInit {
  return { method, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/** A multipart body with no file: the import routes refuse it after authorization, without a write. */
function emptyMultipart(): RequestInit {
  return { method: "POST", body: new FormData() };
}

const encode = encodeURIComponent;

/** Every identity holds the birthright: only a missing identity is refused. */
function everyIdentity(status: number): MatrixExpectation {
  return { owner: status, other: status, analyst: status, serviceAgent: status, noIdentity: 403 };
}
/** The human Security Analyst alone. */
function humanAnalystOnly(status: number): MatrixExpectation {
  return { owner: 403, other: 403, analyst: status, serviceAgent: 403, noIdentity: 403 };
}
/** The explicit analyst grant, held by the human analyst and the service agent. */
function analystAndAgent(status: number): MatrixExpectation {
  return { owner: 403, other: 403, analyst: status, serviceAgent: status, noIdentity: 403 };
}
/** An unmounted path answers every caller alike: 404 for a GET, 405 for a mutation (strapi-http-hardening.md). */
function unmountedRoute(status: 404 | 405): MatrixExpectation {
  return { owner: status, other: status, analyst: status, serviceAgent: status, noIdentity: status, noToken: status };
}
/** A plugin route sees two callers: everyone carrying the API token, and nobody at all. */
function pluginRoute(tokenHolder: number, anonymous: number): MatrixExpectation {
  return { owner: tokenHolder, other: tokenHolder, analyst: tokenHolder, serviceAgent: tokenHolder, noIdentity: tokenHolder, noToken: anonymous };
}
/** Everyone but the owner is refused Jane's record: the owner sees it, the analysts read it by grant. */
const OWNER_READ_OTHER_DENIED_403: MatrixExpectation = { owner: 200, other: 403, analyst: 200, serviceAgent: 200, noIdentity: 403 };
/**
 * Jane's request: the owner and the human analyst reach it. Phase 12 D-33 (R-08-42) withdrew the service
 * agent's request grants, so the agent, holding only the birthright, is refused another's request.
 */
const OWNER_REQUEST_AGENT_DENIED_403: MatrixExpectation = { owner: 200, other: 403, analyst: 200, serviceAgent: 403, noIdentity: 403 };
const requestOutsider = (actor: MatrixActor) => outsider(actor) || actor === "serviceAgent";

const notOwner = (actor: MatrixActor) => actor !== "owner";
const outsider = (actor: MatrixActor) => actor === "other" || actor === "noIdentity" || actor === "noToken";
const notHumanAnalyst = (actor: MatrixActor) => actor !== "analyst";
/**
 * Both Requestors own seeded requests, questionnaires and a released assessment;
 * the analyst and the service agent own none, so an owner-scoped summary must
 * count nothing for them however much their explicit grants reach (D-17).
 */
const ownedByRequestorsOnly = (actor: MatrixActor): "none" | "some" => (actor === "owner" || actor === "other" ? "some" : "none");

const ADMINISTRATION_KINDS: ReadonlyArray<{
  path: string;
  kind: AdministrationFixtureKind;
  fixture: (f: MatrixFixtures) => { update: string; unchanged: string };
  title: string;
  /** 19-14: the three file operations' row keys (the export's catalogue URL with its `?format={format}` stripped). */
  files: { template: string; errorReport: string; exportList: string };
}> = [
  { path: "risk_types", kind: "risk-types", fixture: (f) => f.administration.riskTypes, title: "Administration import unchanged fixture",
    files: { template: "GET:/api/v1/risk_types/import/template", errorReport: "POST:/api/v1/risk_types/import/error_report", exportList: "GET:/api/v1/risk_types/export" } },
  { path: "controls", kind: "controls", fixture: (f) => f.administration.controls, title: "Administration unchanged control",
    files: { template: "GET:/api/v1/controls/import/template", errorReport: "POST:/api/v1/controls/import/error_report", exportList: "GET:/api/v1/controls/export" } },
  { path: "information_systems", kind: "information-systems", fixture: (f) => f.administration.informationSystems, title: "Administration unchanged system",
    files: { template: "GET:/api/v1/information_systems/import/template", errorReport: "POST:/api/v1/information_systems/import/error_report", exportList: "GET:/api/v1/information_systems/export" } },
  { path: "information_assets", kind: "information-assets", fixture: (f) => f.administration.informationAssets, title: "Administration unchanged asset",
    files: { template: "GET:/api/v1/information_assets/import/template", errorReport: "POST:/api/v1/information_assets/import/error_report", exportList: "GET:/api/v1/information_assets/export" } },
];

const ADMINISTRATION_CRUD_PROOF = "administration.integration.test.ts › ADMIN-01 ADMIN-02 ADMIN-03 mounted CRUD is closed, normalized, paginated, and delete-free";
const ADMINISTRATION_IMPORT_PROOF = "administration.integration.test.ts › ADMIN-04 applies five-state imports for every remaining Administration collection";
/* 19-14 (D-31 to D-33): the templates, the error reports and the reference-list exports, proven for the analyst over HTTP. */
const ADMINISTRATION_TEMPLATE_PROOF = "administration.integration.test.ts › CSV-02 D-31 every collection's template carries its import labels and its reserved example row";
const ADMINISTRATION_ERROR_REPORT_PROOF = "administration.integration.test.ts › CSV-02 D-32 the error report at Review is the rejected and similar rows as typed, the header as typed, and an Issues column, with a BOM and no event";
const ADMINISTRATION_ERROR_REPORT_REFUSAL_PROOF = "administration.integration.test.ts › CSV-02 D-32 error report refusals: another analyst's or collection's token, a different file, both or neither token and a client's issues";
const REFERENCE_EXPORT_PROOF = "exports.integration.test.ts › reference-lists: each reference list exports as a BOM-led CSV with its import columns then its read-only columns, the leading-zero control number as text, and one export.completed line each";
const REFERENCE_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › reference-lists: Jane, the service agent (even when its role is granted the Function), Jane mis-granted the Function, Bob without the list read and no identity are 403 in the exports' words at all four exports, and no token is 401";
const CANONICAL_ADMINISTRATION_QUERY = "?q=&sort=name%3Aasc&page=1&pageSize=25";
const PICKER_PROOF = "authorization.integration.test.ts › single-owner picker routes keep the legacy envelope and deny canonical Administration queries to agents";
const SELECTOR_PROOF = "authorization.integration.test.ts › Requestor selector routes return bounded summaries and reject invalid inventory input";
/*
 * The mounted proofs of the successes the matrix does not issue, each cited only for the actors its test
 * sends a request as (SR-02). The last two exist for the actors the older proofs never sent.
 */
const REQUEST_CREATE_PROOF = "authorization.integration.test.ts › mounted POST derives requestor ownership and rejects PATCH";
const REQUEST_UPDATE_PROOF = "authorization.integration.test.ts › mounted canonical PUT persists only owner and exact-grant analyst changes";
const REQUEST_DELETE_PROOF = "authorization.integration.test.ts › mounted DELETE denies an owning Requestor before an exact-grant analyst removes the record";
const REQUEST_REVERT_PROOF = "request-workflow.integration.test.ts › request revert returns only eligible submitted requests to draft with server-owned audit facts";
const REQUEST_ASSIGNMENT_PROOF = "request-assignment.integration.test.ts › a Security Analyst picks up a submitted request and the facts and one log event are recorded (D-05, D-09)";
const REQUEST_ASSIGNABLE_ANALYSTS_PROOF = "request-assignment.integration.test.ts › a Security Analyst lists exactly the analysts who may hold a request, by name only and searchable (D-06)";
const REQUEST_NOTES_EXCHANGE_PROOF = "request-notes.integration.test.ts › the Requestor and a Security Analyst exchange notes on a submitted request, oldest first, each unread only for the other part (D-21, D-24)";
const REQUEST_NOTE_AI_INPUT_PROOF = "request-notes.integration.test.ts › a Security Analyst marks the Requestor's note as changing the AI inputs and undoes it, one logged event per change and none for the same value (D-26)";
const REQUEST_NOTE_AI_INPUT_REFUSAL_PROOF = "request-notes.integration.test.ts › the AI-input mark is refused to the Requestor, the other Requestor, the service agent and a requesting analyst, outside the notes window, for a note from another request and for an open body, with nothing written (D-26, D-07, D-30)";
const REQUEST_NOTES_REFUSAL_PROOF = "request-notes.integration.test.ts › another Requestor, the service agent and anyone naming a missing request get 404 on every notes route with nothing written (D-23)";
/*
 * Phase 13 (D-23): the request's requestor and every human Security Analyst use its notes; everyone else, the other
 * Requestor and the service agent on Jane's request included, gets the refusal a missing record gets (404).
 */
const REQUEST_NOTES_READERS: MatrixExpectation = { owner: 200, other: 404, analyst: 200, serviceAgent: 404, noIdentity: 403 };
/* WR-204: the whole database's note, read-state and orphaned-note counts join each snapshot, so no refused write hides. */
const requestNotesPersistence = (f: MatrixFixtures) => f.harness.snapshot([
  () => f.harness.listRequestNotes(f.workflow.requests.submitted),
  () => f.harness.listRequestNoteReadStates(f.workflow.requests.submitted),
  () => f.harness.countRequestNoteRows(),
  () => f.harness.countOrphanedRequestNotes(),
]);
/* WR-203: the seeded note's request, for the rows that name a note. */
const seededNotePersistence = (f: MatrixFixtures) => f.harness.snapshot([
  () => f.harness.listRequestNotes(f.notes.request),
  () => f.harness.listRequestNoteReadStates(f.notes.request),
  () => f.harness.countRequestNoteRows(),
  () => f.harness.countOrphanedRequestNotes(),
]);
/*
 * Phase 14 (D-18): the readers of a request's attachments are exactly its notes readers; everyone else, the other
 * Requestor and the service agent on Jane's request included, gets the refusal a missing record gets (404).
 */
const REQUEST_ATTACHMENT_UPLOAD_PROOF = "request-attachments.integration.test.ts › Jane adds the data-flow DOCX to her draft and it is stored byte for byte, clean, with one uploaded event and no name in the log (D-05, D-13, D-16, D-37)";
const REQUEST_ATTACHMENT_LIST_PROOF = "request-attachments.integration.test.ts › Jane lists her draft's file with the add facts, Bob sees it without the add, and a legacy request lists none (D-16, D-28)";
const REQUEST_ATTACHMENT_REFUSAL_PROOF = "request-attachments.integration.test.ts › another Requestor, the service agent and anyone naming a missing request get 404 at the list and the upload with nothing written (D-18)";
const REQUEST_ATTACHMENT_DOWNLOAD_PROOF = "request-attachments.integration.test.ts › Bob downloads Jane's data-flow DOCX byte for byte with hardened headers and one downloaded event without its name, and Jane downloads her own (D-23, D-37)";
const REQUEST_ATTACHMENT_DOWNLOAD_REFUSAL_PROOF = "request-attachments.integration.test.ts › the other Requestor, the service agent and an unknown file id get 404 at the download, with no byte of the file (D-18, D-23)";
const REQUEST_ATTACHMENT_REMOVAL_PROOF = "request-attachments.integration.test.ts › Jane removes the data-flow DOCX from her draft and restores it, with who and when on the record and its bytes kept (D-19, D-20, D-37)";
const REQUEST_ATTACHMENT_REMOVAL_REFUSAL_PROOF = "request-attachments.integration.test.ts › the other Requestor, the service agent and a file id from another request get 404 at the removal, and a malformed body is 400, each with nothing written (D-18, D-20)";
/* Phase 14 (D-30, D-31, D-38): the AI inclusion and the preview, granted to the human Security Analyst alone and human-only. */
const REQUEST_ATTACHMENT_AI_INPUT_PROOF = "attachment-ai-input.integration.test.ts › Bob includes the vendor security pack Jane posted with her note, previews exactly what the AI would read, and excludes it again (D-30, D-31, D-33, D-37)";
const REQUEST_ATTACHMENT_AI_INPUT_REFUSAL_PROOF = "attachment-ai-input.integration.test.ts › Jane, the other Requestor and the service agent get 403 at the AI inclusion and the preview, with nothing written and no text served (D-30, D-38)";
/* The whole database's attachment rows, plugin file records and stored files join each snapshot, so no refused write hides. */
const requestAttachmentsPersistence = (f: MatrixFixtures) => f.harness.snapshot([
  () => f.harness.listRequestAttachments(f.attachments.draft),
  () => f.harness.countRequestAttachmentRows(),
  () => f.harness.countUploadFileRecords(),
  () => f.harness.listAttachmentStorageFiles(),
]);
/** A one-file multipart upload, built per actor so each request carries its own body. */
function attachmentUpload(actor: MatrixActor): RequestInit {
  const form = new FormData();
  form.set("file", new File([`Matrix attachment from ${actor}.`], "matrix.txt"));
  return { method: "POST", body: form };
}
const QUESTIONNAIRE_MUTATION_PROOF = "questionnaire-workflow.integration.test.ts › mounted questionnaire mutations enforce ownership, allowlisting, and immutable submitted batches";
const QUESTIONNAIRE_REVERT_PROOF = "questionnaire-workflow.integration.test.ts › questionnaire reversal preserves values, audit facts, and refusal persistence";
const QUESTION_MUTATION_PROOF = "questionnaire-governance.integration.test.ts › mounted analyst question mutations retain deleted evidence and exclude it from active progress";
const DRAFT_GENERATION_PROOF = "assessment-workflow.integration.test.ts › mounted assessment draft generation exposes a bounded analyst-owned lifecycle";
const REQUEST_WRITES_PROOF = "authorization.integration.test.ts › mounted request writes admit every granted actor, the service agent included";
/* T-08-A1: an analyst's or the service agent's create succeeds as the caller's own request, whatever the body names. */
const REQUEST_CREATE_OWNER_BOUND_PROOF = "authorization.integration.test.ts › T-08-A1 mounted create binds an analyst's or the service agent's request to its creator whatever the body names";
const OWN_REQUEST_LISTED_PROOF = "authorization.integration.test.ts › T-08-A1 an analyst's or the service agent's own new request appears in their own My Requests";
/* T-08-A2: an analyst's or the service agent's update succeeds while writing only the published update body. */
const REQUEST_UPDATE_KEEPS_OWNER_PROOF = "authorization.integration.test.ts › T-08-A2 mounted update keeps a request's owner when an analyst names another Requestor";
const REQUEST_UPDATE_PUBLISHED_BODY_PROOF = "authorization.integration.test.ts › T-08-A2 mounted update ignores server-owned facts and honours only the published submission intent from an analyst";
const AGENT_ASSESSMENT_WRITES_PROOF = "assessment-workflow.integration.test.ts › mounted assessment writes admit the service agent's exact grants";

function administrationRows(): MatrixRow[] {
  return ADMINISTRATION_KINDS.flatMap(({ path, kind, fixture, title, files }): MatrixRow[] => [
    {
      operation: `GET:/api/v1/${path}/{${idParameter(path)}}`,
      family: "administration",
      request: (f) => ({ path: `/api/v1/${path}/${encode(fixture(f).unchanged)}` }),
      expect: humanAnalystOnly(200),
      exercisesAllowed: true,
      mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [fixture(f).unchanged, title] : []),
    },
    {
      operation: `POST:/api/v1/${path}`,
      family: "administration",
      request: (f, actor) => ({ path: `/api/v1/${path}`, init: json("POST", { name: `Matrix ${path} ${actor}` }) }),
      expect: humanAnalystOnly(201),
      persistence: (f) => f.harness.snapshot([() => f.harness.countAdministrationRecords(kind)]),
      provenBy: { analyst: [ADMINISTRATION_CRUD_PROOF] },
    },
    {
      operation: `PATCH:/api/v1/${path}/{${idParameter(path)}}`,
      family: "administration",
      request: (f) => ({ path: `/api/v1/${path}/${encode(fixture(f).unchanged)}`, init: json("PATCH", { description: "Matrix edit" }) }),
      expect: humanAnalystOnly(200),
      persistence: (f) => f.harness.snapshot([() => f.harness.getAdministrationRecord(kind, fixture(f).unchanged)]),
      provenBy: { analyst: [ADMINISTRATION_CRUD_PROOF] },
      mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [fixture(f).unchanged, title] : []),
    },
    {
      operation: `POST:/api/v1/${path}/import/preview`,
      family: "administration",
      request: () => ({ path: `/api/v1/${path}/import/preview`, init: emptyMultipart() }),
      // The analyst reaches the handler, which refuses a multipart body carrying no file (400).
      expect: humanAnalystOnly(400),
      persistence: (f) => f.harness.snapshot([() => f.harness.countAdministrationRecords(kind)]),
      seeAlso: [ADMINISTRATION_IMPORT_PROOF],
    },
    {
      operation: `POST:/api/v1/${path}/import`,
      family: "administration",
      request: () => ({ path: `/api/v1/${path}/import`, init: emptyMultipart() }),
      expect: humanAnalystOnly(400),
      persistence: (f) => f.harness.snapshot([() => f.harness.countAdministrationRecords(kind)]),
      seeAlso: [ADMINISTRATION_IMPORT_PROOF],
    },
    {
      // 19-14 (D-31): the import template, generated from the import contract; no record and no event, so it is issued.
      operation: files.template,
      family: "administration",
      request: () => ({ path: `/api/v1/${path}/import/template?format=csv` }),
      expect: humanAnalystOnly(200),
      exercisesAllowed: true,
      seeAlso: [ADMINISTRATION_TEMPLATE_PROOF],
    },
    {
      // 19-14 (D-32): the error report. The analyst's report needs a reviewed file and its token, so the analyst's 200 is
      // proven by the administration file; every other caller is refused before the body is read.
      operation: files.errorReport,
      family: "administration",
      request: () => ({ path: `/api/v1/${path}/import/error_report`, init: emptyMultipart() }),
      expect: humanAnalystOnly(200),
      persistence: (f) => f.harness.snapshot([() => f.harness.countAdministrationRecords(kind)]),
      provenBy: { analyst: [ADMINISTRATION_ERROR_REPORT_PROOF] },
      seeAlso: [ADMINISTRATION_ERROR_REPORT_REFUSAL_PROOF],
    },
    {
      // 19-14 (D-04, D-13, D-33): the reference-list export, keyed by its catalogue URL with the query stripped (the
      // policy literal is GET:/api/v1/{segment}/export?format={format}). Human analyst only; the service agent is refused by
      // both refusal sets. The analyst's file, read back, is proven by the export file.
      operation: files.exportList,
      family: "administration",
      request: () => ({ path: `/api/v1/${path}/export?format=csv` }),
      expect: humanAnalystOnly(200),
      provenBy: { analyst: [REFERENCE_EXPORT_PROOF] },
      seeAlso: [REFERENCE_EXPORT_DENIAL_PROOF],
      mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [title] : []),
    },
  ]);
}

function idParameter(path: string): string {
  return {
    risk_types: "riskTypeId",
    controls: "controlId",
    information_systems: "informationSystemId",
    information_assets: "informationAssetId",
  }[path] ?? "id";
}

/** The eight users-permissions user routes (D-37 residual surface), probed for the token holder and the anonymous caller. */
function usersPermissionsUserRows(): MatrixRow[] {
  const missingUser = "999999";
  return [
    {
      operation: "GET:/api/users",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/users" }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
    {
      operation: "POST:/api/users",
      family: "plugin",
      plugin: true,
      request: (_f, actor) => ({
        path: "/api/users",
        // The default Authenticated role (id 1) exists in every users-permissions install; without a role the create is a 400.
        init: json("POST", { username: `matrix-user-${actor}`, email: `matrix-user-${actor}@example.test`, password: "Matrix-Passw0rd!", role: 1 }),
      }),
      // The D-37 residual, measured: the full-access token creates a users-permissions account (201) in this
      // throwaway database; the anonymous caller is refused. CSRM holds no such account and INT-02 replaces the surface.
      expect: pluginRoute(201, 403),
      exercisesAllowed: true,
      persistence: (f) => f.harness.snapshot([() => f.harness.countUsersPermissionsUsers()]),
    },
    {
      operation: "GET:/api/users/:id",
      family: "plugin",
      plugin: true,
      request: () => ({ path: `/api/users/${missingUser}` }),
      // The token holder reaches the account read; a missing account is an empty 204 (the D-37 residual).
      expect: pluginRoute(204, 403),
      exercisesAllowed: true,
    },
    {
      operation: "PUT:/api/users/:id",
      family: "plugin",
      plugin: true,
      request: () => ({ path: `/api/users/${missingUser}`, init: json("PUT", { username: "matrix-renamed" }) }),
      expect: pluginRoute(404, 403),
      persistence: (f) => f.harness.snapshot([() => f.harness.countUsersPermissionsUsers()]),
    },
    {
      operation: "DELETE:/api/users/:id",
      family: "plugin",
      plugin: true,
      request: () => ({ path: `/api/users/${missingUser}`, init: { method: "DELETE" } }),
      // The token holder reaches the account delete; a missing account is an empty 204 (the D-37 residual).
      expect: pluginRoute(204, 403),
      exercisesAllowed: true,
      persistence: (f) => f.harness.snapshot([() => f.harness.countUsersPermissionsUsers()]),
    },
    {
      operation: "GET:/api/users/count",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/users/count" }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
    {
      operation: "GET:/api/users/me",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/users/me" }),
      // No caller carries a users-permissions session: the API token and the CSRM identity are not one (401);
      // with no credential at all the public role answers, and it holds no permission for the route (403).
      expect: pluginRoute(401, 403),
    },
  ];
}

/** The users-permissions authentication routes: registration is disabled (D-37) and no account exists to sign in. */
function usersPermissionsAuthRows(): MatrixRow[] {
  const password = "Matrix-Passw0rd!";
  return [
    {
      operation: "GET:/api/auth/:provider/callback",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/github/callback" }),
      // A public route: every caller reaches it and the provider is disabled.
      expect: pluginRoute(400, 400),
    },
    {
      operation: "POST:/api/auth/change-password",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/change-password", init: json("POST", { currentPassword: password, password, passwordConfirmation: password }) }),
      // The token holder reaches the handler, which refuses a caller with no users-permissions session as a 400.
      expect: pluginRoute(400, 403),
    },
    {
      operation: "GET:/api/auth/email-confirmation",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/email-confirmation?confirmation=matrix" }),
      // A public route: every caller reaches it and an unknown confirmation token is refused.
      expect: pluginRoute(400, 400),
    },
    {
      operation: "POST:/api/auth/forgot-password",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/forgot-password", init: json("POST", { email: "nobody@example.test" }) }),
      // A public route answering { ok: true } for any address so accounts cannot be enumerated; no account exists to reset.
      expect: pluginRoute(200, 200),
      exercisesAllowed: true,
    },
    {
      operation: "POST:/api/auth/local",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/local", init: json("POST", { identifier: "nobody@example.test", password }) }),
      // CSRM holds no users-permissions account, so a well-formed login can only be refused.
      expect: pluginRoute(400, 400),
      persistence: (f) => f.harness.snapshot([() => f.harness.countUsersPermissionsUsers()]),
    },
    {
      operation: "POST:/api/auth/local/register",
      family: "plugin",
      plugin: true,
      request: (_f, actor) => ({
        path: "/api/auth/local/register",
        init: json("POST", { username: `matrix-${actor}`, email: `matrix-${actor}@example.test`, password }),
      }),
      // Registration is disabled at every boot (08-03, D-37): a well-formed registration is refused for every caller.
      expect: pluginRoute(400, 400),
      persistence: (f) => f.harness.snapshot([() => f.harness.countUsersPermissionsUsers()]),
    },
    {
      operation: "POST:/api/auth/logout",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/logout", init: { method: "POST" } }),
      expect: pluginRoute(401, 403),
    },
    {
      operation: "POST:/api/auth/refresh",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/refresh", init: json("POST", {}) }),
      // A public route: every caller reaches it and a missing refresh token is refused.
      expect: pluginRoute(400, 400),
    },
    {
      operation: "POST:/api/auth/reset-password",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/reset-password", init: json("POST", { code: "matrix", password, passwordConfirmation: password }) }),
      // A public route: every caller reaches it and an unknown reset code is refused.
      expect: pluginRoute(400, 400),
    },
    {
      operation: "POST:/api/auth/send-email-confirmation",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/send-email-confirmation", init: json("POST", { email: "nobody@example.test" }) }),
      // A public route answering 200 for any address so accounts cannot be enumerated; no account exists to confirm.
      expect: pluginRoute(200, 200),
      exercisesAllowed: true,
    },
    {
      operation: "GET:/api/auth/sessions",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/sessions" }),
      expect: pluginRoute(401, 403),
    },
    {
      operation: "DELETE:/api/auth/sessions/:sessionId",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/auth/sessions/matrix-session", init: { method: "DELETE" } }),
      expect: pluginRoute(401, 403),
    },
    {
      operation: "GET:/api/connect/(.*)",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/connect/github" }),
      // A public route: every caller reaches it and the provider is disabled.
      expect: pluginRoute(400, 400),
    },
  ];
}

/** The users-permissions role and permission routes, mounted under the plugin's own prefix. */
function usersPermissionsRoleRows(): MatrixRow[] {
  const missingRole = "999999";
  return [
    {
      operation: "GET:/api/users-permissions/permissions",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/users-permissions/permissions" }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
    {
      operation: "GET:/api/users-permissions/roles",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/users-permissions/roles" }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
    {
      operation: "POST:/api/users-permissions/roles",
      family: "plugin",
      plugin: true,
      request: (_f, actor) => ({ path: "/api/users-permissions/roles", init: json("POST", { name: `matrix-role-${actor}`, description: "matrix", permissions: {}, users: [] }) }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
    {
      operation: "GET:/api/users-permissions/roles/:id",
      family: "plugin",
      plugin: true,
      request: () => ({ path: `/api/users-permissions/roles/${missingRole}` }),
      expect: pluginRoute(404, 403),
    },
    {
      operation: "DELETE:/api/users-permissions/roles/:role",
      family: "plugin",
      plugin: true,
      request: () => ({ path: `/api/users-permissions/roles/${missingRole}`, init: { method: "DELETE" } }),
      expect: pluginRoute(404, 403),
    },
    {
      operation: "PUT:/api/users-permissions/roles/:role",
      family: "plugin",
      plugin: true,
      request: () => ({ path: `/api/users-permissions/roles/${missingRole}`, init: json("PUT", { name: "matrix-renamed" }) }),
      expect: pluginRoute(404, 403),
    },
  ];
}

/** D-08: the mounted proof that the upload plugin's content-API routes answer no caller. */
const UPLOAD_UNMOUNTED_PROOF = "http-hardening.integration.test.ts › the upload plugin's content-API routes are unmounted for every caller, the full-access token included";

/**
 * The content-type-builder, email and i18n content-API routes the plugins keep mounted, and the upload plugin's five,
 * which the application unmounts (14-04, D-08): they keep their rows as unmounted-path assertions.
 */
function otherPluginRows(): MatrixRow[] {
  const uploadRecordsUnchanged = (f: MatrixFixtures) => f.harness.snapshot([() => f.harness.countUploadFileRecords()]);
  return [
    {
      operation: "GET:/api/content-type-builder/components",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/content-type-builder/components" }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
    {
      operation: "GET:/api/content-type-builder/components/:uid",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/content-type-builder/components/matrix.unknown" }),
      expect: pluginRoute(404, 403),
    },
    {
      operation: "GET:/api/content-type-builder/content-types",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/content-type-builder/content-types" }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
    {
      operation: "GET:/api/content-type-builder/content-types/:uid",
      family: "plugin",
      plugin: true,
      request: () => ({ path: `/api/content-type-builder/content-types/${encode("api::matrix.unknown")}` }),
      expect: pluginRoute(404, 403),
    },
    {
      operation: "POST:/api/email",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/email", init: json("POST", {}) }),
      // The token holder reaches the email handler; an empty options object makes the sendmail provider throw,
      // which strapi::errors answers with the bare 500 envelope (nothing is sent, nothing leaks).
      expect: pluginRoute(500, 403),
    },
    {
      operation: "GET:/api/i18n/locales",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/i18n/locales" }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
    {
      operation: "POST:/api/upload",
      family: "plugin",
      plugin: true,
      unmounted: true,
      request: () => ({ path: "/api/upload", init: emptyMultipart() }),
      expect: unmountedRoute(405),
      persistence: uploadRecordsUnchanged,
      seeAlso: [UPLOAD_UNMOUNTED_PROOF],
    },
    {
      operation: "GET:/api/upload/files",
      family: "plugin",
      plugin: true,
      unmounted: true,
      request: () => ({ path: "/api/upload/files" }),
      expect: unmountedRoute(404),
      seeAlso: [UPLOAD_UNMOUNTED_PROOF],
    },
    {
      operation: "DELETE:/api/upload/files/:id",
      family: "plugin",
      plugin: true,
      unmounted: true,
      request: () => ({ path: "/api/upload/files/999999", init: { method: "DELETE" } }),
      expect: unmountedRoute(405),
      persistence: uploadRecordsUnchanged,
      seeAlso: [UPLOAD_UNMOUNTED_PROOF],
    },
    {
      operation: "GET:/api/upload/files/:id",
      family: "plugin",
      plugin: true,
      unmounted: true,
      request: () => ({ path: "/api/upload/files/999999" }),
      expect: unmountedRoute(404),
      seeAlso: [UPLOAD_UNMOUNTED_PROOF],
    },
    {
      operation: "GET:/api/upload/files/page",
      family: "plugin",
      plugin: true,
      unmounted: true,
      request: () => ({ path: "/api/upload/files/page" }),
      expect: unmountedRoute(404),
      seeAlso: [UPLOAD_UNMOUNTED_PROOF],
    },
  ];
}

/* Phase 16 (16-09): the mounted proofs of the risk AI proposal operations, and what a refused one must leave equal. */
const RISK_AI_SUGGEST_PROOF = "risk-proposals.integration.test.ts › Suggest more risks: Bob's start is a recorded job whose run names him, the instruction, the provider and the risks listed, and changes no risk (D-24 to D-27, ASSESS-10 criterion 3)";
const RISK_AI_READ_PROOF = "risk-proposals.integration.test.ts › the proposals read folds the open suggestions with the payment-file risk, a similar flag with its risk number, the run's adjustments and the analyst's actions (D-41)";
const RISK_AI_START_DENIAL_PROOF = "risk-proposals.integration.test.ts › the Requestor, the Secondary Requestor and the service agent get 403 on the start and the read, and OWN_REQUEST refuses Bob on a request he raised; nothing is queued (D-43, G-1)";
const RISK_AI_REWRITE_PROOF = "risk-proposals.integration.test.ts › Rewrite this risk: Bob's focused rewrite is a recorded run whose changes read as fresh units of the risk, with the uncited cause, and openByRisk lists it (D-34 to D-37)";
const RISK_AI_RETRY_PROOF = "risk-proposals.integration.test.ts › the second analyst reads Bob's failed job and retries it as their own new run; a completed job is not retried (409); OWN_REQUEST refuses Bob's rewrite, job read and retry (D-26, Phase 13 D-18)";
const RISK_AI_REWRITE_DENIAL_PROOF = "risk-proposals.integration.test.ts › the Requestor, the Secondary Requestor and the service agent get 403 on the rewrite and the retry, with nothing queued (D-43)";
function riskAiPersistence(f: MatrixFixtures): Promise<unknown[]> {
  return f.harness.snapshot([
    () => f.harness.getAssessment(f.riskAiProposals.assessment),
    () => f.harness.getRisk(f.riskAiProposals.risk),
    async () => (await f.harness.listAiRunsForAssessment(f.riskAiProposals.assessment)).map((run) => [run.documentId, run.operation, run.status, run.attempt]),
    // The failed job as the human analyst reads it: a retry a guard failed to refuse would move its status and attempt.
    async () => {
      const response = await f.harness.request({ path: `/api/v1/risk_proposal_jobs/${encode(f.riskAiProposals.failedJob)}`, identity: f.harness.identities.analyst });
      const body = (await response.json()) as { data?: { status?: unknown; attempt?: unknown } };
      return [response.status, body.data?.status, body.data?.attempt];
    },
  ]);
}

/* Phase 16 (16-05): the mounted proofs of the curation operations, and what a refused curation must leave equal. */
const CURATION_WITHDRAW_PROOF = "risk-curation.integration.test.ts › a human Security Analyst withdraws a Risk with a reason that keeps its number, fields, control implementations and AI provenance, and records one withdrawn row (D-05, D-06, D-09)";
const CURATION_WITHDRAW_DENIAL_PROOF = "risk-curation.integration.test.ts › the request's Requestor, an unrelated Requestor and the service agent are refused the withdrawal with 403 and nothing changes (D-43)";
const CURATION_REINSTATE_PROOF = "risk-curation.integration.test.ts › reinstatement with a reason clears the three facts, records a reinstated row and keeps both rows in the history (D-10)";
const CURATION_REINSTATE_DENIAL_PROOF = "risk-curation.integration.test.ts › the request's Requestor, an unrelated Requestor and the service agent are refused the reinstatement with 403 and nothing changes (D-43)";
const REGISTER_EXPORT_PROOF = "exports.integration.test.ts › risk-register: Bob's filtered Risk register exports as a workbook at its reserved URL, a formula-like statement as text, with one log line";
const REGISTER_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › risk-register: a Requestor, the service agent (even when its role is granted the export), an analyst without the underlying read and a caller with no identity are 403, and no token is 401";
const QUEUE_EXPORT_PROOF = "exports.integration.test.ts › requests: Bob's review queue exports whole as a workbook equal to the list's three pages in order, with one log line";
const QUEUE_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › requests: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the queue read and no identity are 403 in the exports' words, and no token is 401";
const MY_REQUESTS_EXPORT_PROOF = "exports.integration.test.ts › my-requests: Jane, the Secondary Requestor and Bob each export their own records only, in the list's order, with one log line each";
const MY_REQUESTS_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › my-requests: the service agent is refused although its birthright holds the export, in the exports' automation wording; no identity is 403, no token 401 and a page 400";
const QUESTIONNAIRES_EXPORT_PROOF = "exports.integration.test.ts › questionnaires: Bob's questionnaire review list exports whole as a workbook equal to the list's three pages in order, with no question, answer or description, and one log line";
const QUESTIONNAIRES_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › questionnaires: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the review list read and no identity are 403 in the exports' words, and no token is 401";
const MY_QUESTIONNAIRES_EXPORT_PROOF = "exports.integration.test.ts › my-questionnaires: Jane, the Secondary Requestor and Bob each export their own records only, in the list's order, with one log line each";
const MY_QUESTIONNAIRES_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › my-questionnaires: the service agent is refused although its birthright holds the export, in the exports' automation wording; no identity is 403, no token 401 and a page size 400";
const ALERTS_EXPORT_PROOF = "exports.integration.test.ts › alerts: Bob's alert list exports whole as a CSV equal to the list's pages in order, the overdue treatment as the list derives it and no withdrawn Risk, with one log line";
const ALERTS_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › alerts: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the alert read and no identity are 403 in the exports' words, and no token is 401";
const QUESTIONNAIRE_AND_ALERT_EXPORT_QUERY_PROOF = "exports.integration.test.ts › questionnaires, my-questionnaires and alerts: a page or pageSize, an unknown column or an unknown format is 400 with no reason and one export.refused line";
const REPORT_EXPORT_PROOF = "exports.integration.test.ts › reports: Bob's risk exposure report exports as a workbook of its tables in page order, each equal to the report's figures, with As at and one log line";
// 19-10: the released assessment's export and the two assessment lists' exports.
const RELEASED_EXPORT_PROOF = "exports.integration.test.ts › released-assessment: Jane exports her released assessment as Summary, Risks and Mitigation controls equal to her released reads, with no withdrawn Risk, the AI notice and one log line";
const RELEASED_EXPORT_SAME_TABLES_PROOF = "exports.integration.test.ts › released-assessment: Bob's export of Jane's released assessment holds the same tables as Jane's, sheet by sheet and cell by cell, its Mitigation controls only the active Risks' implementations";
const RELEASED_EXPORT_TABLE_PROOF = "exports.integration.test.ts › released-assessment: each record table exports alone as a CSV; CSV without a table, XLSX with one, the Summary table, columns, an unknown key or format are 400 with one export.refused line";
const RELEASED_EXPORT_NOT_FOUND_PROOF = "exports.integration.test.ts › released-assessment: another Requestor at Jane's released assessment and Jane at her own unreleased one get the missing record's 404, with no file and no export event";
const RELEASED_EXPORT_NOT_RELEASED_PROOF = "exports.integration.test.ts › released-assessment: Bob's export of an unreleased assessment is 409 ASSESSMENT_NOT_RELEASED with one export.refused line";
const RELEASED_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › released-assessment: the service agent (even when its role is granted the export) and no identity are 403 in the exports' automation words, and no token is 401";
const RISK_ASSESSMENTS_EXPORT_PROOF = "exports.integration.test.ts › risk-assessments: Bob's Risk assessments list exports whole as a workbook equal to the list's pages in order, Released for approved and the Risk figures without the withdrawn Risk, with one log line";
const RISK_ASSESSMENTS_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › risk-assessments: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the list read and no identity are 403 in the exports' words, and no token is 401";
const MY_RISK_ASSESSMENTS_EXPORT_PROOF = "exports.integration.test.ts › my-risk-assessments: Jane, the Secondary Requestor and Bob each export their own released assessments only, in the list's order, with one log line each";
const MY_RISK_ASSESSMENTS_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › my-risk-assessments: the service agent is refused although its birthright holds the export, in the exports' automation wording; no identity is 403, no token 401, and a page is 400 at both list exports";
const REPORT_EXPORT_DENIAL_PROOF = "exports.integration.test.ts › reports: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the report read and no identity are 403 in the exports' words, and no token is 401";
const REPORT_EXPORT_BODY_PROOF = "exports.integration.test.ts › reports: no columns parameter: a columns key, an unknown key, a body that is not an object, a CSV without its table, an XLSX with one, an unknown table or format, a 17-key or non-text query and an unknown zone are 400 with no reason and one export.refused line";
const CURATION_HISTORY_PROOF = "risk-curation.integration.test.ts › a human Security Analyst reads a Risk's history newest first with its pagination and recordedFrom, a withdrawn Risk's included (D-21)";
const CURATION_HISTORY_DENIAL_PROOF = "risk-curation.integration.test.ts › the request's Requestor, an unrelated Requestor and the service agent are refused the history read with 403 (D-43)";
const RISK_NO_DELETE_PROOF = "risk-no-delete.unit.test.ts › no Strapi source deletes a Risk or a Risk history row, and no DELETE route serves /v1/risks (D-16)";
function curationPersistence(f: MatrixFixtures): Promise<unknown[]> {
  return f.harness.snapshot([
    () => f.harness.getAssessment(f.curation.assessment),
    () => f.harness.getRisk(f.curation.risk),
    () => f.harness.riskWithdrawalFactsFixture(f.curation.risk),
    () => f.harness.riskHistoryRowsFixture(f.curation.risk),
  ]);
}

const SCIM_SOURCE_ONLY_PROOF = "iam-scim-routes.integration.test.ts › CSRM API tokens, human credentials and forged source headers alone cannot authenticate SCIM";
const SCIM_SOURCE_SCOPE_PROOF = "iam-scim-security.integration.test.ts › human/dev/API/forged-source combinations cannot authenticate or widen valid source scope";

/**
 * SCIM 2.0 operations authenticate only an Identity Source's bearer token (ADR 0005). Every CSRM caller, with or
 * without the CSRM API token and whatever identity it asserts, is refused at the SCIM boundary with 401 before any
 * CSRM policy runs, and no SCIM write is attempted.
 */
function scimRows(): MatrixRow[] {
  const refused: MatrixExpectation = { owner: 401, other: 401, analyst: 401, serviceAgent: 401, noIdentity: 401, noToken: 401 };
  const body = (method: string): RequestInit => ({ method, headers: { "content-type": "application/scim+json" }, body: "{}" });
  const operations: ReadonlyArray<[string, string, RequestInit | undefined]> = [
    ["GET", "/scim/v2/ServiceProviderConfig", undefined],
    ["GET", "/scim/v2/ResourceTypes", undefined],
    ["GET", "/scim/v2/ResourceTypes/{id}", undefined],
    ["GET", "/scim/v2/Schemas", undefined],
    ["GET", "/scim/v2/Schemas/{id}", undefined],
    ["GET", "/scim/v2/Users", undefined],
    ["POST", "/scim/v2/Users", body("POST")],
    ["GET", "/scim/v2/Users/{id}", undefined],
    ["PUT", "/scim/v2/Users/{id}", body("PUT")],
    ["PATCH", "/scim/v2/Users/{id}", body("PATCH")],
    ["DELETE", "/scim/v2/Users/{id}", { method: "DELETE" }],
    ["GET", "/scim/v2/Groups", undefined],
    ["POST", "/scim/v2/Groups", body("POST")],
    ["PUT", "/scim/v2/Groups", body("PUT")],
    ["PATCH", "/scim/v2/Groups", body("PATCH")],
    ["DELETE", "/scim/v2/Groups", { method: "DELETE" }],
    ["GET", "/scim/v2/Groups/{id}", undefined],
    ["POST", "/scim/v2/Groups/{id}", body("POST")],
    ["PUT", "/scim/v2/Groups/{id}", body("PUT")],
    ["PATCH", "/scim/v2/Groups/{id}", body("PATCH")],
    ["DELETE", "/scim/v2/Groups/{id}", { method: "DELETE" }],
  ];
  return operations.map(([method, url, init]) => ({
    operation: `${method}:${url}`,
    family: "identity-provisioning",
    request: (f) => ({ path: url.replace("{id}", encode(f.users.owner)), ...(init ? { init } : {}) }),
    expect: refused,
    seeAlso: [SCIM_SOURCE_ONLY_PROOF, SCIM_SOURCE_SCOPE_PROOF],
  }));
}

/** The rows every served operation and every plugin route must be found in, family by family. */
export const matrixRows: readonly MatrixRow[] = [
  // ---------------------------------------------------------------- assessment requests
  {
    operation: "GET:/api/csrm-assessment-requests",
    family: "assessment-requests",
    request: () => ({ path: "/api/csrm-assessment-requests" }),
    // The My list: owner-scoped for every actor, the analysts included (D-17).
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: ["authorization.integration.test.ts › mounted GET routes enforce owner scope and explicit analyst collection scope"],
    mustNotDisclose: (f, actor) => (actor === "owner"
      ? [f.requests.otherRequestor, "Other request"]
      : actor === "other"
        ? [f.requests.owner, "Owner request"]
        : [f.requests.owner, f.requests.otherRequestor, "Owner request", "Other request"]),
  },
  {
    operation: "POST:/api/csrm-assessment-requests",
    family: "assessment-requests",
    request: (_f, actor) => ({
      path: "/api/csrm-assessment-requests",
      init: json("POST", { data: { requestNumber: `MATRIX-${actor.toUpperCase()}-001`, title: `Matrix request ${actor}`, requestStatus: "draft" } }),
    }),
    // Every identity creates as a Requestor, its birthright, so every created request is the caller's own (T-08-A1).
    expect: everyIdentity(200),
    persistence: (f) => f.harness.snapshot([
      () => f.harness.countRequestsForUser(f.users.owner),
      () => f.harness.countRequestsForUser(f.users.otherRequestor),
      () => f.harness.countRequestsForUser(f.users.analyst),
      () => f.harness.countRequestsForUser(f.users.serviceAnalystAgent),
    ]),
    provenBy: {
      owner: [REQUEST_CREATE_PROOF],
      other: [REQUEST_WRITES_PROOF],
      analyst: [REQUEST_WRITES_PROOF, REQUEST_CREATE_OWNER_BOUND_PROOF, OWN_REQUEST_LISTED_PROOF],
      serviceAgent: [REQUEST_WRITES_PROOF, REQUEST_CREATE_OWNER_BOUND_PROOF, OWN_REQUEST_LISTED_PROOF],
    },
  },
  {
    operation: "GET:/api/csrm-assessment-requests/{id}",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/csrm-assessment-requests/${encode(f.requests.owner)}` }),
    expect: OWNER_REQUEST_AGENT_DENIED_403,
    exercisesAllowed: true,
    mustNotDisclose: (f, actor) => (requestOutsider(actor) ? [f.requests.owner, "Owner request"] : []),
  },
  {
    operation: "PUT:/api/csrm-assessment-requests/{id}",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/csrm-assessment-requests/${encode(f.requests.owner)}`, init: json("PUT", { data: { title: "Cross requestor update" } }) }),
    // The analysts reach any request, but write only the published update body and never its owner (T-08-A2).
    expect: OWNER_REQUEST_AGENT_DENIED_403,
    persistence: (f) => f.harness.snapshot([() => f.harness.getRequest(f.requests.owner)]),
    provenBy: {
      owner: [REQUEST_UPDATE_PROOF],
      analyst: [REQUEST_UPDATE_PROOF, REQUEST_UPDATE_KEEPS_OWNER_PROOF, REQUEST_UPDATE_PUBLISHED_BODY_PROOF],
    },
    mustNotDisclose: (f, actor) => (requestOutsider(actor) ? [f.requests.owner, "Owner request"] : []),
  },
  {
    operation: "DELETE:/api/csrm-assessment-requests/{id}",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/csrm-assessment-requests/${encode(f.requests.owner)}`, init: { method: "DELETE" } }),
    // The birthright holds no delete grant: an owning Requestor is refused before the human analyst removes the
    // record. Phase 12 D-33 withdrew the service agent's delete grant.
    expect: humanAnalystOnly(204),
    persistence: (f) => f.harness.snapshot([() => f.harness.getRequest(f.requests.owner)]),
    provenBy: { analyst: [REQUEST_DELETE_PROOF] },
    mustNotDisclose: (f, actor) => (actor === "other" || actor === "serviceAgent" || actor === "noIdentity" || actor === "noToken" ? [f.requests.owner, "Owner request"] : []),
  },
  {
    operation: "GET:/api/v1/assessment_requests",
    family: "assessment-requests",
    request: () => ({ path: "/api/v1/assessment_requests?pagination[page]=1&pagination[pageSize]=10" }),
    // The analyst review queue carries the wider grant and is deliberately not a My list.
    expect: analystAndAgent(200),
    exercisesAllowed: true,
    seeAlso: ["assessment-workflow.integration.test.ts › mounted analyst review queue denies ungranted actors and rejects query expansion safely"],
  },
  {
    operation: "POST:/api/v1/assessment_requests/{requestId}/revert_to_draft",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/v1/assessment_requests/${encode(f.workflow.requests.submitted)}/revert_to_draft`, init: json("POST", { reason: "Matrix revert" }) }),
    // Granted to the Requestor birthright and the human analyst: the service agent holds neither the explicit grant nor the record.
    expect: { owner: 200, other: 403, analyst: 200, serviceAgent: 403, noIdentity: 403 },
    persistence: (f) => f.harness.snapshot([() => f.harness.getRequest(f.workflow.requests.submitted)]),
    provenBy: { owner: [REQUEST_REVERT_PROOF], analyst: [REQUEST_REVERT_PROOF] },
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "analyst" ? [] : [f.workflow.requests.submitted, "Submitted request"]),
  },
  {
    operation: "PUT:/api/v1/assessment_requests/{requestId}/assignee",
    family: "assessment-requests",
    request: (f) => ({
      path: `/api/v1/assessment_requests/${encode(f.workflow.requests.submitted)}/assignee`,
      init: json("PUT", { data: { analyst: f.users.analyst, expectedAnalyst: null } }),
    }),
    // Phase 13 (G-1, D-30): granted to the human Security Analyst alone and human-only, so the Requestor who raised
    // the request, the other Requestor and the service agent are refused before anything is read or written.
    expect: humanAnalystOnly(200),
    persistence: (f) => f.harness.snapshot([
      () => f.harness.getRequest(f.workflow.requests.submitted),
      () => f.harness.getRequestAssignment(f.workflow.requests.submitted),
    ]),
    provenBy: { analyst: [REQUEST_ASSIGNMENT_PROOF] },
    mustNotDisclose: (f, actor) => (actor === "analyst" ? [] : [f.workflow.requests.submitted, "Submitted request"]),
  },
  {
    operation: "GET:/api/v1/assessment_requests/{requestId}/assignable_analysts",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/v1/assessment_requests/${encode(f.workflow.requests.submitted)}/assignable_analysts` }),
    // Phase 13 (D-06, D-07): who may hold the request, read by the human Security Analyst alone; the Requestor who
    // raised it, the other Requestor and the service agent are refused before any person is read.
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: [REQUEST_ASSIGNABLE_ANALYSTS_PROOF],
    mustNotDisclose: (f, actor) => (actor === "analyst" ? [] : [f.workflow.requests.submitted, "Submitted request", "Bob Doe", "Second Analyst"]),
  },
  {
    operation: "GET:/api/v1/assessment_requests/{requestId}/notes",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/v1/assessment_requests/${encode(f.workflow.requests.submitted)}/notes` }),
    // Phase 13 (D-23): canUseRequestNotes decides in the controller; a caller who may not use the notes learns only 404.
    expect: REQUEST_NOTES_READERS,
    exercisesAllowed: true,
    seeAlso: [REQUEST_NOTES_EXCHANGE_PROOF, REQUEST_NOTES_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "analyst" ? [] : [f.workflow.requests.submitted, "Submitted request"]),
  },
  {
    operation: "POST:/api/v1/assessment_requests/{requestId}/notes",
    family: "assessment-requests",
    request: (f, actor) => ({
      path: `/api/v1/assessment_requests/${encode(f.workflow.requests.submitted)}/notes`,
      init: json("POST", { data: { body: `Matrix note from ${actor}` } }),
    }),
    // Phase 13 (D-21, D-23): a note is append-only, so the matrix never adds one; the mounted exchange proves both writers.
    expect: REQUEST_NOTES_READERS,
    persistence: requestNotesPersistence,
    provenBy: { owner: [REQUEST_NOTES_EXCHANGE_PROOF], analyst: [REQUEST_NOTES_EXCHANGE_PROOF] },
    seeAlso: [REQUEST_NOTES_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "analyst" ? [] : [f.workflow.requests.submitted, "Submitted request"]),
  },
  {
    operation: "POST:/api/v1/assessment_requests/{requestId}/notes/read",
    family: "assessment-requests",
    request: (f) => ({
      path: `/api/v1/assessment_requests/${encode(f.notes.request)}/notes/read`,
      init: json("POST", { data: { throughNoteId: f.notes.note } }),
    }),
    // Phase 13 (D-24): the read state is personal and advances only through this call; the mounted exchange proves both readers.
    // WR-203: the note is real, so the 404 for the other Requestor and the service agent is the reader rule's alone.
    expect: REQUEST_NOTES_READERS,
    persistence: seededNotePersistence,
    provenBy: { owner: [REQUEST_NOTES_EXCHANGE_PROOF], analyst: [REQUEST_NOTES_EXCHANGE_PROOF] },
    seeAlso: [REQUEST_NOTES_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "analyst" ? [] : [f.notes.request, f.notes.note, "Matrix notes request"]),
  },
  {
    operation: "PUT:/api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input",
    family: "assessment-requests",
    request: (f) => ({
      path: `/api/v1/assessment_requests/${encode(f.notes.request)}/notes/${encode(f.notes.note)}/ai_input`,
      init: json("PUT", { data: { changesAiInputs: true } }),
    }),
    // Phase 13 (D-26, D-30): granted to the human Security Analyst alone and human-only, so the Requestor who raised the
    // request, the other Requestor and the service agent are refused before anything is read or written.
    expect: humanAnalystOnly(200),
    persistence: seededNotePersistence,
    provenBy: { analyst: [REQUEST_NOTE_AI_INPUT_PROOF] },
    seeAlso: [REQUEST_NOTE_AI_INPUT_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "analyst" ? [] : [f.notes.request, f.notes.note, "Matrix notes request"]),
  },
  {
    operation: "GET:/api/v1/assessment_requests/{requestId}/attachments",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/v1/assessment_requests/${encode(f.attachments.draft)}/attachments` }),
    // Phase 14 (D-18): canUseRequestNotes decides in the controller; a caller who may not read the files learns only 404.
    expect: REQUEST_NOTES_READERS,
    exercisesAllowed: true,
    seeAlso: [REQUEST_ATTACHMENT_LIST_PROOF, REQUEST_ATTACHMENT_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "analyst" ? [] : [f.attachments.draft, "Matrix attachments draft"]),
  },
  {
    operation: "POST:/api/v1/assessment_requests/{requestId}/attachments",
    family: "assessment-requests",
    request: (f, actor) => ({ path: `/api/v1/assessment_requests/${encode(f.attachments.draft)}/attachments`, init: attachmentUpload(actor) }),
    // Phase 14 (D-16, D-18): Jane adds to her draft (proven mounted); a Security Analyst does not work on a draft (409
    // REQUEST_NOT_SUBMITTED, nothing written); the other Requestor and the service agent learn only 404.
    expect: { owner: 201, other: 404, analyst: 409, serviceAgent: 404, noIdentity: 403 },
    persistence: requestAttachmentsPersistence,
    provenBy: { owner: [REQUEST_ATTACHMENT_UPLOAD_PROOF] },
    seeAlso: [REQUEST_ATTACHMENT_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "analyst" ? [] : [f.attachments.draft, "Matrix attachments draft"]),
  },
  {
    operation: "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/v1/assessment_requests/${encode(f.attachments.draft)}/attachments/${encode(f.attachments.attachment)}/content` }),
    // Phase 14 (D-18, D-23): the file's readers download it; the other Requestor and the service agent learn only 404,
    // and none of them receives a byte of the stored file.
    expect: REQUEST_NOTES_READERS,
    exercisesAllowed: true,
    seeAlso: [REQUEST_ATTACHMENT_DOWNLOAD_PROOF, REQUEST_ATTACHMENT_DOWNLOAD_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "analyst" ? [] : [f.attachments.draft, f.attachments.attachment, "Matrix attachments draft", "Seeded attachment 1 on"]),
  },
  {
    operation: "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal",
    family: "assessment-requests",
    request: (f) => ({
      path: `/api/v1/assessment_requests/${encode(f.attachments.draft)}/attachments/${encode(f.attachments.attachment)}/removal`,
      init: json("PUT", { data: { removed: true } }),
    }),
    // Phase 14 (D-16, D-18 to D-20): Jane removes her own draft's file (proven mounted, so the download row keeps its file);
    // a Security Analyst does not work on a draft (409 REQUEST_NOT_SUBMITTED, nothing written); the other Requestor and the
    // service agent learn only 404.
    expect: { owner: 200, other: 404, analyst: 409, serviceAgent: 404, noIdentity: 403 },
    persistence: requestAttachmentsPersistence,
    provenBy: { owner: [REQUEST_ATTACHMENT_REMOVAL_PROOF] },
    seeAlso: [REQUEST_ATTACHMENT_REMOVAL_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "analyst" ? [] : [f.attachments.draft, f.attachments.attachment, "Matrix attachments draft", "Seeded attachment 1 on"]),
  },
  {
    operation: "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input",
    family: "assessment-requests",
    request: (f) => ({
      path: `/api/v1/assessment_requests/${encode(f.attachments.draft)}/attachments/${encode(f.attachments.attachment)}/ai_input`,
      init: json("PUT", { data: { included: true } }),
    }),
    // Phase 14 (D-30, D-38): granted to the human Security Analyst alone and human-only, so the Requestor who raised the
    // request, the other Requestor and the service agent are refused before anything is read or written. The analyst's
    // 200 is proven mounted on a submitted request (this row's draft would answer 409 REQUEST_NOT_SUBMITTED).
    expect: humanAnalystOnly(200),
    persistence: requestAttachmentsPersistence,
    provenBy: { analyst: [REQUEST_ATTACHMENT_AI_INPUT_PROOF] },
    seeAlso: [REQUEST_ATTACHMENT_AI_INPUT_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "analyst" ? [] : [f.attachments.draft, f.attachments.attachment, "Matrix attachments draft", "Seeded attachment 1 on"]),
  },
  {
    operation: "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/v1/assessment_requests/${encode(f.attachments.draft)}/attachments/${encode(f.attachments.attachment)}/ai_text` }),
    // Phase 14 (D-31, D-38): the stored text an included file sends, for the human Security Analyst alone; everyone else
    // is refused before the file is read. The analyst's 200 is proven mounted on an included file.
    expect: humanAnalystOnly(200),
    provenBy: { analyst: [REQUEST_ATTACHMENT_AI_INPUT_PROOF] },
    seeAlso: [REQUEST_ATTACHMENT_AI_INPUT_REFUSAL_PROOF],
    mustNotDisclose: (f, actor) => (actor === "analyst" ? [] : [f.attachments.draft, f.attachments.attachment, "Matrix attachments draft", "Seeded attachment 1 on"]),
  },
  {
    operation: "GET:/api/v1/my_requests/status_summary",
    family: "assessment-requests",
    request: () => ({ path: "/api/v1/my_requests/status_summary" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: ["request-status-summary.integration.test.ts › mounted request status summary counts only the caller's own requests, for every actor"],
    ownedRecordTotal: ownedByRequestorsOnly,
  },
  {
    operation: "GET:/api/v1/my_requests",
    family: "assessment-requests",
    request: () => ({ path: "/api/v1/my_requests?pageSize=50" }),
    // The caller's own requests with who holds each one: owner-scoped for every actor, the analysts included (D-03).
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: ["my-requests.integration.test.ts › every actor lists only the requests it raised, an analyst from the Requestor's side (D-03, T-11-05, T-11-27)"],
    ownedRecordTotal: ownedByRequestorsOnly,
    mustNotDisclose: (f, actor) => {
      const owner = [f.requests.owner, ...Object.values(f.workflow.requests), "Owner request", "Submitted request"];
      const other = [f.requests.otherRequestor, "Other request"];
      if (actor === "owner") return other;
      if (actor === "other") return owner;
      return [...owner, ...other];
    },
  },
  // ---------------------------------------------------------------- questionnaires
  {
    operation: "GET:/api/v1/my_questionnaires",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/my_questionnaires" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: ["questionnaire-workflow.integration.test.ts › mounted questionnaire reads enforce owner and explicit analyst scope"],
    mustNotDisclose: (f, actor) => {
      const { ownerDraft, ownerSubmitted, otherDraft } = f.questionnaires.questionnaires;
      if (actor === "owner") return [otherDraft, "Other Requestor questionnaire", "Other Requestor secret draft"];
      if (actor === "other") return [ownerDraft, ownerSubmitted, "Owner draft questionnaire", "Owner submitted questionnaire"];
      return [ownerDraft, ownerSubmitted, otherDraft];
    },
  },
  {
    operation: "GET:/api/v1/my_questionnaires/status_summary",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/my_questionnaires/status_summary" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: ["questionnaire-workflow.integration.test.ts › mounted questionnaire status filtering keeps authorized rows and totals on one computed-state path"],
    ownedRecordTotal: ownedByRequestorsOnly,
  },
  {
    operation: "GET:/api/v1/questionnaires",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/questionnaires" }),
    expect: analystAndAgent(200),
    exercisesAllowed: true,
    seeAlso: ["questionnaire-workflow.integration.test.ts › mounted questionnaire reads enforce owner and explicit analyst scope"],
  },
  {
    // 19-08 (D-02, D-13, D-16): the questionnaire review list's export, human analyst only, although the agent holds the
    // list read; the service agent is refused by both refusal sets. The analyst's file, equal to the list's pages, is
    // proven by the export file.
    operation: "GET:/api/v1/questionnaires/export",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/questionnaires/export?format=csv" }),
    expect: humanAnalystOnly(200),
    provenBy: { analyst: [QUESTIONNAIRES_EXPORT_PROOF] },
    seeAlso: [QUESTIONNAIRES_EXPORT_DENIAL_PROOF, QUESTIONNAIRE_AND_ALERT_EXPORT_QUERY_PROOF],
  },
  {
    // 19-08 (D-02, D-04, D-13, D-16): the caller's own questionnaires as a file, through the Requestor birthright,
    // owner-scoped for every person; the service agent holds the grant through its birthright and is refused by
    // SERVICE_IDENTITY_REFUSED_OPERATIONS. Each person's file, holding only their own questionnaires, is proven by the
    // export file.
    operation: "GET:/api/v1/my_questionnaires/export",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/my_questionnaires/export?format=csv" }),
    expect: { owner: 200, other: 200, analyst: 200, serviceAgent: 403, noIdentity: 403 },
    provenBy: { owner: [MY_QUESTIONNAIRES_EXPORT_PROOF], other: [MY_QUESTIONNAIRES_EXPORT_PROOF], analyst: [MY_QUESTIONNAIRES_EXPORT_PROOF] },
    seeAlso: [MY_QUESTIONNAIRES_EXPORT_DENIAL_PROOF, QUESTIONNAIRE_AND_ALERT_EXPORT_QUERY_PROOF],
  },
  {
    operation: "GET:/api/v1/questionnaires/review_summary",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/questionnaires/review_summary" }),
    expect: analystAndAgent(200),
    exercisesAllowed: true,
  },
  {
    operation: "GET:/api/v1/questionnaires/{questionnaireId}",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.questionnaires.questionnaires.ownerDraft)}` }),
    expect: OWNER_READ_OTHER_DENIED_403,
    exercisesAllowed: true,
    mustNotDisclose: (f, actor) => (outsider(actor)
      ? [f.questionnaires.questionnaires.ownerDraft, "Owner draft questionnaire", "Jane secret draft"]
      : []),
  },
  {
    operation: "GET:/api/v1/questionnaires/{questionnaireId}/questions",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.questionnaires.questionnaires.ownerDraft)}/questions` }),
    expect: OWNER_READ_OTHER_DENIED_403,
    exercisesAllowed: true,
    mustNotDisclose: (f, actor) => (outsider(actor)
      ? [f.questionnaires.questionnaires.ownerDraft, f.questionnaires.questions.ownerDraft, "Jane secret draft", "Owner draft question"]
      : []),
  },
  {
    operation: "PATCH:/api/v1/questionnaires/{questionnaireId}/answers",
    family: "questionnaires",
    request: (f) => ({
      path: `/api/v1/questionnaires/${encode(f.questionnaires.questionnaires.ownerDraft)}/answers`,
      init: json("PATCH", { answers: [{ questionKey: "owner-draft", value: "forged by the matrix" }] }),
    }),
    // Granted to the Requestor birthright only: the analysts hold no explicit grant and own no questionnaire.
    expect: { owner: 200, other: 403, analyst: 403, serviceAgent: 403, noIdentity: 403 },
    persistence: (f) => f.harness.snapshot([
      () => f.harness.getQuestionnaire(f.questionnaires.questionnaires.ownerDraft),
      () => f.harness.getQuestion(f.questionnaires.questions.ownerDraft),
    ]),
    provenBy: { owner: [QUESTIONNAIRE_MUTATION_PROOF] },
    mustNotDisclose: (f, actor) => (notOwner(actor) ? [f.questionnaires.questionnaires.ownerDraft, "Jane secret draft"] : []),
  },
  {
    operation: "POST:/api/v1/questionnaires/{questionnaireId}/submit",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.questionnaires.questionnaires.ownerDraft)}/submit`, init: { method: "POST" } }),
    expect: { owner: 200, other: 403, analyst: 403, serviceAgent: 403, noIdentity: 403 },
    persistence: (f) => f.harness.snapshot([
      () => f.harness.getQuestionnaire(f.questionnaires.questionnaires.ownerDraft),
      () => f.harness.getQuestion(f.questionnaires.questions.ownerDraft),
    ]),
    provenBy: { owner: [QUESTIONNAIRE_MUTATION_PROOF] },
    mustNotDisclose: (f, actor) => (notOwner(actor) ? [f.questionnaires.questionnaires.ownerDraft, "Jane secret draft"] : []),
  },
  {
    operation: "POST:/api/v1/questionnaires/{questionnaireId}/revert_to_draft",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.questionnaires.questionnaires.ownerSubmitted)}/revert_to_draft`, init: json("POST", { reason: "Matrix revert" }) }),
    expect: { owner: 200, other: 403, analyst: 200, serviceAgent: 403, noIdentity: 403 },
    persistence: (f) => f.harness.snapshot([
      () => f.harness.getQuestionnaire(f.questionnaires.questionnaires.ownerSubmitted),
      () => f.harness.getQuestion(f.questionnaires.questions.ownerSubmitted),
    ]),
    provenBy: { owner: [QUESTIONNAIRE_REVERT_PROOF], analyst: [QUESTIONNAIRE_REVERT_PROOF] },
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "analyst" ? [] : [f.questionnaires.questionnaires.ownerSubmitted, "Owner submitted questionnaire"]),
  },
  {
    operation: "POST:/api/v1/questionnaires/{questionnaireId}/release",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.governance.questionnaires.unreleased)}/release`, init: { method: "POST" } }),
    expect: humanAnalystOnly(200),
    persistence: (f) => f.harness.snapshot([() => f.harness.getQuestionnaire(f.governance.questionnaires.unreleased)]),
    provenBy: { analyst: ["questionnaire-governance.integration.test.ts › mounted questionnaire release gates the Requestor and is human-analyst only"] },
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.governance.questionnaires.unreleased, "Governance unreleased questionnaire"] : []),
  },
  {
    operation: "POST:/api/v1/questionnaires/{questionnaireId}/return_to_review",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.governance.questionnaires.released)}/return_to_review`, init: json("POST", { reason: "Matrix return to review" }) }),
    expect: humanAnalystOnly(200),
    persistence: (f) => f.harness.snapshot([() => f.harness.getQuestionnaire(f.governance.questionnaires.released)]),
    provenBy: { analyst: ["questionnaire-governance.integration.test.ts › mounted return to review is analyst-only, audited, and restores submitted answers as drafts"] },
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.governance.questionnaires.released, "Governance released questionnaire"] : []),
  },
  {
    operation: "POST:/api/v1/questionnaires/{questionnaireId}/questions",
    family: "questionnaires",
    request: (f) => ({
      path: `/api/v1/questionnaires/${encode(f.governance.questionnaires.editable)}/questions`,
      init: json("POST", { questionText: "Matrix question", answerType: "Text", questionKey: "matrix-question", section: { key: "context", title: "Context", order: 1 }, order: 9, required: false }),
    }),
    expect: humanAnalystOnly(201),
    persistence: (f) => f.harness.snapshot([
      () => f.harness.getQuestionnaire(f.governance.questionnaires.editable),
      () => f.harness.getQuestion(f.governance.questions.editable),
    ]),
    provenBy: { analyst: [QUESTION_MUTATION_PROOF] },
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.governance.questionnaires.editable, "Governance editable questionnaire"] : []),
  },
  {
    operation: "PATCH:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}",
    family: "questionnaires",
    request: (f) => ({
      path: `/api/v1/questionnaires/${encode(f.governance.questionnaires.editable)}/questions/${encode(f.governance.questions.editable)}`,
      init: json("PATCH", { questionText: "Matrix edit" }),
    }),
    expect: humanAnalystOnly(200),
    persistence: (f) => f.harness.snapshot([() => f.harness.getQuestion(f.governance.questions.editable)]),
    provenBy: { analyst: [QUESTION_MUTATION_PROOF] },
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.governance.questions.editable, "Governance question EDITABLE"] : []),
  },
  {
    operation: "DELETE:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}",
    family: "questionnaires",
    request: (f) => ({
      path: `/api/v1/questionnaires/${encode(f.governance.questionnaires.editable)}/questions/${encode(f.governance.questions.editable)}`,
      init: { method: "DELETE" },
    }),
    expect: humanAnalystOnly(200),
    persistence: (f) => f.harness.snapshot([() => f.harness.getQuestion(f.governance.questions.editable)]),
    provenBy: { analyst: [QUESTION_MUTATION_PROOF] },
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.governance.questions.editable, "Governance question EDITABLE"] : []),
  },
  {
    operation: "POST:/api/v1/assessment_requests/{requestId}/generate_questionnaire",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/assessment_requests/${encode(f.workflow.requests.submitted)}/generate_questionnaire`, init: { method: "POST" } }),
    expect: humanAnalystOnly(202),
    persistence: (f) => f.harness.snapshot([() => f.harness.getRequest(f.workflow.requests.submitted)]),
    provenBy: { analyst: ["questionnaire-generation.integration.test.ts › mounted questionnaire generation keeps completed relations populated and job reads actor-scoped"] },
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.workflow.requests.submitted, "Submitted request"] : []),
  },
  {
    operation: "GET:/api/v1/questionnaire_generation_jobs/{jobId}",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/questionnaire_generation_jobs/matrix-unknown-job" }),
    // The human analyst alone reaches the job read, which answers an unknown job with 404 and no enumeration. D-18:
    // any human Security Analyst on the request reads a job someone else started (the second analyst's mounted 200).
    expect: humanAnalystOnly(404),
    seeAlso: ["questionnaire-generation.integration.test.ts › mounted analysts share a request's running job and any analyst follows it by id (D-18)"],
  },
  {
    operation: "POST:/api/v1/questionnaire_generation_jobs/{jobId}/retry",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/questionnaire_generation_jobs/matrix-unknown-job/retry", init: { method: "POST" } }),
    expect: humanAnalystOnly(404),
    seeAlso: ["questionnaire-generation.integration.test.ts › mounted second analyst retries Bob's failed questionnaire generation and the retry is theirs (D-18)"],
  },
  {
    operation: "GET:/api/v1/assessment_requests/{requestId}/generation_jobs",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/assessment_requests/${encode(f.workflow.requests.submitted)}/generation_jobs` }),
    // D-25, D-47: every human analyst reads a request's current generation jobs; nobody else does.
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: ["questionnaire-generation.integration.test.ts › mounted request generation read answers no jobs, an unknown request and every refused caller"],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.workflow.requests.submitted, "Submitted request"] : []),
  },
  {
    operation: "POST:/api/v1/questionnaires/{questionnaireId}/generate_assessment",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.questionnaires.questionnaires.ownerSubmitted)}/generate_assessment`, init: { method: "POST" } }),
    // Phase 12 D-32: every AI run names an accountable human, so the service agent is refused before any write.
    expect: humanAnalystOnly(202),
    persistence: (f) => f.harness.snapshot([() => f.harness.getQuestionnaire(f.questionnaires.questionnaires.ownerSubmitted)]),
    provenBy: {
      analyst: ["authorization.integration.test.ts › mounted route requires a token before IdamBox authorization", DRAFT_GENERATION_PROOF],
    },
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "other" || actor === "serviceAgent" || actor === "noIdentity" || actor === "noToken"
      ? [f.questionnaires.questionnaires.ownerSubmitted, "Owner submitted questionnaire"]
      : []),
  },
  // ---------------------------------------------------------------- assessments and draft jobs
  {
    operation: "GET:/api/v1/risk_assessments",
    family: "assessments",
    request: () => ({ path: "/api/v1/risk_assessments" }),
    expect: analystAndAgent(200),
    exercisesAllowed: true,
    seeAlso: ["assessment-workflow.integration.test.ts › mounted analyst assessment list accepts closed within its scope while the owner list stays released-only"],
  },
  {
    operation: "GET:/api/v1/risk_assessments/status_summary",
    family: "assessments",
    request: () => ({ path: "/api/v1/risk_assessments/status_summary" }),
    expect: analystAndAgent(200),
    exercisesAllowed: true,
  },
  {
    operation: "GET:/api/v1/risk_assessments/{assessmentId}",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.assessments.releaseFacts.complete)}` }),
    // An unauthorised assessment read is 404 by design: the other Requestor learns nothing of the record's existence.
    expect: { owner: 200, other: 404, analyst: 200, serviceAgent: 200, noIdentity: 403 },
    exercisesAllowed: true,
    seeAlso: ["assessment-workflow.integration.test.ts › mounted Requestor reads require owner scope and the complete release aggregate"],
    mustNotDisclose: (f, actor) => (outsider(actor)
      ? [f.assessments.releaseFacts.complete, "ASM-2026-FULL07", "Assessment release fixture FULL07"]
      : []),
  },
  {
    // 19-10 (D-14 to D-16, D-21): the released assessment as a file, granted to role.security_analyst and role.requestor
    // and decided by the one record-read check: its Requestor and any analyst export it, and another Requestor gets the
    // missing record's 404, as at the released read. The service agent holds the grant through its birthright and is
    // refused by SERVICE_IDENTITY_REFUSED_OPERATIONS. Each file is proven by the export file.
    operation: "GET:/api/v1/risk_assessments/{assessmentId}/export",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.assessments.releaseFacts.complete)}/export?format=xlsx` }),
    expect: { owner: 200, other: 404, analyst: 200, serviceAgent: 403, noIdentity: 403 },
    provenBy: { owner: [RELEASED_EXPORT_PROOF, RELEASED_EXPORT_TABLE_PROOF], analyst: [RELEASED_EXPORT_SAME_TABLES_PROOF, RELEASED_EXPORT_TABLE_PROOF] },
    seeAlso: [RELEASED_EXPORT_NOT_FOUND_PROOF, RELEASED_EXPORT_NOT_RELEASED_PROOF, RELEASED_EXPORT_DENIAL_PROOF],
    mustNotDisclose: (f, actor) => (outsider(actor)
      ? [f.assessments.releaseFacts.complete, "ASM-2026-FULL07", "Assessment release fixture FULL07"]
      : []),
  },
  {
    // 19-10 (D-04, D-05, D-13): the analyst Risk assessments list as a file, human analyst only, with the list read; the
    // service agent is refused by both refusal sets. The analyst's file, equal to the list's pages, is proven by the export file.
    operation: "GET:/api/v1/risk_assessments/export",
    family: "assessments",
    request: () => ({ path: "/api/v1/risk_assessments/export?format=csv" }),
    expect: humanAnalystOnly(200),
    provenBy: { analyst: [RISK_ASSESSMENTS_EXPORT_PROOF] },
    seeAlso: [RISK_ASSESSMENTS_EXPORT_DENIAL_PROOF],
  },
  {
    // 19-10 (D-04, D-13, D-14): the caller's own released assessments as a file, through the Requestor birthright,
    // owner-scoped for every person; the service agent holds the grant through its birthright and is refused by
    // SERVICE_IDENTITY_REFUSED_OPERATIONS. Each person's file, holding only their own releases, is proven by the export file.
    operation: "GET:/api/v1/my_risk_assessments/export",
    family: "assessments",
    request: () => ({ path: "/api/v1/my_risk_assessments/export?format=csv" }),
    expect: { owner: 200, other: 200, analyst: 200, serviceAgent: 403, noIdentity: 403 },
    provenBy: { owner: [MY_RISK_ASSESSMENTS_EXPORT_PROOF], other: [MY_RISK_ASSESSMENTS_EXPORT_PROOF], analyst: [MY_RISK_ASSESSMENTS_EXPORT_PROOF] },
    seeAlso: [MY_RISK_ASSESSMENTS_EXPORT_DENIAL_PROOF],
  },
  {
    operation: "GET:/api/v1/risk_assessments/{assessmentId}/risks",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.assessments.releaseFacts.complete)}/risks` }),
    expect: { owner: 200, other: 404, analyst: 200, serviceAgent: 200, noIdentity: 403 },
    exercisesAllowed: true,
    mustNotDisclose: (f, actor) => (outsider(actor) ? [f.assessments.releaseFacts.complete, f.assessments.aggregate.risk, "Mounted aggregate risk"] : []),
  },
  {
    operation: "PATCH:/api/v1/risk_assessments/{assessmentId}",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.assessments.releaseFacts.unreleased)}`, init: json("PATCH", { summary: "Matrix edit" }) }),
    expect: analystAndAgent(200),
    persistence: (f) => f.harness.snapshot([() => f.harness.getAssessment(f.assessments.releaseFacts.unreleased)]),
    provenBy: {
      analyst: ["assessment-workflow.integration.test.ts › mounted analyst assessment metadata routes are bounded and transition the first accepted edit once"],
      serviceAgent: [AGENT_ASSESSMENT_WRITES_PROOF],
    },
    mustNotDisclose: (f, actor) => (actor === "analyst" || actor === "serviceAgent" ? [] : [f.assessments.releaseFacts.unreleased, "Assessment release fixture NONE00"]),
  },
  {
    operation: "POST:/api/v1/risk_assessments/{assessmentId}/release",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.assessments.releaseFacts.unreleased)}/release`, init: { method: "POST" } }),
    // The birthright holds no release grant, so the other Requestor is refused by the policy (403, never a 404 here);
    // the service agent is refused by the human-analyst guard; the analyst is refused by the readiness gate (409).
    expect: { owner: 403, other: 403, analyst: 409, serviceAgent: 403, noIdentity: 403 },
    persistence: (f) => f.harness.snapshot([
      () => f.harness.getAssessment(f.assessments.releaseFacts.unreleased),
      () => f.harness.getRequest(f.assessments.requests.complete),
    ]),
    seeAlso: ["assessment-workflow.integration.test.ts › mounted explicit release is readiness-gated, atomic, and concurrent-safe"],
    mustNotDisclose: (f, actor) => (actor === "analyst" ? [] : [f.assessments.releaseFacts.unreleased, "Assessment release fixture NONE00"]),
  },
  {
    operation: "POST:/api/v1/risk_assessments/{assessmentId}/risks",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.assessments.releaseFacts.unreleased)}/risks`, init: json("POST", { riskStatement: "Matrix risk" }) }),
    expect: analystAndAgent(201),
    persistence: (f) => f.harness.snapshot([() => f.harness.countRisksForAssessment(f.assessments.releaseFacts.unreleased)]),
    provenBy: {
      analyst: ["assessment-workflow.integration.test.ts › mounted contextual Risk routes cover the frozen writable surface and bounded references"],
      serviceAgent: [AGENT_ASSESSMENT_WRITES_PROOF],
    },
  },
  {
    operation: "GET:/api/v1/assessment_draft_jobs/{jobId}",
    family: "assessments",
    request: () => ({ path: "/api/v1/assessment_draft_jobs/matrix-unknown-job" }),
    // The human analyst alone reaches the job read (D-32), which answers an unknown job with 404 and no enumeration;
    // D-18: any human Security Analyst on the request reads and retries a job someone else started.
    expect: humanAnalystOnly(404),
    seeAlso: ["assessment-workflow.integration.test.ts › mounted provider failures are safe, observable, and retryable without enumeration", "assessment-workflow.integration.test.ts › mounted second analyst follows and retries Bob's failed draft job and the retry is theirs (D-18)"],
  },
  {
    operation: "POST:/api/v1/assessment_draft_jobs/{jobId}/retry",
    family: "assessments",
    request: () => ({ path: "/api/v1/assessment_draft_jobs/matrix-unknown-job/retry", init: { method: "POST" } }),
    expect: humanAnalystOnly(404),
    seeAlso: ["assessment-workflow.integration.test.ts › mounted provider failures are safe, observable, and retryable without enumeration", "assessment-workflow.integration.test.ts › mounted second analyst follows and retries Bob's failed draft job and the retry is theirs (D-18)"],
  },
  {
    operation: "GET:/api/v1/questionnaires/{questionnaireId}/ai_proposals",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.questionnaireAi.questionnaire)}/ai_proposals` }),
    // Phase 15 D-03 item 4, D-31: the proposals read is the human analyst's alone.
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: ["questionnaire-ai-proposals.integration.test.ts › the proposals read is refused to the Requestor, the Secondary Requestor and the service agent, and OWN_REQUEST to an analyst on a request they raised (D-31, D-32)"],
  },
  {
    operation: "POST:/api/v1/questionnaires/{questionnaireId}/ai_proposals",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.questionnaireAi.questionnaire)}/ai_proposals`, init: json("POST", {}) }),
    // Phase 15 D-10, D-31: a proposal start queues a job for the human analyst alone; a refused caller queues nothing.
    expect: humanAnalystOnly(202),
    exercisesAllowed: true,
    seeAlso: ["questionnaire-ai-proposals.integration.test.ts › every questionnaire AI route refuses the Requestor, the Secondary Requestor and the service agent with 403 and nothing changes, and answers OWN_REQUEST to an analyst on a request they raised (D-31, D-32)"],
  },
  {
    operation: "POST:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite",
    family: "questionnaires",
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.questionnaireAi.questionnaire)}/questions/${encode(f.questionnaireAi.optionalQuestion)}/rewrite`, init: json("POST", {}) }),
    expect: humanAnalystOnly(202),
    exercisesAllowed: true,
    seeAlso: ["questionnaire-ai-proposals.integration.test.ts › every questionnaire AI route refuses the Requestor, the Secondary Requestor and the service agent with 403 and nothing changes, and answers OWN_REQUEST to an analyst on a request they raised (D-31, D-32)"],
  },
  {
    operation: "GET:/api/v1/questionnaire_proposal_jobs/{jobId}",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/questionnaire_proposal_jobs/matrix-unknown-job" }),
    // An unknown job is 404 to the human analyst with no enumeration; everyone else stops at the grant.
    expect: humanAnalystOnly(404),
    seeAlso: ["questionnaire-ai-proposals.integration.test.ts › over HTTP Bob starts proposals (202), follows the job to its run, gets the same job while it runs, rewrites an unanswered question, and is refused an answered or removed target, an open body and a long instruction (D-03, D-10, D-11, D-16)"],
  },
  {
    operation: "POST:/api/v1/questionnaire_proposal_jobs/{jobId}/retry",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/questionnaire_proposal_jobs/matrix-unknown-job/retry", init: { method: "POST" } }),
    expect: humanAnalystOnly(404),
    seeAlso: ["questionnaire-ai-proposals.integration.test.ts › over HTTP a too-large job's read serves failureAttachments in the published GenerationJobFailureAttachment shape, and the second analyst retries a failed job as their own run (S-3; Phase 13 D-18)"],
  },
  {
    operation: "POST:/api/v1/questionnaires/{questionnaireId}/ai_proposal_decisions",
    family: "questionnaires",
    // An empty batch: the human analyst reaches the service and is told the body is invalid; nothing can change.
    request: (f) => ({ path: `/api/v1/questionnaires/${encode(f.questionnaireAi.questionnaire)}/ai_proposal_decisions`, init: json("POST", { decisions: [] }) }),
    expect: humanAnalystOnly(400),
    seeAlso: ["questionnaire-ai-proposals.integration.test.ts › over HTTP Bob's decisions answer 200 with the counts, a batch naming another questionnaire's run is 404 deep-equal, and confirming on a released questionnaire is QUESTIONNAIRE_RELEASED (D-21)"],
  },
  {
    operation: "GET:/api/v1/ai_runs/{runId}",
    family: "assessments",
    request: () => ({ path: "/api/v1/ai_runs/matrix-unknown-run" }),
    // D-25, D-32: the human analyst alone reads what an AI run used; an unknown run is 404 with no enumeration.
    expect: humanAnalystOnly(404),
    seeAlso: ["ai-run.integration.test.ts › mounted analyst run read serves the run facts and context summary and nothing of the proposal"],
  },
  {
    operation: "POST:/api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions",
    family: "assessments",
    /*
     * IN-204: a one-item batch the operation would carry out. A refused caller's confirms the proposed issue statement,
     * so a missing guard would write and the persistence snapshot would show it. The analyst's repeats the confirmation
     * already recorded, an exact repeat that changes nothing (D-24), so the matrix issues it.
     */
    request: (f, actor) => ({
      path: `/api/v1/risk_assessments/${encode(f.aiDecision.assessment)}/ai_proposal_decisions`,
      init: json("POST", { decisions: [{ target: { kind: "risk", riskId: f.aiDecision.risk }, action: "accept", fields: [actor === "analyst" ? "riskStatement" : "issueStatement"] }] }),
    }),
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    persistence: (f) => f.harness.snapshot([() => f.harness.getAssessment(f.aiDecision.assessment), () => f.harness.getRisk(f.aiDecision.risk), () => f.harness.getAiRun(f.aiDecision.run)]),
    seeAlso: ["ai-proposal-decisions.integration.test.ts › mounted proposal decisions refuse other actors without writes"],
  },
  {
    operation: "GET:/api/v1/my_risk_assessments",
    family: "assessments",
    request: () => ({ path: "/api/v1/my_risk_assessments" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: ["assessment-workflow.integration.test.ts › mounted Requestor reads require owner scope and the complete release aggregate"],
    mustNotDisclose: (f, actor) => (actor === "owner"
      ? [f.assessments.releaseFacts.crossOwnerComplete, "ASM-2026-OTHER8"]
      : actor === "other"
        ? [f.assessments.releaseFacts.complete, "ASM-2026-FULL07"]
        : [f.assessments.releaseFacts.complete, f.assessments.releaseFacts.crossOwnerComplete, "ASM-2026-FULL07", "ASM-2026-OTHER8"]),
  },
  {
    operation: "GET:/api/v1/my_risk_assessments/rating_summary",
    family: "assessments",
    request: () => ({ path: "/api/v1/my_risk_assessments/rating_summary" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    ownedRecordTotal: ownedByRequestorsOnly,
  },
  {
    operation: "GET:/api/v1/risks/{riskId}/control_implementations",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risks/${encode(f.assessments.aggregate.risk)}/control_implementations` }),
    expect: { owner: 200, other: 404, analyst: 200, serviceAgent: 200, noIdentity: 403 },
    exercisesAllowed: true,
    mustNotDisclose: (f, actor) => (outsider(actor) ? [f.assessments.aggregate.controlImplementation, "Mounted aggregate evidence"] : []),
  },
  // ---------------------------------------------------------------- Risks, the Risk Register and the pickers
  {
    operation: "GET:/api/v1/risks",
    family: "risks",
    request: () => ({ path: "/api/v1/risks" }),
    // The Risk Register requires the human analyst's own grant: the service agent holds the catalogue grant and is still refused.
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: ["risk-register.integration.test.ts › mounted Risk Register requires the exact analyst grant before query validation or record work"],
  },
  {
    operation: "GET:/api/v1/risks/{riskId}",
    family: "risks",
    request: (f) => ({ path: `/api/v1/risks/${encode(f.assessments.aggregate.risk)}` }),
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: ["risk-register.integration.test.ts › mounted Risk detail requires the exact analyst grant before query or record lookup"],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.assessments.aggregate.risk, "Mounted aggregate risk"] : []),
  },
  {
    operation: "PATCH:/api/v1/risks/{riskId}",
    family: "risks",
    request: (f) => ({ path: `/api/v1/risks/${encode(f.assessments.aggregate.risk)}`, init: json("PATCH", { riskStatement: "Matrix edit" }) }),
    // The seeded Risk belongs to a released assessment, so the granted actors are refused by release immutability (409).
    expect: analystAndAgent(409),
    persistence: (f) => f.harness.snapshot([() => f.harness.getRisk(f.assessments.aggregate.risk)]),
    seeAlso: ["assessment-workflow.integration.test.ts › mounted contextual Risk routes cover the frozen writable surface and bounded references"],
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "other" || actor === "noIdentity" || actor === "noToken" ? [f.assessments.aggregate.risk, "Mounted aggregate risk"] : []),
  },
  {
    operation: "POST:/api/v1/risk_assessments/{assessmentId}/risk_withdrawals",
    family: "risks",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.curation.assessment)}/risk_withdrawals`, init: json("POST", { riskIds: [f.curation.risk], reason: "Matrix withdrawal" }) }),
    // Phase 16 (D-43): human analyst-only; the analyst's success would withdraw the shared Risk, so it is cited.
    expect: humanAnalystOnly(200),
    persistence: curationPersistence,
    provenBy: { analyst: [CURATION_WITHDRAW_PROOF] },
    seeAlso: [CURATION_WITHDRAW_DENIAL_PROOF],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.curation.risk] : []),
  },
  {
    operation: "POST:/api/v1/risk_assessments/{assessmentId}/risk_reinstatements",
    family: "risks",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.curation.assessment)}/risk_reinstatements`, init: json("POST", { riskIds: [f.curation.risk], undo: true }) }),
    // Phase 16 (D-43): human analyst-only; a reinstatement needs a withdrawn Risk the shared fixture does not hold, so it is cited.
    expect: humanAnalystOnly(200),
    persistence: curationPersistence,
    provenBy: { analyst: [CURATION_REINSTATE_PROOF] },
    seeAlso: [CURATION_REINSTATE_DENIAL_PROOF],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.curation.risk] : []),
  },
  {
    operation: "GET:/api/v1/risks/{riskId}/history",
    family: "risks",
    request: (f) => ({ path: `/api/v1/risks/${encode(f.curation.risk)}/history` }),
    // Phase 16 (D-21, D-43): the history read is human analyst-only in this phase; a read, so every answer is issued.
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: [CURATION_HISTORY_PROOF, CURATION_HISTORY_DENIAL_PROOF],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.curation.risk] : []),
  },
  {
    // Phase 19 (D-02, D-13, D-16): the register export, keyed by its catalogue URL as the served inventory records it
    // (GET:/api/v1/risks/export?format={format} with the query stripped). Human analyst only; the service agent is
    // refused by both refusal sets. The analyst's file is proven, read back, by the export file.
    operation: "GET:/api/v1/risks/export",
    family: "risks",
    request: () => ({ path: "/api/v1/risks/export?format=csv" }),
    expect: humanAnalystOnly(200),
    provenBy: { analyst: [REGISTER_EXPORT_PROOF] },
    seeAlso: [REGISTER_EXPORT_DENIAL_PROOF],
  },
  {
    // 19-07 (D-02, D-13, D-16): the review queue's export, human analyst only; the service agent is refused by both
    // refusal sets. The analyst's file, equal to the list's pages, is proven by the export file.
    operation: "GET:/api/v1/assessment_requests/export",
    family: "assessment-requests",
    request: () => ({ path: "/api/v1/assessment_requests/export?format=csv&filters[queue]=all" }),
    expect: humanAnalystOnly(200),
    provenBy: { analyst: [QUEUE_EXPORT_PROOF] },
    seeAlso: [QUEUE_EXPORT_DENIAL_PROOF],
  },
  {
    // 19-07 (D-02, D-04, D-13, D-16): the caller's own requests as a file, through the Requestor birthright, owner-scoped
    // for every person; the service agent holds the grant through its birthright and is refused by
    // SERVICE_IDENTITY_REFUSED_OPERATIONS. Each person's file, holding only their own requests, is proven by the export file.
    operation: "GET:/api/v1/my_requests/export",
    family: "assessment-requests",
    request: () => ({ path: "/api/v1/my_requests/export?format=csv" }),
    expect: { owner: 200, other: 200, analyst: 200, serviceAgent: 403, noIdentity: 403 },
    provenBy: { owner: [MY_REQUESTS_EXPORT_PROOF], other: [MY_REQUESTS_EXPORT_PROOF], analyst: [MY_REQUESTS_EXPORT_PROOF] },
    seeAlso: [MY_REQUESTS_EXPORT_DENIAL_PROOF],
  },
  /*
   * Phase 16 (16-09; D-26, D-41, D-43): the risk AI proposal operations, human Security Analyst only. A start, a rewrite
   * and a retry would queue a job and record a run on the shared fixture, so the analyst's success is cited; the two
   * reads are issued for every caller.
   */
  {
    operation: "POST:/api/v1/risk_assessments/{assessmentId}/risk_suggestions",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.riskAiProposals.assessment)}/risk_suggestions`, init: json("POST", { instruction: "Matrix suggestion" }) }),
    expect: humanAnalystOnly(202),
    persistence: riskAiPersistence,
    provenBy: { analyst: [RISK_AI_SUGGEST_PROOF] },
    seeAlso: [RISK_AI_START_DENIAL_PROOF],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.riskAiProposals.risk, f.riskAiProposals.failedJob] : []),
  },
  {
    operation: "POST:/api/v1/risks/{riskId}/rewrite",
    family: "risks",
    request: (f) => ({ path: `/api/v1/risks/${encode(f.riskAiProposals.risk)}/rewrite`, init: json("POST", { focus: ["statement"] }) }),
    expect: humanAnalystOnly(202),
    persistence: riskAiPersistence,
    provenBy: { analyst: [RISK_AI_REWRITE_PROOF] },
    seeAlso: [RISK_AI_REWRITE_DENIAL_PROOF],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.riskAiProposals.assessment, f.riskAiProposals.failedJob] : []),
  },
  {
    operation: "GET:/api/v1/risk_proposal_jobs/{jobId}",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_proposal_jobs/${encode(f.riskAiProposals.failedJob)}` }),
    // A read of the fixture's failed job, so every answer is issued; nobody else learns its assessment.
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: [RISK_AI_RETRY_PROOF, RISK_AI_REWRITE_DENIAL_PROOF],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.riskAiProposals.assessment] : []),
  },
  {
    operation: "POST:/api/v1/risk_proposal_jobs/{jobId}/retry",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_proposal_jobs/${encode(f.riskAiProposals.failedJob)}/retry`, init: { method: "POST" } }),
    // The fixture's job failed, so the analyst's retry would start a second attempt and a run: cited, not issued.
    expect: humanAnalystOnly(202),
    persistence: riskAiPersistence,
    provenBy: { analyst: [RISK_AI_RETRY_PROOF] },
    seeAlso: [RISK_AI_REWRITE_DENIAL_PROOF],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.riskAiProposals.assessment] : []),
  },
  {
    operation: "GET:/api/v1/risk_assessments/{assessmentId}/ai_proposals",
    family: "assessments",
    request: (f) => ({ path: `/api/v1/risk_assessments/${encode(f.riskAiProposals.assessment)}/ai_proposals` }),
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: [RISK_AI_READ_PROOF, RISK_AI_START_DENIAL_PROOF],
    mustNotDisclose: (f, actor) => (notHumanAnalyst(actor) ? [f.riskAiProposals.risk, f.riskAiProposals.failedJob] : []),
  },
  /*
   * Phase 16 (D-16): no route deletes a Risk. Neither the CSRM path nor the generic content-type path is mounted for
   * DELETE, so every caller gets the unmounted-path answer and the Risk, its facts and its history stay equal.
   */
  {
    operation: "DELETE:/api/v1/risks/{riskId}",
    family: "risks",
    unmounted: true,
    request: (f) => ({ path: `/api/v1/risks/${encode(f.curation.risk)}`, init: { method: "DELETE" } }),
    expect: unmountedRoute(405),
    persistence: curationPersistence,
    seeAlso: [RISK_NO_DELETE_PROOF],
  },
  {
    operation: "DELETE:/api/csrm-risks/{id}",
    family: "risks",
    unmounted: true,
    request: (f) => ({ path: `/api/csrm-risks/${encode(f.curation.risk)}`, init: { method: "DELETE" } }),
    expect: unmountedRoute(405),
    persistence: curationPersistence,
    seeAlso: [RISK_NO_DELETE_PROOF],
  },
  {
    operation: "GET:/api/v1/risk_types",
    family: "risks",
    request: () => ({ path: "/api/v1/risk_types" }),
    // The bare path is the assessment picker, granted to both analyst roles.
    expect: analystAndAgent(200),
    exercisesAllowed: true,
    variants: [{
      label: "canonical Administration list query",
      request: () => ({ path: `/api/v1/risk_types${CANONICAL_ADMINISTRATION_QUERY}` }),
      expect: humanAnalystOnly(200),
      exercisesAllowed: true,
      seeAlso: [PICKER_PROOF],
    }],
  },
  {
    operation: "GET:/api/v1/controls",
    family: "risks",
    request: () => ({ path: "/api/v1/controls" }),
    expect: analystAndAgent(200),
    exercisesAllowed: true,
    variants: [{
      label: "canonical Administration list query",
      request: () => ({ path: `/api/v1/controls${CANONICAL_ADMINISTRATION_QUERY}` }),
      expect: humanAnalystOnly(200),
      exercisesAllowed: true,
      seeAlso: [PICKER_PROOF],
    }],
  },
  {
    operation: "GET:/api/v1/users",
    family: "risks",
    request: () => ({ path: "/api/v1/users?search=Jane" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: ["assessment-workflow.integration.test.ts › mounted active user search stays bounded and assessment detail never accepts selected-owner query expansion"],
  },
  // ---------------------------------------------------------------- control implementations
  {
    operation: "POST:/api/v1/risks/{riskId}/control_implementations",
    family: "control-implementations",
    request: (f) => ({ path: `/api/v1/risks/${encode(f.assessments.aggregate.risk)}/control_implementations`, init: json("POST", { control: f.assessments.aggregate.control, controlStatus: "Planned" }) }),
    // The seeded Risk belongs to a released assessment: release immutability refuses the granted actors (409).
    expect: analystAndAgent(409),
    persistence: (f) => f.harness.snapshot([() => f.harness.countControlImplementationsForRisk(f.assessments.aggregate.risk)]),
    seeAlso: ["assessment-workflow.integration.test.ts › mounted contextual ControlImplementation routes cover every frozen writable field and exact Risk parent"],
  },
  {
    operation: "PATCH:/api/v1/control_implementations/{implementationId}",
    family: "control-implementations",
    request: (f) => ({ path: `/api/v1/control_implementations/${encode(f.assessments.aggregate.controlImplementation)}`, init: json("PATCH", { controlStatus: "Implemented" }) }),
    expect: analystAndAgent(409),
    persistence: (f) => f.harness.snapshot([() => f.harness.getControlImplementation(f.assessments.aggregate.controlImplementation)]),
    seeAlso: ["assessment-workflow.integration.test.ts › mounted contextual ControlImplementation routes cover every frozen writable field and exact Risk parent"],
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "other" || actor === "noIdentity" || actor === "noToken" ? [f.assessments.aggregate.controlImplementation, "Mounted aggregate evidence"] : []),
  },
  {
    operation: "DELETE:/api/v1/control_implementations/{implementationId}",
    family: "control-implementations",
    request: (f) => ({ path: `/api/v1/control_implementations/${encode(f.assessments.aggregate.controlImplementation)}`, init: { method: "DELETE" } }),
    expect: analystAndAgent(409),
    persistence: (f) => f.harness.snapshot([() => f.harness.getControlImplementation(f.assessments.aggregate.controlImplementation)]),
    seeAlso: ["assessment-workflow.integration.test.ts › direct ControlImplementation descendants reject every partial and complete release fact"],
  },
  // ---------------------------------------------------------------- Administration and the Requestor selectors
  {
    operation: "GET:/api/v1/information_systems",
    family: "administration",
    // A bare path or a `q` search is the Requestor selector, a birthright read; an ordered query is the Administration list.
    request: () => ({ path: "/api/v1/information_systems?q=Administration&page=1&pageSize=10" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: [SELECTOR_PROOF, "administration.integration.test.ts › ADMIN-03 the Requestor selector searches without reaching Administration query scope"],
    variants: [{
      label: "canonical Administration list query",
      request: () => ({ path: `/api/v1/information_systems${CANONICAL_ADMINISTRATION_QUERY}` }),
      expect: humanAnalystOnly(200),
      exercisesAllowed: true,
    }],
  },
  {
    operation: "GET:/api/v1/information_assets",
    family: "administration",
    request: () => ({ path: "/api/v1/information_assets?q=Administration&page=1&pageSize=10" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: [SELECTOR_PROOF, "administration.integration.test.ts › ADMIN-03 the Requestor selector searches without reaching Administration query scope"],
    variants: [{
      label: "canonical Administration list query",
      request: () => ({ path: `/api/v1/information_assets${CANONICAL_ADMINISTRATION_QUERY}` }),
      expect: humanAnalystOnly(200),
      exercisesAllowed: true,
    }],
  },
  ...administrationRows(),
  {
    operation: "POST:/api/v1/information_systems/selected",
    family: "reference-data",
    request: (f) => ({ path: "/api/v1/information_systems/selected", init: json("POST", { selectedIds: [f.administration.informationSystems.unchanged] }) }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: [SELECTOR_PROOF],
  },
  {
    operation: "POST:/api/v1/information_assets/selected",
    family: "reference-data",
    request: (f) => ({ path: "/api/v1/information_assets/selected", init: json("POST", { selectedIds: [f.administration.informationAssets.unchanged] }) }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: [SELECTOR_PROOF],
  },
  // ---------------------------------------------------------------- current user (every identity, own access only)
  {
    operation: "GET:/api/v1/me/access",
    family: "current-user",
    request: () => ({ path: "/api/v1/me/access" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    // Each caller reads only its own access, never another person's name (docs/adr/0004).
    mustNotDisclose: (_f, actor) => (actor === "analyst" ? ["Jane Doe"] : actor === "owner" || actor === "other" ? ["Bob Doe"] : []),
    seeAlso: ["keycloak-identity.integration.test.ts › a verified Security Analyst token resolves Bob with the analyst grants, human-only operations included"],
  },
  // ---------------------------------------------------------------- analyst insights (human analyst only)
  {
    operation: "GET:/api/v1/dashboard/summary",
    family: "analyst-insights",
    request: () => ({ path: "/api/v1/dashboard/summary" }),
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: ["analyst-dashboard.integration.test.ts › the summary refuses every identity other than the human analyst, and any query, without leaking a figure"],
  },
  {
    operation: "GET:/api/v1/alerts",
    family: "analyst-insights",
    request: () => ({ path: "/api/v1/alerts" }),
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: ["analyst-alerts.integration.test.ts › both alert operations refuse every identity other than the human analyst"],
  },
  {
    operation: "GET:/api/v1/alerts/summary",
    family: "analyst-insights",
    request: () => ({ path: "/api/v1/alerts/summary" }),
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: ["analyst-alerts.integration.test.ts › both alert operations refuse every identity other than the human analyst"],
  },
  {
    // 19-08 (D-02, D-13, D-16; G-16): the alert list's export, human analyst only, with the alert read and the insight
    // scope's underlying reads; the service agent is refused by both refusal sets. The analyst's file, equal to the
    // list's pages, is proven by the export file.
    operation: "GET:/api/v1/alerts/export",
    family: "analyst-insights",
    request: () => ({ path: "/api/v1/alerts/export?format=csv" }),
    expect: humanAnalystOnly(200),
    provenBy: { analyst: [ALERTS_EXPORT_PROOF] },
    seeAlso: [ALERTS_EXPORT_DENIAL_PROOF, QUESTIONNAIRE_AND_ALERT_EXPORT_QUERY_PROOF],
  },
  {
    operation: "GET:/api/v1/reports",
    family: "analyst-insights",
    request: () => ({ path: "/api/v1/reports" }),
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: ["analyst-reports.integration.test.ts › both report operations refuse every identity other than the human analyst, before any key or query is read"],
  },
  {
    operation: "GET:/api/v1/reports/{reportKey}",
    family: "analyst-insights",
    request: () => ({ path: "/api/v1/reports/risk-exposure" }),
    expect: humanAnalystOnly(200),
    exercisesAllowed: true,
    seeAlso: ["analyst-reports.integration.test.ts › both report operations refuse every identity other than the human analyst, before any key or query is read"],
  },
  {
    // 19-09 (D-02, D-13, D-16, D-22): the reserved report export, human analyst only, with the report read and the
    // insight scope's underlying reads; the service agent is refused by both refusal sets. The analyst's workbook,
    // equal to the report read's figures, is proven by the export file.
    operation: "POST:/api/v1/reports/{reportKey}/export",
    family: "analyst-insights",
    request: () => ({ path: "/api/v1/reports/risk-exposure/export", init: json("POST", { format: "xlsx" }) }),
    expect: humanAnalystOnly(200),
    provenBy: { analyst: [REPORT_EXPORT_PROOF] },
    seeAlso: [REPORT_EXPORT_DENIAL_PROOF, REPORT_EXPORT_BODY_PROOF],
  },
  // ---------------------------------------------------------------- SCIM 2.0 (Identity Source bearer only)
  ...scimRows(),
  // ---------------------------------------------------------------- plugin routes (the residual surface, observed)
  ...otherPluginRows(),
  ...usersPermissionsAuthRows(),
  ...usersPermissionsUserRows(),
  ...usersPermissionsRoleRows(),
];
