import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import type { Core } from "@strapi/strapi";
import { SCIM_ROUTES } from "../src/iam/scim/routes";
import { seedCsrmData } from "../src/bootstrap/seed-csrm-data";

import {
  startAuthorizationHttpHarness,
  type AuthorizationHttpHarness,
  type MountedApplicationRoute,
  type MountedContentApiRoutes,
  type MountedPluginRoute,
} from "./helpers/strapi-http-harness";

/*
 * The served-operations inventory (D-04, D-06, D-38).
 *
 * The whole contract chain is enumerated from the running Strapi: every route
 * the application routers mount, every plugin route, and the koa layers that
 * prove each path and method is mounted once. Each served operation is tied to
 * its OpenAPI operation, its FunctionAPI grants and the web modules that call
 * it; every catalogued FunctionAPI no router serves carries its reason, and so
 * does every served operation no FunctionAPI names and every documented
 * operation no application router mounts. The result is checked in as
 * docs/references/served-operations.json, which the web chain guard and the
 * authorization matrix read. This file regenerates that inventory when
 * SERVED_OPERATIONS_WRITE=1 is set and fails on any drift otherwise. The
 * switch runs only through `pnpm --filter @csrm/strapi served-operations:write`:
 * the everyday test script refuses it, CI refuses it here, and a regenerating
 * run ends with the drift check skipped, never passed, until it is run again
 * without the switch (SR-07).
 */

type JsonObject = Record<string, any>;

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
const appDir = path.resolve(__dirname, "..", "..", "..");
const repositoryDir = path.resolve(appDir, "..", "..");
const webDir = path.join(repositoryDir, "apps", "csrm");
const inventoryFilename = path.join(repositoryDir, "docs", "references", "served-operations.json");
const catalogueFilename = "idambox-csrm-role-function-api-catalogue.json";
const WRITE_COMMAND = "SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write";
const HTTP_METHODS: ReadonlySet<string> = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const IAM_SCIM_RESERVATIONS = [
  "GET:/scim/v2/Users", "POST:/scim/v2/Users",
  "GET:/scim/v2/Users/{id}", "PUT:/scim/v2/Users/{id}", "PATCH:/scim/v2/Users/{id}", "DELETE:/scim/v2/Users/{id}",
  "GET:/scim/v2/ServiceProviderConfig", "GET:/scim/v2/Schemas", "GET:/scim/v2/Schemas/{id}",
  "GET:/scim/v2/ResourceTypes", "GET:/scim/v2/ResourceTypes/{id}",
  "GET:/scim/v2/Groups", "GET:/scim/v2/Groups/{id}",
  "POST:/scim/v2/Groups", "PUT:/scim/v2/Groups", "PATCH:/scim/v2/Groups", "DELETE:/scim/v2/Groups",
  "POST:/scim/v2/Groups/{id}", "PUT:/scim/v2/Groups/{id}", "PATCH:/scim/v2/Groups/{id}", "DELETE:/scim/v2/Groups/{id}",
] as const;
const CSRM_AUTHORIZATION_POLICY = "global::csrm-authorization";

type ObservedResponder = { status: number; handler: string | null; bodyShape: string };
type ServedOperation = {
  method: string;
  path: string;
  catalogueUrl: string;
  apiName: string;
  routerFile: string;
  handler: string;
  authStrategies: string[] | null;
  policyOperation: string | null;
  policyConfig: Record<string, unknown> | null;
  functionApiIds: string[];
  roleIds: string[];
  specOperationId: string | null;
  webCallers?: string[];
};
type UnservedOperation = { catalogueUrl: string; functionApiIds: string[]; reason: string };
type UncataloguedOperation = { method: string; path: string; reason: string };
type PluginRoute = { method: string; path: string; plugin: string; observedNoIdentityStatus?: number };
type RegistrationProbe = { status: number; usersBefore: number; usersAfter: number };
type SpecOnlyOperation = { method: string; path: string; operationId: string; reason: string };
type Collision = { method: string; path: string; layers: string[]; observedResponder: ObservedResponder | null };
type Probe = { method: string; path: string; layers: string[]; observedResponder: ObservedResponder };
type ServedOperationsInventory = {
  generatedAt: string;
  served: ServedOperation[];
  unserved: UnservedOperation[];
  uncatalogued: UncataloguedOperation[];
  pluginRoutes: PluginRoute[];
  specOnly: SpecOnlyOperation[];
  collisions: Collision[];
  probes: Probe[];
};
type MountedLayer = { method: string; path: string; handler: string };

const PHASE_7_NOTE = "unserved by Phase 7 D-06 (catalogue design note 8)";
const PHASE_3_NOTE = "reserved Phase 3 review intent (catalogue design note 7): superseded by the served questionnaire release, return-to-review and revert operations";
const RELEASE_TRIPLE = "reserved Phase 4 review intent: superseded by the served release triple (PATCH /api/v1/risk_assessments/{assessmentId} and POST /api/v1/risk_assessments/{assessmentId}/release)";
const REQUEST_RELATIONS_READ = "reserved request alias: the request's information systems and assets are relations of the core request document (GET /api/csrm-assessment-requests/{id})";
const REQUEST_RELATIONS_WRITE = "reserved request alias: the request's information systems and assets are written as relations through PUT /api/csrm-assessment-requests/{id}, chosen through the served /api/v1/information_{systems,assets} selectors";

/**
 * Why each catalogued FunctionAPI URL no router serves stays unserved (D-04),
 * keyed by the query-stripped catalogue URL. Catalogue design note 9 records
 * the same reasons. A catalogued URL that becomes unserved without an entry
 * here fails UNSERVED_WITHOUT_REASON; an entry whose URL is served fails
 * UNSERVED_BUT_MOUNTED, so the map never outlives the routes it describes.
 */
