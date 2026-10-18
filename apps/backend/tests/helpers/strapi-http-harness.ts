import assert from "node:assert/strict";
import type { Core } from "@strapi/strapi";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { CSRM_ASSESSMENT_REQUEST_OPERATIONS } from "../../src/api/csrm-assessment-request/operations";
import { seedCsrmData } from "../../src/bootstrap/seed-csrm-data";
import { buildAssessmentContextFor, type AssessmentContextStrapi } from "../../src/csrm/ai/assessment-context-loader";
import { createRunningAiRun, completeAiRun, failAiRun, appendAiRunDecisions, reconcileInterruptedAiRuns, type CreateRunningAiRunInput, type AiRunDecisionEvent, type AiRunProposal } from "../../src/api/csrm-ai-run/services/ai-run-record";
import type { AttachmentStorage } from "../../src/csrm/files/storage-port";

type Document = { documentId: string };
export type AdministrationFixtureKind = "risk-types" | "controls" | "information-systems" | "information-assets";

/** One Administration import upload and its fields (19-13 preview and commit; 19-14 error report). */
export type MultipartImportInput = {
  filename: string;
  bytes: Uint8Array;
  digest?: string;
  confirmed?: boolean;
  decisions?: string;
  resultToken?: string;
  timeZone?: string;
};
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
/* Phase 15 (15-05): the mounted deterministic proposal and rewrite providers keep `propose` and `rewrite` replaceable. */
type InjectableQuestionnaireProposalProvider = { propose: (...args: unknown[]) => Promise<unknown> };
type InjectableQuestionRewriteProvider = { rewrite: (...args: unknown[]) => Promise<unknown> };
/**
 * Phase 15 (15-06): a proposal workflow call as the mounted service answered it, shaped as the routes 15-09 adds will
 * answer: 202 with the job for a start or a retry, 200 with the job for a read, or the workflow's refusal (its status,
 * closed reason when it has one, and message).
 */
export type ProposalFixtureResponse = { status: number; data?: Record<string, unknown>; reason?: string; message?: string };
/** Phase 15 (15-06): the hold `withHeldQuestionnaireProposalProvider` gives its action. */
export type HeldQuestionnaireProposalProvider = {
  /** Settles when a proposal or rewrite call first reaches the hold, after its run exists. */
  reached: Promise<void>;
  /** Lets every held call continue; `action` settling does the same. */
  release: () => void;
  /** The provider inputs captured so far, in call order, when `capture` was asked for; empty otherwise. */
  captured: () => ReadonlyArray<Record<string, unknown>>;
};
/** The CSRM content types a test may build fixtures of directly. */
export type CsrmFixtureUid =
  | "api::csrm-ai-run.csrm-ai-run"
  | "api::csrm-assessment-request.csrm-assessment-request"
  | "api::csrm-questionnaire.csrm-questionnaire"
  | "api::csrm-question.csrm-question"
  | "api::csrm-assessment.csrm-assessment"
  | "api::csrm-risk.csrm-risk"
  | "api::csrm-control-implementation.csrm-control-implementation"
  | "api::csrm-control.csrm-control"
  | "api::csrm-information-system.csrm-information-system"
  | "api::csrm-information-asset.csrm-information-asset"
  /* Phase 13 (D-26): a note's stored AI-input log, set directly to prove the full and unreadable log refusals. */
  | "api::csrm-request-note.csrm-request-note"
  /* Phase 14 (D-10, D-16): an attachment's facts, set directly to prove the window, limit and state rules. */
  | "api::csrm-request-attachment.csrm-request-attachment";
export type QuestionnaireLifecycleAnswerState = "none" | "draft" | "submitted";
/** The analyst questionnaire mutations a test can run inside another mutation's transaction window, as the analyst. */
export type InterleavedQuestionnaireWorkflows = {
  release: (questionnaireDocumentId: string) => Promise<unknown>;
  addQuestion: (questionnaireDocumentId: string, body: Record<string, unknown>) => Promise<unknown>;
  replaceQuestionnaire: (requestDocumentId: string) => Promise<unknown>;
};
/**
 * What became of an intrusion: it ran to the end inside the window; it reached a row lock the operation holds,
 * where PostgreSQL would make it wait, and stopped there before writing anything; it failed otherwise; or the
 * operation never reached the window.
 */
export type InterleavedIntrusionOutcome =
  | { outcome: "committed" }
  | { outcome: "blocked"; lock: string }
  | { outcome: "failed"; error: unknown }
  | { outcome: "not-reached" };
