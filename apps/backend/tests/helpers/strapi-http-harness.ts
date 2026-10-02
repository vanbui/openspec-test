import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { CSRM_ASSESSMENT_REQUEST_OPERATIONS } from "../../src/api/csrm-assessment-request/operations";
import { seedCsrmData } from "../../src/bootstrap/seed-csrm-data";

type Document = { documentId: string };
export type AdministrationFixtureKind = "risk-types" | "controls" | "information-systems" | "information-assets";
export type AssessmentJobStatus = "queued" | "running" | "completed" | "failed";
export type AssessmentJobObservation = {
  jobId: string;
  status: AssessmentJobStatus;
  attempt: number;
  observedAt: string;
  assessmentId?: string;
  failureCode?: string;
};
export type HarnessRequest = {
  path: string;
  identity?: string;
  init?: RequestInit;
  omitApiToken?: boolean;
};
type InjectableAssessmentDraftProvider = {
  generate: (...args: unknown[]) => Promise<unknown>;
};
type InjectableQuestionnaireGenerationProvider = {
  generate: (...args: unknown[]) => Promise<unknown>;
};
/** The CSRM content types a test may build fixtures of directly. */
export type CsrmFixtureUid =
  | "api::csrm-assessment-request.csrm-assessment-request"
  | "api::csrm-questionnaire.csrm-questionnaire"
  | "api::csrm-question.csrm-question"
  | "api::csrm-assessment.csrm-assessment"
  | "api::csrm-risk.csrm-risk"
  | "api::csrm-control-implementation.csrm-control-implementation"
  | "api::csrm-control.csrm-control"
  | "api::csrm-information-system.csrm-information-system";
