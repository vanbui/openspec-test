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
 * 10 D-25) and the five analyst insight operations. The matrix test
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
  ...Object.values(CSRM_ANALYST_INSIGHT_OPERATIONS),
];

/** Seeded titles and values no denial may echo (the alerts-test pattern, widened to every fixture family). */
export const FIXTURE_TITLE_PATTERN =
  /Owner request|Other request|Submitted request|secret draft|Must never leak|Owner draft questionnaire|Owner submitted questionnaire|Other Requestor questionnaire|Governance (unreleased|released|returnable|editable) questionnaire|Assessment release fixture|Mounted aggregate|Administration (update|unchanged)/;

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
   * actor who owns no seeded record, "some" for one who does. Checked on every
   * successful response the row issues.
   */
  ownedRecordTotal?: (actor: MatrixActor) => "none" | "some";
  variants?: readonly MatrixVariant[];
  /** A route mounted by a plugin (the inventory's `pluginRoutes`), outside the CSRM policy. */
  plugin?: true;
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
/** A plugin route sees two callers: everyone carrying the API token, and nobody at all. */
function pluginRoute(tokenHolder: number, anonymous: number): MatrixExpectation {
  return { owner: tokenHolder, other: tokenHolder, analyst: tokenHolder, serviceAgent: tokenHolder, noIdentity: tokenHolder, noToken: anonymous };
}
/** Everyone but the owner is refused Jane's record: the owner sees it, the analysts read it by grant. */
const OWNER_READ_OTHER_DENIED_403: MatrixExpectation = { owner: 200, other: 403, analyst: 200, serviceAgent: 200, noIdentity: 403 };

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
}> = [
  { path: "risk_types", kind: "risk-types", fixture: (f) => f.administration.riskTypes, title: "Administration import unchanged fixture" },
  { path: "controls", kind: "controls", fixture: (f) => f.administration.controls, title: "Administration unchanged control" },
  { path: "information_systems", kind: "information-systems", fixture: (f) => f.administration.informationSystems, title: "Administration unchanged system" },
  { path: "information_assets", kind: "information-assets", fixture: (f) => f.administration.informationAssets, title: "Administration unchanged asset" },
];

const ADMINISTRATION_CRUD_PROOF = "administration.integration.test.ts › ADMIN-01 ADMIN-02 ADMIN-03 mounted CRUD is closed, normalized, paginated, and delete-free";
const ADMINISTRATION_IMPORT_PROOF = "administration.integration.test.ts › ADMIN-04 applies five-state imports for every remaining Administration collection";
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
const QUESTIONNAIRE_MUTATION_PROOF = "questionnaire-workflow.integration.test.ts › mounted questionnaire mutations enforce ownership, allowlisting, and immutable submitted batches";
const QUESTIONNAIRE_REVERT_PROOF = "questionnaire-workflow.integration.test.ts › questionnaire reversal preserves values, audit facts, and refusal persistence";
const QUESTION_MUTATION_PROOF = "questionnaire-governance.integration.test.ts › mounted analyst question mutations retain deleted evidence and exclude it from active progress";
const DRAFT_GENERATION_PROOF = "assessment-workflow.integration.test.ts › mounted assessment draft generation exposes a bounded analyst-owned lifecycle";
const REQUEST_WRITES_PROOF = "authorization.integration.test.ts › mounted request writes admit every granted actor, the service agent included";
/* T-08-A1: an analyst's or the service agent's create succeeds as the caller's own request, whatever the body names. */
const REQUEST_CREATE_OWNER_BOUND_PROOF = "authorization.integration.test.ts › T-08-A1 mounted create binds an analyst's or the service agent's request to its creator whatever the body names";
const OWN_REQUEST_LISTED_PROOF = "authorization.integration.test.ts › T-08-A1 an analyst's or the service agent's own new request appears in their own My Requests";
/* T-08-A2: an analyst's or the service agent's update succeeds while writing only the published update body. */
const REQUEST_UPDATE_KEEPS_OWNER_PROOF = "authorization.integration.test.ts › T-08-A2 mounted update keeps a request's owner when an analyst or the service agent names another Requestor";
const REQUEST_UPDATE_PUBLISHED_BODY_PROOF = "authorization.integration.test.ts › T-08-A2 mounted update ignores server-owned facts and honours only the published submission intent from an analyst or the service agent";
const AGENT_ASSESSMENT_WRITES_PROOF = "assessment-workflow.integration.test.ts › mounted assessment writes admit the service agent's exact grants";