/** One FOR UPDATE row lock, numbered by the transaction that took it (in the order each first locked a row). */
export type RecordedRowLock = { transaction: number; uid: string; documentId: string };
/** Phase 14 WR-301: one call to `withRequestLock` for the watched request, as `withHeldRequestLock` saw it. */
export type WatchedRequestLockCall = {
  /** Whether the call has asked the database for its transaction (on SQLite, waited for the one connection). */
  transactionRequested: boolean;
  /** The active-file counts the call read inside the lock, in order. */
  activeCounts: number[];
};
/** Phase 14 WR-301: the hold `withHeldRequestLock` gives its action. */
export type HeldRequestLock = {
  /** Settles when the first call for the request arrives at the lock's door, where it waits, holding nothing. */
  atDoor: Promise<void>;
  /** Lets the call waiting at the door into `withRequestLock`. */
  admitFirst: () => void;
  /** Settles with the active count a call read inside the lock, once that call is held just after the read. */
  countHeld: Promise<number>;
  /** Lets the held call go on from its count. */
  releaseCount: () => void;
  /** Every call for the request so far, in arrival order. */
  calls: () => readonly WatchedRequestLockCall[];
};
export type ReviewQueueBucketFixture = "requires-attention" | "awaiting-requestor" | "generation-in-progress" | "open" | "released" | "all";
/** Phase 13 (13-12): the assignee and notes filters a shared count applies, for the viewer named by documentId. */
export type ReviewQueueCountFixtureOptions = { viewerDocumentId: string; assignee?: "me" | "unassigned"; notesUnread?: true };
type StrapiDocumentService = {
  create: (input: { data: Record<string, unknown> }) => Promise<Document>;
  findMany: (input: Record<string, unknown>) => Promise<Document[]>;
  findOne?: (input: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  update?: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
  delete?: (input: { documentId: string }) => Promise<unknown>;
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
  rootRoutes: MountedApplicationRoute[];
  rootKoaLayers: Array<{ path: string; methods: string[] }>;
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
    routes: (routes: { type?: string; prefix?: string; routes: RegisteredRoute[] }) => unknown;
    router: { stack: Array<{ path: string; methods: string[] }> };
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

function listMountedContentApiRoutes(strapi: RunningStrapi, rootRoutes: MountedApplicationRoute[]): MountedContentApiRoutes {
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
  return { applicationRoutes, pluginRoutes, koaLayers, rootRoutes: structuredClone(rootRoutes),
    rootKoaLayers: strapi.server.router.stack.map(layer => ({ path: layer.path, methods: [...layer.methods] })) };
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
  /** Trusted fixture setup against the same persisted backend serving the mounted routes. */
  withBackendFixture: <T>(action: (backend: Core.Strapi) => Promise<T>) => Promise<T>;
  baseUrl: string;
  identities: { owner: string; otherRequestor: string; analyst: string; secondAnalyst: string; analystAgent: string; serviceAnalystAgent: string; inactiveAnalyst: string };
  developmentEmails: { jane: string; bob: string; inactive: string; unknown: string };
  users: { owner: string; otherRequestor: string; analyst: string; secondAnalyst: string; serviceAnalystAgent: string; inactiveAnalyst: string };
  requests: { owner: string; otherRequestor: string };
  seedUatALikeFixture: () => Promise<{ requestId: string; questionnaireId: string; systemIds: string[]; assetIds: string[]; riskTypeIds: string[]; controlIds: string[] }>;
  /**
   * WR-210: another UAT-A-like request and released, answered questionnaire over the same library, its numbers
   * suffixed by `label`, so a test that needs a known starting state generates a draft of its own.
   */
  seedUatALikeRequest: (label: string) => Promise<{ requestId: string; questionnaireId: string }>;
  buildAssessmentContextFixture: (input: Parameters<typeof buildAssessmentContextFor>[1]) => ReturnType<typeof buildAssessmentContextFor>;
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
  /**
   * Sends the requests together (`Promise.all` over `fetch`), with no hook that puts two handlers in one window. On SQLite
   * the single connection serialises their transactions, so a test built on it proves the serialised outcome, never a
   * lock (WR-201): use `interleaveInTransactionWindow` or `recordRowLocks` for that.
   */
  simultaneousRequests: (requests: readonly HarnessRequest[]) => Promise<Response[]>;
  recordJobObservation: (observation: AssessmentJobObservation) => void;
  getJobObservations: (jobId?: string) => readonly AssessmentJobObservation[];
  withProviderFailure: <T>(action: () => Promise<T>) => Promise<T>;
  withProviderFailureCode: <T>(code: string, safeMessage: string, action: () => Promise<T>) => Promise<T>;
  /**
   * WR-206: holds the deterministic assessment draft provider until `action` settles, so a draft job waits inside
   * its provider call, after its run is created, for exactly that long. `action` receives a promise that settles
   * when a job first reaches the provider. The job is then released; following it is the caller's.
   */
  withHeldAssessmentDraftProvider: <T>(action: (reached: Promise<void>) => Promise<T>) => Promise<T>;
  /**
   * WR-201: holds every AI generation job (a questionnaire generation or an assessment draft) just before it builds its
   * context and so before it reads the AI data policy, until `release` is called or `action` settles. `reached` settles
   * when a job first reaches the hold. Nothing else is held: the enqueue routes evaluate the policy themselves.
   */
  withHeldAiContext: <T>(action: (hold: { reached: Promise<void>; release: () => void }) => Promise<T>) => Promise<T>;
  /**
   * Phase 14 WR-204: holds the first upload screening that reaches it, just inside screenAttachment, until `release` is
   * called or `action` settles; every later screening runs at once. `reached` settles when the first is held. The upload
   * calls screenAttachment through its module object, so the mounted instance takes this hold.
   */
  withHeldScreening: <T>(action: (hold: { reached: Promise<void>; release: () => void }) => Promise<T>) => Promise<T>;
  /**
   * Phase 14 WR-204: fills the mounted instance's one screening and extraction queue, one held task and every waiting
   * place, while `action` runs, then releases it and waits for it to drain.
   */
  withFullExtractionQueue: <T>(action: () => Promise<T>) => Promise<T>;
  /**
   * Phase 14 WR-301: watches and holds the one request lock (`withRequestLock`) for `requestDocumentId` until `action`
   * settles, so a test can put two writers to one request in a known order and see what the second does while the first
   * holds the lock. The first call for the request to arrive waits at the lock's door, before it takes anything, until
   * `admitFirst`. The first active-file count any call reads inside the lock (`scanStatus` in its filter) is read, then
   * held until `releaseCount`. `calls` reports, per call, whether it has asked the database for its transaction and the
   * active counts it has read inside the lock. The services call `withRequestLock` through its module object, so the
   * mounted instance takes this hook; nothing in the application changes, and other requests pass through untouched.
   * SQLite's one connection would make a second writer wait for the first anyway, so "has not asked the database for its
   * transaction" is how a test sees the lock's in-process tail hold it.
   */
  withHeldRequestLock: <T>(requestDocumentId: string, action: (lock: HeldRequestLock) => Promise<T>) => Promise<T>;
  /**
   * WR-201: the mounted instance reads `ceiling` as its AI data classification ceiling (the value of
   * CSRM_AI_DATA_CLASSIFICATION_CEILING; "" is none) until `action` settles, then the ceiling it booted with again.
   */
  withAiDataClassificationCeiling: <T>(ceiling: string, action: () => Promise<T>) => Promise<T>;
  withQuestionnaireProviderFailureCode: <T>(code: string, safeMessage: string, action: () => Promise<T>) => Promise<T>;
  /**
   * WR-02: the mounted questionnaire provider answers every generation with what `generate` returns (for example a
   * hosted model's wire output through its adapter) until `action` settles, so the workflow persists that proposal.
   */
  withQuestionnaireProviderOutput: <T>(generate: () => unknown, action: () => Promise<T>) => Promise<T>;
  /**
   * WR-104: the mounted assessment draft provider answers every draft with `transform` applied to its own proposal until
   * `action` settles (for example a proposal within the parser's bounds but over the run record's).
   */
  withAssessmentDraftProviderOutput: <T>(transform: (proposal: Record<string, unknown>) => unknown, action: () => Promise<T>) => Promise<T>;
  listAiRunsForRequest: (requestId: string) => Promise<Array<Record<string, unknown>>>;
  runQuestionnaireGenerationJobFixture: (requestId: string, analystId: string) => Promise<{ questionnaireId: string }>;
  runAssessmentDraftJobFixture: (questionnaireId: string, analystId: string) => Promise<{ assessmentId: string }>;
  /**
   * Counts the mounted deterministic providers' calls while `action` runs: questionnaire generation and assessment draft
   * `generate`, and (Phase 15 H-1) the questionnaire proposal provider's `propose` and the question rewrite provider's
   * `rewrite`, so a zero-call assertion on a proposal job counts the provider the job would call.
   */
  withProviderCallRecorder: <T>(action: (counts: { questionnaire: () => number; assessment: () => number; proposals: () => number; rewrites: () => number }) => Promise<T>) => Promise<T>;
  /**
   * Phase 15 (15-06): starts a questionnaire-wide proposal job through the mounted workflow as the human Security Analyst
   * `analystId` (a documentId), with `body` as the request body (`{ instruction? }`).
   */
  startQuestionnaireProposalsFixture: (analystId: string, questionnaireId: string, body?: unknown) => Promise<ProposalFixtureResponse>;
  /** Phase 15 (15-06): starts a question rewrite job for `questionId` as the human Security Analyst `analystId`. */
  startQuestionRewriteFixture: (analystId: string, questionnaireId: string, questionId: string, body?: unknown) => Promise<ProposalFixtureResponse>;
  /** Phase 15 (15-06): reads a proposal job as the human Security Analyst `analystId`. */
  getProposalJobFixture: (analystId: string, jobId: string) => Promise<ProposalFixtureResponse>;
  /** Phase 15 (15-06): retries a failed proposal job as the human Security Analyst `analystId`. */
  retryProposalJobFixture: (analystId: string, jobId: string) => Promise<ProposalFixtureResponse>;
  /**
   * Phase 15 (15-06): waits until the proposal job's current attempt has ended and returns the registry's record of it
   * (status, attempt, runId, failure and the initiating analyst's documentId), read past every access rule. A held job
   * ends only once its hold is released.
   */
  waitForProposalJobFixture: (jobId: string) => Promise<Record<string, unknown>>;
  /** Phase 15 (15-06): the questionnaire's queued and running proposal jobs, as the registry holds them. */
  activeProposalJobsFixture: (questionnaireId: string) => Promise<Array<Record<string, unknown>>>;
  /**
   * Phase 15 (15-06): holds the mounted deterministic proposal and rewrite providers until `release` is called or
   * `action` settles, so a job waits inside its provider call, after its run exists. `capture` records each call's input;
   * `failWith` makes every call fail afterwards as a hosted provider's failure (`QuestionnaireGenerationJobFailure`)
   * with that code and message.
   */
  withHeldQuestionnaireProposalProvider: <T>(action: (hold: HeldQuestionnaireProposalProvider) => Promise<T>, options?: { capture?: boolean; failWith?: { code: string; message: string } }) => Promise<T>;
  /** Phase 15 (15-06): every AI run on the questionnaire, oldest first, with its initiating analyst populated. */
  listQuestionnaireRunsFixture: (questionnaireId: string) => Promise<Array<Record<string, unknown>>>;
  /**
   * Phase 15 (15-08): runs an acknowledged questionnaire replacement for `requestId` as the analyst, directly on the
   * mounted job body (`persistGeneratedQuestionnaire`), and reports how it ended: completed, or failed with its code.
   */
  replaceQuestionnaireFixture: (requestId: string) => Promise<{ status: "completed" | "failed"; failureCode?: string }>;
  /** Phase 15 (15-08): records the mounted instance's `strapi.log.warn` messages while `action` runs. */
  withStrapiWarnings: <T>(action: (warnings: () => readonly string[]) => Promise<T>) => Promise<T>;
  /**
   * Phase 15 (15-07): decides AI proposals on the questionnaire through the mounted decision service as the human Security
   * Analyst `analystId`, with `body` as the request body (`{ decisions }`): 200 with `{ applied, unchanged }`, or the
   * service's refusal as the route 15-09 adds will answer it.
   */
  decideQuestionnaireProposalsFixture: (analystId: string, questionnaireId: string, body: unknown) => Promise<ProposalFixtureResponse>;
  /**
   * Phase 15 (15-07): everything a decision may change, for deep-equal checks: every question row (text, help text, type,
   * options and answer) by documentId, the release fact, the governance log, and every run's decisions by run.
   */
  questionnaireSnapshotFixture: (questionnaireId: string) => Promise<Record<string, unknown>>;
  /**
   * Phase 15 (15-07): the Requestor's answer save and submit, called on the mounted services directly (past the route's
   * policy), as `requestorId`: 200 with the service's result, or its refusal (status, closed reason and message).
   */
  saveAnswersServiceFixture: (requestorId: string, questionnaireId: string, body: unknown) => Promise<ProposalFixtureResponse>;
  submitQuestionnaireServiceFixture: (requestorId: string, questionnaireId: string, body?: unknown) => Promise<ProposalFixtureResponse>;
  listAiRunsForAssessment: (assessmentId: string) => Promise<Array<Record<string, unknown>>>;
  withDocumentWriteFailure: <T>(uid: string, operation: "create" | "update", failAt: number, action: () => Promise<T>) => Promise<T>;
  withQuestionUpdateFailure: <T>(failAt: number, action: () => Promise<T>) => Promise<T>;
  countRequestsForUser: (userDocumentId: string) => Promise<number>;
  /**
   * Phase 13 (D-01): a request's four assignment facts as the Document Service holds them, the two relations as
   * documentIds. The facts are private, so no route returns them; a persistence comparison reads them here.
   */
  getRequestAssignment: (documentId: string) => Promise<{
    assignedAnalyst: string | null;
    assignedBy: string | null;
    assignedAt: unknown;
    assignmentLog: unknown;
  } | null>;
  /** The column names SQLite reports for `table` (`PRAGMA table_info`), in declaration order. */
  listTableColumns: (table: string) => Promise<string[]>;
  /**
   * Phase 16 (D-18): a Risk's history rows as the Document Service holds them, oldest first (by id), every relation as
   * its documentId. No route serves the rows unprojected, so a persistence comparison reads them here.
   */
  riskHistoryRowsFixture: (riskDocumentId: string) => Promise<Array<Record<string, unknown>>>;
  /** Phase 16 (D-05): a Risk's three withdrawal facts as stored, `withdrawnBy` as a documentId; null for no Risk. */
  riskWithdrawalFactsFixture: (riskDocumentId: string) => Promise<{ withdrawnAt: unknown; withdrawnBy: string | null; withdrawalReason: unknown } | null>;
  /**
   * Phase 16 (16-04): writes a Risk's three withdrawal facts straight through the Document Service, so a test holds a
   * withdrawn Risk before 16-05's withdraw operation exists. `withdrawnBy` is a documentId or null.
   */
  setRiskWithdrawalFactsFixture: (riskDocumentId: string, facts: { withdrawnAt: string | null; withdrawnBy: string | null; withdrawalReason: string | null }) => Promise<void>;
  /**
   * Phase 16 (D-21): writes one history row straight through the Document Service, past the only writer's checks, so a
   * test can hold a row the writer would refuse (a malformed `changes`). `actor`, `assessment`, `risk` and `aiRun` are
   * documentIds. Returns the row's documentId.
   */
  writeRawHistoryRowFixture: (row: Record<string, unknown>) => Promise<string>;
  /**
   * Phase 13 (D-21): a request's notes as the Document Service holds them, by sequence, each relation as a
   * documentId. No core route reaches the notes, so a persistence comparison reads them here.
   */
  listRequestNotes: (requestDocumentId: string) => Promise<Array<Record<string, unknown>>>;
  /** Phase 13 (D-24): every read state on a request, by reader then id, the reader as a documentId. */
  listRequestNoteReadStates: (requestDocumentId: string) => Promise<Array<Record<string, unknown>>>;
  /**
   * Phase 13 (D-21, T-13-22): how many note rows in the whole database reference no existing request, counted in SQL
   * so a note left behind by a deleted request is found even though no request filter can reach it.
   */
  countOrphanedRequestNotes: () => Promise<number>;
  /**
   * WR-204: how many note and read-state rows the whole database holds, counted in SQL, so a refusal snapshot sees a
   * write that landed on another request or on none, which no request-scoped read can reach.
   */
  countRequestNoteRows: () => Promise<{ notes: number; readStates: number }>;
  /**
   * Phase 13 (D-21): writes `count` notes by Jane on the request straight through the Document Service, with sequences
   * 1 to `count`, so a test can reach the 500-note cap without posting 500 times.
   */
  createRequestNoteFixtures: (requestDocumentId: string, count: number) => Promise<void>;
  /**
   * Phase 13 (D-27, 13-16): writes the given notes on the request straight through the Document Service, each with its
   * own part, sequence, posting time, body and AI-input mark; a Requestor note is Jane's, an analyst note Bob's. Returns
   * the notes' documentIds in the order given.
   */
  seedRequestNotes: (requestDocumentId: string, notes: ReadonlyArray<{ part: "requestor" | "security-analyst"; sequence: number; postedAt: string; body: string; changesAiInputs: boolean }>) => Promise<string[]>;
  /**
   * Gives a user created in a test an `x-csrm-test-identity` label, so the test can call the mounted API as them
   * (Phase 13: the participant-shaped caller Phase 17 will add).
   */
  registerTestIdentity: (label: string, userDocumentId: string) => void;
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
  getAiRun: (documentId: string) => Promise<Record<string, unknown> | null>;
  createAiRunFixture: (data: CreateRunningAiRunInput) => Promise<string>;
  // Phase 15 D-19 (W-1): either envelope family; the run record checks it against the run's operation.
  completeAiRunFixture: (runId: string, proposal: AiRunProposal) => Promise<Record<string, unknown>>;
  failAiRunFixture: (runId: string, code: string, message: string) => Promise<Record<string, unknown>>;
  appendAiRunDecisionsFixture: (runId: string, events: AiRunDecisionEvent[]) => Promise<void>;
  /** Writes fields of an AI run straight through the Document Service, as the Content Manager can (WR-103). */
  updateAiRunFixture: (runId: string, data: Record<string, unknown>) => Promise<void>;
  /** Deletes an AI run, as an administrator can in the Content Manager (WR-103). */
  deleteAiRunFixture: (runId: string) => Promise<void>;
  /** Runs the AI run reconciliation of D-20 against this instance, at `now` when given (WR-01). */
  reconcileInterruptedAiRunsFixture: (now?: () => Date) => Promise<number>;
  getControlImplementation: (documentId: string) => Promise<Record<string, unknown> | null>;
  countRisksForAssessment: (assessmentDocumentId: string) => Promise<number>;
  /** WR-210: an assessment's Risks in an explicit order (risk number, as the analyst's page reads them), with their relations. */
  listRisksForAssessment: (assessmentDocumentId: string) => Promise<Array<Record<string, unknown>>>;
  countControlImplementationsForRisk: (riskDocumentId: string) => Promise<number>;
  /**
   * Creates an IdamBox User. `roles` names seeded CSRM Roles to hold (none when absent): WR-101 needs a user holding both
   * the human Security Analyst and the Security Analyst Agent role, a misconfiguration no seeded identity has.
   */
  createUserFixture: (data: {
    email: string;
    username: string;
    displayName: string;
    accountStatus: "active" | "inactive";
    roles?: ReadonlyArray<"Requestor" | "Security Analyst" | "Security Analyst Agent">;
  }) => Promise<string>;
  /**
   * WR-102: runs `action` while the seeded Role `roleName` holds no Function granting `operation` (a FunctionApi url),
   * then gives the Role its Functions back, so a test can prove what a later catalogue change to one grant would do.
   */
  withRoleOperationWithdrawn: <T>(roleName: "Requestor" | "Security Analyst" | "Security Analyst Agent", operation: string, action: () => Promise<T>) => Promise<T>;
  /** Creates one document of a CSRM content type through the Document Service and returns its documentId. */
  createFixtureDocument: (uid: CsrmFixtureUid, data: Record<string, unknown>) => Promise<string>;
  /** Writes fields of one CSRM document through the Document Service, for seeding states no route produces. */
  updateFixtureDocument: (uid: CsrmFixtureUid, documentId: string, data: Record<string, unknown>) => Promise<void>;
  createAssessmentRequestFixture: (data: {
    requestNumber: string;
    title: string;
    requestStatus: string;
    requestor: "owner" | "otherRequestor";
    dueDate?: string | null;
    submittedDate?: string | null;
    assessmentType?: "BAU" | "Project" | "Other";
    businessCriticality?: "Low" | "Moderate" | "High" | "Critical";
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
  /**
   * CR-101: runs `operation` and, the first time it reaches `before.action` on `before.uid`, runs `intrusion`
   * inside the operation's open transaction as a second, separate transaction. SQLite gives Strapi a single
   * connection, so two real transactions never overlap there; this seam is how a test puts a second mutation
   * into the window between one mutation's reads and its writes. FOR UPDATE row locks are emulated across the
   * two as PostgreSQL holds them (exclusive, until the holding transaction ends): an intrusion that reaches a
   * row the operation has locked stops at that lock, before it writes anything, and is reported `blocked`,
   * which is where PostgreSQL would make it wait for the operation to commit. The caller then runs it again, as
   * the waiting transaction would. This proves the lock protocol; it does not exercise PostgreSQL itself.
   */
  interleaveInTransactionWindow: <T>(input: {
    before: { uid: CsrmFixtureUid; action: "create" | "update" | "delete" };
    operation: () => Promise<T>;
    intrusion: (workflows: InterleavedQuestionnaireWorkflows) => Promise<unknown>;
  }) => Promise<{ result: T; intrusion: InterleavedIntrusionOutcome }>;
  /** CR-101: runs `work` and returns every FOR UPDATE row lock taken meanwhile, in the order taken. */
  recordRowLocks: <T>(work: () => Promise<T>) => Promise<{ result: T; locks: RecordedRowLock[] }>;
  /** Counts a review queue through the running application's own shared bucket counter. */
  countReviewQueueBucketFixture: (bucket: ReviewQueueBucketFixture, activeIds: readonly string[], options?: ReviewQueueCountFixtureOptions) => Promise<number>;
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
  createRiskRegisterMitigationFixture: (
    riskDocumentId: string,
    controlDocumentId: string,
    controlStatus: string,
    data?: Record<string, unknown>,
  ) => Promise<string>;
  /**
   * Writes one stored value straight to its column, past the Document Service's enum validation, so a test can
   * hold a legacy value off the JDL vocabulary (11-15: the register's "none" filters must list it).
   */
  writeStoredValueFixture: (
    table: "csrm_risks" | "csrm_control_implementations",
    documentId: string,
    column: "treatment_status" | "treatment_action" | "effectiveness_rating",
    value: string | null,
  ) => Promise<void>;
  getAdministrationRecord: (kind: AdministrationFixtureKind, documentId: string) => Promise<Record<string, unknown> | null>;
  countAdministrationRecords: (kind: AdministrationFixtureKind) => Promise<number>;
  seedRiskTypesDirectly: (count: number, prefix: string) => Promise<{ targetName: string }>;
  /**
   * `decisions` (19-13): the commit's JSON object of row number to `update` or `skip`, sent as given. `resultToken` and
   * `timeZone` (19-14): the error report's Results token and the viewer's zone; `digest` is sent as `previewDigest`.
   */
  createCsvMultipart: (input: MultipartImportInput) => FormData;
  /** The XLSX sibling of createCsvMultipart (19-13): the same fields, with the workbook media type. */
  createXlsxMultipart: (input: MultipartImportInput) => FormData;
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
  /**
   * 14-04 (D-06): the running instance's attachment storage port, loaded from the compiled application as Strapi
   * loads it, so a test stores and reads bytes exactly as the attachment operations will.
   */
  attachmentStorage: () => AttachmentStorage;
  /** D-15: the private storage directory this instance was booted with; removed when the harness closes. */
  attachmentStorageDirectory: () => string;
  /** The upload plugin's file record, or null: what the storage port wrote beside the bytes. */
  findUploadFileRecord: (fileId: number) => Promise<Record<string, unknown> | null>;
  /** How many upload plugin file records exist; a refused or unmounted upload must leave it unchanged. */
  countUploadFileRecords: () => Promise<number>;
  /**
   * 14-06 (D-01): a request's attachment records as stored, oldest first, with the media relation as `fileId` and
   * every user and note relation as its documentId, so a test reads the facts no response serves (the digest, the
   * scan attempts, the event log).
   */
  listRequestAttachments: (requestDocumentId: string) => Promise<Array<Record<string, unknown>>>;
  /** How many attachment rows exist in the whole database; a refused upload must leave it unchanged. */
  countRequestAttachmentRows: () => Promise<number>;
  /** The names of the files in this instance's private storage directory, sorted; empty before the first upload. */
  listAttachmentStorageFiles: () => Promise<string[]>;
  /**
   * 14-06 (D-10): `count` clean text attachments on a request, each with real stored bytes and a plugin file record
   * through the storage port, uploaded by Jane unless another IdamBox User documentId is named. IN-302: each takes the
   * part the upload would give its uploader (authorPartFor): `requestor` when the uploader raised the request, otherwise
   * `security-analyst`, so a seed never writes a record the upload path cannot produce.
   */
  seedRequestAttachments: (requestDocumentId: string, count: number, uploadedBy?: string) => Promise<string[]>;
  close: () => Promise<void>;
};

export type AuthorizationHttpHarnessOptions = {
  /** D-31: pin the data ceiling for this isolated test run. */
  aiDataClassificationCeiling?: string;
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
  /**
   * D-15: scan with the ClamAV adapter against this host and port (a fake clamd) instead of the development double.
   */
  attachmentScanner?: { kind: "clamav"; host: string; port: number; timeoutMs?: number };
  /**
   * D-06: store attachments in S3 at this endpoint (a fake object store) instead of the private local directory. The
   * SDK gets dummy credentials and the instance-metadata lookup is disabled, so no real AWS endpoint is contacted.
   */
  attachmentStorage?: { kind: "s3"; endpoint: string; bucket: string; kmsKeyId: string };
};

/** The Keycloak subjects a token-verification harness links to the seeded IdamBox Users. */
export const keycloakSubjects = Object.freeze({
  owner: "kc-subject-jane",
  analyst: "kc-subject-bob",
  inactiveAnalyst: "kc-subject-inactive",
  serviceAnalystAgent: "kc-subject-service-agent",
});

/** IN-301: the dummy access key id an S3 harness boot gives the SDK; a presigned URL's credential starts with it. */
export const HARNESS_S3_ACCESS_KEY_ID = "csrm-test-access-key";

/** D-15: every attachment setting a harness boot pins or clears, restored when the harness closes. */
const ATTACHMENT_ENVIRONMENT = [
  "CSRM_ATTACHMENT_STORAGE",
  "CSRM_ATTACHMENT_LOCAL_DIR",
  "CSRM_ATTACHMENT_SCANNER",
  "CSRM_ATTACHMENT_S3_BUCKET",
  "CSRM_ATTACHMENT_S3_REGION",
  "CSRM_ATTACHMENT_S3_KMS_KEY_ID",
  "CSRM_ATTACHMENT_S3_ENDPOINT",
  "CSRM_CLAMAV_HOST",
  "CSRM_CLAMAV_PORT",
  "CSRM_CLAMAV_TIMEOUT_MS",
  // The AWS SDK's own settings: pinned for an S3 boot, cleared otherwise, so a developer's profile is never used.
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_REGION",
  "AWS_PROFILE",
  "AWS_ENDPOINT_URL",
  "AWS_ENDPOINT_URL_S3",
  "AWS_EC2_METADATA_DISABLED",
] as const;

export async function startAuthorizationHttpHarness(options: AuthorizationHttpHarnessOptions = {}): Promise<AuthorizationHttpHarness> {
  const originalEnvironment = new Map(
    ["NODE_ENV", "CSRM_ENVIRONMENT", "CSRM_DEV_IDENTITY", "CSRM_DEV_API_TOKEN", "IDAMBOX_SEED_CORE", "CSRM_AI_PROVIDER", "CSRM_AI_DATA_CLASSIFICATION_CEILING", "CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS", "CSRM_AI_REQUEST_TIMEOUT_MS", "CSRM_CORS_ALLOWED_ORIGINS", "IDAMBOX_KEYCLOAK_PROVISIONING", "IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION", "KEYCLOAK_ISSUER", "KEYCLOAK_TOKEN_CLIENT_ID", ...ATTACHMENT_ENVIRONMENT]
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
  // WR-306: cleared to "", never deleted. Strapi's configuration module runs dotenv when the harness first requires
  // it, and dotenv fills every unset key from the developer's file but never overrides one that exists, even empty.
  process.env.CSRM_DEV_API_TOKEN = "";
  process.env.csrmAppIsEnabled = "true";
  process.env.CSRM_AI_PROVIDER = "deterministic";
  process.env.CSRM_AI_DATA_CLASSIFICATION_CEILING = options.aiDataClassificationCeiling ?? "";
  process.env.CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS = "false";
  // WR-01: the AI run reconciliation bound derives from it, so a developer's .env never moves the bound under a test.
  process.env.CSRM_AI_REQUEST_TIMEOUT_MS = "60000";
  process.env.CSRM_CORS_ALLOWED_ORIGINS = options.corsAllowedOrigins ?? "";
  process.env.STRAPI_DISABLE_UPDATE_NOTIFICATION = "true";
  // Tests never reach Keycloak, whatever the developer .env enables.
  process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "false";
  process.env.IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION = options.keycloakTokenVerification ? "true" : "false";
  if (options.keycloakTokenVerification) {
    process.env.KEYCLOAK_ISSUER = options.keycloakTokenVerification.issuer;
    process.env.KEYCLOAK_TOKEN_CLIENT_ID = options.keycloakTokenVerification.clientId;
  }
  // D-15: attachments boot with this instance's own private directory and the development scanner, under the
  // development key the double requires, so a developer's .env never changes an outcome. Every attachment variable
  // is pinned or cleared, and restored on close. WR-306: a cleared variable is set to "", which attachment-config's
  // setting() and the AWS SDK both read as unset, because dotenv would refill a deleted one (see CSRM_DEV_API_TOKEN).
  const attachmentStorageDirectory = path.join(databaseDir, `attachments-${process.pid}`);
  await rm(attachmentStorageDirectory, { recursive: true, force: true });
  for (const name of ATTACHMENT_ENVIRONMENT) process.env[name] = "";
  process.env.NODE_ENV = "development";
  process.env.CSRM_ENVIRONMENT = "development";
  process.env.CSRM_ATTACHMENT_STORAGE = "local";
  process.env.CSRM_ATTACHMENT_LOCAL_DIR = attachmentStorageDirectory;
  process.env.CSRM_ATTACHMENT_SCANNER = "development";
  if (options.attachmentScanner) {
    process.env.CSRM_ATTACHMENT_SCANNER = "clamav";
    process.env.CSRM_CLAMAV_HOST = options.attachmentScanner.host;
    process.env.CSRM_CLAMAV_PORT = String(options.attachmentScanner.port);
    if (options.attachmentScanner.timeoutMs !== undefined) process.env.CSRM_CLAMAV_TIMEOUT_MS = String(options.attachmentScanner.timeoutMs);
  }
  if (options.attachmentStorage) {
    process.env.CSRM_ATTACHMENT_STORAGE = "s3";
    process.env.CSRM_ATTACHMENT_S3_ENDPOINT = options.attachmentStorage.endpoint;
    process.env.CSRM_ATTACHMENT_S3_BUCKET = options.attachmentStorage.bucket;
    process.env.CSRM_ATTACHMENT_S3_KMS_KEY_ID = options.attachmentStorage.kmsKeyId;
    // Dummy credentials, so the SDK never resolves a real one; kept until close, because the SDK resolves them on first
    // use. IN-301: the fake store checks no signature; a test checks a presigned URL's credential names this key id.
    process.env.AWS_ACCESS_KEY_ID = HARNESS_S3_ACCESS_KEY_ID;
    process.env.AWS_SECRET_ACCESS_KEY = "csrm-test-secret-key";
    process.env.AWS_REGION = "ap-southeast-2";
    process.env.AWS_EC2_METADATA_DISABLED = "true";
  }

  // The public package exports are intentionally loaded dynamically because its
  // declaration surface re-exports Core but does not declare these runtime helpers.
  const strapiPackage = require("@strapi/strapi") as {
    compileStrapi: (options: { appDir: string }) => Promise<{ appDir: string; distDir: string }>;
    createStrapi: (options: { appDir: string; distDir: string }) => RunningStrapi & { load: () => Promise<RunningStrapi> };
  };
  const compiled = await strapiPackage.compileStrapi({ appDir });
  const instance = strapiPackage.createStrapi(compiled);
  const rootRoutes: MountedApplicationRoute[] = [];
  const registerRoutes = instance.server.routes.bind(instance.server);
  // Observe actual root-manager registration before bootstrap; metadata is never synthesized from the manifest.
  instance.server.routes = (definition) => {
    const result = registerRoutes(definition);
    if (definition.type === undefined && Array.isArray(definition.routes)) {
      for (const route of definition.routes) {
        rootRoutes.push({ apiName: "iam-scim", routerName: "root", method: route.method.toUpperCase(),
          path: `${definition.prefix ?? ""}${route.path}`, handler: qualifiedHandler("iam-scim", route.handler),
          config: structuredClone(route.config ?? {}) });
      }
    }
    return result;
  };
  const strapi = await instance.load();
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
  // A second active human Security Analyst: every analyst reads a request's generation jobs (D-25, D-47), and only
  // the one who started a job may retry it, so the shared read needs another analyst to prove the difference.
  const secondAnalyst = await createDocument(strapi, "api::idambox-user.idambox-user", { email: "second.analyst@example.test", username: "second-analyst", displayName: "Second Analyst", accountStatus: "active", roles: [analystRole.documentId] });

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
  testIdentities.set("second-analyst", { documentId: secondAnalyst.documentId });
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
  // Synchronous SQLite fixture work can block the event loop past Node's 5-second keep-alive
  // timeout. The next fetch then reuses a pooled socket that the server closes in the same
  // turn, and a non-idempotent POST surfaces it as ECONNRESET. Outlast any fixture stretch.
  (strapi.server.httpServer as unknown as { keepAliveTimeout: number }).keepAliveTimeout = 120_000;

  let workflowFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedRequestWorkflowFixtures"]>> | null = null;
  let questionnaireFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedQuestionnaireWorkflowFixtures"]>> | null = null;
  let questionnaireGovernanceFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedQuestionnaireGovernanceFixtures"]>> | null = null;
  let conditionalQuestionnaireFixture: Awaited<ReturnType<AuthorizationHttpHarness["seedConditionalQuestionnaireFixture"]>> | null = null;
  let concurrentQuestionnaireFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedConcurrentQuestionnaireFixtures"]>> | null = null;
  let assessmentWorkflowFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedAssessmentWorkflowFixtures"]>> | null = null;
  let uatALikeFixture: Awaited<ReturnType<AuthorizationHttpHarness["seedUatALikeFixture"]>> | null = null;
  let administrationFixtures: Awaited<ReturnType<AuthorizationHttpHarness["seedAdministrationFixtures"]>> | null = null;
  let lifecycleQuestionnaireSequence = 0;
  const jobObservations: AssessmentJobObservation[] = [];

  /*
   * CR-101 row-lock observation. The mounted Strapi query builder is wrapped once, on first use, so every
   * FOR UPDATE lock a workflow takes (`where({ documentId })`, `forUpdate()`, `transacting(trx)`, `execute()`)
   * is reported to the current observers with the transaction that holds it. A lock taken inside an
   * intrusion is owned by that intrusion's logical transaction, not by the transaction it shares.
   */
  type RowLock = { uid: string; documentId: string; owner: object; transaction: { isCompleted?: () => boolean } };
  const rowLockObservers = new Set<(lock: RowLock) => void>();
  const logicalTransaction = new AsyncLocalStorage<object>();
  let rowLocksObserved = false;
  const observeRowLocks = (observer: (lock: RowLock) => void): (() => void) => {
    if (!rowLocksObserved) {
      rowLocksObserved = true;
      const database = strapi.db as unknown as { queryBuilder: (uid: string) => Record<string, (...args: unknown[]) => unknown> };
      const originalQueryBuilder = database.queryBuilder.bind(database);
      database.queryBuilder = (uid: string) => {
        const builder = originalQueryBuilder(uid);
        if (rowLockObservers.size === 0) return builder;
        let where: unknown;
        let forUpdate = false;
        let transaction: unknown;
        const intercept = (name: string, record: (args: unknown[]) => void) => {
          const original = builder[name];
          builder[name] = (...args: unknown[]) => {
            record(args);
            return original.apply(builder, args);
          };
        };
        intercept("where", ([value]) => { where = value; });
        intercept("forUpdate", () => { forUpdate = true; });
        intercept("transacting", ([value]) => { transaction = value; });
        intercept("execute", () => {
          const documentId = typeof where === "object" && where !== null ? (where as Record<string, unknown>).documentId : undefined;
          // A knex transaction is a callable object.
          if (!forUpdate || (typeof transaction !== "object" && typeof transaction !== "function") || transaction === null || typeof documentId !== "string") return;
          const lock: RowLock = { uid, documentId, owner: logicalTransaction.getStore() ?? transaction, transaction: transaction as RowLock["transaction"] };
          for (const notify of rowLockObservers) notify(lock);
        });
        return builder;
      };
    }
    rowLockObservers.add(observer);
    return () => { rowLockObservers.delete(observer); };
  };
  class EmulatedRowLockWait extends Error {
    constructor(readonly lock: string) {
      super(`The intrusion would wait for the row lock on ${lock}.`);
    }
  }
  const interleavedQuestionnaireWorkflows = (): InterleavedQuestionnaireWorkflows => {
    const servicesDir = path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services");
    const governance = require(path.join(servicesDir, "questionnaire-governance-workflow.js")) as {
      releaseQuestionnaire: (input: Record<string, unknown>) => Promise<unknown>;
      addQuestionnaireQuestion: (input: Record<string, unknown>) => Promise<unknown>;
    };
    const generation = require(path.join(servicesDir, "questionnaire-generation-workflow.js")) as {
      persistGeneratedQuestionnaire: (strapi: unknown, requestId: string, analystId: string, replace: boolean) => Promise<unknown>;
    };
    const asAnalyst = { strapi, actor: "analyst", actorDocumentId: analyst.documentId };
    return {
      release: (questionnaireDocumentId) => governance.releaseQuestionnaire({ ...asAnalyst, questionnaireDocumentId, body: undefined }),
      addQuestion: (questionnaireDocumentId, body) => governance.addQuestionnaireQuestion({ ...asAnalyst, questionnaireDocumentId, body }),
      replaceQuestionnaire: (requestDocumentId) => generation.persistGeneratedQuestionnaire(strapi, requestDocumentId, analyst.documentId, true),
    };
  };

  /*
   * Phase 15 (15-06): the proposal workflow and providers as the mounted instance loaded them, so a fixture call shares
   * the instance's job registry and a patched provider is the one its jobs call.
   */
  type MountedProposalWorkflow = {
    startQuestionnaireProposals: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    startQuestionRewrite: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    getQuestionnaireProposalJob: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    retryQuestionnaireProposalJob: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    settledQuestionnaireProposalJob: (strapi: unknown, jobId: string) => Promise<Record<string, unknown> | null>;
    activeQuestionnaireProposalJobs: (strapi: unknown, questionnaireId: string) => ReadonlyArray<Record<string, unknown>>;
    QuestionnaireProposalWorkflowError: new (...args: never[]) => Error & { status: number; reason?: string };
  };
  const mountedProposalWorkflow = (): MountedProposalWorkflow => require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "questionnaire-proposals-workflow.js")) as MountedProposalWorkflow;
  const mountedProposalProviders = () => {
    const providerModule = require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "deterministic-questionnaire-proposal-provider.js")) as {
      deterministicQuestionnaireProposalProvider: InjectableQuestionnaireProposalProvider;
      deterministicQuestionRewriteProvider: InjectableQuestionRewriteProvider;
    };
    return { proposals: providerModule.deterministicQuestionnaireProposalProvider, rewrites: providerModule.deterministicQuestionRewriteProvider };
  };
  const proposalFixtureCall = async (success: number, call: (workflow: MountedProposalWorkflow) => Promise<Record<string, unknown>>): Promise<ProposalFixtureResponse> => {
    const workflow = mountedProposalWorkflow();
    try {
      return { status: success, data: await call(workflow) };
    } catch (error) {
      if (!(error instanceof workflow.QuestionnaireProposalWorkflowError)) throw error;
      return { status: error.status, ...(error.reason ? { reason: error.reason } : {}), message: error.message };
    }
  };

  /* Phase 15 (15-07): the Requestor's mounted answer services, their refusals returned as the routes answer them. */
  type MountedQuestionnaireWorkflow = {
    saveAnswers: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    submitQuestionnaire: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    QuestionnaireWorkflowError: new (...args: never[]) => Error & { status: number; reason?: string };
  };
  const questionnaireServiceCall = async (call: (workflow: MountedQuestionnaireWorkflow) => Promise<Record<string, unknown>>): Promise<ProposalFixtureResponse> => {
    const workflow = require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "questionnaire-workflow.js")) as MountedQuestionnaireWorkflow;
    try {
      return { status: 200, data: await call(workflow) };
    } catch (error) {
      if (!(error instanceof workflow.QuestionnaireWorkflowError)) throw error;
      return { status: error.status, ...(error.reason ? { reason: error.reason } : {}), message: error.message };
    }
  };

  /*
   * IN-207: the deterministic draft proposes Risks only of the Risk Types with its three exact names, so the UAT-A-like
   * library gives its types those names (and Payment Integrity), and its controls reach the draft as suggestions. A Risk
   * Type's name is unique and the assessment workflow fixtures use the same three names, so whichever seeder runs second
   * adds its applicable controls to the type the first created.
   */
  const ensureRiskType = async (name: string, description: string, controlIds: readonly string[]): Promise<string> => {
    const riskTypes = strapi.documents("api::csrm-risk-type.csrm-risk-type") as unknown as {
      findMany: (input: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
      update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
    };
    const [existing] = await riskTypes.findMany({ filters: { name: { $eq: name } }, populate: { applicableControls: true }, limit: 1 });
    if (!existing) return (await createDocument(strapi, "api::csrm-risk-type.csrm-risk-type", { name, description, applicableControls: [...controlIds] })).documentId;
    const current = (Array.isArray(existing.applicableControls) ? existing.applicableControls : []).map((control) => String((control as { documentId: unknown }).documentId));
    await riskTypes.update({ documentId: String(existing.documentId), data: { applicableControls: [...new Set([...current, ...controlIds])] } });
    return String(existing.documentId);
  };

  /* The UAT-A-like request: systems, the Restricted asset, the Privacy Act and TFN obligations, a payroll processor. */
  const createUatALikeRequest = async (suffix: string, library: { systemIds: string[]; assetIds: string[] }) => {
    const request = await createDocument(strapi, "api::csrm-assessment-request.csrm-assessment-request", { requestNumber: `UATA-SECRET-${suffix}`, title: "Payroll platform change", description: "Unsigned payment files could be altered.", assessmentType: "Project", division: "Corporate", businessUnit: "People and Finance", businessPurpose: "Pay employees", businessCriticality: "High", thirdPartyInvolvement: true, thirdPartyDetails: "External payroll processor", regulatoryRequirements: "Privacy Act 1988 and tax file number obligations", requestStatus: "questionnaire-in-progress", requestor: owner.documentId, informationSystems: library.systemIds, informationAssets: library.assetIds });
    const questionnaire = await createDocument(strapi, "api::csrm-questionnaire.csrm-questionnaire", { questionnaireNumber: `UATA-QUES-${suffix}`, title: "Payroll controls", assessmentRequest: request.documentId, ...releaseFacts(analyst.documentId) });
    const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not-sure", label: "Not sure" }];
    for (const [index, item] of [
      { key: "payment-files", text: "Are payment files signed?", value: "Unsigned payment files", help: "Describe the integrity control." },
      { key: "duties", text: "Are duties segregated?", value: "Partial segregation of duties", help: "Describe approval roles." },
      /*
       * WR-204: the fallback question carries the key the deterministic questionnaire gives its recovery question, so the
       * deterministic draft cites this answer and lists the claim no source supports as uncited (UAT-042).
       */
      { key: "recovery-tested", text: "Has the pay-run fallback been tested?", value: "no", help: "Include test results.", answerType: "Single select", choices: yesNo },
      { key: "optional", text: "Other recovery notes?", value: null, help: "Optional." },
    ].entries()) await createDocument(strapi, "api::csrm-question.csrm-question", { questionText: item.text, helpText: item.help, answerType: item.answerType ?? "Long text", options: { schemaVersion: 1, questionKey: item.key, section: { key: "payment", title: "Payment processing", order: 1 }, order: index + 1, required: index < 3, ...(item.choices ? { choices: item.choices } : {}) }, answer: { schemaVersion: 1, value: item.value, state: "submitted", updatedAt: "2026-08-30T00:00:00.000Z", submittedAt: "2026-08-30T00:00:00.000Z" }, questionnaire: questionnaire.documentId });
    return { requestId: request.documentId, questionnaireId: questionnaire.documentId };
  };
  /* The UAT-A-like library and its first request, seeded once per harness. */
  const seedUatALikeLibrary = async (): Promise<Awaited<ReturnType<AuthorizationHttpHarness["seedUatALikeFixture"]>>> => {
    if (uatALikeFixture) return uatALikeFixture;
    const controlNames = ["File integrity verification", "Segregation of duties", "Backup recovery testing", "Privileged access review", "Payroll reconciliation", "Payment approval", "Audit logging", "Change control", "Incident response", "Supplier assurance", "Encryption at rest", "Access recertification"];
    const controls = [];
    for (const [index, name] of controlNames.entries()) controls.push(await createDocument(strapi, "api::csrm-control.csrm-control", { controlNumber: `UATA-${String(index + 1).padStart(3, "0")}`, name, description: name, controlType: "Preventive", framework: "Mounted test framework", frameworkVersion: "1" }));
    const riskTypeIds: string[] = [];
    for (const [index, name] of ["Internet Exposure", "Personal Information Handling", "Third-Party Dependency", "Payment Integrity"].entries()) riskTypeIds.push(await ensureRiskType(name, `${name} risk`, controls.slice(index, index + 3).map((control) => control.documentId)));
    const systems = [];
    for (const data of [
      { name: "HR and payroll platform", description: "Internet-facing pay processing", environment: "Production", deploymentModel: "SaaS", internetFacing: true },
      { name: "Finance system", description: "Payment reconciliation", environment: "Production" },
      { name: "Identity provider", description: "Workforce access", environment: "Production" },
    ]) systems.push(await createDocument(strapi, "api::csrm-information-system.csrm-information-system", data));
    const asset = await createDocument(strapi, "api::csrm-information-asset.csrm-information-asset", { name: "Employee payment details", description: "Personal and bank details", type: "Data", dataClassification: "Restricted", containsPersonalData: true, comments: "Private asset comment" });
    const library = { systemIds: systems.map((system) => system.documentId), assetIds: [asset.documentId] };
    const { requestId, questionnaireId } = await createUatALikeRequest("001", library);
    uatALikeFixture = { requestId, questionnaireId, ...library, riskTypeIds, controlIds: controls.map((control) => control.documentId) };
    return uatALikeFixture;
  };

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    identities: { owner: "owner", otherRequestor: "other", analyst: "analyst", secondAnalyst: "second-analyst", analystAgent: "agent", serviceAnalystAgent: "service-agent", inactiveAnalyst: "inactive" },
    developmentEmails: { jane: "jane.doe@idambox.com", bob: "bob.doe@idambox.com", inactive: "inactive@idambox.com", unknown: "unknown@idambox.com" },
    users: {
      owner: owner.documentId,
      otherRequestor: otherRequestor.documentId,
      analyst: analyst.documentId,
      secondAnalyst: secondAnalyst.documentId,
      serviceAnalystAgent: serviceAnalystAgent.documentId,
      inactiveAnalyst: inactiveAnalyst.documentId,
    },
    requests: { owner: ownerRequest.documentId, otherRequestor: otherRequest.documentId },
    seedUatALikeFixture: seedUatALikeLibrary,
    async seedUatALikeRequest(label) {
      return createUatALikeRequest(label, await seedUatALikeLibrary());
    },
    buildAssessmentContextFixture: (input) => buildAssessmentContextFor(strapi as unknown as AssessmentContextStrapi, input),
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
      // IN-207: the UAT-A-like library may already hold these names; each seeder adds its applicable controls.
      await Promise.all(["Internet Exposure", "Personal Information Handling", "Third-Party Dependency"].map((name) =>
        ensureRiskType(name, `Mounted deterministic ${name}`, [control.documentId])));

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
    async withHeldAssessmentDraftProvider(action) {
      const provider = (require(path.join(appDir, "dist", "src", "api", "csrm-assessment", "services", "deterministic-assessment-draft-provider.js")) as {
        deterministicAssessmentDraftProvider: InjectableAssessmentDraftProvider;
      }).deterministicAssessmentDraftProvider;
      const originalGenerate = provider.generate;
      let releaseGate: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { releaseGate = resolve; });
      let signalReached: () => void = () => undefined;
      const reached = new Promise<void>((resolve) => { signalReached = resolve; });
      provider.generate = async (...args: unknown[]) => {
        signalReached();
        await gate;
        return originalGenerate.apply(provider, args);
      };
      try {
        return await action(reached);
      } finally {
        releaseGate();
        provider.generate = originalGenerate;
      }
    },
    async withHeldAiContext(action) {
      // Both generation workflows call the loader through its module object, so the mounted instance takes this hold.
      const loader = require(path.join(appDir, "dist", "src", "csrm", "ai", "assessment-context-loader.js")) as {
        buildAssessmentContextFor: (...args: unknown[]) => Promise<unknown>;
      };
      const originalBuild = loader.buildAssessmentContextFor;
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let signalReached: () => void = () => undefined;
      const reached = new Promise<void>((resolve) => { signalReached = resolve; });
      loader.buildAssessmentContextFor = async (...args: unknown[]) => {
        signalReached();
        await gate;
        return originalBuild(...args);
      };
      try {
        return await action({ reached, release });
      } finally {
        release();
        loader.buildAssessmentContextFor = originalBuild;
      }
    },
    async withHeldScreening(action) {
      const screening = require(path.join(appDir, "dist", "src", "csrm", "files", "screen-attachment.js")) as {
        screenAttachment: (...args: unknown[]) => Promise<unknown>;
      };
      const originalScreen = screening.screenAttachment;
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let signalReached: () => void = () => undefined;
      const reached = new Promise<void>((resolve) => { signalReached = resolve; });
      let held = false;
      screening.screenAttachment = async (...args: unknown[]) => {
        if (!held) {
          held = true;
          signalReached();
          await gate;
        }
        return originalScreen(...args);
      };
      try {
        return await action({ reached, release });
      } finally {
        release();
        screening.screenAttachment = originalScreen;
      }
    },
    async withFullExtractionQueue(action) {
      const queue = require(path.join(appDir, "dist", "src", "csrm", "files", "extraction.js")) as {
        runExclusively?: (task: () => Promise<unknown>) => Promise<unknown>;
        EXTRACTION_QUEUE_MAX_WAITING?: number;
      };
      const { runExclusively, EXTRACTION_QUEUE_MAX_WAITING: waitingPlaces } = queue;
      assert.ok(typeof runExclusively === "function" && typeof waitingPlaces === "number", "THE_EXTRACTION_QUEUE_IS_NOT_BOUNDED");
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const tasks = [runExclusively(() => gate), ...Array.from({ length: waitingPlaces }, () => runExclusively(async () => undefined))];
      try {
        return await action();
      } finally {
        release();
        await Promise.allSettled(tasks);
      }
    },
    async withHeldRequestLock(requestDocumentId, action) {
      const lockModule = require(path.join(appDir, "dist", "src", "api", "csrm-assessment-request", "services", "request-lock.js")) as {
        withRequestLock: (lockStrapi: unknown, documentId: string, work: (trx: unknown) => Promise<unknown>) => Promise<unknown>;
      };
      type Counter = { count: (query: { where?: Record<string, unknown> }) => Promise<number> };
      const database = strapi.db as unknown as { transaction: (...args: unknown[]) => Promise<unknown>; query: (uid: string) => Counter };
      const engine = database.query("api::csrm-request-attachment.csrm-request-attachment");
      const originalLock = lockModule.withRequestLock;
      const ownTransaction = Object.prototype.hasOwnProperty.call(database, "transaction");
      const originalTransaction = database.transaction;
      const originalCount = engine.count;
      // Each watched call runs inside its own scope, so the database calls it makes from inside the lock are its own.
      const scope = new AsyncLocalStorage<WatchedRequestLockCall>();
      const calls: WatchedRequestLockCall[] = [];
      let admitFirst: () => void = () => undefined;
      const door = new Promise<void>((resolve) => { admitFirst = resolve; });
      let signalAtDoor: () => void = () => undefined;
      const atDoor = new Promise<void>((resolve) => { signalAtDoor = resolve; });
      let releaseCount: () => void = () => undefined;
      const countGate = new Promise<void>((resolve) => { releaseCount = resolve; });
      let signalCountHeld: (count: number) => void = () => undefined;
      const countHeld = new Promise<number>((resolve) => { signalCountHeld = resolve; });
      let countHoldTaken = false;
      lockModule.withRequestLock = async (lockStrapi, documentId, work) => {
        if (documentId !== requestDocumentId) return originalLock(lockStrapi, documentId, work);
        const call: WatchedRequestLockCall = { transactionRequested: false, activeCounts: [] };
        calls.push(call);
        if (calls.length === 1) {
          signalAtDoor();
          await door;
        }
        return scope.run(call, () => originalLock(lockStrapi, documentId, work));
      };
      database.transaction = function (this: unknown, ...args: unknown[]) {
        const call = scope.getStore();
        if (call) call.transactionRequested = true;
        return originalTransaction.apply(this, args);
      };
      engine.count = async (query) => {
        const value = await originalCount.call(engine, query);
        const call = scope.getStore();
        if (call && query?.where !== undefined && "scanStatus" in query.where) {
          call.activeCounts.push(Number(value));
          if (!countHoldTaken) {
            countHoldTaken = true;
            signalCountHeld(Number(value));
            await countGate;
          }
        }
        return value;
      };
      try {
        return await action({ atDoor, admitFirst, countHeld, releaseCount, calls: () => calls.map((call) => ({ ...call, activeCounts: [...call.activeCounts] })) });
      } finally {
        admitFirst();
        releaseCount();
        lockModule.withRequestLock = originalLock;
        if (ownTransaction) database.transaction = originalTransaction;
        else delete (database as { transaction?: unknown }).transaction;
        engine.count = originalCount;
      }
    },
    async withAiDataClassificationCeiling(ceiling, action) {
      const config = (strapi as unknown as { config: { get: (key: string) => unknown; set: (key: string, value: unknown) => unknown } }).config;
      const booted = config.get("ai.dataClassificationCeiling");
      config.set("ai.dataClassificationCeiling", ceiling);
      try {
        return await action();
      } finally {
        config.set("ai.dataClassificationCeiling", booted);
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
    async interleaveInTransactionWindow({ before, operation, intrusion }) {
      const held = new Map<string, RowLock>();
      const stopObserving = observeRowLocks((lock) => {
        const key = `${lock.uid}:${lock.documentId}`;
        const holder = held.get(key);
        if (holder && holder.owner !== lock.owner && !holder.transaction.isCompleted?.()) throw new EmulatedRowLockWait(key);
        held.set(key, lock);
      });
      let outcome: InterleavedIntrusionOutcome = { outcome: "not-reached" };
      let armed = true;
      const documents = strapi.documents as unknown as {
        use: (middleware: (context: { uid: string; action: string }, next: () => Promise<unknown>) => Promise<unknown>) => () => void;
      };
      const stopIntercepting = documents.use(async (context, next) => {
        if (armed && context.uid === before.uid && context.action === before.action) {
          armed = false;
          try {
            await logicalTransaction.run({ intrusion: before }, () => intrusion(interleavedQuestionnaireWorkflows()));
            outcome = { outcome: "committed" };
          } catch (error) {
            outcome = error instanceof EmulatedRowLockWait ? { outcome: "blocked", lock: error.lock } : { outcome: "failed", error };
          }
        }
        return next();
      });
      try {
        const result = await operation();
        return { result, intrusion: outcome };
      } finally {
        stopIntercepting();
        stopObserving();
      }
    },
    async recordRowLocks(work) {
      const transactions = new Map<object, number>();
      const locks: RecordedRowLock[] = [];
      const stopObserving = observeRowLocks((lock) => {
        if (!transactions.has(lock.owner)) transactions.set(lock.owner, transactions.size + 1);
        locks.push({ transaction: transactions.get(lock.owner) as number, uid: lock.uid, documentId: lock.documentId });
      });
      try {
        return { result: await work(), locks };
      } finally {
        stopObserving();
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
    async getRequestAssignment(documentId) {
      const request = await (strapi.documents("api::csrm-assessment-request.csrm-assessment-request") as StrapiDocumentService & {
        findOne: (input: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      }).findOne({
        documentId,
        fields: ["assignedAt", "assignmentLog"],
        populate: { assignedAnalyst: { fields: ["documentId"] }, assignedBy: { fields: ["documentId"] } },
      });
      if (!request) return null;
      const relationId = (value: unknown): string | null => (typeof value === "object" && value !== null
        && typeof (value as { documentId?: unknown }).documentId === "string" ? (value as { documentId: string }).documentId : null);
      return {
        assignedAnalyst: relationId(request.assignedAnalyst),
        assignedBy: relationId(request.assignedBy),
        assignedAt: request.assignedAt ?? null,
        assignmentLog: request.assignmentLog ?? null,
      };
    },
    async listTableColumns(table) {
      if (!/^[a-z_]+$/.test(table)) throw new Error(`TABLE_NAME_INVALID_${table}`);
      const connection = (strapi as unknown as { db: { connection: { raw: (sql: string) => Promise<unknown> } } }).db.connection;
      const rows = await connection.raw(`PRAGMA table_info(${table})`) as Array<{ name: string }>;
      return rows.map((row) => row.name);
    },
    async riskHistoryRowsFixture(riskDocumentId) {
      const rows = await strapi.documents("api::csrm-risk-history-event.csrm-risk-history-event").findMany({
        filters: { risk: { documentId: { $eq: riskDocumentId } } },
        populate: { actor: { fields: ["documentId"] }, assessment: { fields: ["documentId"] }, risk: { fields: ["documentId"] }, aiRun: { fields: ["documentId"] } },
        sort: ["id:asc"],
        limit: 10_000,
      });
      const relationId = (value: unknown): string | null => (typeof value === "object" && value !== null
        && typeof (value as { documentId?: unknown }).documentId === "string" ? (value as { documentId: string }).documentId : null);
      return rows.map((row) => {
        const { actor, assessment, risk, aiRun, ...rest } = row as Record<string, unknown>;
        return { ...rest, actor: relationId(actor), assessment: relationId(assessment), risk: relationId(risk), aiRun: relationId(aiRun) };
      });
    },
    async riskWithdrawalFactsFixture(riskDocumentId) {
      const risk = await strapi.documents("api::csrm-risk.csrm-risk").findOne?.({
        documentId: riskDocumentId,
        populate: { withdrawnBy: { fields: ["documentId"] } },
      });
      if (!risk) return null;
      const withdrawnBy = risk.withdrawnBy;
      return {
        withdrawnAt: risk.withdrawnAt ?? null,
        withdrawnBy: typeof withdrawnBy === "object" && withdrawnBy !== null && typeof (withdrawnBy as { documentId?: unknown }).documentId === "string"
          ? (withdrawnBy as { documentId: string }).documentId : null,
        withdrawalReason: risk.withdrawalReason ?? null,
      };
    },
    async setRiskWithdrawalFactsFixture(riskDocumentId, facts) {
      await strapi.documents("api::csrm-risk.csrm-risk").update?.({ documentId: riskDocumentId, data: { ...facts } });
    },
    async writeRawHistoryRowFixture(row) {
      const created = await createDocument(strapi, "api::csrm-risk-history-event.csrm-risk-history-event", row);
      return created.documentId;
    },
    async listRequestNotes(requestDocumentId) {
      const notes = await (strapi.documents("api::csrm-request-note.csrm-request-note") as StrapiDocumentService).findMany({
        filters: { assessmentRequest: { documentId: { $eq: requestDocumentId } } },
        fields: ["documentId", "sequence", "body", "authorPart", "postedAt", "changesAiInputs", "aiInputLog"],
        populate: { author: { fields: ["documentId"] } },
        sort: ["sequence:asc", "id:asc"],
        limit: 10_000,
      });
      return notes.map((note) => {
        const { author, ...rest } = note as Record<string, unknown>;
        const authorId = typeof author === "object" && author !== null ? (author as { documentId?: unknown }).documentId ?? null : null;
        return { ...rest, author: authorId };
      });
    },
    async listRequestNoteReadStates(requestDocumentId) {
      const states = await (strapi.documents("api::csrm-request-note.csrm-request-note-read-state") as StrapiDocumentService).findMany({
        filters: { assessmentRequest: { documentId: { $eq: requestDocumentId } } },
        fields: ["documentId", "lastReadSequence", "lastReadAt"],
        populate: { reader: { fields: ["documentId"] } },
        sort: ["id:asc"],
        limit: 10_000,
      });
      return states.map((state) => {
        const { reader, ...rest } = state as Record<string, unknown>;
        const readerId = typeof reader === "object" && reader !== null ? (reader as { documentId?: unknown }).documentId ?? null : null;
        return { ...rest, reader: readerId };
      });
    },
    async countOrphanedRequestNotes() {
      const connection = (strapi as unknown as { db: { connection: { raw: (sql: string) => Promise<unknown> } } }).db.connection;
      const rows = await connection.raw(`SELECT COUNT(*) AS orphaned FROM csrm_request_notes n WHERE NOT EXISTS (
        SELECT 1 FROM csrm_request_notes_assessment_request_lnk l
        JOIN csrm_assessment_requests r ON r.id = l.csrm_assessment_request_id
        WHERE l.csrm_request_note_id = n.id
      )`) as Array<{ orphaned: number | string }>;
      return Number(rows[0]?.orphaned ?? Number.NaN);
    },
    async countRequestNoteRows() {
      const connection = (strapi as unknown as { db: { connection: { raw: (sql: string) => Promise<unknown> } } }).db.connection;
      const rows = await connection.raw(`SELECT
        (SELECT COUNT(*) FROM csrm_request_notes) AS notes,
        (SELECT COUNT(*) FROM csrm_request_note_read_states) AS read_states`) as Array<{ notes: number | string; read_states: number | string }>;
      return { notes: Number(rows[0]?.notes ?? Number.NaN), readStates: Number(rows[0]?.read_states ?? Number.NaN) };
    },
    async createRequestNoteFixtures(requestDocumentId, count) {
      for (let index = 1; index <= count; index += 1) {
        await createDocument(strapi, "api::csrm-request-note.csrm-request-note", {
          body: `Seeded note ${index}`,
          authorPart: "requestor",
          sequence: index,
          postedAt: new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString(),
          changesAiInputs: false,
          assessmentRequest: requestDocumentId,
          author: owner.documentId,
        });
      }
    },
    async seedRequestNotes(requestDocumentId, notes) {
      const ids: string[] = [];
      for (const note of notes) {
        const created = await createDocument(strapi, "api::csrm-request-note.csrm-request-note", {
          body: note.body,
          authorPart: note.part,
          sequence: note.sequence,
          postedAt: note.postedAt,
          changesAiInputs: note.changesAiInputs,
          assessmentRequest: requestDocumentId,
          author: note.part === "requestor" ? owner.documentId : analyst.documentId,
        });
        ids.push(created.documentId);
      }
      return ids;
    },
    registerTestIdentity(label, userDocumentId) {
      testIdentities.set(label, { documentId: userDocumentId });
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
        populate: { assessmentRequest: { populate: { requestor: true } }, approvedBy: true, generatedBy: true,
          risks: { populate: { riskType: true, informationSystemImpacted: true, informationAssetImpacted: true, controlImplementations: true } } },
      })) ?? null;
    },
    async getRisk(documentId) {
      return (await strapi.documents("api::csrm-risk.csrm-risk").findOne?.({
        documentId,
        populate: { assessment: true, riskType: true, riskOwner: true, controlImplementations: true },
      })) ?? null;
    },
    async withQuestionnaireProviderFailureCode(code, safeMessage, action) {
      const providerModule = require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "deterministic-questionnaire-generation-provider.js")) as { deterministicQuestionnaireGenerationProvider: InjectableQuestionnaireGenerationProvider };
      const registryModule = require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "questionnaire-generation-registry.js")) as { QuestionnaireGenerationJobFailure: new (failureCode: string, failureMessage: string) => Error };
      const provider = providerModule.deterministicQuestionnaireGenerationProvider;
      const originalGenerate = provider.generate;
      provider.generate = async () => { throw new registryModule.QuestionnaireGenerationJobFailure(code, safeMessage); };
      try { return await action(); } finally { provider.generate = originalGenerate; }
    },
    async withQuestionnaireProviderOutput(generate, action) {
      const provider = (require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "deterministic-questionnaire-generation-provider.js")) as { deterministicQuestionnaireGenerationProvider: InjectableQuestionnaireGenerationProvider }).deterministicQuestionnaireGenerationProvider;
      const originalGenerate = provider.generate;
      provider.generate = async () => generate();
      try { return await action(); } finally { provider.generate = originalGenerate; }
    },
    async withAssessmentDraftProviderOutput(transform, action) {
      const provider = (require(path.join(appDir, "dist", "src", "api", "csrm-assessment", "services", "deterministic-assessment-draft-provider.js")) as { deterministicAssessmentDraftProvider: InjectableAssessmentDraftProvider }).deterministicAssessmentDraftProvider;
      const originalGenerate = provider.generate;
      provider.generate = async (...args: unknown[]) => transform(await originalGenerate.apply(provider, args) as Record<string, unknown>);
      try { return await action(); } finally { provider.generate = originalGenerate; }
    },
    async listAiRunsForRequest(requestId) {
      const rows = await strapi.documents("api::csrm-ai-run.csrm-ai-run" as Parameters<typeof strapi.documents>[0]).findMany?.({ filters: { assessmentRequest: { documentId: { $eq: requestId } } }, populate: { initiatedBy: true, questionnaire: true }, sort: "startedAt:asc", limit: 1000 });
      return (rows ?? []) as Array<Record<string, unknown>>;
    },
    async runQuestionnaireGenerationJobFixture(requestId, analystId) {
      const workflow = require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "questionnaire-generation-workflow.js")) as {
        persistGeneratedQuestionnaire: (strapi: unknown, requestId: string, analystId: string, replace: boolean) => Promise<{ questionnaireId: string }>;
      };
      return workflow.persistGeneratedQuestionnaire(strapi, requestId, analystId, false);
    },
    async runAssessmentDraftJobFixture(questionnaireId, analystId) {
      const workflow = require(path.join(appDir, "dist", "src", "api", "csrm-assessment", "services", "assessment-workflow.js")) as {
        persistAssessmentDraft: (strapi: unknown, job: Record<string, unknown>) => Promise<{ assessmentId: string }>;
      };
      return workflow.persistAssessmentDraft(strapi, { jobId: "policy-fixture", questionnaireId, initiatingAnalystDocumentId: analystId, providerName: "deterministic", providerVersion: "1", attempt: 1 });
    },
    async withProviderCallRecorder(action) {
      const questionnaire = (require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "deterministic-questionnaire-generation-provider.js")) as { deterministicQuestionnaireGenerationProvider: InjectableQuestionnaireGenerationProvider }).deterministicQuestionnaireGenerationProvider;
      const assessment = (require(path.join(appDir, "dist", "src", "api", "csrm-assessment", "services", "deterministic-assessment-draft-provider.js")) as { deterministicAssessmentDraftProvider: InjectableAssessmentDraftProvider }).deterministicAssessmentDraftProvider;
      const { proposals, rewrites } = mountedProposalProviders();
      const originalQuestionnaire = questionnaire.generate;
      const originalAssessment = assessment.generate;
      const originalPropose = proposals.propose;
      const originalRewrite = rewrites.rewrite;
      let questionnaireCalls = 0;
      let assessmentCalls = 0;
      let proposalCalls = 0;
      let rewriteCalls = 0;
      questionnaire.generate = async (...args) => { questionnaireCalls++; return originalQuestionnaire(...args); };
      assessment.generate = async (...args) => { assessmentCalls++; return originalAssessment(...args); };
      // H-1: the proposal providers are counted the same way, each call reaching the provider the job would use.
      proposals.propose = async (...args) => { proposalCalls++; return originalPropose.apply(proposals, args); };
      rewrites.rewrite = async (...args) => { rewriteCalls++; return originalRewrite.apply(rewrites, args); };
      try { return await action({ questionnaire: () => questionnaireCalls, assessment: () => assessmentCalls, proposals: () => proposalCalls, rewrites: () => rewriteCalls }); }
      finally { questionnaire.generate = originalQuestionnaire; assessment.generate = originalAssessment; proposals.propose = originalPropose; rewrites.rewrite = originalRewrite; }
    },
    startQuestionnaireProposalsFixture(analystId, questionnaireId, body) {
      return proposalFixtureCall(202, (workflow) => workflow.startQuestionnaireProposals({ strapi, questionnaireId, body, analystDocumentId: analystId, humanAnalyst: true }));
    },
    startQuestionRewriteFixture(analystId, questionnaireId, questionId, body) {
      return proposalFixtureCall(202, (workflow) => workflow.startQuestionRewrite({ strapi, questionnaireId, questionId, body, analystDocumentId: analystId, humanAnalyst: true }));
    },
    getProposalJobFixture(analystId, jobId) {
      return proposalFixtureCall(200, (workflow) => workflow.getQuestionnaireProposalJob({ strapi, jobId, analystDocumentId: analystId, humanAnalyst: true }));
    },
    retryProposalJobFixture(analystId, jobId) {
      return proposalFixtureCall(202, (workflow) => workflow.retryQuestionnaireProposalJob({ strapi, jobId, analystDocumentId: analystId, humanAnalyst: true }));
    },
    async waitForProposalJobFixture(jobId) {
      const job = await mountedProposalWorkflow().settledQuestionnaireProposalJob(strapi, jobId);
      assert.ok(job, "PROPOSAL_JOB_NOT_FOUND");
      return job;
    },
    async activeProposalJobsFixture(questionnaireId) {
      return [...mountedProposalWorkflow().activeQuestionnaireProposalJobs(strapi, questionnaireId)];
    },
    async withHeldQuestionnaireProposalProvider(action, options = {}) {
      const { proposals, rewrites } = mountedProposalProviders();
      const failureModule = require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "questionnaire-generation-registry.js")) as { QuestionnaireGenerationJobFailure: new (code: string, message: string) => Error };
      const originalPropose = proposals.propose;
      const originalRewrite = rewrites.rewrite;
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let signalReached: () => void = () => undefined;
      const reached = new Promise<void>((resolve) => { signalReached = resolve; });
      const captured: Array<Record<string, unknown>> = [];
      const held = <P extends object>(provider: P, original: (...args: unknown[]) => Promise<unknown>) => async (...args: unknown[]) => {
        if (options.capture) captured.push(args[0] as Record<string, unknown>);
        signalReached();
        await gate;
        if (options.failWith) throw new failureModule.QuestionnaireGenerationJobFailure(options.failWith.code, options.failWith.message);
        return original.apply(provider, args);
      };
      proposals.propose = held(proposals, originalPropose);
      rewrites.rewrite = held(rewrites, originalRewrite);
      try {
        return await action({ reached, release, captured: () => [...captured] });
      } finally {
        release();
        proposals.propose = originalPropose;
        rewrites.rewrite = originalRewrite;
      }
    },
    async replaceQuestionnaireFixture(requestId) {
      try {
        await interleavedQuestionnaireWorkflows().replaceQuestionnaire(requestId);
        return { status: "completed" as const };
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        if (typeof code === "string") return { status: "failed" as const, failureCode: code };
        throw error;
      }
    },
    async withStrapiWarnings(action) {
      const log = (strapi as unknown as { log: { warn: (...args: unknown[]) => unknown } }).log;
      const original = log.warn;
      const warnings: string[] = [];
      log.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(" ")); return original.apply(log, args); };
      try { return await action(() => [...warnings]); } finally { log.warn = original; }
    },
    decideQuestionnaireProposalsFixture(analystId, questionnaireId, body) {
      const decisions = require(path.join(appDir, "dist", "src", "api", "csrm-questionnaire", "services", "questionnaire-proposal-decisions.js")) as {
        decideQuestionnaireAiProposals: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
      };
      return proposalFixtureCall(200, () => decisions.decideQuestionnaireAiProposals({ strapi, questionnaireId, body, analystDocumentId: analystId, humanAnalyst: true }));
    },
    async questionnaireSnapshotFixture(questionnaireId) {
      const questionnaire = await strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne?.({ documentId: questionnaireId, populate: { questions: true } });
      assert.ok(questionnaire, "QUESTIONNAIRE_NOT_FOUND");
      const questions = ((questionnaire.questions ?? []) as Array<Record<string, unknown>>)
        .map((row) => ({ documentId: row.documentId, questionText: row.questionText, helpText: row.helpText ?? null, answerType: row.answerType, options: row.options, answer: row.answer ?? null }))
        .sort((left, right) => String(left.documentId).localeCompare(String(right.documentId)));
      const runs = ((await strapi.documents("api::csrm-ai-run.csrm-ai-run" as Parameters<typeof strapi.documents>[0]).findMany?.({
        filters: { questionnaire: { documentId: { $eq: questionnaireId } } }, fields: ["documentId", "decisions"], sort: ["id:asc"], limit: 1000,
      })) ?? []) as Array<Record<string, unknown>>;
      return {
        questions,
        releasedAt: questionnaire.releasedAt ?? null,
        governanceLog: questionnaire.governanceLog ?? null,
        runs: runs.map((run) => ({ documentId: run.documentId, decisions: run.decisions ?? null })),
      };
    },
    saveAnswersServiceFixture(requestorId, questionnaireId, body) {
      return questionnaireServiceCall((workflow) => workflow.saveAnswers({ strapi, questionnaireDocumentId: questionnaireId, actor: "requestor", actorDocumentId: requestorId, body }));
    },
    submitQuestionnaireServiceFixture(requestorId, questionnaireId, body) {
      return questionnaireServiceCall((workflow) => workflow.submitQuestionnaire({ strapi, questionnaireDocumentId: questionnaireId, actor: "requestor", actorDocumentId: requestorId, body }));
    },
    async listQuestionnaireRunsFixture(questionnaireId) {
      const rows = await strapi.documents("api::csrm-ai-run.csrm-ai-run" as Parameters<typeof strapi.documents>[0]).findMany?.({
        filters: { questionnaire: { documentId: { $eq: questionnaireId } } },
        populate: { initiatedBy: true, questionnaire: true, assessmentRequest: true }, sort: ["startedAt:asc", "id:asc"], limit: 1000,
      });
      return (rows ?? []) as Array<Record<string, unknown>>;
    },
    async listAiRunsForAssessment(assessmentId) {
      const rows = await strapi.documents("api::csrm-ai-run.csrm-ai-run" as Parameters<typeof strapi.documents>[0]).findMany?.({
        filters: { assessment: { documentId: { $eq: assessmentId } } },
        populate: { assessment: true, questionnaire: true }, sort: "startedAt:asc", limit: 1000,
      });
      return (rows ?? []) as Array<Record<string, unknown>>;
    },
    async getAiRun(documentId) {
      return (await strapi.documents("api::csrm-ai-run.csrm-ai-run" as Parameters<typeof strapi.documents>[0]).findOne?.({
        documentId, populate: { initiatedBy: true, assessmentRequest: true, questionnaire: true, assessment: true, risk: true },
      })) ?? null;
    },
    async createAiRunFixture(data) {
      return (await createRunningAiRun(strapi as unknown as Core.Strapi, data)).documentId;
    },
    async completeAiRunFixture(runId, proposal) {
      return completeAiRun(strapi as unknown as Core.Strapi, runId, { proposal });
    },
    async failAiRunFixture(runId, code, message) {
      return failAiRun(strapi as unknown as Core.Strapi, runId, { code, message });
    },
    async appendAiRunDecisionsFixture(runId, events) {
      await appendAiRunDecisions(strapi as unknown as Core.Strapi, runId, events);
    },
    async updateAiRunFixture(runId, data) {
      await strapi.documents("api::csrm-ai-run.csrm-ai-run").update?.({ documentId: runId, data });
    },
    async deleteAiRunFixture(runId) {
      await strapi.documents("api::csrm-ai-run.csrm-ai-run").delete?.({ documentId: runId });
    },
    async reconcileInterruptedAiRunsFixture(now) {
      return reconcileInterruptedAiRuns(strapi as unknown as Core.Strapi, now);
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
    async listRisksForAssessment(assessmentDocumentId) {
      const rows = await strapi.documents("api::csrm-risk.csrm-risk").findMany?.({
        filters: { assessment: { documentId: { $eq: assessmentDocumentId } } },
        sort: ["riskNumber:asc"],
        populate: { riskType: true, informationSystemImpacted: true, informationAssetImpacted: true, controlImplementations: true },
        limit: 1_000,
      });
      return (rows ?? []) as Array<Record<string, unknown>>;
    },
    async countControlImplementationsForRisk(riskDocumentId) {
      const rows = await strapi.documents("api::csrm-control-implementation.csrm-control-implementation").findMany?.({
        filters: { risk: { documentId: { $eq: riskDocumentId } } },
        limit: 1_000,
      });
      return rows?.length ?? 0;
    },
    async withBackendFixture(action) {
      return action(strapi as unknown as Core.Strapi);
    },
    async createUserFixture({ roles: roleNames, ...data }) {
      const roleIds = (roleNames ?? []).map((name) => {
        const role = roleByName.get(name);
        assert.ok(role, `seeded CSRM role ${name} must exist`);
        return role.documentId;
      });
      const user = await createDocument(strapi, "api::idambox-user.idambox-user", { ...data, ...(roleNames ? { roles: roleIds } : {}) });
      return user.documentId;
    },
    async withRoleOperationWithdrawn(roleName, operation, action) {
      const role = roleByName.get(roleName);
      assert.ok(role, `seeded CSRM role ${roleName} must exist`);
      const roleDocuments = strapi.documents("api::role.role") as unknown as {
        findOne: (query: Record<string, unknown>) => Promise<{ functions?: Array<{ documentId: string; functionApis?: Array<{ url?: string }> }> } | null>;
        update: (query: { documentId: string; data: Record<string, unknown> }) => Promise<unknown>;
      };
      const held = (await roleDocuments.findOne({ documentId: role.documentId, populate: { functions: { populate: { functionApis: true } } } }))?.functions ?? [];
      const kept = held.filter((grant) => !(grant.functionApis ?? []).some((api) => api.url === operation));
      assert.ok(kept.length < held.length, `seeded CSRM role ${roleName} must hold ${operation}`);
      await roleDocuments.update({ documentId: role.documentId, data: { functions: kept.map((grant) => grant.documentId) } });
      try {
        return await action();
      } finally {
        await roleDocuments.update({ documentId: role.documentId, data: { functions: held.map((grant) => grant.documentId) } });
      }
    },
    async updateFixtureDocument(uid, documentId, data) {
      await strapi.documents(uid).update?.({ documentId, data });
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
    async countReviewQueueBucketFixture(bucket, activeIds, options) {
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
        countReviewQueueBucket: (
          instance: unknown,
          queue: ReviewQueueBucketFixture,
          ids: readonly string[],
          filters?: { assignee?: "me" | "unassigned"; notesUnread?: true; viewer: { id: number; humanAnalyst: boolean } },
        ) => Promise<number>;
      };
      if (!options) return repositoryModule.countReviewQueueBucket(strapi, bucket, activeIds);
      // The viewer's numeric id, as the policy resolves it; every analyst fixture is a human Security Analyst.
      const viewer = await strapi.documents("api::idambox-user.idambox-user").findOne?.({ documentId: options.viewerDocumentId, fields: ["id"] });
      assert.ok(viewer && typeof viewer.id === "number", "count viewer must exist");
      return repositoryModule.countReviewQueueBucket(strapi, bucket, activeIds, {
        ...(options.assignee ? { assignee: options.assignee } : {}),
        ...(options.notesUnread ? { notesUnread: true as const } : {}),
        viewer: { id: viewer.id, humanAnalyst: true },
      });
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
    async createRiskRegisterMitigationFixture(riskDocumentId, controlDocumentId, controlStatus, data = {}) {
      const implementation = await createDocument(strapi, "api::csrm-control-implementation.csrm-control-implementation", {
        ...data,
        risk: riskDocumentId,
        control: controlDocumentId,
        controlStatus,
      });
      return implementation.documentId;
    },
    async writeStoredValueFixture(table, documentId, column, value) {
      const connection = (strapi as unknown as { db: { connection: (name: string) => {
        where: (filter: Record<string, unknown>) => { update: (values: Record<string, unknown>) => Promise<number> };
      } } }).db.connection;
      const updated = await connection(table).where({ document_id: documentId }).update({ [column]: value });
      if (updated < 1) throw new Error(`STORED_VALUE_FIXTURE_MISSED_${table}_${documentId}`);
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
    createCsvMultipart({ filename, bytes, digest, confirmed, decisions, resultToken, timeZone }) {
      const form = new FormData();
      form.set("file", new File([bytes], filename, { type: "text/csv" }));
      if (digest !== undefined) form.set("previewDigest", digest);
      if (confirmed !== undefined) form.set("confirmed", String(confirmed));
      if (decisions !== undefined) form.set("decisions", decisions);
      if (resultToken !== undefined) form.set("resultToken", resultToken);
      if (timeZone !== undefined) form.set("timeZone", timeZone);
      return form;
    },
    createXlsxMultipart({ filename, bytes, digest, confirmed, decisions, resultToken, timeZone }) {
      const form = new FormData();
      form.set("file", new File([bytes], filename, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      if (digest !== undefined) form.set("previewDigest", digest);
      if (confirmed !== undefined) form.set("confirmed", String(confirmed));
      if (decisions !== undefined) form.set("decisions", decisions);
      if (resultToken !== undefined) form.set("resultToken", resultToken);
      if (timeZone !== undefined) form.set("timeZone", timeZone);
      return form;
    },
    listMountedContentApiRoutes() {
      return listMountedContentApiRoutes(strapi, rootRoutes);
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
    attachmentStorage() {
      const port = require(path.join(appDir, "dist", "src", "csrm", "files", "storage-port.js")) as {
        createAttachmentStorage: (instance: RunningStrapi) => AttachmentStorage;
      };
      return port.createAttachmentStorage(strapi);
    },
    attachmentStorageDirectory() {
      return attachmentStorageDirectory;
    },
    async findUploadFileRecord(fileId) {
      return (await strapi.query("plugin::upload.file").findOne({ where: { id: fileId } })) as Record<string, unknown> | null;
    },
    async countUploadFileRecords() {
      return (await strapi.query("plugin::upload.file").findMany({ where: {} })).length;
    },
    async listRequestAttachments(requestDocumentId) {
      const records = await (strapi.documents("api::csrm-request-attachment.csrm-request-attachment") as StrapiDocumentService).findMany({
        filters: { assessmentRequest: { documentId: { $eq: requestDocumentId } } },
        populate: {
          file: { fields: ["id"] },
          uploadedBy: { fields: ["documentId"] },
          removedBy: { fields: ["documentId"] },
          note: { fields: ["documentId"] },
        },
        sort: ["id:asc"],
        limit: 10_000,
      });
      const idOf = (value: unknown, key: "id" | "documentId") => (typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] ?? null : null);
      return records.map((record) => {
        const { file, uploadedBy, removedBy, note, ...rest } = record as Record<string, unknown>;
        return { ...rest, fileId: idOf(file, "id"), uploadedBy: idOf(uploadedBy, "documentId"), removedBy: idOf(removedBy, "documentId"), note: idOf(note, "documentId") };
      });
    },
    async countRequestAttachmentRows() {
      const connection = (strapi as unknown as { db: { connection: { raw: (sql: string) => Promise<unknown> } } }).db.connection;
      const rows = await connection.raw("SELECT COUNT(*) AS attachments FROM csrm_request_attachments") as Array<{ attachments: number | string }>;
      return Number(rows[0]?.attachments ?? Number.NaN);
    },
    async listAttachmentStorageFiles() {
      try {
        return (await readdir(attachmentStorageDirectory)).sort();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    },
    async seedRequestAttachments(requestDocumentId, count, uploadedBy = owner.documentId) {
      assert.ok(Number.isInteger(count) && count >= 0 && count <= 60, "attachment fixture count must be 0 to 60");
      const port = require(path.join(appDir, "dist", "src", "csrm", "files", "storage-port.js")) as {
        createAttachmentStorage: (instance: RunningStrapi) => AttachmentStorage;
      };
      const storage = port.createAttachmentStorage(strapi);
      const { createHash } = require("node:crypto") as typeof import("node:crypto");
      const [request] = await (strapi.documents("api::csrm-assessment-request.csrm-assessment-request") as StrapiDocumentService).findMany({
        filters: { documentId: { $eq: requestDocumentId } },
        populate: { requestor: { fields: ["documentId"] } },
        limit: 1,
      }) as Array<{ requestor?: { documentId?: unknown } | null }>;
      assert.ok(request, "attachment fixture request not found");
      const uploaderPart = request.requestor?.documentId === uploadedBy ? "requestor" : "security-analyst";
      const ids: string[] = [];
      for (let index = 1; index <= count; index += 1) {
        const bytes = Buffer.from(`Seeded attachment ${index} on ${requestDocumentId}.`, "utf8");
        const stored = await storage.put(bytes, { type: "txt" });
        const created = await createDocument(strapi, "api::csrm-request-attachment.csrm-request-attachment", {
          fileName: `seeded-${index}.txt`,
          fileType: "txt",
          byteSize: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          uploaderPart,
          uploadedAt: new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString(),
          scanStatus: "clean",
          scanAttempts: 0,
          aiTextIncluded: false,
          assessmentRequest: requestDocumentId,
          uploadedBy,
          file: stored.fileId,
        });
        ids.push(created.documentId);
      }
      return ids;
    },
    async close() {
      testIdentities.clear();
      observedDevelopmentIdentities.clear();
      jobObservations.length = 0;
      await strapi.destroy();
      await rm(databaseFilename, { force: true });
      await rm(attachmentStorageDirectory, { recursive: true, force: true });
      for (const [name, value] of originalEnvironment) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    },
  };
}