export type QuestionnaireLifecycleAnswerState = "none" | "draft" | "submitted";
export type ReviewQueueBucketFixture = "requires-attention" | "awaiting-requestor" | "generation-in-progress" | "released";
type StrapiDocumentService = {
  create: (input: { data: Record<string, unknown> }) => Promise<Document>;
  findMany: (input: Record<string, unknown>) => Promise<Document[]>;
  findOne?: (input: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  update?: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
};
/** A route as a router module declares it, after Strapi has registered it. */
type RegisteredRoute = {
  method: string;
  path: string;
  handler: unknown;
  config?: Record<string, unknown>;
};
type RegisteredRouter = { type?: string; prefix?: string; routes: RegisteredRoute[] };
/** One route an application router mounts on the content API, at its mounted path. */
export type MountedApplicationRoute = {
  apiName: string;
  routerName: string;
  method: string;
  path: string;
  handler: string;
  config: Record<string, unknown>;
};
/** One route a plugin mounts on the content API, at its mounted path. */
export type MountedPluginRoute = {
  plugin: string;
  routerName: string;
  method: string;
  path: string;
  handler: string;
  config: Record<string, unknown>;
};
export type MountedContentApiRoutes = {
  applicationRoutes: MountedApplicationRoute[];
  pluginRoutes: MountedPluginRoute[];
  /** The content API router's koa layers, in registration order; a route layer names its methods. */
  koaLayers: Array<{ path: string; methods: string[] }>;
};
type RunningStrapi = {
  apis: Record<string, { routes: Record<string, RegisteredRouter> }>;
  plugins: Record<string, { routes: RegisteredRoute[] | Record<string, RegisteredRouter> }>;
  store: (params: { type: string; name: string }) => {
    get: (params: { key: string }) => Promise<unknown>;
    set: (params: { key: string; value: unknown }) => Promise<unknown>;
  };
  db: { query: (uid: string) => {
    createMany: (input: { data: Array<Record<string, unknown>> }) => Promise<unknown>;
    findMany: (input: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  } };
  destroy: () => Promise<void>;
  documents: (uid: string) => StrapiDocumentService;
  service: (uid: string) => unknown;
  query: (uid: string) => {
    findOne: (input: { where: Record<string, unknown> }) => Promise<{ id: number } | null>;
    findMany: (input: { where: Record<string, unknown> }) => Promise<Array<{ action: string }>>;
    create: (input: { data: Record<string, unknown> }) => Promise<unknown>;
    delete: (input: { where: Record<string, unknown> }) => Promise<unknown>;
  };
  server: {
    api: (name: "content-api" | "admin") => { listRoutes: () => Array<{ path: string; methods: string[] }> };
    app: { middleware: Array<(ctx: { get: (name: string) => string; state: Record<string, unknown> }, next: () => Promise<unknown>) => Promise<unknown>> };
    httpServer: { address: () => { port: number } | string | null };
    listen: (port: number, host: string) => Promise<void>;
  };
};

const CONTENT_API_PREFIX = "/api";

/**
 * The path a route is mounted at. Strapi registers a route that carries its own
 * `config.prefix` straight on the content API router, where only the `/api`
 * prefix applies; every other route joins a sub-router carrying the router's
 * prefix (a plugin's defaults to its name) that is then mounted under `/api`.
 * The koa router collapses a route path of `/` onto its prefix.
 */
function mountedRoutePath(route: RegisteredRoute, routerPrefix: string | undefined): string {
  const prefix = route.config !== undefined && "prefix" in route.config ? "" : (routerPrefix ?? "");
  const routePath = route.path === "/" ? "" : route.path;
  return `${CONTENT_API_PREFIX}${prefix}${routePath}`;
}

function qualifiedHandler(namespace: string, handler: unknown): string {
  if (typeof handler !== "string") return `${namespace}.<function>`;
  return handler.startsWith(namespace) ? handler : `${namespace}.${handler}`;
}

function listMountedContentApiRoutes(strapi: RunningStrapi): MountedContentApiRoutes {
  const applicationRoutes: MountedApplicationRoute[] = [];
  for (const [apiName, api] of Object.entries(strapi.apis)) {
    for (const [routerName, router] of Object.entries(api.routes)) {
      if (router.type !== "content-api") continue;
      for (const route of router.routes) {
        applicationRoutes.push({
          apiName,
          routerName,
          method: route.method.toUpperCase(),
          path: mountedRoutePath(route, router.prefix),
          handler: qualifiedHandler(`api::${apiName}`, route.handler),
          config: route.config ?? {},
        });
      }
    }
  }
  const pluginRoutes: MountedPluginRoute[] = [];
  for (const [plugin, definition] of Object.entries(strapi.plugins)) {
    // A plugin declaring a plain route array registers it on the admin API.
    if (Array.isArray(definition.routes)) continue;
    for (const [routerName, router] of Object.entries(definition.routes)) {
      if (router.type !== "content-api") continue;
      for (const route of router.routes) {
        pluginRoutes.push({
          plugin,
          routerName,
          method: route.method.toUpperCase(),
          path: mountedRoutePath(route, router.prefix ?? `/${plugin}`),
          handler: qualifiedHandler(`plugin::${plugin}`, route.handler),
          config: route.config ?? {},
        });
      }
    }
  }
  const koaLayers = strapi.server.api("content-api").listRoutes().map((layer) => ({ path: layer.path, methods: [...layer.methods] }));
  return { applicationRoutes, pluginRoutes, koaLayers };
}

// This helper is emitted to `.tmp/tests-dist/tests/helpers`, so four parents
// return to the Strapi application root in both local and CI runs.
const appDir = path.resolve(__dirname, "..", "..", "..", "..");
const databaseDir = path.join(appDir, ".tmp", "authorization-http");
const testIdentities = new Map<string, { documentId: string }>();
const observedDevelopmentIdentities = new Map<string, unknown>();

const DEVELOPMENT_PERMISSION_ACTIONS = [
  "api::csrm-assessment-request.csrm-assessment-request.find",
  "api::csrm-assessment-request.csrm-assessment-request.findOne",
  "api::csrm-assessment-request.csrm-assessment-request.create",
  "api::csrm-assessment-request.csrm-assessment-request.update",
  "api::csrm-information-system.csrm-information-system.find",
  "api::csrm-information-asset.csrm-information-asset.find",
  "api::csrm-questionnaire.csrm-questionnaire.listMine",
  "api::csrm-questionnaire.csrm-questionnaire.statusSummary",
  "api::csrm-questionnaire.csrm-questionnaire.listAll",
  "api::csrm-questionnaire.csrm-questionnaire.reviewSummary",
  "api::csrm-questionnaire.csrm-questionnaire.findWorkflowOne",
  "api::csrm-questionnaire.csrm-questionnaire.listQuestions",
] as const;

function testIdentityMiddleware() {
  return async (ctx: { get: (name: string) => string; state: Record<string, unknown> }, next: () => Promise<unknown>) => {
    const identity = testIdentities.get(ctx.get("x-csrm-test-identity"));
    if (identity) {
      ctx.state.idamboxUser = identity;
    }
    await next();
    const developmentEmail = ctx.get("x-csrm-dev-identity");
    if (developmentEmail) {
      observedDevelopmentIdentities.set(developmentEmail, ctx.state.idamboxUser);
    }
  };
}

/** The sentinel header that makes the test-only internal-error middleware throw. */
export const INTERNAL_ERROR_HEADER = "x-csrm-test-internal-error";

/*
 * Phase 8 D-38: a test-only middleware that throws a plain Error for a request
 * carrying the sentinel header and is inert otherwise. It is pushed onto the
 * Koa stack before `listen`, so it sits after every configured middleware
 * (`strapi::errors` and `strapi::security` included) and before the router that
 * `listen` mounts: the error is formatted by Strapi's own error middleware, not
 * by Koa's default handler. Nothing of this exists in apps/backend/src.
 */
function internalErrorMiddleware() {
  return async (ctx: { get: (name: string) => string; state: Record<string, unknown> }, next: () => Promise<unknown>) => {
    if (ctx.get(INTERNAL_ERROR_HEADER) === "1") {
      throw new Error("injected internal failure with an internal detail no client may read");
    }
    await next();
  };
}

async function createDocument(
  strapi: RunningStrapi,
  uid: string,
  data: Record<string, unknown>,
): Promise<Document> {
  return strapi.documents(uid).create({ data });
}

/*
 * Every questionnaire fixture a Requestor route reads must carry the release
 * facts, because a generated questionnaire is analyst-only until an explicit
 * Analyst release. The governance fixtures below are the deliberate exception:
 * one of them stays unreleased so the denial can be proved.
 */
function releaseFacts(analystDocumentId: string, at = "2026-08-15T00:00:00.000Z") {
  return {
    releasedAt: at,
    releasedBy: analystDocumentId,
    governanceLog: [{ schemaVersion: 1, kind: "released", at, by: analystDocumentId }],
  };
}

export type AuthorizationHttpHarness = {
  baseUrl: string;
  identities: { owner: string; otherRequestor: string; analyst: string; analystAgent: string; serviceAnalystAgent: string; inactiveAnalyst: string };
  developmentEmails: { jane: string; bob: string; inactive: string; unknown: string };
  users: { owner: string; otherRequestor: string; analyst: string; serviceAnalystAgent: string };
  requests: { owner: string; otherRequestor: string };
  seedRequestWorkflowFixtures: () => Promise<{
    requests: { editable: string; submitted: string; transition: string; illegalTransition: string };
    relations: { informationSystem: string; informationAsset: string; questionnaire: string; assessment: string };
  }>;
  seedQuestionnaireWorkflowFixtures: () => Promise<{
    questionnaires: { ownerDraft: string; ownerSubmitted: string; otherDraft: string };
    requests: { ownerDraft: string; ownerSubmitted: string; otherDraft: string };
    questions: { ownerDraft: string; ownerSubmitted: string; otherDraft: string };
  }>;
  seedQuestionnaireGovernanceFixtures: () => Promise<{
    questionnaires: { unreleased: string; released: string; returnable: string; editable: string; gated: string; timeline: string; schema: string };
    requests: { unreleased: string; released: string; returnable: string; editable: string; gated: string; timeline: string; schema: string };
    questions: { unreleased: string; released: string; returnable: string; editable: string; gated: string; timeline: string; schema: string };
  }>;
  seedConditionalQuestionnaireFixture: () => Promise<{
    questionnaire: string;
    questions: { controller: string; dependent: string };
  }>;
  seedConcurrentQuestionnaireFixtures: () => Promise<{
    patchPatch: { questionnaire: string; request: string; questions: { first: string; second: string } };
    patchSubmit: { questionnaire: string; request: string; questions: { first: string; second: string } };
  }>;
  seedAssessmentWorkflowFixtures: () => Promise<{
    releaseFacts: {
      unreleased: string;
      approvedOnly: string;
      approverOnly: string;
      approvalDateOnly: string;
      approvedAndApprover: string;
      approvedAndApprovalDate: string;
      approverAndApprovalDate: string;
      complete: string;
      crossOwnerComplete: string;
    };
    requests: { complete: string; crossOwnerComplete: string; concurrent: string };
    aggregate: {
      request: string;
      assessment: string;
      risk: string;
      controlImplementation: string;
      riskType: string;
      control: string;
    };
    concurrency: { request: string; assessment: string };
    jobTargets: { completed: string; providerFailure: string; providerFailureCode: string; writeFailure: string; zeroMapping: string };
  }>;
  seedAdministrationFixtures: () => Promise<{
    riskTypes: { update: string; unchanged: string };
    controls: { update: string; unchanged: string };
    informationSystems: { update: string; unchanged: string };
    informationAssets: { update: string; unchanged: string };
  }>;
  request: (request: HarnessRequest) => Promise<Response>;
  simultaneousRequests: (requests: readonly HarnessRequest[]) => Promise<Response[]>;
  recordJobObservation: (observation: AssessmentJobObservation) => void;
  getJobObservations: (jobId?: string) => readonly AssessmentJobObservation[];
  withProviderFailure: <T>(action: () => Promise<T>) => Promise<T>;
  withProviderFailureCode: <T>(code: string, safeMessage: string, action: () => Promise<T>) => Promise<T>;
  withDocumentWriteFailure: <T>(uid: string, operation: "create" | "update", failAt: number, action: () => Promise<T>) => Promise<T>;
  withQuestionUpdateFailure: <T>(failAt: number, action: () => Promise<T>) => Promise<T>;
  countRequestsForUser: (userDocumentId: string) => Promise<number>;
  developmentPermissionActions: readonly string[];
  getObservedDevelopmentIdentity: (email: string) => unknown;
  getPublicPermissionActions: () => Promise<string[]>;
  ensurePublicPermission: (action: string) => Promise<void>;
  reconcileDevelopmentPermissions: () => Promise<readonly string[]>;
  seedDevelopmentApiToken: () => Promise<void>;
  getDevelopmentApiTokens: () => Promise<Array<Record<string, unknown>>>;
  clearDevelopmentApiTokens: () => Promise<void>;
  hashApiToken: (value: string) => string;
  withDevelopmentEnvironment: <T>(nodeEnv: string | undefined, environment: string | undefined, flag: string | undefined, action: () => Promise<T>) => Promise<T>;
  getRequest: (documentId: string) => Promise<Record<string, unknown> | null>;
  getQuestionnaire: (documentId: string) => Promise<Record<string, unknown> | null>;
  getQuestion: (documentId: string) => Promise<Record<string, unknown> | null>;
  getAssessment: (documentId: string) => Promise<Record<string, unknown> | null>;
  getRisk: (documentId: string) => Promise<Record<string, unknown> | null>;
  getControlImplementation: (documentId: string) => Promise<Record<string, unknown> | null>;
  countRisksForAssessment: (assessmentDocumentId: string) => Promise<number>;
  countControlImplementationsForRisk: (riskDocumentId: string) => Promise<number>;
  createUserFixture: (data: { email: string; username: string; displayName: string; accountStatus: "active" | "inactive" }) => Promise<string>;
  /** Creates one document of a CSRM content type through the Document Service and returns its documentId. */
  createFixtureDocument: (uid: CsrmFixtureUid, data: Record<string, unknown>) => Promise<string>;
  createAssessmentRequestFixture: (data: {
    requestNumber: string;
    title: string;
    requestStatus: string;
    requestor: "owner" | "otherRequestor";
    dueDate?: string | null;
    submittedDate?: string | null;
  }) => Promise<string>;
  /**
   * Links a questionnaire to the request, released by the analyst when asked,
   * with one question carrying a draft or submitted answer unless the state is
   * "none", in which case the questionnaire has no questions.
   */
  createQuestionnaireLifecycleFixture: (input: {
    requestDocumentId: string;
    released: boolean;
    answerState: QuestionnaireLifecycleAnswerState;
  }) => Promise<{ questionnaire: string; question: string | null }>;
  /** The request with every relation the lifecycle rule reads, fully populated. */
  getRequestLifecycleDocument: (documentId: string) => Promise<Record<string, unknown> | null>;
  /**
   * Inserts submitted requests with no relations straight through the query
   * layer, in index order, each with a later submittedDate than the last. Returns
   * their request numbers in that order.
   */
  seedReviewableRequestsDirectly: (count: number, prefix: string) => Promise<{ requestNumbers: readonly string[] }>;
  /**
   * Queues questionnaire generation for the request as the analyst and holds the
   * deterministic provider until `action` settles, so the job stays active for
   * exactly that long. The job is then released and followed to completion, or
   * to the failure `expectedStatus` names. `replaceUnansweredQuestionnaire`
   * queues an acknowledged replacement; `action` receives the job's id.
   */
  withHeldQuestionnaireGeneration: <T>(
    requestDocumentId: string,
    action: (jobId: string) => Promise<T>,
    options?: { replaceUnansweredQuestionnaire?: boolean; expectedStatus?: "completed" | "failed" },
  ) => Promise<T>;
  /** Counts a review queue through the running application's own shared bucket counter. */
  countReviewQueueBucketFixture: (bucket: ReviewQueueBucketFixture, activeIds: readonly string[]) => Promise<number>;
  createAssessmentFixture: (data: {
    assessmentNumber: string;
    assessmentStatus: string;
    assessmentRequest: string;
    summary?: string;
  }) => Promise<string>;
  setRiskOwnerFixture: (riskDocumentId: string, ownerDocumentId: string) => Promise<void>;
  /**
   * Moves a request fixture to a workflow status directly. The request routes never set a status past
   * submission (T-08-A2): the questionnaire, draft and release workflows do, so a fixture set up at a
   * later step is written here, through the Document Service.
   */
  setRequestStatusFixture: (requestDocumentId: string, requestStatus: string) => Promise<void>;
  setUserAccountStatusFixture: (userDocumentId: string, accountStatus: "active" | "inactive") => Promise<void>;
  createRiskRegisterFixture: (assessmentDocumentId: string, data: Record<string, unknown>) => Promise<string>;
  createRiskRegisterMitigationFixture: (riskDocumentId: string, controlDocumentId: string, controlStatus: string) => Promise<string>;
  getAdministrationRecord: (kind: AdministrationFixtureKind, documentId: string) => Promise<Record<string, unknown> | null>;
  countAdministrationRecords: (kind: AdministrationFixtureKind) => Promise<number>;
  seedRiskTypesDirectly: (count: number, prefix: string) => Promise<{ targetName: string }>;
  createCsvMultipart: (input: { filename: string; bytes: Uint8Array; digest?: string; confirmed?: boolean }) => FormData;
  /**
   * The content API as the running instance mounts it: every application
   * router's routes, every plugin's content-api routes and the koa layers that
   * prove each path and method is mounted once, all at their mounted paths.
   */
  listMountedContentApiRoutes: () => MountedContentApiRoutes;
  /** The users-permissions `advanced` plugin store, as its bootstrap and this application's leave it. */
  readUsersPermissionsAdvancedSettings: () => Promise<Record<string, unknown> | null>;
  /** How many users-permissions accounts exist; CSRM never creates one, so a registration probe must leave it unchanged. */
  countUsersPermissionsUsers: () => Promise<number>;
  /** Reads every getter at once: the before and after halves of a persistence comparison around a denied mutation. */
  snapshot: (getters: ReadonlyArray<() => Promise<unknown>>) => Promise<unknown[]>;
  close: () => Promise<void>;
};

export type AuthorizationHttpHarnessOptions = {
  /** Install the D-38 internal-error middleware, which throws for a request carrying INTERNAL_ERROR_HEADER. */
  internalErrorMiddleware?: boolean;
  /**
   * The CSRM_CORS_ALLOWED_ORIGINS value this instance boots with (R-08-11). Every harness pins it, so a
   * value in the developer's .env never reaches a test; left out, it is empty, the configured default.
   */
  corsAllowedOrigins?: string;
  /**
   * Boot with Keycloak access-token verification on (docs/adr/0004) against this issuer, whose
   * JWKS the test serves, and link the seeded people to `keycloakSubjects`. Left out, it is off.
   */
  keycloakTokenVerification?: { issuer: string; clientId: string };
};

/** The Keycloak subjects a token-verification harness links to the seeded IdamBox Users. */
export const keycloakSubjects = Object.freeze({
  owner: "kc-subject-jane",
  analyst: "kc-subject-bob",
  inactiveAnalyst: "kc-subject-inactive",
  serviceAnalystAgent: "kc-subject-service-agent",
});

export async function startAuthorizationHttpHarness(options: AuthorizationHttpHarnessOptions = {}): Promise<AuthorizationHttpHarness> {
  const originalEnvironment = new Map(
    ["NODE_ENV", "CSRM_ENVIRONMENT", "CSRM_DEV_IDENTITY", "CSRM_DEV_API_TOKEN", "IDAMBOX_SEED_CORE", "CSRM_AI_PROVIDER", "CSRM_CORS_ALLOWED_ORIGINS", "IDAMBOX_KEYCLOAK_PROVISIONING", "IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION", "KEYCLOAK_ISSUER", "KEYCLOAK_TOKEN_CLIENT_ID"]
      .map((name) => [name, process.env[name]] as const),
  );
  await mkdir(databaseDir, { recursive: true });
  const databaseFilename = path.join(databaseDir, `authorization-${process.pid}.sqlite`);
  await rm(databaseFilename, { force: true });

  process.env.APP_KEYS = "authorization-test-key-1,authorization-test-key-2";
  process.env.ADMIN_JWT_SECRET = "authorization-test-admin-jwt-secret";
  process.env.API_TOKEN_SALT = "authorization-test-api-token-salt";
  process.env.TRANSFER_TOKEN_SALT = "authorization-test-transfer-token-salt";
  process.env.ENCRYPTION_KEY = "authorization-test-encryption-key";
  process.env.JWT_SECRET = "authorization-test-jwt-secret";
  process.env.DATABASE_CLIENT = "sqlite";
  // Strapi's SQLite config resolves this value from the app root, so retain a
  // relative filename on Windows rather than passing an already-absolute path.
  process.env.DATABASE_FILENAME = path.relative(appDir, databaseFilename);
  process.env.IDAMBOX_SEED_CSRM = "false";
  process.env.IDAMBOX_SEED_CORE = "false";
  delete process.env.CSRM_DEV_API_TOKEN;
  process.env.csrmAppIsEnabled = "true";
  process.env.CSRM_AI_PROVIDER = "deterministic";
  process.env.CSRM_CORS_ALLOWED_ORIGINS = options.corsAllowedOrigins ?? "";
  process.env.STRAPI_DISABLE_UPDATE_NOTIFICATION = "true";
  // Tests never reach Keycloak, whatever the developer .env enables.
  process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "false";
  process.env.IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION = options.keycloakTokenVerification ? "true" : "false";
  if (options.keycloakTokenVerification) {
    process.env.KEYCLOAK_ISSUER = options.keycloakTokenVerification.issuer;
    process.env.KEYCLOAK_TOKEN_CLIENT_ID = options.keycloakTokenVerification.clientId;
  }

  // The public package exports are intentionally loaded dynamically because its
  // declaration surface re-exports Core but does not declare these runtime helpers.
  const strapiPackage = require("@strapi/strapi") as {
    compileStrapi: (options: { appDir: string }) => Promise<{ appDir: string; distDir: string }>;
    createStrapi: (options: { appDir: string; distDir: string }) => RunningStrapi & { load: () => Promise<RunningStrapi> };
  };
  const compiled = await strapiPackage.compileStrapi({ appDir });
  const strapi = await strapiPackage.createStrapi(compiled).load();
  const apiTokenService = strapi.service("admin::api-token-content-api") as {
    create: (attributes: { name: string; description: string; type: "full-access"; lifespan: null }) => Promise<{ accessKey: string }>;
  };
  const apiToken = await apiTokenService.create({
    name: `Mounted HTTP harness ${process.pid}`,
    description: "Isolated mounted HTTP test credential",
    type: "full-access",
    lifespan: null,
  });
  const authorizationHeader = { Authorization: `Bearer ${apiToken.accessKey}` };

  // Internal scheduled jobs (admin metrics, telemetry pings) reference the
  // global `strapi` binding, which is gone once the harness destroys this
  // instance; a job firing then crashes the whole test process. Cancel every
  // scheduled job up front — none is needed for authorization coverage.
  (strapi as unknown as { cron?: { destroy?: () => void } }).cron?.destroy?.();

  // Seed the production Role -> Function -> FunctionAPI catalogue into this
  // isolated database. It is deliberately invoked after load so no test-only
  // identity can affect the application bootstrap.
  process.env.IDAMBOX_SEED_CSRM = "true";
  await seedCsrmData(strapi as never);
  process.env.IDAMBOX_SEED_CSRM = "false";
  process.env.NODE_ENV = "development";
  process.env.CSRM_ENVIRONMENT = "development";
  process.env.CSRM_DEV_IDENTITY = "true";

  // Insert only in the harness' Koa pipeline before the mounted router. This
  // never changes application source or runtime configuration.
  strapi.server.app.middleware.unshift(testIdentityMiddleware());
  // Koa composes app.middleware when the server starts listening, and `listen`
  // mounts the router last, so a push here lands after every configured
  // middleware and before the routes.
  if (options.internalErrorMiddleware) {
    strapi.server.app.middleware.push(internalErrorMiddleware());
  }

  const publicRole = await strapi.query("plugin::users-permissions.role").findOne({
    where: { type: "public" },
  });
  assert.ok(publicRole, "The users-permissions public role must exist in the test app");
  const permissionStore = strapi.query("plugin::users-permissions.permission");
  const getPublicPermissionActions = async () =>
    (await permissionStore.findMany({ where: { role: publicRole.id } }))
      .map((permission) => permission.action)
      .sort();
  const roleService = strapi.documents("api::role.role");
  const roles = await roleService.findMany({
    filters: { name: { $in: ["Requestor", "Security Analyst", "Security Analyst Agent"] } },
    limit: 10,
  }) as Array<Document & { name: string }>;
  const roleByName = new Map(roles.map((role) => [role.name, role]));
  const requestorRole = roleByName.get("Requestor");
  const analystRole = roleByName.get("Security Analyst");
  const analystAgentRole = roleByName.get("Security Analyst Agent");
  assert.ok(requestorRole && analystRole && analystAgentRole, "seeded CSRM roles must exist");
  const userService = strapi.documents("api::idambox-user.idambox-user") as StrapiDocumentService & {
    update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
  };
  const [owner] = await userService.findMany({
    filters: { email: { $eq: "jane.doe@idambox.com" } },
    limit: 1,
  });
  const [analyst] = await userService.findMany({
    filters: { email: { $eq: "bob.doe@idambox.com" } },
    limit: 1,
  });
  assert.ok(owner && analyst, "seeded Jane and Bob identities must exist");
  const otherRequestor = await createDocument(strapi, "api::idambox-user.idambox-user", {
    email: "other@example.test",
    username: "other",
    displayName: "Other",
    accountStatus: "active",
  });
  await userService.update({ documentId: owner.documentId, data: { roles: [requestorRole.documentId] } });
  await userService.update({ documentId: otherRequestor.documentId, data: { roles: [requestorRole.documentId] } });
  // This analyst-named identity has no explicit analyst role. It retains only
  // the implicit Requestor birthright so non-owner cases prove a role label
  // cannot substitute for an exact FunctionAPI grant.
  const analystAgent = await createDocument(strapi, "api::idambox-user.idambox-user", { email: "agent@example.test", username: "agent", displayName: "Analyst Agent", accountStatus: "active", roles: [] });
  const serviceAnalystAgent = await createDocument(strapi, "api::idambox-user.idambox-user", {
    email: "service-agent@example.test",
    username: "service-agent",
    displayName: "Security Analyst Agent",
    accountStatus: "active",
    roles: [analystAgentRole.documentId],
  });
  const inactiveAnalyst = await createDocument(strapi, "api::idambox-user.idambox-user", { email: "inactive@idambox.com", username: "inactive", displayName: "Inactive Analyst", accountStatus: "inactive", roles: [analystRole.documentId] });

  const ownerRequest = await createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "AUTH-OWNER-001",
    title: "Owner request",
    requestStatus: "draft",
    requestor: owner.documentId,
  });
  const otherRequest = await createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "AUTH-OTHER-001",
    title: "Other request",
    requestStatus: "draft",
    requestor: otherRequestor.documentId,
  });
  if (options.keycloakTokenVerification) {
    const links: Array<[string, string]> = [
      [owner.documentId, keycloakSubjects.owner],
      [analyst.documentId, keycloakSubjects.analyst],
      [inactiveAnalyst.documentId, keycloakSubjects.inactiveAnalyst],
      [serviceAnalystAgent.documentId, keycloakSubjects.serviceAnalystAgent],
    ];
    for (const [documentId, externalSubject] of links) await userService.update({ documentId, data: { externalSubject } });
  }
  testIdentities.set("owner", { documentId: owner.documentId });
  testIdentities.set("other", { documentId: otherRequestor.documentId });
  testIdentities.set("analyst", { documentId: analyst.documentId });
  testIdentities.set("agent", { documentId: analystAgent.documentId });
  testIdentities.set("service-agent", { documentId: serviceAnalystAgent.documentId });
  testIdentities.set("inactive", { documentId: inactiveAnalyst.documentId });

  await new Promise<void>((resolve, reject) => {
    const server = strapi.server.httpServer as unknown as {
      once: (event: "error" | "listening", listener: (error?: Error) => void) => void;
    };
    server.once("error", reject);
    server.once("listening", () => resolve());
    strapi.server.listen(0, "127.0.0.1");
  });
  const address = strapi.server.httpServer.address();
  assert.ok(address && typeof address !== "string", "Strapi must listen on a loopback port");

  let workflowFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedRequestWorkflowFixtures"]>> | null = null;
  let questionnaireFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedQuestionnaireWorkflowFixtures"]>> | null = null;
  let questionnaireGovernanceFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedQuestionnaireGovernanceFixtures"]>> | null = null;
  let conditionalQuestionnaireFixture: Awaited<ReturnType<AuthorizationHttpHarness["seedConditionalQuestionnaireFixture"]>> | null = null;
  let concurrentQuestionnaireFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedConcurrentQuestionnaireFixtures"]>> | null = null;
  let assessmentWorkflowFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedAssessmentWorkflowFixtures"]>> | null = null;
  let administrationFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedAdministrationFixtures"]>> | null = null;
  let lifecycleQuestionnaireSequence = 0;
  const jobObservations: AssessmentJobObservation[] = [];

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    identities: { owner: "owner", otherRequestor: "other", analyst: "analyst", analystAgent: "agent", serviceAnalystAgent: "service-agent", inactiveAnalyst: "inactive" },
    developmentEmails: { jane: "jane.doe@idambox.com", bob: "bob.doe@idambox.com", inactive: "inactive@idambox.com", unknown: "unknown@idambox.com" },
    users: {
      owner: owner.documentId,
      otherRequestor: otherRequestor.documentId,
      analyst: analyst.documentId,
      serviceAnalystAgent: serviceAnalystAgent.documentId,
    },
    requests: { owner: ownerRequest.documentId, otherRequestor: otherRequest.documentId },
    async seedRequestWorkflowFixtures() {
      if (workflowFixtures) return workflowFixtures;

      const [editable, submitted, transition, illegalTransition, informationSystem, informationAsset, questionnaire, assessment] = await Promise.all([
        createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: "WORKFLOW-EDIT-001", title: "Editable request", requestStatus: "draft", requestor: owner.documentId,
        }),
        createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: "WORKFLOW-SUBMITTED-001", title: "Submitted request", requestStatus: "submitted",
          submittedDate: "2026-01-02T03:04:05.000Z", requestor: owner.documentId,
        }),
        createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: "WORKFLOW-TRANSITION-001", title: "Transition request", requestStatus: "draft", requestor: owner.documentId,
        }),
        createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: "WORKFLOW-ILLEGAL-001", title: "Illegal transition request", requestStatus: "draft", requestor: owner.documentId,
        }),
        createDocument(strapi, "api::csrm-information-system.csrm-information-system", { name: "Workflow system" }),
        createDocument(strapi, "api::csrm-information-asset.csrm-information-asset", { name: "Workflow asset" }),
        createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", { title: "Forged questionnaire" }),
        createDocument(strapi, "api::csrm-assessment.csrm-assessment", {
          assessmentNumber: "WORKFLOW-ASSESSMENT-001", assessmentStatus: "draft",
        }),
      ]);
      workflowFixtures = {
        requests: {
          editable: editable.documentId,
          submitted: submitted.documentId,
          transition: transition.documentId,
          illegalTransition: illegalTransition.documentId,
        },
        relations: {
          informationSystem: informationSystem.documentId,
          informationAsset: informationAsset.documentId,
          questionnaire: questionnaire.documentId,
          assessment: assessment.documentId,
        },
      };
      return workflowFixtures;
    },
    async seedQuestionnaireWorkflowFixtures() {
      if (questionnaireFixtures) return questionnaireFixtures;

      const [ownerDraftRequest, ownerSubmittedRequest, otherDraftRequest] = await Promise.all([
        createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: "QUESTIONNAIRE-OWNER-DRAFT-001", title: "Owner draft questionnaire request",
          requestStatus: "questionnaire-in-progress", requestor: owner.documentId,
        }),
        createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: "QUESTIONNAIRE-OWNER-SUBMITTED-001", title: "Owner submitted questionnaire request",
          requestStatus: "questionnaire-in-progress", requestor: owner.documentId,
        }),
        createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: "QUESTIONNAIRE-OTHER-DRAFT-001", title: "Other draft questionnaire request",
          requestStatus: "questionnaire-in-progress", requestor: otherRequestor.documentId,
        }),
      ]);
      const [ownerDraft, ownerSubmitted, otherDraft] = await Promise.all([
        createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", {
          questionnaireNumber: "QUES-OWNER-DRAFT-001", title: "Owner draft questionnaire",
          description: "Owner-only draft", assessmentRequest: ownerDraftRequest.documentId,
          ...releaseFacts(analyst.documentId),
        }),
        createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", {
          questionnaireNumber: "QUES-OWNER-SUBMITTED-001", title: "Owner submitted questionnaire",
          description: "Submitted for analyst review", assessmentRequest: ownerSubmittedRequest.documentId,
          ...releaseFacts(analyst.documentId),
        }),
        // Released, so the cross-owner denials stay proved by ownership rather
        // than by an incidentally absent release fact.
        createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", {
          questionnaireNumber: "QUES-OTHER-DRAFT-001", title: "Other Requestor questionnaire",
          description: "Must never leak to Jane", assessmentRequest: otherDraftRequest.documentId,
          ...releaseFacts(analyst.documentId),
        }),
      ]);
      const options = (questionKey: string) => ({
        schemaVersion: 1,
        questionKey,
        section: { key: "context", title: "Context", order: 1 },
        order: 1,
        required: true,
      });
      const draftAnswer = (value: string) => ({
        schemaVersion: 1, value, state: "draft", updatedAt: "2026-08-01T00:00:00.000Z",
      });
      const submittedAnswer = {
        schemaVersion: 1, value: "Submitted owner answer", state: "submitted",
        updatedAt: "2026-08-02T00:00:00.000Z", submittedAt: "2026-08-02T00:00:00.000Z",
      };
      const [ownerDraftQuestion, ownerSubmittedQuestion, otherDraftQuestion] = await Promise.all([
        createDocument(strapi, "api::csrm-question.csrm-question", {
          questionText: "Owner draft question", answerType: "Text", options: options("owner-draft"),
          answer: draftAnswer("Jane secret draft"), questionnaire: ownerDraft.documentId,
        }),
        createDocument(strapi, "api::csrm-question.csrm-question", {
          questionText: "Owner submitted question", answerType: "Text", options: options("owner-submitted"),
          answer: submittedAnswer, questionnaire: ownerSubmitted.documentId,
        }),
        createDocument(strapi, "api::csrm-question.csrm-question", {
          questionText: "Other draft question", answerType: "Text", options: options("other-draft"),
          answer: draftAnswer("Other Requestor secret draft"), questionnaire: otherDraft.documentId,
        }),
      ]);

      questionnaireFixtures = {
        questionnaires: {
          ownerDraft: ownerDraft.documentId,
          ownerSubmitted: ownerSubmitted.documentId,
          otherDraft: otherDraft.documentId,
        },
        questions: {
          ownerDraft: ownerDraftQuestion.documentId,
          ownerSubmitted: ownerSubmittedQuestion.documentId,
          otherDraft: otherDraftQuestion.documentId,
        },
        requests: {
          ownerDraft: ownerDraftRequest.documentId,
          ownerSubmitted: ownerSubmittedRequest.documentId,
          otherDraft: otherDraftRequest.documentId,
        },
      };
      return questionnaireFixtures;
    },
    /*
     * Governance fixtures live in their own seeder rather than joining the
     * shared questionnaire workflow fixtures, because one of them must stay
     * unreleased while every other owner-reachable fixture is released. Only
     * the governance test seeds them, so no other file's counts move.
     */
    async seedQuestionnaireGovernanceFixtures() {
      if (questionnaireGovernanceFixtures) return questionnaireGovernanceFixtures;

      const seed = async (suffix: string, title: string, released: boolean) => {
        const assessmentRequest = await createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: `QUESTIONNAIRE-GOVERNANCE-${suffix}`,
          title: `Governance questionnaire request ${suffix}`,
          requestStatus: "questionnaire-in-progress",
          requestor: owner.documentId,
        });
        const questionnaire = await createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", {
          questionnaireNumber: `QUES-GOVERNANCE-${suffix}`,
          title,
          description: "Governance fixture",
          assessmentRequest: assessmentRequest.documentId,
          ...(released ? releaseFacts(analyst.documentId) : {}),
        });
        const question = await createDocument(strapi, "api::csrm-question.csrm-question", {
          questionText: `Governance question ${suffix}`,
          answerType: "Text",
          options: {
            schemaVersion: 1,
            questionKey: `governance-${suffix.toLowerCase()}`,
            section: { key: "context", title: "Context", order: 1 },
            order: 1,
            required: true,
          },
          answer: null,
          questionnaire: questionnaire.documentId,
        });
        return {
          questionnaire: questionnaire.documentId,
          request: assessmentRequest.documentId,
          question: question.documentId,
        };
      };
      const unreleased = await seed("UNRELEASED", "Governance unreleased questionnaire", false);
      const released = await seed("RELEASED", "Governance released questionnaire", true);
      const returnable = await seed("RETURNABLE", "Governance returnable questionnaire", false);
      const editable = await seed("EDITABLE", "Governance editable questionnaire", false);
      // Stays released for the whole run: the question-mutation gate needs a
      // questionnaire no other test returns to review.
      const gated = await seed("GATED", "Governance released and untouched questionnaire", true);
      const timeline = await seed("TIMELINE", "Governance timeline questionnaire", false);
      // Dedicated to schema-shape assertions: never released/returned by any
      // other test, so its release and return-to-review responses are each
      // exercised exactly once, independent of other tests' execution order.
      const schema = await seed("SCHEMA", "Governance schema questionnaire", false);
      questionnaireGovernanceFixtures = {
        questionnaires: { unreleased: unreleased.questionnaire, released: released.questionnaire, returnable: returnable.questionnaire, editable: editable.questionnaire, gated: gated.questionnaire, timeline: timeline.questionnaire, schema: schema.questionnaire },
        requests: { unreleased: unreleased.request, released: released.request, returnable: returnable.request, editable: editable.request, gated: gated.request, timeline: timeline.request, schema: schema.request },
        questions: { unreleased: unreleased.question, released: released.question, returnable: returnable.question, editable: editable.question, gated: gated.question, timeline: timeline.question, schema: schema.question },
      };
      return questionnaireGovernanceFixtures;
    },
    async seedConditionalQuestionnaireFixture() {
      if (conditionalQuestionnaireFixture) return conditionalQuestionnaireFixture;

      const assessmentRequest = await createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: "QUESTIONNAIRE-CONDITIONAL-001",
        title: "Conditional questionnaire request",
        requestStatus: "questionnaire-in-progress",
        requestor: owner.documentId,
      });
      const questionnaire = await createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", {
        questionnaireNumber: "QUES-CONDITIONAL-001",
        title: "Conditional questionnaire",
        description: "Exercises a hidden required branch",
        assessmentRequest: assessmentRequest.documentId,
        ...releaseFacts(analyst.documentId),
      });
      const section = { key: "exposure", title: "Exposure", order: 1 };
      const [controller, dependent] = await Promise.all([
        createDocument(strapi, "api::csrm-question.csrm-question", {
          questionText: "Is the service internet facing?",
          answerType: "Boolean",
          options: { schemaVersion: 1, questionKey: "internet-facing", section, order: 1, required: true },
          answer: null,
          questionnaire: questionnaire.documentId,
        }),
        createDocument(strapi, "api::csrm-question.csrm-question", {
          questionText: "Describe the public exposure",
          answerType: "Text",
          options: {
            schemaVersion: 1,
            questionKey: "exposure-detail",
            section,
            order: 2,
            required: true,
            visibility: { questionKey: "internet-facing", operator: "equals", value: true },
          },
          answer: {
            schemaVersion: 1,
            value: "stale hidden value",
            state: "draft",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
          questionnaire: questionnaire.documentId,
        }),
      ]);
      conditionalQuestionnaireFixture = {
        questionnaire: questionnaire.documentId,
        questions: { controller: controller.documentId, dependent: dependent.documentId },
      };
      return conditionalQuestionnaireFixture;
    },
    async seedConcurrentQuestionnaireFixtures() {
      if (concurrentQuestionnaireFixtures) return concurrentQuestionnaireFixtures;

      const createFixture = async (suffix: string) => {
        const assessmentRequest = await createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: `QUESTIONNAIRE-CONCURRENT-${suffix}`,
          title: `Concurrent questionnaire request ${suffix}`,
          requestStatus: "questionnaire-in-progress",
          requestor: owner.documentId,
        });
        const questionnaire = await createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", {
          questionnaireNumber: `QUES-CONCURRENT-${suffix}`,
          title: `Concurrent questionnaire ${suffix}`,
          assessmentRequest: assessmentRequest.documentId,
          ...releaseFacts(analyst.documentId),
        });
        const section = { key: "concurrency", title: "Concurrency", order: 1 };
        const [first, second] = await Promise.all([
          createDocument(strapi, "api::csrm-question.csrm-question", {
            questionText: "First concurrent answer",
            answerType: "Text",
            options: { schemaVersion: 1, questionKey: "first", section, order: 1, required: true },
            answer: null,
            questionnaire: questionnaire.documentId,
          }),
          createDocument(strapi, "api::csrm-question.csrm-question", {
            questionText: "Second concurrent answer",
            answerType: "Text",
            options: { schemaVersion: 1, questionKey: "second", section, order: 2, required: true },
            answer: null,
            questionnaire: questionnaire.documentId,
          }),
        ]);
        return { questionnaire: questionnaire.documentId, request: assessmentRequest.documentId, questions: { first: first.documentId, second: second.documentId } };
      };

      concurrentQuestionnaireFixtures = {
        patchPatch: await createFixture("PATCH-PATCH"),
        patchSubmit: await createFixture("PATCH-SUBMIT"),
      };
      return concurrentQuestionnaireFixtures;
    },
    async seedAssessmentWorkflowFixtures() {
      if (assessmentWorkflowFixtures) return assessmentWorkflowFixtures;

      const riskType = await createDocument(strapi, "api::csrm-risk-type.csrm-risk-type", {
        name: "Mounted Internet Exposure",
        description: "Reusable mounted risk type for assessment workflow security tests",
      });
      const control = await createDocument(strapi, "api::csrm-control.csrm-control", {
        controlNumber: "MOUNTED-CTRL-001",
        name: "Mounted boundary protection",
        description: "Reusable control definition linked by contextual implementations",
        controlType: "Preventive",
        framework: "Mounted test framework",
        frameworkVersion: "1",
      });
      await Promise.all(["Internet Exposure", "Personal Information Handling", "Third-Party Dependency"].map((name) =>
        createDocument(strapi, "api::csrm-risk-type.csrm-risk-type", {
          name,
          description: `Mounted deterministic ${name}`,
          applicableControls: [control.documentId],
        })));

      const createReleaseFixture = async (
        suffix: string,
        requestorDocumentId: string,
        facts: { approved: boolean; approvedBy: boolean; approvalDate: boolean },
      ) => {
        const request = await createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: `ASSESSMENT-RELEASE-${suffix}`,
          title: `Assessment release fixture ${suffix}`,
          requestStatus: facts.approved ? "approved" : "under-review",
          requestor: requestorDocumentId,
        });
        const assessment = await createDocument(strapi, "api::csrm-assessment.csrm-assessment", {
          assessmentNumber: `ASM-2026-${suffix}`,
          assessmentStatus: facts.approved ? "approved" : "in-review",
          summary: `Assessment release fixture ${suffix}`,
          overallRating: "Moderate",
          overallControlEffectiveness: "Partially Effective",
          recommendationsSummary: "Review the mounted mitigation",
          overallRiskRationale: "Mounted release boundary coverage",
          assessmentRequest: request.documentId,
          ...(facts.approvedBy ? { approvedBy: analyst.documentId } : {}),
          // The release transition writes approvalDate and assessmentDate in the
          // same update, so a fixture carrying one without the other is a state
          // production cannot reach.
          ...(facts.approvalDate
            ? { approvalDate: "2026-08-30T00:00:00.000Z", assessmentDate: "2026-08-30T00:00:00.000Z" }
            : {}),
        });
        return { request: request.documentId, assessment: assessment.documentId };
      };

      const releaseRows = await Promise.all([
        createReleaseFixture("NONE00", owner.documentId, { approved: false, approvedBy: false, approvalDate: false }),
        createReleaseFixture("APPR01", owner.documentId, { approved: true, approvedBy: false, approvalDate: false }),
        createReleaseFixture("BY0002", owner.documentId, { approved: false, approvedBy: true, approvalDate: false }),
        createReleaseFixture("DATE03", owner.documentId, { approved: false, approvedBy: false, approvalDate: true }),
        createReleaseFixture("APBY04", owner.documentId, { approved: true, approvedBy: true, approvalDate: false }),
        createReleaseFixture("APDT05", owner.documentId, { approved: true, approvedBy: false, approvalDate: true }),
        createReleaseFixture("BYDT06", owner.documentId, { approved: false, approvedBy: true, approvalDate: true }),
        createReleaseFixture("FULL07", owner.documentId, { approved: true, approvedBy: true, approvalDate: true }),
        createReleaseFixture("OTHER8", otherRequestor.documentId, { approved: true, approvedBy: true, approvalDate: true }),
      ]);
      const [unreleased, approvedOnly, approverOnly, approvalDateOnly, approvedAndApprover,
        approvedAndApprovalDate, approverAndApprovalDate, complete, crossOwnerComplete] = releaseRows;

      const risk = await createDocument(strapi, "api::csrm-risk.csrm-risk", {
        riskNumber: "RSK-2026-MNT001",
        riskStatement: "Mounted aggregate risk",
        riskCategory: "Cyber Security",
        inherentLikelihood: "Likely",
        highestInherentConsequence: "Moderate",
        inherentRating: "Moderate",
        residualLikelihood: "Possible",
        highestResidualConsequence: "Low",
        residualRating: "Low",
        controlEffectiveness: "Partially Effective",
        treatmentAction: "Treat",
        treatmentPlan: "Apply the reusable mounted control",
        treatmentStatus: "In Progress",
        riskType: riskType.documentId,
        riskOwner: owner.documentId,
        assessment: complete.assessment,
      });
      const controlImplementation = await createDocument(strapi, "api::csrm-control-implementation.csrm-control-implementation", {
        control: control.documentId,
        risk: risk.documentId,
        controlStatus: "Planned",
        controlOwner: owner.documentId,
        effectivenessRating: "Not Assessed",
        evidence: "Mounted aggregate evidence",
        implementationDueDate: "2026-12-01",
      });
      const concurrent = await createReleaseFixture("RACE09", owner.documentId, {
        approved: false,
        approvedBy: false,
        approvalDate: false,
      });

      const createJobTarget = async (suffix: string) => {
        const request = await createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
          requestNumber: `ASSESSMENT-JOB-${suffix}`,
          title: `Assessment job fixture ${suffix}`,
          requestStatus: "questionnaire-in-progress",
          requestor: owner.documentId,
        });
        const questionnaire = await createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", {
          questionnaireNumber: `QUES-ASSESSMENT-JOB-${suffix}`,
          title: `Assessment job questionnaire ${suffix}`,
          assessmentRequest: request.documentId,
          ...releaseFacts(analyst.documentId),
        });
        await createDocument(strapi, "api::csrm-question.csrm-question", {
          questionText: "Describe the assessment context",
          answerType: "Text",
          options: {
            schemaVersion: 1,
            questionKey: `assessment-job-${suffix.toLowerCase()}`,
            section: { key: "context", title: "Context", order: 1 },
            order: 1,
            required: true,
          },
          answer: {
            schemaVersion: 1,
            value: `Submitted assessment job answer ${suffix}`,
            state: "submitted",
            updatedAt: "2026-08-30T00:00:00.000Z",
            submittedAt: "2026-08-30T00:00:00.000Z",
          },
          questionnaire: questionnaire.documentId,
        });
        return questionnaire.documentId;
      };
      const [completedJobTarget, providerFailureJobTarget, providerFailureCodeJobTarget, writeFailureJobTarget, zeroMappingJobTarget] = await Promise.all([
        createJobTarget("COMPLETE"),
        createJobTarget("PROVIDER-FAIL"),
        createJobTarget("PROVIDER-FAIL-CODE"),
        createJobTarget("WRITE-FAIL"),
        createJobTarget("ZERO-MAPPING"),
      ]);

      assessmentWorkflowFixtures = {
        releaseFacts: {
          unreleased: unreleased.assessment,
          approvedOnly: approvedOnly.assessment,
          approverOnly: approverOnly.assessment,
          approvalDateOnly: approvalDateOnly.assessment,
          approvedAndApprover: approvedAndApprover.assessment,
          approvedAndApprovalDate: approvedAndApprovalDate.assessment,
          approverAndApprovalDate: approverAndApprovalDate.assessment,
          complete: complete.assessment,
          crossOwnerComplete: crossOwnerComplete.assessment,
        },
        requests: {
          complete: complete.request,
          crossOwnerComplete: crossOwnerComplete.request,
          concurrent: concurrent.request,
        },
        aggregate: {
          request: complete.request,
          assessment: complete.assessment,
          risk: risk.documentId,
          controlImplementation: controlImplementation.documentId,
          riskType: riskType.documentId,
          control: control.documentId,
        },
        concurrency: { request: concurrent.request, assessment: concurrent.assessment },
        jobTargets: {
          completed: completedJobTarget,
          providerFailure: providerFailureJobTarget,
          providerFailureCode: providerFailureCodeJobTarget,
          writeFailure: writeFailureJobTarget,
          zeroMapping: zeroMappingJobTarget,
        },
      };
      return assessmentWorkflowFixtures;
    },
    async seedAdministrationFixtures() {
      if (administrationFixtures) return administrationFixtures;

      const [riskTypeUpdate, riskTypeUnchanged, controlUpdate, controlUnchanged, systemUpdate,
        systemUnchanged, assetUpdate, assetUnchanged] = await Promise.all([
        createDocument(strapi, "api::csrm-risk-type.csrm-risk-type", {
          name: "Administration import update fixture", description: "original value",
        }),
        createDocument(strapi, "api::csrm-risk-type.csrm-risk-type", {
          name: "Administration import unchanged fixture", description: "existing value",
        }),
        createDocument(strapi, "api::csrm-control.csrm-control", {
          controlNumber: "ADMIN-UPDATE-001", name: "Administration update control", framework: "CSRM acceptance",
        }),
        createDocument(strapi, "api::csrm-control.csrm-control", {
          controlNumber: "ADMIN-UNCHANGED-001", name: "Administration unchanged control", framework: "CSRM acceptance",
        }),
        createDocument(strapi, "api::csrm-information-system.csrm-information-system", {
          name: "Administration update system", description: "original value",
        }),
        createDocument(strapi, "api::csrm-information-system.csrm-information-system", {
          name: "Administration unchanged system", description: "existing value",
        }),
        createDocument(strapi, "api::csrm-information-asset.csrm-information-asset", {
          name: "Administration update asset", description: "original value",
        }),
        createDocument(strapi, "api::csrm-information-asset.csrm-information-asset", {
          name: "Administration unchanged asset", description: "existing value",
        }),
      ]);
      administrationFixtures = {
        riskTypes: { update: riskTypeUpdate.documentId, unchanged: riskTypeUnchanged.documentId },
        controls: { update: controlUpdate.documentId, unchanged: controlUnchanged.documentId },
        informationSystems: { update: systemUpdate.documentId, unchanged: systemUnchanged.documentId },
        informationAssets: { update: assetUpdate.documentId, unchanged: assetUnchanged.documentId },
      };
      return administrationFixtures;
    },
    async request({ path: requestPath, identity, init = {}, omitApiToken = false }) {
      return fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
        ...init,
        headers: {
          ...(!omitApiToken ? authorizationHeader : {}),
          ...(identity ? { "x-csrm-test-identity": identity } : {}),
          ...init.headers,
        },
      });
    },
    async simultaneousRequests(requests) {
      return Promise.all(requests.map((request) => fetch(`http://127.0.0.1:${address.port}${request.path}`, {
        ...request.init,
        headers: {
          ...(!request.omitApiToken ? authorizationHeader : {}),
          ...(request.identity ? { "x-csrm-test-identity": request.identity } : {}),
          ...request.init?.headers,
        },
      })));
    },
    recordJobObservation(observation) {
      jobObservations.push({ ...observation });
    },
    getJobObservations(jobId) {
      return jobObservations
        .filter((observation) => jobId === undefined || observation.jobId === jobId)
        .map((observation) => ({ ...observation }));
    },
    async withProviderFailure(action) {
      const mountedProviderModule = require(path.join(
        appDir,
        "dist",
        "src",
        "api",
        "csrm-assessment",
        "services",
        "deterministic-assessment-draft-provider.js",
      )) as { deterministicAssessmentDraftProvider: InjectableAssessmentDraftProvider };
      const provider = mountedProviderModule.deterministicAssessmentDraftProvider;
      const originalGenerate = provider.generate;
      provider.generate = async () => {
        throw new Error("injected assessment draft provider failure");
      };
      try {
        return await action();
      } finally {
        provider.generate = originalGenerate;
      }
    },
    async withHeldQuestionnaireGeneration(requestDocumentId, action, options = {}) {
      const mountedProviderModule = require(path.join(
        appDir,
        "dist",
        "src",
        "api",
        "csrm-questionnaire",
        "services",
        "deterministic-questionnaire-generation-provider.js",
      )) as { deterministicQuestionnaireGenerationProvider: InjectableQuestionnaireGenerationProvider };
      const provider = mountedProviderModule.deterministicQuestionnaireGenerationProvider;
      const originalGenerate = provider.generate;
      let releaseGate: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { releaseGate = resolve; });
      provider.generate = async (...args: unknown[]) => {
        await gate;
        return originalGenerate.apply(provider, args);
      };
      const analystRequest = (requestPath: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
        ...init,
        headers: { ...authorizationHeader, "x-csrm-test-identity": "analyst", ...init.headers },
      });
      let jobId: string | undefined;
      try {
        const queued = await analystRequest(
          `/api/v1/assessment_requests/${encodeURIComponent(requestDocumentId)}/generate_questionnaire`,
          options.replaceUnansweredQuestionnaire
            ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ replaceUnansweredQuestionnaire: true }) }
            : { method: "POST" },
        );
        assert.equal(queued.status, 202, "HELD_QUESTIONNAIRE_GENERATION_NOT_QUEUED");
        const job = ((await queued.json()) as { data?: { jobId?: unknown } }).data;
        assert.equal(typeof job?.jobId, "string", "HELD_QUESTIONNAIRE_GENERATION_JOB_ID_MISSING");
        jobId = job?.jobId as string;
        return await action(jobId);
      } finally {
        releaseGate();
        try {
          if (jobId !== undefined) {
            let status: unknown;
            for (let poll = 0; poll < 50; poll += 1) {
              const response = await analystRequest(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`);
              assert.equal(response.status, 200, "HELD_QUESTIONNAIRE_GENERATION_JOB_UNREADABLE");
              status = ((await response.json()) as { data?: { status?: unknown } }).data?.status;
              if (status === "completed" || status === "failed") break;
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            const expectedStatus = options.expectedStatus ?? "completed";
            assert.equal(status, expectedStatus, expectedStatus === "completed" ? "HELD_QUESTIONNAIRE_GENERATION_DID_NOT_COMPLETE" : "HELD_QUESTIONNAIRE_GENERATION_DID_NOT_FAIL");
          }
        } finally {
          provider.generate = originalGenerate;
        }
      }
    },
    async withProviderFailureCode(code, safeMessage, action) {
      const mountedProviderModule = require(path.join(
        appDir,
        "dist",
        "src",
        "api",
        "csrm-assessment",
        "services",
        "deterministic-assessment-draft-provider.js",
      )) as { deterministicAssessmentDraftProvider: InjectableAssessmentDraftProvider };
      const mountedRegistryModule = require(path.join(
        appDir,
        "dist",
        "src",
        "api",
        "csrm-assessment",
        "services",
        "assessment-draft-registry.js",
      )) as { AssessmentDraftJobFailure: new (failureCode: string, failureMessage: string) => Error };
      const provider = mountedProviderModule.deterministicAssessmentDraftProvider;
      const originalGenerate = provider.generate;
      provider.generate = async () => {
        throw new mountedRegistryModule.AssessmentDraftJobFailure(code, safeMessage);
      };
      try {
        return await action();
      } finally {
        provider.generate = originalGenerate;
      }
    },
    async withDocumentWriteFailure(uid, operation, failAt, action) {
      assert.ok(Number.isInteger(failAt) && failAt > 0, "write failure index must be a positive integer");
      const documentService = strapi.documents(uid) as StrapiDocumentService & {
        create: (input: { data: Record<string, unknown> }) => Promise<Document>;
        update?: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
      };
      const original = documentService[operation];
      assert.ok(original, `${uid} document service must support ${operation}`);
      let writeCount = 0;
      documentService[operation] = (async (input: never) => {
        writeCount += 1;
        if (writeCount === failAt) throw new Error(`unexpected ${uid} ${operation} infrastructure detail`);
        return (original as (input: never) => Promise<Document>).call(documentService, input);
      }) as never;
      try {
        return await action();
      } finally {
        documentService[operation] = original as never;
      }
    },
    async withQuestionUpdateFailure(failAt, action) {
      const questionService = strapi.documents("api::csrm-question.csrm-question");
      assert.ok(questionService.update, "question document service must support updates");
      const originalUpdate = questionService.update;
      let updateCount = 0;
      questionService.update = async (input) => {
        updateCount += 1;
        if (updateCount === failAt) throw new Error("injected production question update failure");
        return originalUpdate.call(questionService, input);
      };
      try {
        return await action();
      } finally {
        questionService.update = originalUpdate;
      }
    },
    async countRequestsForUser(userDocumentId) {
      const documents = await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findMany({
        filters: { requestor: { documentId: { $eq: userDocumentId } } },
        limit: 100,
      });
      return documents.length;
    },
    developmentPermissionActions: DEVELOPMENT_PERMISSION_ACTIONS,
    getObservedDevelopmentIdentity(email) {
      return observedDevelopmentIdentities.get(email);
    },
    async getPublicPermissionActions() {
      return getPublicPermissionActions();
    },
    async ensurePublicPermission(action) {
      const actions = await getPublicPermissionActions();
      if (!actions.includes(action)) {
        await permissionStore.create({ data: { action, role: publicRole.id } });
      }
    },
    async reconcileDevelopmentPermissions() {
      const bootstrap = require(path.join(
        appDir,
        "dist",
        "src",
        "bootstrap",
        "reconcile-development-public-permissions.js",
      )) as {
        HISTORICAL_DEVELOPMENT_CONTENT_API_ACTIONS: readonly string[];
        reconcileDevelopmentPublicPermissions: (instance: RunningStrapi) => Promise<void>;
      };
      await bootstrap.reconcileDevelopmentPublicPermissions(strapi);
      return bootstrap.HISTORICAL_DEVELOPMENT_CONTENT_API_ACTIONS;
    },
    async seedDevelopmentApiToken() {
      const bootstrap = require(path.join(appDir, "dist", "src", "bootstrap", "seed-development-api-token.js")) as {
        seedDevelopmentApiToken: (instance: RunningStrapi) => Promise<void>;
      };
      await bootstrap.seedDevelopmentApiToken(strapi);
    },
    async getDevelopmentApiTokens() {
      return strapi.db.query("admin::api-token").findMany({
        where: { name: "CSRM isolated development test token" },
      });
    },
    async clearDevelopmentApiTokens() {
      await (strapi.db.query("admin::api-token") as unknown as {
        deleteMany: (input: { where: { name: string } }) => Promise<unknown>;
      }).deleteMany({
        where: { name: "CSRM isolated development test token" },
      });
    },
    hashApiToken(value) {
      const service = strapi.service("admin::api-token-content-api") as { hash: (accessKey: string) => string };
      return service.hash(value);
    },
    async withDevelopmentEnvironment(nodeEnv, environment, flag, action) {
      const previousNodeEnv = process.env.NODE_ENV;
      const previousEnvironment = process.env.CSRM_ENVIRONMENT;
      const previousFlag = process.env.CSRM_DEV_IDENTITY;
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;
      if (environment === undefined) delete process.env.CSRM_ENVIRONMENT;
      else process.env.CSRM_ENVIRONMENT = environment;
      if (flag === undefined) delete process.env.CSRM_DEV_IDENTITY;
      else process.env.CSRM_DEV_IDENTITY = flag;
      try {
        return await action();
      } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
        if (previousEnvironment === undefined) delete process.env.CSRM_ENVIRONMENT;
        else process.env.CSRM_ENVIRONMENT = previousEnvironment;
        if (previousFlag === undefined) delete process.env.CSRM_DEV_IDENTITY;
        else process.env.CSRM_DEV_IDENTITY = previousFlag;
      }
    },
    async getRequest(documentId) {
      return (await (strapi.documents("api::csrm-assessment-request.csrm-assessment-request") as StrapiDocumentService & {
        findOne: (input: { documentId: string; populate: Record<string, true> }) => Promise<Record<string, unknown> | null>;
      }).findOne({
        documentId,
        populate: {
          requestor: true,
          sponsor: true,
          questionnaire: true,
          assessment: true,
          informationSystems: true,
          informationAssets: true,
          revertedBy: true,
        },
      })) ?? null;
    },
    async getQuestionnaire(documentId) {
      return (await strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne?.({
        documentId,
        populate: { assessmentRequest: { populate: { requestor: true } }, generatedBy: true, questions: true, revertedBy: true, releasedBy: true },
      })) ?? null;
    },
    async getQuestion(documentId) {
      return (await strapi.documents("api::csrm-question.csrm-question").findOne?.({
        documentId,
        populate: { questionnaire: true },
      })) ?? null;
    },
    async getAssessment(documentId) {
      return (await strapi.documents("api::csrm-assessment.csrm-assessment").findOne?.({
        documentId,
        populate: { assessmentRequest: { populate: { requestor: true } }, approvedBy: true, generatedBy: true, risks: true },
      })) ?? null;
    },
    async getRisk(documentId) {
      return (await strapi.documents("api::csrm-risk.csrm-risk").findOne?.({
        documentId,
        populate: { assessment: true, riskType: true, riskOwner: true, controlImplementations: true },
      })) ?? null;
    },
    async getControlImplementation(documentId) {
      return (await strapi.documents("api::csrm-control-implementation.csrm-control-implementation").findOne?.({
        documentId,
        populate: { risk: true, control: true, controlOwner: true },
      })) ?? null;
    },
    async countRisksForAssessment(assessmentDocumentId) {
      const rows = await strapi.documents("api::csrm-risk.csrm-risk").findMany?.({
        filters: { assessment: { documentId: { $eq: assessmentDocumentId } } },
        limit: 1_000,
      });
      return rows?.length ?? 0;
    },
    async countControlImplementationsForRisk(riskDocumentId) {
      const rows = await strapi.documents("api::csrm-control-implementation.csrm-control-implementation").findMany?.({
        filters: { risk: { documentId: { $eq: riskDocumentId } } },
        limit: 1_000,
      });
      return rows?.length ?? 0;
    },
    async createUserFixture(data) {
      const user = await createDocument(strapi, "api::idambox-user.idambox-user", data);
      return user.documentId;
    },
    async createFixtureDocument(uid, data) {
      const document = await createDocument(strapi, uid, data);
      return document.documentId;
    },
    async createAssessmentRequestFixture({ requestor, ...data }) {
      const request = await createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", {
        ...data,
        requestor: requestor === "owner" ? owner.documentId : otherRequestor.documentId,
      });
      return request.documentId;
    },
    async createQuestionnaireLifecycleFixture({ requestDocumentId, released, answerState }) {
      const sequence = String(++lifecycleQuestionnaireSequence).padStart(3, "0");
      const questionnaire = await createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", {
        questionnaireNumber: `QUES-LIFECYCLE-${sequence}`,
        title: `Lifecycle questionnaire ${sequence}`,
        assessmentRequest: requestDocumentId,
        ...(released ? releaseFacts(analyst.documentId) : {}),
      });
      if (answerState === "none") return { questionnaire: questionnaire.documentId, question: null };
      // The same answer envelope and question options as the questionnaire workflow fixtures.
      const answer = answerState === "submitted"
        ? { schemaVersion: 1, value: `Submitted lifecycle answer ${sequence}`, state: "submitted", updatedAt: "2026-08-02T00:00:00.000Z", submittedAt: "2026-08-02T00:00:00.000Z" }
        : { schemaVersion: 1, value: `Draft lifecycle answer ${sequence}`, state: "draft", updatedAt: "2026-08-01T00:00:00.000Z" };
      const question = await createDocument(strapi, "api::csrm-question.csrm-question", {
        questionText: `Describe the lifecycle context ${sequence}`,
        answerType: "Text",
        options: {
          schemaVersion: 1,
          questionKey: `lifecycle-${sequence}`,
          section: { key: "context", title: "Context", order: 1 },
          order: 1,
          required: true,
        },
        answer,
        questionnaire: questionnaire.documentId,
      });
      return { questionnaire: questionnaire.documentId, question: question.documentId };
    },
    async getRequestLifecycleDocument(documentId) {
      return (await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findOne?.({
        documentId,
        populate: {
          questionnaire: { populate: { questions: true } },
          assessment: { populate: { approvedBy: true, reviewedBy: true, risks: true } },
        },
      })) ?? null;
    },
    async seedReviewableRequestsDirectly(count, prefix) {
      assert.ok(Number.isInteger(count) && count > 0 && count <= 2_000, "direct review queue fixture count must be bounded");
      assert.match(prefix, /^[A-Za-z0-9-]{1,40}$/);
      // Every direct row is submitted later than any hand-built fixture, one
      // minute apart, so its position in the default queue order is known.
      const firstSubmitted = Date.UTC(2030, 0, 1);
      const records = Array.from({ length: count }, (_, index) => {
        const suffix = String(index).padStart(5, "0");
        return {
          documentId: `${prefix}-${suffix}`,
          requestNumber: `${prefix}-${suffix}`,
          title: `${prefix} direct review queue fixture ${suffix}`,
          requestStatus: "submitted",
          submittedDate: new Date(firstSubmitted + index * 60_000).toISOString(),
        };
      });
      const repository = strapi.db.query("api::csrm-assessment-request.csrm-assessment-request");
      for (let offset = 0; offset < records.length; offset += 200) {
        await repository.createMany({ data: records.slice(offset, offset + 200) });
      }
      return { requestNumbers: records.map((record) => record.requestNumber) };
    },
    async countReviewQueueBucketFixture(bucket, activeIds) {
      // The compiled module the running application loaded, so this is the same
      // counter the analyst dashboard uses.
      const repositoryModule = require(path.join(
        appDir,
        "dist",
        "src",
        "api",
        "csrm-assessment-request",
        "services",
        "review-queue-repository.js",
      )) as {
        countReviewQueueBucket: (instance: unknown, queue: ReviewQueueBucketFixture, ids: readonly string[]) => Promise<number>;
      };
      return repositoryModule.countReviewQueueBucket(strapi, bucket, activeIds);
    },
    async createAssessmentFixture(data) {
      const assessment = await createDocument(strapi, "api::csrm-assessment.csrm-assessment", data);
      return assessment.documentId;
    },
    async setRiskOwnerFixture(riskDocumentId, ownerDocumentId) {
      await (strapi.documents("api::csrm-risk.csrm-risk") as StrapiDocumentService & {
        update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
      }).update({ documentId: riskDocumentId, data: { riskOwner: ownerDocumentId } });
    },
    async setRequestStatusFixture(requestDocumentId, requestStatus) {
      await (strapi.documents("api::csrm-assessment-request.csrm-assessment-request") as StrapiDocumentService & {
        update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
      }).update({ documentId: requestDocumentId, data: { requestStatus } });
    },
    async setUserAccountStatusFixture(userDocumentId, accountStatus) {
      await userService.update({ documentId: userDocumentId, data: { accountStatus } });
    },
    async createRiskRegisterFixture(assessmentDocumentId, data) {
      const risk = await createDocument(strapi, "api::csrm-risk.csrm-risk", {
        ...data,
        assessment: assessmentDocumentId,
      });
      return risk.documentId;
    },
    async createRiskRegisterMitigationFixture(riskDocumentId, controlDocumentId, controlStatus) {
      const implementation = await createDocument(strapi, "api::csrm-control-implementation.csrm-control-implementation", {
        risk: riskDocumentId,
        control: controlDocumentId,
        controlStatus,
      });
      return implementation.documentId;
    },
    async getAdministrationRecord(kind, documentId) {
      const uid = {
        "risk-types": "api::csrm-risk-type.csrm-risk-type",
        controls: "api::csrm-control.csrm-control",
        "information-systems": "api::csrm-information-system.csrm-information-system",
        "information-assets": "api::csrm-information-asset.csrm-information-asset",
      }[kind];
      return (await strapi.documents(uid).findOne?.({ documentId })) ?? null;
    },
    async countAdministrationRecords(kind) {
      const uid = {
        "risk-types": "api::csrm-risk-type.csrm-risk-type",
        controls: "api::csrm-control.csrm-control",
        "information-systems": "api::csrm-information-system.csrm-information-system",
        "information-assets": "api::csrm-information-asset.csrm-information-asset",
      }[kind];
      const rows = await strapi.documents(uid).findMany({ limit: 65_536 });
      return rows.length;
    },
    async seedRiskTypesDirectly(count, prefix) {
      assert.ok(Number.isInteger(count) && count > 5_000 && count <= 10_000, "mounted beyond-window fixture count must be bounded");
      assert.match(prefix, /^[A-Za-z0-9-]{1,80}$/);
      const records = Array.from({ length: count }, (_, index) => ({
        documentId: `${prefix}-${String(index).padStart(5, "0")}`,
        name: `${prefix} ${String(index).padStart(5, "0")}`,
        description: "mounted beyond-window fixture",
      }));
      const repository = strapi.db.query("api::csrm-risk-type.csrm-risk-type");
      for (let offset = 0; offset < records.length; offset += 200) {
        await repository.createMany({ data: records.slice(offset, offset + 200) });
      }
      return { targetName: records.at(-1)!.name };
    },
    createCsvMultipart({ filename, bytes, digest, confirmed }) {
      const form = new FormData();
      form.set("file", new File([bytes], filename, { type: "text/csv" }));
      if (digest !== undefined) form.set("previewDigest", digest);
      if (confirmed !== undefined) form.set("confirmed", String(confirmed));
      return form;
    },
    listMountedContentApiRoutes() {
      return listMountedContentApiRoutes(strapi);
    },
    async readUsersPermissionsAdvancedSettings() {
      const settings = await strapi.store({ type: "plugin", name: "users-permissions" }).get({ key: "advanced" });
      return (settings ?? null) as Record<string, unknown> | null;
    },
    async countUsersPermissionsUsers() {
      return (await strapi.query("plugin::users-permissions.user").findMany({ where: {} })).length;
    },
    async snapshot(getters) {
      return Promise.all(getters.map((getter) => getter()));
    },
    async close() {
      testIdentities.clear();
      observedDevelopmentIdentities.clear();
      jobObservations.length = 0;
      await strapi.destroy();
      await rm(databaseFilename, { force: true });
      for (const [name, value] of originalEnvironment) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    },
  };
}