const UNSERVED_REASONS: Readonly<Record<string, string>> = {
  "GET:/api/v1/alerts/{alertId}": `${PHASE_7_NOTE}: a derived alert links straight to its source record`,
  "PATCH:/api/v1/alerts/{alertId}/acknowledge": `${PHASE_7_NOTE}: acknowledgement needs persisted per-analyst state, a datamodel change deferred beyond this milestone`,
  "GET:/api/v1/dashboard/alerts": `${PHASE_7_NOTE}: the dedicated GET /api/v1/alerts operation serves the dashboard`,
  "GET:/api/v1/dashboard/reports": `${PHASE_7_NOTE}: the dedicated GET /api/v1/reports operation serves the dashboard`,
  "PATCH:/api/v1/questionnaires/{questionnaireId}/review_comments": PHASE_3_NOTE,
  "POST:/api/v1/questionnaires/{questionnaireId}/complete_review": PHASE_3_NOTE,
  "POST:/api/v1/risk_assessments/{assessmentId}/approve": RELEASE_TRIPLE,
  "POST:/api/v1/risk_assessments/{assessmentId}/submit_for_approval": RELEASE_TRIPLE,
  "POST:/api/v1/risk_assessments/{assessmentId}/regenerate_draft": "reserved Phase 4 intent: superseded by the targeted proposal operations POST /api/v1/risk_assessments/{assessmentId}/risk_suggestions and POST /api/v1/risks/{riskId}/rewrite (Phase 16 D-24); whole-draft regeneration is not offered",
  "GET:/api/v1/risk_assessments/due_for_review": "reserved Phase 4 intent: superseded by the served analyst review list (GET /api/v1/risk_assessments) and the Phase 7 dashboard and alerts",
  "POST:/api/v1/assessment_requests": "reserved request alias: served by the core route POST /api/csrm-assessment-requests",
  "GET:/api/v1/assessment_requests/{requestId}": "reserved request alias: served by the core route GET /api/csrm-assessment-requests/{id}",
  "PATCH:/api/v1/assessment_requests/{requestId}": "reserved request alias: served by the core route PUT /api/csrm-assessment-requests/{id}",
  "POST:/api/v1/assessment_requests/{requestId}/submit": "reserved request alias (two FunctionAPI entries): submission is the served PUT /api/csrm-assessment-requests/{id} with the submitted requestStatus intent",
  "GET:/api/v1/assessment_requests/form_metadata": "reserved request alias: the request form's reference data is served by the /api/v1/information_{systems,assets} selectors and their /selected hydration",
  "GET:/api/v1/assessment_requests/overdue": "reserved request alias: superseded by the Phase 7 analyst dashboard and alerts",
  "GET:/api/v1/assessment_requests/status_summary": "reserved request alias: superseded by the Phase 7 analyst dashboard; the Requestor summary is the served GET /api/v1/my_requests/status_summary",
  "GET:/api/v1/assessment_requests/{requestId}/information_assets": REQUEST_RELATIONS_READ,
  "GET:/api/v1/assessment_requests/{requestId}/information_systems": REQUEST_RELATIONS_READ,
  "POST:/api/v1/assessment_requests/{requestId}/information_assets": REQUEST_RELATIONS_WRITE,
  "POST:/api/v1/assessment_requests/{requestId}/information_systems": REQUEST_RELATIONS_WRITE,
  "GET:/api/v1/control_implementations": "reserved collection intent: control implementations are served under their Risk (GET /api/v1/risks/{riskId}/control_implementations)",
  "POST:/api/v1/control_implementations": "reserved collection intent: control implementations are created under their Risk (POST /api/v1/risks/{riskId}/control_implementations)",
  "GET:/api/v1/control_implementations/{implementationId}": "reserved detail intent: a control implementation is read through its Risk (GET /api/v1/risks/{riskId}/control_implementations) and mutated through the served PATCH and DELETE /api/v1/control_implementations/{implementationId}",
  "GET:/api/v1/control_implementations/overdue": "reserved intent: superseded by the Phase 7 alerts and the Risk Register treatment due state",
  "GET:/api/v1/control_implementations/status_summary": "reserved intent: superseded by the Phase 7 analyst dashboard",
  "POST:/api/v1/risks/{riskId}/close": "deferred beyond this milestone: nothing closes a Risk yet",
  "GET:/api/v1/risks/overdue": "reserved intent: superseded by the Phase 7 alerts and the Risk Register state and treatment due filters",
  "GET:/api/v1/risks/status_summary": "reserved intent: superseded by the Phase 7 analyst dashboard summary",
  "GET:/api/csrm-information-systems": "unmounted in Phase 8 (D-44): the served `/v1/information_{systems,assets}` selectors are the only read surface",
  "GET:/api/csrm-information-assets": "unmounted in Phase 8 (D-44): the served `/v1/information_{systems,assets}` selectors are the only read surface",
};

/**
 * Served operations no FunctionAPI names, each allow-listed with its reason
 * (D-04), keyed by catalogue URL. A served operation with neither a grant nor
 * an entry here fails NOT_CATALOGUED; an entry that is catalogued or no longer
 * served fails UNCATALOGUED_ALLOWLIST_STALE. The IAM core routers that once
 * needed entries here mount nothing since D-36, so the list is empty.
 */
const UNCATALOGUED_REASONS: Readonly<Record<string, string>> = {};

/**
 * Served operations the OpenAPI contract does not document, each allow-listed
 * with its reason, keyed by catalogue URL. Their rows carry a null
 * specOperationId. An undocumented served operation without an entry fails
 * NOT_IN_SPEC; an entry that is documented or no longer served fails
 * UNSPECIFIED_ALLOWLIST_STALE.
 */
const UNSPECIFIED_REASONS: Readonly<Record<string, string>> = {};

/** Content types whose generic core CRUD routes stay documented but unmounted (only: []) since Phases 3 and 4. */
const GENERIC_CORE_COLLECTIONS: ReadonlySet<string> = new Set([
  "csrm-assessments",
  "csrm-control-implementations",
  "csrm-questionnaires",
  "csrm-questions",
  "csrm-risks",
]);

/** IAM content types administered by IdamBox, whose core routers mount nothing (D-36). */
const IAM_COLLECTIONS: ReadonlySet<string> = new Set(["applications", "functions", "function-apis", "idambox-users", "roles", "identity-sources", "keycloak-sync-outboxes"]);
const IAM_BASES = [...IAM_COLLECTIONS].map((collection) => `/api/${collection}`);
/** The generic reference-data reads D-44 unmounts; the /v1 selectors are the only read surface. */
const GENERIC_REFERENCE_BASES = ["/api/csrm-information-systems", "/api/csrm-information-assets"];

const IMPORT_OPERATIONS = ["risk_types", "controls", "information_systems", "information_assets"].flatMap((collection) => [
  `POST:/api/v1/${collection}/import/preview`,
  `POST:/api/v1/${collection}/import`,
]);

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

function parseJsonFile(filename: string, diagnostic: string): JsonObject {
  try {
    return JSON.parse(readFileSync(filename, "utf8")) as JsonObject;
  } catch (error) {
    assert.fail(`${diagnostic}: ${(error as Error).message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const byString = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(byString);

/** A route's catalogue URL: `:name` path parameters are written `{name}` in the FunctionAPI catalogue. */
function catalogueUrlOf(method: string, mountedPath: string): string {
  return `${method}:${mountedPath.replace(/:([A-Za-z][A-Za-z0-9]*)/g, "{$1}")}`;
}

const stripQuery = (url: string): string => url.split("?")[0];
/** Parameter names replaced by an empty placeholder, so two URLs compare by position. */
const positional = (url: string): string => url.replace(/\{[^}]+\}/g, "{}");

function csrmAuthorizationConfig(config: Record<string, unknown>): Record<string, unknown> | null {
  const policies = Array.isArray(config.policies) ? config.policies : [];
  for (const policy of policies) {
    if (isRecord(policy) && policy.name === CSRM_AUTHORIZATION_POLICY) {
      return isRecord(policy.config) ? policy.config : {};
    }
  }
  return null;
}

function authStrategiesOf(config: Record<string, unknown>): string[] | null | false {
  const auth = config.auth;
  if (auth === false) return false;
  if (isRecord(auth) && Array.isArray(auth.strategies)) return auth.strategies.map(String);
  return null;
}

/** The contract's operations keyed `METHOD:/api/<path>`, with a positional index for parameter names that differ. */
function specOperationIndex(specification: JsonObject) {
  const exact = new Map<string, { specPath: string; operationId: string }>();
  const byPosition = new Map<string, string>();
  for (const [specPath, item] of Object.entries(specification.paths as Record<string, JsonObject>)) {
    for (const [method, operation] of Object.entries(item)) {
      const upper = method.toUpperCase();
      if (!HTTP_METHODS.has(upper)) continue;
      const servers = (operation as JsonObject).servers ?? item.servers ?? specification.servers;
      const server = servers?.[0]?.url;
      const prefix = server === "/" ? "" : server === undefined ? "/api" : new URL(server, "http://contract.invalid").pathname.replace(/\/$/, "");
      const key = `${upper}:${prefix}${specPath}`;
      exact.set(key, { specPath, operationId: String((operation as JsonObject).operationId ?? "") });
      byPosition.set(positional(key), key);
    }
  }
  return {
    find(catalogueUrl: string): { key: string; specPath: string; operationId: string } | null {
      const key = exact.has(catalogueUrl) ? catalogueUrl : byPosition.get(positional(catalogueUrl));
      if (key === undefined) return null;
      const entry = exact.get(key)!;
      return { key, ...entry };
    },
    keys(): string[] {
      return [...exact.keys()];
    },
  };
}

/*
 * How the web reaches the generated client, read exactly as the web chain guard
 * reads it (apps/csrm/src/features/contract-operation-chain.test.ts, SR-03): an
 * HTTP-method call through any receiver, and a method taken off the client into
 * a binding of its own or reached by a computed key, which would hide its call.
 */
// A type argument (`client.GET<T>(`, nested or not) or a space before the parenthesis cannot hide a call (O-1).
const WEB_METHOD_CALL = /\.(GET|POST|PUT|PATCH|DELETE)\s*(?:<[^()]*>)?\s*\(\s*([^,)]+)/g;
const WEB_DETACHED_METHOD = [
  /\b(?:const|let|var)\s*\{[^}]*\b(?:GET|POST|PUT|PATCH|DELETE)\b[^}]*\}\s*=/,
  /\[\s*(['"`])(?:GET|POST|PUT|PATCH|DELETE)\1\s*\]/,
];

