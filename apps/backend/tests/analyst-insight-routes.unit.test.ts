import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CSRM_ANALYST_INSIGHT_OPERATIONS } from "../src/api/csrm-analyst-insight/operations";
import alertRoutes from "../src/api/csrm-analyst-insight/routes/alerts";
import dashboardRoutes from "../src/api/csrm-analyst-insight/routes/dashboard";
import reportRoutes from "../src/api/csrm-analyst-insight/routes/reports";

/*
 * The static inventory of every served analyst insight route (D-05, D-07).
 * Each route is mounted exactly once, authenticates with the content API
 * token, runs the app gate first and asks the policy for the analyst insight
 * scope. Plans that serve further insight operations add their router and
 * their operations here.
 */

// Tests compile into `.tmp/tests-dist/tests`, so three parents resolve apps/strapi.
const appDir = path.resolve(__dirname, "..", "..", "..");

type RoutePolicy = string | { name: string; config?: Record<string, unknown> };
type RouteDefinition = {
  method: string;
  path: string;
  handler: string;
  config?: { auth?: unknown; policies?: RoutePolicy[] };
};

/** Every router module that serves an insight operation. */
const INSIGHT_ROUTERS: ReadonlyArray<readonly [string, { type?: string; routes: RouteDefinition[] }]> = [
  ["routes/alerts.ts", alertRoutes as unknown as { type?: string; routes: RouteDefinition[] }],
  ["routes/dashboard.ts", dashboardRoutes as unknown as { type?: string; routes: RouteDefinition[] }],
  ["routes/reports.ts", reportRoutes as unknown as { type?: string; routes: RouteDefinition[] }],
];

/** The served insight operations, each with its one method, path, handler and declaring router. */
const SERVED_INSIGHT_ROUTES = [
  {
    operation: CSRM_ANALYST_INSIGHT_OPERATIONS.dashboardSummary,
    method: "GET",
    path: "/v1/dashboard/summary",
    handler: "api::csrm-analyst-insight.dashboard.summary",
    file: "csrm-analyst-insight/routes/dashboard.ts",
  },
  {
    operation: CSRM_ANALYST_INSIGHT_OPERATIONS.alertSummary,
    method: "GET",
    path: "/v1/alerts/summary",
    handler: "api::csrm-analyst-insight.alerts.summary",
    file: "csrm-analyst-insight/routes/alerts.ts",
  },
  {
    operation: CSRM_ANALYST_INSIGHT_OPERATIONS.listAlerts,
    method: "GET",
    path: "/v1/alerts",
    handler: "api::csrm-analyst-insight.alerts.list",
    file: "csrm-analyst-insight/routes/alerts.ts",
  },
  {
    operation: CSRM_ANALYST_INSIGHT_OPERATIONS.listReports,
    method: "GET",
    path: "/v1/reports",
    handler: "api::csrm-analyst-insight.reports.list",
    file: "csrm-analyst-insight/routes/reports.ts",
  },
  {
    operation: CSRM_ANALYST_INSIGHT_OPERATIONS.getReport,
    method: "GET",
    path: "/v1/reports/:reportKey",
    handler: "api::csrm-analyst-insight.reports.get",
    file: "csrm-analyst-insight/routes/reports.ts",
  },
] as const;

/** A route's catalogue URL: `:name` path parameters are written `{name}` in the FunctionAPI catalogue. */
const catalogueUrl = (method: string, routePath: string): string =>
  `${method}:/api${routePath.replace(/:([A-Za-z][A-Za-z0-9]*)/g, "{$1}")}`;

/** D-06: catalogued operations that no router may serve. */
const UNSERVED_PATH_FRAGMENTS = ['"/v1/alerts/:', '"/v1/dashboard/alerts"', '"/v1/dashboard/reports"', "/acknowledge", "/export"];

function routeSources(): Array<{ file: string; source: string }> {
  const apiDir = path.join(appDir, "src", "api");
  return readdirSync(apiDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const routesDir = path.join(apiDir, entry.name, "routes");
      let files: string[];
      try {
        files = readdirSync(routesDir).filter((file) => file.endsWith(".ts"));
      } catch {
        return [];
      }
      return files.map((file) => ({
        file: `${entry.name}/routes/${file}`,
        source: readFileSync(path.join(routesDir, file), "utf8"),
      }));
    });
}

test("every served analyst insight route is token-only, app-gated and asks for the insight scope", () => {
  const mounted = INSIGHT_ROUTERS.flatMap(([file, router]) => {
    assert.equal(router.type, "content-api", `INSIGHT_ROUTER_NOT_CONTENT_API_${file}`);
    return router.routes.map((route) => ({ file, route }));
  });

  for (const { file, route } of mounted) {
    const served = SERVED_INSIGHT_ROUTES.find((entry) => entry.method === route.method && entry.path === route.path);
    assert.ok(served, `UNINVENTORIED_INSIGHT_ROUTE_${file}_${route.method}_${route.path}`);
    assert.equal(route.handler, served.handler, `INSIGHT_ROUTE_HANDLER_${route.path}`);
    assert.deepEqual(route.config?.auth, { strategies: ["content-api-token"] }, `INSIGHT_ROUTE_NOT_TOKEN_ONLY_${route.path}`);
    const policies = route.config?.policies ?? [];
    assert.equal(policies[0], "global::csrm-app-enabled", `INSIGHT_ROUTE_APP_GATE_NOT_FIRST_${route.path}`);
    assert.deepEqual(policies.slice(1), [
      { name: "global::csrm-authorization", config: { operation: served.operation, requireAnalystInsightScope: true } },
    ], `INSIGHT_ROUTE_POLICY_${route.path}`);
    assert.equal(served.operation, catalogueUrl(served.method, served.path), `INSIGHT_OPERATION_DOES_NOT_NAME_ITS_ROUTE_${route.path}`);
    assert.equal(`csrm-analyst-insight/${file}`, served.file, `INSIGHT_ROUTE_IN_THE_WRONG_ROUTER_${route.path}`);
  }

  for (const served of SERVED_INSIGHT_ROUTES) {
    const matches = mounted.filter(({ route }) => route.method === served.method && route.path === served.path);
    assert.equal(matches.length, 1, `INSIGHT_ROUTE_NOT_MOUNTED_ONCE_${served.method}_${served.path}`);
  }
});

test("no other router in the application mounts an analyst insight path or operation", () => {
  const sources = routeSources();
  assert.ok(sources.length > 10, "ROUTE_SOURCES_NOT_FOUND");
  for (const served of SERVED_INSIGHT_ROUTES) {
    const literal = JSON.stringify(served.path);
    const declaring = sources.filter(({ source }) => source.includes(literal));
    assert.deepEqual(
      declaring.map(({ file }) => file),
      [served.file],
      `INSIGHT_PATH_DECLARED_ELSEWHERE_${served.path}`,
    );
  }
  for (const { file, source } of sources) {
    if (file.startsWith("csrm-analyst-insight/")) continue;
    assert.doesNotMatch(source, /CSRM_ANALYST_INSIGHT_OPERATIONS/, `INSIGHT_OPERATION_MOUNTED_BY_${file}`);
  }
  for (const { file, source } of sources) {
    for (const fragment of UNSERVED_PATH_FRAGMENTS) {
      assert.equal(source.includes(fragment), false, `UNSERVED_OPERATION_MOUNTED_${file}_${fragment}`);
    }
  }
});