function administrationRows(): MatrixRow[] {
  return ADMINISTRATION_KINDS.flatMap(({ path, kind, fixture, title }): MatrixRow[] => [
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

/** The content-type-builder, email, i18n and upload content-API routes the plugins keep mounted. */
function otherPluginRows(): MatrixRow[] {
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
      // A multipart body with no file: the handler is reached and refuses it, and nothing lands on disk.
      request: () => ({ path: "/api/upload", init: emptyMultipart() }),
      expect: pluginRoute(400, 403),
    },
    {
      operation: "GET:/api/upload/files",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/upload/files" }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
    {
      operation: "DELETE:/api/upload/files/:id",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/upload/files/999999", init: { method: "DELETE" } }),
      expect: pluginRoute(404, 403),
    },
    {
      operation: "GET:/api/upload/files/:id",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/upload/files/999999" }),
      expect: pluginRoute(404, 403),
    },
    {
      operation: "GET:/api/upload/files/page",
      family: "plugin",
      plugin: true,
      request: () => ({ path: "/api/upload/files/page" }),
      expect: pluginRoute(200, 403),
      exercisesAllowed: true,
    },
  ];
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
    expect: OWNER_READ_OTHER_DENIED_403,
    exercisesAllowed: true,
    mustNotDisclose: (f, actor) => (outsider(actor) ? [f.requests.owner, "Owner request"] : []),
  },
  {
    operation: "PUT:/api/csrm-assessment-requests/{id}",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/csrm-assessment-requests/${encode(f.requests.owner)}`, init: json("PUT", { data: { title: "Cross requestor update" } }) }),
    // The analysts reach any request, but write only the published update body and never its owner (T-08-A2).
    expect: OWNER_READ_OTHER_DENIED_403,
    persistence: (f) => f.harness.snapshot([() => f.harness.getRequest(f.requests.owner)]),
    provenBy: {
      owner: [REQUEST_UPDATE_PROOF],
      analyst: [REQUEST_UPDATE_PROOF, REQUEST_UPDATE_KEEPS_OWNER_PROOF, REQUEST_UPDATE_PUBLISHED_BODY_PROOF],
      serviceAgent: [REQUEST_WRITES_PROOF, REQUEST_UPDATE_KEEPS_OWNER_PROOF, REQUEST_UPDATE_PUBLISHED_BODY_PROOF],
    },
    mustNotDisclose: (f, actor) => (outsider(actor) ? [f.requests.owner, "Owner request"] : []),
  },
  {
    operation: "DELETE:/api/csrm-assessment-requests/{id}",
    family: "assessment-requests",
    request: (f) => ({ path: `/api/csrm-assessment-requests/${encode(f.requests.owner)}`, init: { method: "DELETE" } }),
    // The birthright holds no delete grant: an owning Requestor is refused before an exact-grant analyst removes the record.
    expect: analystAndAgent(204),
    persistence: (f) => f.harness.snapshot([() => f.harness.getRequest(f.requests.owner)]),
    provenBy: { analyst: [REQUEST_DELETE_PROOF], serviceAgent: [REQUEST_WRITES_PROOF] },
    mustNotDisclose: (f, actor) => (actor === "other" || actor === "noIdentity" || actor === "noToken" ? [f.requests.owner, "Owner request"] : []),
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
    operation: "GET:/api/v1/my_requests/status_summary",
    family: "assessment-requests",
    request: () => ({ path: "/api/v1/my_requests/status_summary" }),
    expect: everyIdentity(200),
    exercisesAllowed: true,
    seeAlso: ["request-status-summary.integration.test.ts › mounted request status summary counts only the caller's own requests, for every actor"],
    ownedRecordTotal: ownedByRequestorsOnly,
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
    // The analyst alone reaches the job read, which answers an unknown job with 404 and no enumeration.
    expect: humanAnalystOnly(404),
  },
  {
    operation: "POST:/api/v1/questionnaire_generation_jobs/{jobId}/retry",
    family: "questionnaires",
    request: () => ({ path: "/api/v1/questionnaire_generation_jobs/matrix-unknown-job/retry", init: { method: "POST" } }),
    expect: humanAnalystOnly(404),
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
    expect: analystAndAgent(202),
    persistence: (f) => f.harness.snapshot([() => f.harness.getQuestionnaire(f.questionnaires.questionnaires.ownerSubmitted)]),
    provenBy: {
      analyst: ["authorization.integration.test.ts › mounted route requires a token before IdamBox authorization", DRAFT_GENERATION_PROOF],
      serviceAgent: [DRAFT_GENERATION_PROOF],
    },
    mustNotDisclose: (f, actor) => (actor === "owner" || actor === "other" || actor === "noIdentity" || actor === "noToken"
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
    // The granted actors reach the job read, which answers an unknown job with 404 and no enumeration.
    expect: analystAndAgent(404),
    seeAlso: ["assessment-workflow.integration.test.ts › mounted provider failures are safe, observable, and retryable without enumeration"],
  },
  {
    operation: "POST:/api/v1/assessment_draft_jobs/{jobId}/retry",
    family: "assessments",
    request: () => ({ path: "/api/v1/assessment_draft_jobs/matrix-unknown-job/retry", init: { method: "POST" } }),
    expect: analystAndAgent(404),
    seeAlso: ["assessment-workflow.integration.test.ts › mounted provider failures are safe, observable, and retryable without enumeration"],
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
  // ---------------------------------------------------------------- plugin routes (the residual surface, observed)
  ...otherPluginRows(),
  ...usersPermissionsAuthRows(),
  ...usersPermissionsUserRows(),
  ...usersPermissionsRoleRows(),
];