/**
 * The web's calls through the generated client, keyed by catalogue URL. Every
 * module of the web source is read (app/, src/ and the files beside them, tests
 * and declarations excepted), whatever module makes a call and whatever its
 * receiver is named. Every call must name its path as a string literal or a
 * module-level path constant, and no module may take a method off the client,
 * so the chain can be enumerated statically; the web chain guard enforces the
 * same rules.
 */
function webCallersByCatalogueUrl(): Map<string, string[]> {
  const files: string[] = [];
  const isSourceModule = (name: string) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !/\.test\.tsx?$/.test(name);
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (isSourceModule(entry.name)) files.push(full);
    }
  };
  walk(path.join(webDir, "src"));
  walk(path.join(webDir, "app"));
  for (const entry of readdirSync(webDir, { withFileTypes: true })) {
    if (entry.isFile() && isSourceModule(entry.name)) files.push(path.join(webDir, entry.name));
  }
  const callers = new Map<string, Set<string>>();
  for (const file of files.sort(byString)) {
    const relative = path.relative(webDir, file).split(path.sep).join("/");
    const source = readFileSync(file, "utf8");
    assert.ok(!WEB_DETACHED_METHOD.some((pattern) => pattern.test(source)), `WEB_CLIENT_METHOD_DETACHED_${relative}`);
    const constants = new Map([...source.matchAll(/const (\w+) = '(\/[^']+)'(?: as const)?;/g)].map((match) => [match[1], match[2]] as const));
    for (const [, method, argument] of source.matchAll(WEB_METHOD_CALL)) {
      const trimmed = argument.trim();
      const clientPath = trimmed.startsWith("'") && trimmed.endsWith("'") ? trimmed.slice(1, -1) : constants.get(trimmed);
      assert.ok(clientPath, `WEB_CLIENT_PATH_NOT_LITERAL_${relative}_${trimmed}`);
      const key = `${method}:/api${clientPath}`;
      if (!callers.has(key)) callers.set(key, new Set());
      callers.get(key)!.add(relative);
    }
  }
  return new Map([...callers].map(([key, set]) => [key, [...set].sort(byString)]));
}

/**
 * The koa layers Strapi registers, in registration order: every application
 * router first (api by api, router by router), then every plugin router. Within
 * a router, a route carrying its own config.prefix is registered straight on
 * the content API router before the router's sub-router is mounted, so it
 * precedes the router's other routes.
 */
function registeredLayers(routes: MountedContentApiRoutes): MountedLayer[] {
  const groups = new Map<string, Array<MountedApplicationRoute | MountedPluginRoute>>();
  const groupOf = (route: MountedApplicationRoute | MountedPluginRoute): string =>
    "apiName" in route ? `api:${route.apiName}:${route.routerName}` : `plugin:${route.plugin}:${route.routerName}`;
  for (const route of [...routes.applicationRoutes, ...routes.pluginRoutes]) {
    const key = groupOf(route);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(route);
  }
  const layers: MountedLayer[] = [];
  for (const group of groups.values()) {
    const direct = group.filter((route) => "prefix" in route.config);
    const nested = group.filter((route) => !("prefix" in route.config));
    for (const route of [...direct, ...nested]) layers.push({ method: route.method, path: route.path, handler: route.handler });
  }
  return layers;
}

function koaRouteLayers(routes: MountedContentApiRoutes): Array<{ method: string; path: string }> {
  return routes.koaLayers.flatMap((layer) =>
    layer.methods.filter((method) => HTTP_METHODS.has(method)).map((method) => ({ method, path: layer.path })),
  );
}

function classifyRolesResponder(body: unknown): string | null {
  if (!isRecord(body)) return null;
  // The users-permissions role controller answers `{ roles: [...] }`.
  if (Array.isArray(body.roles)) return "plugin::users-permissions.role.find";
  // The core find controller answers `{ data: [documents], meta }`.
  if (Array.isArray(body.data) && body.data.every((entry) => isRecord(entry) && typeof entry.documentId === "string")) {
    return "api::role.role.find";
  }
  return null;
}

function describeBodyShape(body: unknown): string {
  if (!isRecord(body)) return body === null ? "null" : typeof body;
  return Object.keys(body)
    .sort(byString)
    .map((key) => `${key}:${Array.isArray(body[key]) ? "[]" : body[key] === null ? "null" : typeof body[key]}`)
    .join(",");
}

const REGISTER_ROUTE = { method: "POST", path: "/api/auth/local/register" } as const;

/**
 * D-37: a well-formed anonymous registration. The plugin refuses it while
 * `allow_register` is false, and the account count proves nothing was created.
 */
async function probeRegistration(harness: AuthorizationHttpHarness): Promise<RegistrationProbe> {
  const usersBefore = await harness.countUsersPermissionsUsers();
  const response = await harness.request({
    path: REGISTER_ROUTE.path,
    omitApiToken: true,
    init: {
      method: REGISTER_ROUTE.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "served-operations-probe", email: "served-operations-probe@example.test", password: "Served-operations-probe-1" }),
    },
  });
  await response.text();
  return { status: response.status, usersBefore, usersAfter: await harness.countUsersPermissionsUsers() };
}

async function observeResponder(harness: AuthorizationHttpHarness, mountedPath: string): Promise<ObservedResponder> {
  const response = await harness.request({ path: mountedPath, identity: harness.identities.analyst });
  const body: unknown = await response.json().catch(() => null);
  return { status: response.status, handler: classifyRolesResponder(body), bodyShape: describeBodyShape(body) };
}

function specOnlyReason(key: string, operationId: string, pluginRoutes: readonly MountedPluginRoute[]): string | null {
  const specPath = key.slice(key.indexOf(":") + "/api".length + 1);
  const [collection] = specPath.split("/").filter(Boolean);
  if (collection !== undefined && GENERIC_CORE_COLLECTIONS.has(collection)) {
    return "generic core CRUD route of a content type whose router mounts nothing (only: []) since Phases 3 and 4; its workflow operations are served under /api/v1";
  }
  if (collection !== undefined && IAM_COLLECTIONS.has(collection)) {
    if (key === "GET:/api/applications") {
      return "intentionally unserved (D-36): the application core router mounts nothing and its only caller, the web shell service, is removed; IAM records are administered by IdamBox, not through this API surface";
    }
    const rolesNote = collection === "roles" ? " (the users-permissions role routes mount under /api/users-permissions)" : "";
    return `IAM content type administered by IdamBox, not through this API surface: its core router mounts nothing (D-36); the operation stays documented for traceability${rolesNote}`;
  }
  const mountedByPlugin = pluginRoutes.find((route) => positional(catalogueUrlOf(route.method, route.path)) === positional(key));
  if (mountedByPlugin) {
    return `mounted by the ${mountedByPlugin.plugin} plugin outside the application routers, at the documented path (see pluginRoutes)`;
  }
  const [documentedBy] = operationId.split("/");
  if (pluginRoutes.some((route) => route.plugin === documentedBy)) {
    return `documented ${documentedBy} plugin operation; this Strapi mounts the plugin's routes under /api/${documentedBy} (see pluginRoutes), not at the documented path`;
  }
  if (documentedBy === "upload") return UPLOAD_UNMOUNTED_REASON;
  return null;
}

/** 14-04 (D-08): the upload plugin's documented operations once its content-API routes are unmounted. */
const UPLOAD_UNMOUNTED_REASON = "documented upload plugin operation; the application unmounts the plugin's content-API routes (Phase 14 D-08), so attachment files are reached only through CSRM's own operations";

/** A GET route of the upload plugin's admin router (`@strapi/upload/dist/server/routes/admin.js`), mounted under /upload. */
const UPLOAD_ADMIN_SETTINGS_PATH = "/upload/settings";

function rootRouteProblems(routes: MountedContentApiRoutes): string[] {
  const problems: string[] = [];
  const root = routes.rootKoaLayers.flatMap(layer => layer.methods.filter(method => HTTP_METHODS.has(method)).map(method => ({ method, path: layer.path })));
  const all = [...root, ...koaRouteLayers(routes)];
  const declared = SCIM_ROUTES.map(route => ({ method: route.method, path: `/scim/v2${route.path}` }));
  const key = (route: { method: string; path: string }) => `${route.method}:${route.path}`;
  const expected = new Set(declared.map(key));
  for (const route of declared) {
    const id = key(route);
    if (all.filter(layer => key(layer) === id).length !== 1 || root.filter(layer => key(layer) === id).length !== 1) problems.push(`SCIM_ROOT_LAYER_COUNT_${id}`);
    const registrations = routes.rootRoutes.filter(entry => key(entry) === id);
    if (registrations.length !== 1) { problems.push(`SCIM_REGISTRATION_COUNT_${id}`); continue; }
    const config = registrations[0].config;
    if (config.auth !== false) problems.push(`SCIM_DEFAULT_AUTH_${id}`);
    const operation = catalogueUrlOf(route.method, route.path);
    if (JSON.stringify(config.policies) !== JSON.stringify([{ name: "global::scim-source-bearer", config: { operation } }])) problems.push(`SCIM_SOURCE_POLICY_${id}`);
  }
  for (const route of [...all, ...routes.rootRoutes]) {
    if (route.path.startsWith("/api/scim/v2")) problems.push(`SCIM_API_ALIAS_${key(route)}`);
    if (route.path.startsWith("/scim/v2") && !expected.has(key(route))) problems.push(`SCIM_UNDECLARED_${key(route)}`);
  }
  return problems;
}

type BuiltInventory = { inventory: ServedOperationsInventory; problems: string[]; registrationProbe: RegistrationProbe };

async function buildInventory(harness: AuthorizationHttpHarness): Promise<BuiltInventory> {
  const problems: string[] = [];
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "SPECIFICATION_UNREADABLE");
  const catalogue = parseJsonFile(path.join(repositoryDir, "docs", "references", catalogueFilename), "CATALOGUE_UNREADABLE");
  const spec = specOperationIndex(specification);
  const routes = harness.listMountedContentApiRoutes();
  const layers = registeredLayers(routes);
  const koaLayers = koaRouteLayers(routes);
  problems.push(...rootRouteProblems(routes));
  const webCallers = webCallersByCatalogueUrl();

  // The koa stack is the ground truth for what is mounted; the registries must describe it exactly.
  const describe = (entries: ReadonlyArray<{ method: string; path: string }>) => entries.map((entry) => `${entry.method} ${entry.path}`);
  const registered = describe(layers);
  const mounted = describe(koaLayers);
  if (JSON.stringify(registered) !== JSON.stringify(mounted)) {
    const index = registered.findIndex((entry, position) => entry !== mounted[position]);
    problems.push(`REGISTRY_KOA_MISMATCH at layer ${index}: registries say ${registered[index] ?? "(end)"}, koa says ${mounted[index] ?? "(end)"} (${registered.length} registered, ${mounted.length} mounted)`);
  }
  const koaCount = new Map<string, number>();
  for (const entry of mounted) koaCount.set(entry, (koaCount.get(entry) ?? 0) + 1);
  const layersFor = (method: string, mountedPath: string): string[] =>
    layers.filter((layer) => layer.method === method && layer.path === mountedPath).map((layer) => layer.handler);

  // Catalogue lookups: FunctionAPIs by query-stripped URL, roles through their Functions.
  const functionsById = new Map<string, JsonObject>((catalogue.functions as JsonObject[]).map((entry) => [entry.id, entry]));
  const functionApisByUrl = new Map<string, JsonObject[]>();
  for (const functionApi of catalogue.functionApis as JsonObject[]) {
    const url = stripQuery(String(functionApi.url));
    if (!functionApisByUrl.has(url)) functionApisByUrl.set(url, []);
    functionApisByUrl.get(url)!.push(functionApi);
  }
  const grantsFor = (catalogueUrl: string): { functionApiIds: string[]; roleIds: string[] } => {
    const functionApis = functionApisByUrl.get(catalogueUrl) ?? [];
    const roleIds = functionApis.flatMap((functionApi) => {
      const owner = functionsById.get(String(functionApi.functionId));
      if (!owner) problems.push(`FUNCTION_API_WITHOUT_FUNCTION_${functionApi.id}`);
      return (owner?.roleIds ?? []) as string[];
    });
    return { functionApiIds: unique(functionApis.map((functionApi) => String(functionApi.id))), roleIds: unique(roleIds) };
  };

  // Served operations: one row per application route.
  const served: ServedOperation[] = [];
  const servedByUrl = new Map<string, ServedOperation>();
  for (const route of routes.applicationRoutes) {
    const catalogueUrl = catalogueUrlOf(route.method, route.path);
    if (servedByUrl.has(catalogueUrl)) problems.push(`ROUTE_DECLARED_TWICE_${catalogueUrl}`);
    const entry = `${route.method} ${route.path}`;
    if ((koaCount.get(entry) ?? 0) !== 1) problems.push(`MOUNTED_TWICE_${route.method}_${route.path} (${koaCount.get(entry) ?? 0} koa layers)`);
    const strategies = authStrategiesOf(route.config);
    if (strategies === false) problems.push(`PUBLIC_ROUTE_${route.method}_${route.path}`);
    const policyConfig = csrmAuthorizationConfig(route.config);
    const policyOperation = policyConfig !== null && typeof policyConfig.operation === "string" ? policyConfig.operation : null;
    if (policyOperation !== null && stripQuery(policyOperation) !== catalogueUrl) {
      problems.push(`POLICY_OPERATION_MISMATCH_${catalogueUrl} (policy names ${policyOperation})`);
    }
    if (policyConfig !== null && typeof policyConfig.administrationListOperation === "string"
      && stripQuery(policyConfig.administrationListOperation) !== catalogueUrl) {
      problems.push(`ADMINISTRATION_LIST_OPERATION_MISMATCH_${catalogueUrl} (policy names ${policyConfig.administrationListOperation})`);
    }
    const specOperation = spec.find(catalogueUrl);
    if (specOperation === null && !(catalogueUrl in UNSPECIFIED_REASONS)) problems.push(`NOT_IN_SPEC_${route.method}_${route.path}`);
    if (specOperation !== null && catalogueUrl in UNSPECIFIED_REASONS) problems.push(`UNSPECIFIED_ALLOWLIST_STALE_${catalogueUrl} (documented as ${specOperation.operationId})`);
    const grants = grantsFor(catalogueUrl);
    if (grants.functionApiIds.length === 0 && !(catalogueUrl in UNCATALOGUED_REASONS)) problems.push(`NOT_CATALOGUED_${route.method}_${route.path}`);
    if (grants.functionApiIds.length > 0 && catalogueUrl in UNCATALOGUED_REASONS) problems.push(`UNCATALOGUED_ALLOWLIST_STALE_${catalogueUrl} (granted by ${grants.functionApiIds.join(", ")})`);
    const routerFile = `${route.apiName}/routes/${route.routerName}.ts`;
    if (!existsSync(path.join(appDir, "src", "api", routerFile))) problems.push(`ROUTER_FILE_MISSING_${routerFile}`);
    const callers = webCallers.get(catalogueUrl) ?? webCallers.get([...webCallers.keys()].find((key) => positional(key) === positional(catalogueUrl)) ?? "");
    const row: ServedOperation = {
      method: route.method,
      path: route.path,
      catalogueUrl,
      apiName: route.apiName,
      routerFile,
      handler: route.handler,
      authStrategies: strategies === false ? [] : strategies,
      policyOperation,
      policyConfig,
      functionApiIds: grants.functionApiIds,
      roleIds: grants.roleIds,
      specOperationId: specOperation?.operationId ?? null,
      ...(callers ? { webCallers: callers } : {}),
    };
    served.push(row);
    servedByUrl.set(catalogueUrl, row);
  }
  // Root rows originate in observed registrations, checked against the actual root Koa stack above.
  for (const route of routes.rootRoutes.filter(route => route.path.startsWith("/scim/v2"))) {
    const catalogueUrl = catalogueUrlOf(route.method, route.path);
    const specOperation = spec.find(catalogueUrl);
    if (!specOperation) problems.push(`NOT_IN_SPEC_${catalogueUrl}`);
    const grants = grantsFor(catalogueUrl);
    if (grants.functionApiIds.length !== 1) problems.push(`SCIM_GRANT_COUNT_${catalogueUrl}`);
    if (JSON.stringify(grants.roleIds) !== JSON.stringify(["role.identity_provisioning"])) problems.push(`SCIM_ROLE_SCOPE_${catalogueUrl}`);
    const policy = ((route.config.policies ?? []) as Array<{ name: string; config: Record<string, unknown> }>).find(policy => policy.name === "global::scim-source-bearer");
    const row: ServedOperation = { method: route.method, path: route.path, catalogueUrl,
      apiName: route.apiName, routerFile: "iam/scim/routes.ts", handler: route.handler,
      authStrategies: ["source-bearer"], policyOperation: typeof policy?.config?.operation === "string" ? policy.config.operation : null,
      policyConfig: policy?.config ?? null, ...grants, specOperationId: specOperation?.operationId ?? null };
    served.push(row); servedByUrl.set(catalogueUrl, row);
  }

  served.sort((left, right) => byString(left.catalogueUrl, right.catalogueUrl));

  // Every web call names a served operation (SR-03): a documented path no router mounts still
  // typechecks in the web, but it reaches no route.
  for (const [key, files] of webCallers) {
    const reachesARoute = servedByUrl.has(key) || [...servedByUrl.keys()].some((url) => positional(url) === positional(key));
    if (!reachesARoute) problems.push(`WEB_CALLS_UNSERVED_${key} (${files.join(", ")})`);
  }

  // Every catalogued URL is served or unserved with a reason; no reason outlives its route.
  const unserved: UnservedOperation[] = [];
  for (const [url, functionApis] of functionApisByUrl) {
    if (servedByUrl.has(url)) continue;
    const reason = UNSERVED_REASONS[url];
    if (reason === undefined) problems.push(`UNSERVED_WITHOUT_REASON_${url}`);
    unserved.push({ catalogueUrl: url, functionApiIds: unique(functionApis.map((functionApi) => String(functionApi.id))), reason: reason ?? "" });
  }
  for (const url of Object.keys(UNSERVED_REASONS)) {
    if (servedByUrl.has(url)) problems.push(`UNSERVED_BUT_MOUNTED_${url}`);
    if (!functionApisByUrl.has(url)) problems.push(`UNSERVED_REASON_WITHOUT_FUNCTION_API_${url}`);
  }
  unserved.sort((left, right) => byString(left.catalogueUrl, right.catalogueUrl));

  const uncatalogued: UncataloguedOperation[] = [];
  for (const [url, reason] of Object.entries(UNCATALOGUED_REASONS)) {
    const row = servedByUrl.get(url);
    if (!row) {
      problems.push(`UNCATALOGUED_ALLOWLIST_STALE_${url} (not served)`);
      continue;
    }
    uncatalogued.push({ method: row.method, path: row.path, reason });
  }
  for (const url of Object.keys(UNSPECIFIED_REASONS)) {
    if (!servedByUrl.has(url)) problems.push(`UNSPECIFIED_ALLOWLIST_STALE_${url} (not served)`);
  }
  uncatalogued.sort((left, right) => byString(`${left.path} ${left.method}`, `${right.path} ${right.method}`));

  const registrationProbe = await probeRegistration(harness);
  const pluginRoutes: PluginRoute[] = routes.pluginRoutes
    .map((route): PluginRoute => ({
      method: route.method,
      path: route.path,
      plugin: route.plugin,
      ...(route.method === REGISTER_ROUTE.method && route.path === REGISTER_ROUTE.path ? { observedNoIdentityStatus: registrationProbe.status } : {}),
    }))
    .sort((left, right) => byString(`${left.plugin} ${left.path} ${left.method}`, `${right.plugin} ${right.path} ${right.method}`));
  if (!pluginRoutes.some((route) => route.observedNoIdentityStatus !== undefined)) problems.push("REGISTER_ROUTE_NOT_MOUNTED_BY_THE_PLUGIN");

  // Documented operations no application router mounts, each with its reason.
  const servedSpecKeys = new Set(served.map((row) => spec.find(row.catalogueUrl)?.key).filter((key): key is string => key !== undefined));
  const specOnly: SpecOnlyOperation[] = [];
  for (const key of spec.keys()) {
    if (servedSpecKeys.has(key)) continue;
    const operation = spec.find(key)!;
    const reason = specOnlyReason(key, operation.operationId, routes.pluginRoutes);
    if (reason === null) problems.push(`SPEC_ONLY_WITHOUT_REASON_${key}`);
    specOnly.push({ method: key.slice(0, key.indexOf(":")), path: `/api${operation.specPath}`, operationId: operation.operationId, reason: reason ?? "" });
  }
  specOnly.sort((left, right) => byString(`${left.path} ${left.method}`, `${right.path} ${right.method}`));

  // Collisions: a path and method with more than one koa layer, probed when it is a read.
  const collisions: Collision[] = [];
  for (const [entry, count] of koaCount) {
    if (count < 2) continue;
    const [method, mountedPath] = [entry.slice(0, entry.indexOf(" ")), entry.slice(entry.indexOf(" ") + 1)];
    collisions.push({
      method,
      path: mountedPath,
      layers: layersFor(method, mountedPath),
      observedResponder: method === "GET" ? await observeResponder(harness, mountedPath) : null,
    });
  }
  collisions.sort((left, right) => byString(`${left.path} ${left.method}`, `${right.path} ${right.method}`));

  // D-38: which layer answers GET /api/roles, recorded before and after the IAM router hardening.
  const probes: Probe[] = [
    { method: "GET", path: "/api/roles", layers: layersFor("GET", "/api/roles"), observedResponder: await observeResponder(harness, "/api/roles") },
  ];

  return {
    inventory: { generatedAt: new Date().toISOString(), served, unserved, uncatalogued, pluginRoutes, specOnly, collisions, probes },
    problems,
    registrationProbe,
  };
}

const inventoryPromise: Promise<BuiltInventory> = harnessPromise.then((harness) => buildInventory(harness));

function withoutGeneratedAt(inventory: JsonObject): JsonObject {
  const { generatedAt: _generatedAt, ...rest } = inventory;
  return rest;
}

function firstDifference(checkedIn: JsonObject, mountedNow: JsonObject): string | null {
  const before = JSON.stringify(checkedIn, null, 2).split("\n");
  const now = JSON.stringify(mountedNow, null, 2).split("\n");
  const length = Math.max(before.length, now.length);
  for (let index = 0; index < length; index += 1) {
    if (before[index] !== now[index]) {
      return `line ${index + 1}: checked in ${JSON.stringify(before[index] ?? "(end)")}, mounted now ${JSON.stringify(now[index] ?? "(end)")}`;
    }
  }
  return null;
}

test("every served operation is mounted once, documented and catalogued or allow-listed with a reason", async () => {
  const { inventory, problems } = await inventoryPromise;
  assert.deepEqual(problems, [], `SERVED_OPERATIONS_INVARIANTS: ${problems.join("; ")}`);
  assert.ok(inventory.served.length > 60, "SERVED_INVENTORY_TOO_SMALL");
  for (const row of inventory.served) {
    assert.ok(row.functionApiIds.length > 0 || inventory.uncatalogued.some((entry) => entry.method === row.method && entry.path === row.path), `NOT_CATALOGUED_${row.method}_${row.path}`);
  }
});

test("every catalogued FunctionAPI is served or recorded as unserved with its reason", async () => {
  const { inventory } = await inventoryPromise;
  const servedUrls = new Set(inventory.served.map((row) => row.catalogueUrl));
  const catalogue = parseJsonFile(path.join(repositoryDir, "docs", "references", catalogueFilename), "CATALOGUE_UNREADABLE");
  for (const functionApi of catalogue.functionApis as JsonObject[]) {
    const url = stripQuery(String(functionApi.url));
    const unservedRow = inventory.unserved.find((entry) => entry.catalogueUrl === url);
    assert.ok(servedUrls.has(url) || unservedRow, `UNSERVED_WITHOUT_REASON_${url}`);
    if (unservedRow) {
      assert.ok(unservedRow.reason.length > 0, `UNSERVED_WITHOUT_REASON_${url}`);
      assert.ok(unservedRow.functionApiIds.includes(String(functionApi.id)), `UNSERVED_ROW_MISSES_FUNCTION_API_${functionApi.id}`);
    }
  }
  for (const entry of inventory.unserved) assert.equal(servedUrls.has(entry.catalogueUrl), false, `UNSERVED_BUT_MOUNTED_${entry.catalogueUrl}`);
  assert.ok(inventory.unserved.length >= 30, `UNSERVED_ROWS_${inventory.unserved.length}`);
});

test("the two catalogue copies are byte-identical", () => {
  const authoritative = readFileSync(path.join(repositoryDir, "docs", "references", catalogueFilename));
  const bootstrap = readFileSync(path.join(appDir, "src", "bootstrap", catalogueFilename));
  assert.ok(authoritative.equals(bootstrap), "CATALOGUE_COPIES_DIFFER");
});

test("IAM serves every root SCIM operation with source authentication and no existing-role grants", async () => {
  const { inventory } = await inventoryPromise;
  const catalogue = parseJsonFile(path.join(repositoryDir, "docs/references", catalogueFilename), "CATALOGUE_UNREADABLE");
  const role = catalogue.roles.find((entry: JsonObject) => entry.id === "role.identity_provisioning");
  assert.ok(role);
  assert.equal(role.name, "Identity Provisioning");
  assert.deepEqual(role.functionIds, ["function.identity_provisioning.api"]);
  const capability = catalogue.functions.find((entry: JsonObject) => entry.id === "function.identity_provisioning.api");
  assert.ok(capability);
  assert.equal(capability.name, "Identity Provisioning");
  assert.equal("menuPath" in capability, false);
  assert.deepEqual(capability.roleIds, [role.id]);
  for (const existing of catalogue.roles.filter((entry: JsonObject) => entry.id !== role.id)) {
    assert.equal(existing.functionIds.includes(capability.id), false);
  }
  const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.functionId === capability.id);
  assert.deepEqual(apis.map((entry: JsonObject) => entry.url).sort(), [...IAM_SCIM_RESERVATIONS].sort());
  assert.deepEqual(capability.functionApiIds, apis.map((entry: JsonObject) => entry.id));
  const harness = await harnessPromise;
  const mounted = harness.listMountedContentApiRoutes();
  for (const url of IAM_SCIM_RESERVATIONS) {
    const row = inventory.served.find((entry) => entry.catalogueUrl === url);
    assert.ok(row, url);
    assert.deepEqual(row.authStrategies, ["source-bearer"]);
    assert.deepEqual(row.policyConfig, { operation: url });
    assert.equal(row.policyOperation, url);
    assert.deepEqual(row.roleIds, ["role.identity_provisioning"]);
    assert.equal(inventory.unserved.some(entry => entry.catalogueUrl === url), false);
    const [method, routePath] = url.split(":");
    const route = routePath.replace("{id}", "does-not-exist");
    const response = await harness.request({ path: route, identity: harness.identities.analyst, init: { method } });
    assert.equal(response.status, 401, `${url}: ${response.status}`);
    assert.equal(response.headers.get("WWW-Authenticate"), "Bearer");
    const alias = await harness.request({ path: `/api${route}`, init: { method } });
    assert.ok(alias.status === 404 || alias.status === 405);

  }
});

test("IAM Function belongs only to the active IAM Application and repeated seed preserves capability bindings", async () => {
  await inventoryPromise;
  const instance = (globalThis as typeof globalThis & { strapi: Core.Strapi }).strapi;
  assert.ok(instance);
  const applications = instance.documents("api::application.application");
  const functions = instance.documents("api::function.function");
  const iamApps = await applications.findMany({ filters: { slug: "idambox-iam" } });
  assert.equal(iamApps.length, 1);
  assert.equal(iamApps[0].name, "IdamBox IAM");
  assert.equal(iamApps[0].applicationStatus, "active");
  const snapshot = async () => ({
    applications: await applications.findMany({ fields: ["documentId", "slug"], sort: ["slug:asc"], limit: 100 }),
    functions: await functions.findMany({ fields: ["documentId", "name", "menuPath"], populate: { application: { fields: ["slug"] }, functionApis: { fields: ["documentId", "url"] } }, sort: ["name:asc"], limit: 1000 }),
    roles: await instance.documents("api::role.role").findMany({ fields: ["documentId", "name"], populate: { functions: { fields: ["documentId"] } }, sort: ["name:asc"], limit: 100 }),
  });
  const before = await snapshot();
  const iamFunction = before.functions.filter((entry) => entry.name === "Identity Provisioning");
  assert.equal(iamFunction.length, 1);
  assert.equal(iamFunction[0].application?.slug, "idambox-iam");
  assert.equal(iamFunction[0].menuPath, null);
  for (const entry of before.functions.filter((entry) => entry.name !== "Identity Provisioning")) {
    assert.equal(entry.application?.slug, "idambox-csrm");
  }
  const previousSeedFlag = process.env.IDAMBOX_SEED_CSRM;
  try {
    process.env.IDAMBOX_SEED_CSRM = "true";
    await seedCsrmData(instance);
  } finally {
    if (previousSeedFlag === undefined) delete process.env.IDAMBOX_SEED_CSRM;
    else process.env.IDAMBOX_SEED_CSRM = previousSeedFlag;
  }
  assert.deepEqual(await snapshot(), before);
});

test("the eight administration import operations are served, documented and granted to the human Security Analyst only (D-06)", async () => {
  const { inventory } = await inventoryPromise;
  assert.equal(IMPORT_OPERATIONS.length, 8);
  for (const url of IMPORT_OPERATIONS) {
    const row = inventory.served.find((entry) => entry.catalogueUrl === url);
    assert.ok(row, `IMPORT_OPERATION_NOT_SERVED_${url}`);
    assert.ok(row.specOperationId, `IMPORT_OPERATION_NOT_IN_SPEC_${url}`);
    assert.deepEqual(row.authStrategies, ["content-api-token"], `IMPORT_OPERATION_NOT_TOKEN_ONLY_${url}`);
    assert.ok(row.functionApiIds.length > 0, `IMPORT_OPERATION_NOT_CATALOGUED_${url}`);
    assert.deepEqual(row.roleIds, ["role.security_analyst"], `IMPORT_OPERATION_ROLES_${url}`);
    assert.deepEqual(row.webCallers, ["src/features/administration/administration-service.ts"], `IMPORT_OPERATION_WEB_CALLERS_${url}`);
  }
});

/*
 * Phase 13 (D-02, D-21): the two notes content types are reached only through the three notes operations. No core
 * route serves either type, and nothing edits or deletes a note: 13-06 adds only the AI-input mark under a note.
 */
test("request notes are served by their three operations alone, with no core route and no edit or delete of a note (D-02, D-21)", async () => {
  const { inventory } = await inventoryPromise;
  const notesOperations = [
    "GET:/api/v1/assessment_requests/{requestId}/notes",
    "POST:/api/v1/assessment_requests/{requestId}/notes",
    "POST:/api/v1/assessment_requests/{requestId}/notes/read",
  ];
  for (const url of notesOperations) {
    const row = inventory.served.find((entry) => entry.catalogueUrl === url);
    assert.ok(row, `NOTES_OPERATION_NOT_SERVED_${url}`);
    assert.equal(row.apiName, "csrm-request-note", `NOTES_OPERATION_API_${url}`);
    assert.equal(row.routerFile, "csrm-request-note/routes/request-notes.ts", `NOTES_OPERATION_ROUTER_${url}`);
    assert.deepEqual(row.authStrategies, ["content-api-token"], `NOTES_OPERATION_NOT_TOKEN_ONLY_${url}`);
    assert.deepEqual(row.policyConfig, { operation: url }, `NOTES_OPERATION_POLICY_${url}`);
    assert.deepEqual(row.functionApiIds.map((id) => id.replace(/\.api\.\d+$/, "")), ["function.risk_assessment_requests.notes_api"], `NOTES_OPERATION_FUNCTION_${url}`);
    assert.deepEqual([...row.roleIds].sort(), ["role.requestor", "role.security_analyst"], `NOTES_OPERATION_ROLES_${url}`);
    assert.ok(row.specOperationId, `NOTES_OPERATION_NOT_IN_SPEC_${url}`);
    assert.deepEqual(row.webCallers, ["src/features/request-notes/notes-service.ts"], `NOTES_OPERATION_WEB_CALLERS_${url}`);
  }
  // Phase 13 (D-26, D-30): the AI-input mark is the notes API's fourth route, held by its own human analyst-only Function.
  const aiInputOperation = "PUT:/api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input";
  const aiInputRow = inventory.served.find((entry) => entry.catalogueUrl === aiInputOperation);
  assert.ok(aiInputRow, "NOTE_AI_INPUT_OPERATION_NOT_SERVED");
  assert.equal(aiInputRow.routerFile, "csrm-request-note/routes/request-notes.ts", "NOTE_AI_INPUT_OPERATION_ROUTER");
  assert.deepEqual(aiInputRow.authStrategies, ["content-api-token"], "NOTE_AI_INPUT_OPERATION_NOT_TOKEN_ONLY");
  assert.deepEqual(aiInputRow.policyConfig, { operation: aiInputOperation }, "NOTE_AI_INPUT_OPERATION_POLICY");
  assert.deepEqual(aiInputRow.functionApiIds, ["function.risk_assessment_requests.note_ai_input_api.api.01"], "NOTE_AI_INPUT_OPERATION_FUNCTION");
  assert.deepEqual([...aiInputRow.roleIds], ["role.security_analyst"], "NOTE_AI_INPUT_OPERATION_ROLES");
  assert.ok(aiInputRow.specOperationId, "NOTE_AI_INPUT_OPERATION_NOT_IN_SPEC");
  assert.deepEqual(aiInputRow.webCallers, ["src/features/request-notes/notes-service.ts"], "NOTE_AI_INPUT_OPERATION_WEB_CALLERS");
  assert.deepEqual(
    inventory.served.filter((entry) => entry.apiName === "csrm-request-note").map((entry) => entry.catalogueUrl).sort(),
    [...notesOperations, aiInputOperation].sort(),
    "NOTES_API_SERVES_ANOTHER_ROUTE",
  );
  for (const row of inventory.served) {
    assert.ok(!row.path.startsWith("/api/csrm-request-note"), `NOTES_CORE_ROUTE_MOUNTED_${row.method}_${row.path}`);
    const underANote = row.path.startsWith("/api/v1/assessment_requests/:requestId/notes/:");
    assert.ok(!(underANote && ["PUT", "PATCH", "DELETE"].includes(row.method) && !row.path.endsWith("/ai_input")), `NOTE_EDIT_OR_DELETE_SERVED_${row.method}_${row.path}`);
  }
  const harness = await harnessPromise;
  for (const base of ["/api/csrm-request-notes", "/api/csrm-request-note-read-states"]) {
    const read = await harness.request({ path: base, identity: harness.identities.analyst });
    assert.equal(read.status, 404, `NOTES_CORE_BASE_SERVED_${base}_${read.status}`);
  }
});

test("no application router serves the IAM or generic reference-data bases (D-36, D-44)", async () => {
  const harness = await harnessPromise;
  const { inventory } = await inventoryPromise;
  const mutation = (method: string) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify({ data: {} }) });
  for (const base of [...IAM_BASES, ...GENERIC_REFERENCE_BASES]) {
    assert.equal(inventory.served.some((row) => row.path === base || row.path.startsWith(`${base}/`)), false, `APPLICATION_ROUTE_STILL_MOUNTED_${base}`);
    const read = await harness.request({ path: base, identity: harness.identities.analyst });
    assert.equal(read.status, 404, `BASE_STILL_SERVED_GET_${base}_${read.status}`);
    const create = await harness.request({ path: base, identity: harness.identities.analyst, init: mutation("POST") });
    assert.ok(create.status === 404 || create.status === 405, `BASE_STILL_SERVED_POST_${base}_${create.status}`);
    for (const method of ["PUT", "DELETE"]) {
      const response = await harness.request({ path: `${base}/does-not-exist`, identity: harness.identities.analyst, init: mutation(method) });
      assert.ok(response.status === 404 || response.status === 405, `BASE_STILL_SERVED_${method}_${base}_${response.status}`);
    }
  }
  assert.deepEqual(inventory.uncatalogued, [], "UNCATALOGUED_ROUTES_REMAIN");
  for (const row of inventory.served) assert.ok(row.specOperationId, `SERVED_WITHOUT_SPEC_${row.catalogueUrl}`);
  for (const url of ["GET:/api/csrm-information-systems", "GET:/api/csrm-information-assets"]) {
    const row = inventory.unserved.find((entry) => entry.catalogueUrl === url);
    assert.ok(row?.reason.includes("D-44"), `REFERENCE_READ_NOT_RECORDED_UNSERVED_${url}`);
  }
  // The bounded selector hydration stays served for the owner.
  const selected = await harness.request({
    path: "/api/v1/information_systems/selected",
    identity: harness.identities.owner,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedIds: [] }) },
  });
  assert.equal(selected.status, 200, `SELECTED_HYDRATION_${selected.status}`);
});

test("the upload plugin's content-API routes are unmounted while its admin routes stay mounted (D-08)", async () => {
  const harness = await harnessPromise;
  const { inventory } = await inventoryPromise;
  const mounted = harness.listMountedContentApiRoutes();
  assert.deepEqual(inventory.pluginRoutes.filter((route) => route.path.startsWith("/api/upload")), [], "UPLOAD_CONTENT_API_ROUTE_IN_INVENTORY");
  assert.deepEqual(mounted.pluginRoutes.filter((route) => route.plugin === "upload"), [], "UPLOAD_CONTENT_API_ROUTE_MOUNTED");
  assert.deepEqual(mounted.koaLayers.filter((layer) => layer.path.startsWith("/api/upload")), [], "UPLOAD_CONTENT_API_LAYER_MOUNTED");
  for (const row of inventory.specOnly.filter((entry) => entry.operationId.startsWith("upload/"))) {
    assert.equal(row.reason, UPLOAD_UNMOUNTED_REASON, `UPLOAD_SPEC_ONLY_REASON_${row.operationId}`);
  }
  // The admin panel's router is untouched: without an admin session its settings read is refused, not missing.
  const adminSettings = await harness.request({ path: UPLOAD_ADMIN_SETTINGS_PATH, omitApiToken: true });
  assert.equal(adminSettings.status, 401, `UPLOAD_ADMIN_ROUTE_${adminSettings.status}`);
});

test("users-permissions registration is disabled at every boot (D-37)", async () => {
  const harness = await harnessPromise;
  const { inventory, registrationProbe } = await inventoryPromise;
  const settings = await harness.readUsersPermissionsAdvancedSettings();
  assert.equal(settings?.allow_register, false, `ALLOW_REGISTER_${String(settings?.allow_register)}`);
  assert.ok(registrationProbe.status >= 400 && registrationProbe.status < 500, `REGISTRATION_STATUS_${registrationProbe.status}`);
  assert.equal(registrationProbe.usersAfter, registrationProbe.usersBefore, "REGISTRATION_CREATED_A_USER");
  const row = inventory.pluginRoutes.find((entry) => entry.method === REGISTER_ROUTE.method && entry.path === REGISTER_ROUTE.path);
  assert.ok(row, "REGISTER_ROUTE_NOT_RECORDED");
  assert.equal(row.observedNoIdentityStatus, registrationProbe.status, "REGISTER_ROUTE_STATUS_NOT_RECORDED");
});

test("GET /api/roles meets no application layer and answers 404 (D-38)", async () => {
  const { inventory } = await inventoryPromise;
  const probe = inventory.probes.find((entry) => entry.method === "GET" && entry.path === "/api/roles");
  assert.ok(probe, "ROLES_PROBE_MISSING");
  assert.deepEqual(probe.layers, [], `ROLES_LAYERS_${probe.layers.join(",")}`);
  assert.equal(probe.observedResponder.status, 404, `ROLES_STATUS_${probe.observedResponder.status}`);
  assert.equal(probe.observedResponder.handler, null, `ROLES_RESPONDER_${probe.observedResponder.handler}`);
  assert.deepEqual(inventory.collisions, [], "COLLISIONS_REMAIN");
});

test("the checked-in served-operations inventory matches the mounted Strapi", async (t) => {
  const { inventory, problems } = await inventoryPromise;
  if (process.env.SERVED_OPERATIONS_WRITE === "1") {
    assert.ok(!process.env.CI, "MAINTENANCE_SWITCH_UNDER_CI: SERVED_OPERATIONS_WRITE rewrites the inventory and never runs in CI");
    assert.deepEqual(problems, [], `INVENTORY_NOT_WRITTEN_WHILE_INVALID: ${problems.join("; ")}`);
    writeFileSync(inventoryFilename, `${JSON.stringify(inventory, null, 2)}\n`);
    // A regenerated inventory has not been checked against anything: the run must not read as a pass.
    t.skip("SERVED_OPERATIONS_WRITTEN: docs/references/served-operations.json was regenerated; run the check again without SERVED_OPERATIONS_WRITE");
    return;
  }
  assert.ok(existsSync(inventoryFilename), `SERVED_OPERATIONS_DRIFT: run ${WRITE_COMMAND} (docs/references/served-operations.json is missing)`);
  const checkedIn = parseJsonFile(inventoryFilename, "SERVED_OPERATIONS_UNREADABLE");
  const difference = firstDifference(withoutGeneratedAt(checkedIn), withoutGeneratedAt(inventory));
  assert.equal(difference, null, `SERVED_OPERATIONS_DRIFT: run ${WRITE_COMMAND} (${difference})`);
});


test("root inventory rejects missing, duplicate, aliased and unprotected SCIM routes", async () => {
  const routes = (await harnessPromise).listMountedContentApiRoutes();
  assert.deepEqual(rootRouteProblems(routes), []);
  const mutate = (change: (copy: MountedContentApiRoutes) => void, diagnostic: RegExp) => {
    const copy = structuredClone(routes); change(copy);
    assert.match(rootRouteProblems(copy).join(";"), diagnostic);
  };
  const index = routes.rootKoaLayers.findIndex(layer => layer.path === "/scim/v2/Users");
  assert.ok(index >= 0);
  mutate(copy => { copy.rootKoaLayers.splice(index, 1); }, /SCIM_ROOT_LAYER_COUNT/);
  mutate(copy => { copy.rootKoaLayers.push(copy.rootKoaLayers[index]); }, /SCIM_ROOT_LAYER_COUNT/);
  mutate(copy => { copy.rootKoaLayers.push({ path: "/api/scim/v2/Users", methods: ["GET"] }); }, /SCIM_API_ALIAS/);
  mutate(copy => { copy.rootRoutes[0].config.auth = {}; }, /SCIM_DEFAULT_AUTH/);
  mutate(copy => { copy.rootRoutes[0].config.policies = []; }, /SCIM_SOURCE_POLICY/);
  mutate(copy => { copy.rootRoutes[0].config.policies = [{ name: "global::scim-source-bearer", config: { operation: "GET:/scim/v2/Groups" } }]; }, /SCIM_SOURCE_POLICY/);
  mutate(copy => { copy.rootRoutes.pop(); }, /SCIM_REGISTRATION_COUNT/);
  mutate(copy => { copy.rootKoaLayers.push({ path: "/scim/v2/Unexpected", methods: ["GET"] }); }, /SCIM_UNDECLARED/);
});
