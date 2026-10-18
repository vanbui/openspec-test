import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { importColumns } from "../src/csrm/exports/export-vocabulary";
import { xlsxCellText, type XlsxCell } from "../src/csrm/spreadsheets/xlsx-reader";
import { writeWorkbook } from "../src/csrm/spreadsheets/xlsx-writer";
import { captureSecurityEvents } from "./helpers/attachment-http";
import { readExportCsv, readExportWorkbook } from "./helpers/export-files";
import { is1, rt2Headers, rt3Cp1252 } from "./helpers/spreadsheet-fixtures";
import { startAuthorizationHttpHarness, type AdministrationFixtureKind } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

const resources = [
  { kind: "risk-types", path: "risk_types", fixture: "riskTypes", conflict: { name: "  ADMINISTRATION IMPORT UNCHANGED FIXTURE  " } },
  { kind: "controls", path: "controls", fixture: "controls", conflict: { controlNumber: "  admin-unchanged-001  " } },
  { kind: "information-systems", path: "information_systems", fixture: "informationSystems", conflict: { name: "  ADMINISTRATION UNCHANGED SYSTEM  " } },
  { kind: "information-assets", path: "information_assets", fixture: "informationAssets", conflict: { name: "  ADMINISTRATION UNCHANGED ASSET  " } },
] as const;

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

test("T-06-01 authorizes missing-token, Jane, agent, and missing-grant requests before malformed input", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();

  for (const resource of resources) {
    const countBefore = await harness.countAdministrationRecords(resource.kind);
    const malformedPaths = [
      `/api/v1/${resource.path}?populate=*&page=0`,
      `/api/v1/${resource.path}/not-a-document?populate=*`,
      `/api/v1/${resource.path}/import/preview`,
    ];
    for (const identity of [harness.identities.owner, harness.identities.analystAgent, harness.identities.serviceAnalystAgent, undefined]) {
      for (const path of malformedPaths) {
        const denied = await harness.request({
          path,
          identity,
          init: path.endsWith("preview") ? {
            method: "POST",
            body: harness.createCsvMultipart({ filename: "secret-name.csv", bytes: Buffer.from("not,csv") }),
          } : undefined,
        });
        const denialText = await denied.text();
        assert.doesNotMatch(denialText, /secret-name|not-a-document|populate|SQL|stack|count|total|file|csv/i);
        assert.equal(await harness.countAdministrationRecords(resource.kind), countBefore, `DENIED_${resource.kind}_CHANGED_PERSISTENCE`);
        assert.equal(denied.status, 403, `PHASE6_AUTHORIZATION_ROUTE_MISSING_OR_PARSED_${resource.kind}_${identity ?? "missing"}_${path}`);
      }
    }
    const missingToken = await harness.request({
      path: `/api/v1/${resource.path}?page=0&populate=*`, identity: harness.identities.analyst, omitApiToken: true,
    });
    assert.equal(missingToken.status, 401, `PHASE6_TOKEN_GATE_MISSING_${resource.kind}`);
    assert.equal(await harness.countAdministrationRecords(resource.kind), countBefore);

    const bobReachedParser = await harness.request({
      path: `/api/v1/${resource.path}?page=0&populate=*`, identity: harness.identities.analyst,
    });
    assert.equal(bobReachedParser.status, 400, `PHASE6_ADMINISTRATION_ROUTE_MISSING_${resource.kind}`);
  }
});

test("ADMIN-01 ADMIN-02 maps strict mounted Administration list validation to a bounded 400", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  for (const [path, sort] of [["risk_types", "name%3Aasc"], ["controls", "controlNumber%3Aasc"]] as const) {
    const response = await harness.request({
      path: `/api/v1/${path}?q=&sort=${sort}&page=0&pageSize=25`, identity: harness.identities.analyst,
    });
    assert.equal(response.status, 400, await response.clone().text());
    assert.doesNotMatch(await response.text(), /stack|SQL|TypeError|ValidationError/);
  }
});

/*
 * The Requestor now reaches these shared paths through the bounded selector
 * rather than a bare birthright page: searching by `q` is the point of the
 * selector, and its page sizes are 10, 25 and 50. What has not changed is the
 * boundary that matters — an Administration-shaped call still needs the
 * Administration grant, and nothing about the Administration page leaks.
 */
test("ADMIN-03 the Requestor selector searches without reaching Administration query scope", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  for (const path of ["information_systems", "information_assets"] as const) {
    for (const query of ["", "?q=Administration", "?page=1&pageSize=50"]) {
      const response = await harness.request({ path: `/api/v1/${path}${query}`, identity: harness.identities.owner });
      assert.equal(response.status, 200, `REQUESTOR_${path}_SELECTOR_DENIED: ${await response.clone().text()}`);
      const body = await responseJson(response) as { data?: unknown; meta?: unknown };
      assert.ok(Array.isArray(body.data));
      assert.ok(body.meta);
    }

    // Ordering is the mark of an Administration list, and only that grant serves it.
    for (const query of ["?sort=name%3Adesc", "?q=&sort=name%3Aasc&page=1&pageSize=25"]) {
      const denied = await harness.request({ path: `/api/v1/${path}${query}`, identity: harness.identities.owner });
      const text = await denied.text();
      assert.equal(denied.status, 403, `REQUESTOR_${path}_QUERIED_ADMINISTRATION_DISCLOSED`);
      assert.doesNotMatch(text, /name:desc|pageSize|101|total|count|SQL|stack/i);
    }

    // A page size outside the selector's bounds is a rejected selector query,
    // not a way to widen the page, and it discloses nothing about the data.
    for (const query of ["?pageSize=101", "?page=1&pageSize=100&q=Administration"]) {
      const rejected = await harness.request({ path: `/api/v1/${path}${query}`, identity: harness.identities.owner });
      const text = await rejected.text();
      assert.equal(rejected.status, 400, `REQUESTOR_${path}_UNBOUNDED_SELECTOR_PAGE`);
      assert.doesNotMatch(text, /name:desc|pageSize|101|total|count|SQL|stack/i);
    }
  }
});

test("ADMIN-04 mounted preview classifies a natural key beyond 5,000 persisted records as update", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const { targetName } = await harness.seedRiskTypesDirectly(5_001, `mounted-window-${process.pid}`);
  const preview = await harness.request({
    path: "/api/v1/risk_types/import/preview",
    identity: harness.identities.analyst,
    init: {
      method: "POST",
      body: harness.createCsvMultipart({
        filename: "beyond-window.csv",
        bytes: Buffer.from(`name,description\r\n${targetName},updated beyond the former window`),
      }),
    },
  });
  assert.equal(preview.status, 200, await preview.clone().text());
  const body = await responseJson(preview) as {
    data: { summary: Record<string, number>; rows: Array<{ state: string; matchedDocumentId?: string }> };
  };
  assert.equal(body.data.summary.update, 1);
  assert.equal(body.data.rows[0]?.state, "update");
  assert.equal(typeof body.data.rows[0]?.matchedDocumentId, "string");
});

test("ADMIN-01 ADMIN-02 ADMIN-03 mounted CRUD is closed, normalized, paginated, and delete-free", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAdministrationFixtures();

  for (const resource of resources) {
    const list = await harness.request({
      path: `/api/v1/${resource.path}?q=&sort=name%3Aasc&page=1&pageSize=25`, identity: harness.identities.analyst,
    });
    assert.equal(list.status, 200, `PHASE6_LIST_ROUTE_MISSING_${resource.kind}: ${await list.clone().text()}`);
    const listBody = await responseJson(list);
    assert.ok(Array.isArray(listBody.data));
    assert.deepEqual(Object.keys(listBody).sort(), ["data", "meta"]);
    assert.ok(Number.isInteger(((listBody.meta as { pagination: { total: number } }).pagination.total)));

    const fixtureIds = fixtures[resource.fixture];
    const detail = await harness.request({ path: `/api/v1/${resource.path}/${fixtureIds.update}`, identity: harness.identities.analyst });
    assert.equal(detail.status, 200, `PHASE6_DETAIL_ROUTE_MISSING_${resource.kind}`);
    const detailText = await detail.text();
    assert.doesNotMatch(detailText, resource.kind === "information-systems" || resource.kind === "information-assets"
      ? /createdAt|publishedAt|createdBy|updatedBy|"id":/i
      : /createdAt|updatedAt|publishedAt|createdBy|updatedBy|"id":/i);
    if (resource.kind === "information-systems" || resource.kind === "information-assets") {
      assert.equal(typeof ((JSON.parse(detailText) as { data: { updatedAt: unknown } }).data.updatedAt), "string");
    }

    const before = await harness.getAdministrationRecord(resource.kind, fixtureIds.update);
    const forbidden = await harness.request({
      path: `/api/v1/${resource.path}/${fixtureIds.update}`, identity: harness.identities.analyst,
      init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "forged", createdAt: "forged" }) },
    });
    assert.equal(forbidden.status, 400, `PHASE6_MUTATION_ALLOWLIST_MISSING_${resource.kind}`);
    assert.deepEqual(await harness.getAdministrationRecord(resource.kind, fixtureIds.update), before);

    const conflict = await harness.request({
      path: `/api/v1/${resource.path}/${fixtureIds.update}`, identity: harness.identities.analyst,
      init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(resource.conflict) },
    });
    assert.equal(conflict.status, 409, `PHASE6_NORMALIZED_CONFLICT_MISSING_${resource.kind}`);
    assert.deepEqual(await harness.getAdministrationRecord(resource.kind, fixtureIds.update), before);

    const deleteResponse = await harness.request({
      path: `/api/v1/${resource.path}/${fixtureIds.update}`, identity: harness.identities.analyst, init: { method: "DELETE" },
    });
    assert.ok([404, 405].includes(deleteResponse.status), `T-06-08_DELETE_EXPOSED_${resource.kind}`);
    assert.deepEqual(await harness.getAdministrationRecord(resource.kind, fixtureIds.update), before);
  }
});

test("T-06-05 simultaneous normalized natural-key creates persist exactly one record", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const countBefore = await harness.countAdministrationRecords("risk-types");
  const requests = ["Concurrent natural key", "  CONCURRENT NATURAL KEY  "].map((name) => ({
    path: "/api/v1/risk_types",
    identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description: "race" }) },
  }));
  const responses = await harness.simultaneousRequests(requests);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409], "PHASE6_NORMALIZED_CREATE_SERIALIZATION_MISSING");
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore + 1);
});

test("ADMIN-02 Controls remain globally queried, closed, persistent, and field-safe", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAdministrationFixtures();
  const baseline = await harness.request({
    path: "/api/v1/controls?q=&sort=controlNumber%3Aasc&page=1&pageSize=25",
    identity: harness.identities.analyst,
  });
  assert.equal(baseline.status, 200, `PHASE6_CONTROL_LIST_ROUTE_MISSING: ${await baseline.clone().text()}`);
  const baselineBody = await responseJson(baseline) as {
    data: Array<Record<string, unknown>>;
    meta: { pagination: { page: number; pageSize: number; total: number } };
  };
  assert.equal(baselineBody.meta.pagination.page, 1);
  assert.equal(baselineBody.meta.pagination.pageSize, 25);
  assert.equal(baselineBody.meta.pagination.total, 2_648, "mounted harness adds exactly two isolated Control fixtures to the 2,646-record library");
  assert.ok(baselineBody.data.length <= 25);
  assert.equal(baselineBody.data.some((record) => "sourceData" in record), false);

  const filtered = await harness.request({
    path: "/api/v1/controls?q=administration&framework=CSRM%20acceptance&sort=name%3Aasc&page=1&pageSize=10",
    identity: harness.identities.analyst,
  });
  assert.equal(filtered.status, 200, `PHASE6_CONTROL_FILTER_ROUTE_MISSING: ${await filtered.clone().text()}`);
  const filteredBody = await responseJson(filtered) as {
    data: Array<{ controlNumber: string; name: string; framework: string; controlType: string | null }>;
    meta: { pagination: { total: number } };
  };
  assert.ok(filteredBody.meta.pagination.total <= baselineBody.meta.pagination.total);
  assert.ok(filteredBody.data.length > 0);
  assert.ok(filteredBody.data.every((record) => record.framework === "CSRM acceptance" && /administration/i.test(`${record.controlNumber} ${record.name} ${record.framework}`)));

  const controlNumber = `MOUNTED-CONTROL-${process.pid}`;
  const create = await harness.request({
    path: "/api/v1/controls",
    identity: harness.identities.analyst,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        controlNumber,
        name: "Mounted Control acceptance",
        framework: "CSRM acceptance",
        controlType: "Preventive",
        sourceData: { forged: true },
      }),
    },
  });
  assert.equal(create.status, 400, "PHASE6_CONTROL_SOURCE_DATA_ACCEPTED");

  const accepted = await harness.request({
    path: "/api/v1/controls",
    identity: harness.identities.analyst,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        controlNumber,
        name: "Mounted Control acceptance",
        framework: "CSRM acceptance",
        controlType: "Preventive",
      }),
    },
  });
  assert.equal(accepted.status, 201, `PHASE6_CONTROL_CREATE_ROUTE_MISSING: ${await accepted.clone().text()}`);
  const acceptedBody = await responseJson(accepted) as { data: { documentId: string } };
  const typed = await harness.request({
    path: "/api/v1/controls?q=Mounted&framework=CSRM%20acceptance&controlType=Preventive&sort=name%3Aasc&page=1&pageSize=10",
    identity: harness.identities.analyst,
  });
  assert.equal(typed.status, 200);
  const typedBody = await responseJson(typed) as { data: Array<{ documentId: string; controlType: string }> };
  assert.deepEqual(typedBody.data.map(({ documentId, controlType }) => ({ documentId, controlType })), [
    { documentId: acceptedBody.data.documentId, controlType: "Preventive" },
  ]);
  const update = await harness.request({
    path: `/api/v1/controls/${acceptedBody.data.documentId}`,
    identity: harness.identities.analyst,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ controlReference: "mounted/edit/reload" }),
    },
  });
  assert.equal(update.status, 200, `PHASE6_CONTROL_UPDATE_ROUTE_MISSING: ${await update.clone().text()}`);
  const reloaded = await harness.request({
    path: `/api/v1/controls/${acceptedBody.data.documentId}`,
    identity: harness.identities.analyst,
  });
  assert.equal(reloaded.status, 200);
  assert.equal(((await responseJson(reloaded) as { data: { controlReference: string } }).data.controlReference), "mounted/edit/reload");

  const beforeConflict = await harness.getAdministrationRecord("controls", fixtures.controls.update);
  const conflictRequests = ["ADMIN-CONTROL-RACE", "  admin-control-race  "].map((candidate) => ({
    path: "/api/v1/controls",
    identity: harness.identities.analyst,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ controlNumber: candidate, name: "Race Control", framework: "CSRM acceptance" }),
    },
  }));
  const conflictResponses = await harness.simultaneousRequests(conflictRequests);
  assert.deepEqual(conflictResponses.map(({ status }) => status).sort(), [201, 409]);
  const safeConflict = await responseJson(conflictResponses.find(({ status }) => status === 409)!);
  assert.equal((safeConflict.error as { field: string }).field, "controlNumber");
  assert.deepEqual(await harness.getAdministrationRecord("controls", fixtures.controls.update), beforeConflict);
});

/*
 * D-46, D-29: the control search every picker uses matches number, name and framework, so a word from a
 * loaded title finds its control. Before the Annex A names were loaded, `masking` matched nothing.
 */
test("ADMIN-05 D-46 the control search finds an Annex A control by a word from its name", async () => {
  const harness = await harnessPromise;
  const response = await harness.request({
    path: "/api/v1/controls?q=masking&sort=controlNumber%3Aasc&page=1&pageSize=10",
    identity: harness.identities.analyst,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const body = await responseJson(response) as { data: Array<{ controlNumber: string; name: string }> };
  assert.deepEqual(
    body.data.filter((record) => record.controlNumber === "8.11").map((record) => record.name),
    ["8.11 — Data masking"],
  );
});

/*
 * The Controls contract (ControlsAdministrationRecord) bounds every text field a control record serves, and
 * the web's closed parser enforces each bound, so a single control beyond one fails the whole list page and
 * every picker page that holds it. The walkthrough's searches all reached APP-13, whose seeded description
 * was 100,973 characters against a bound of 10,000; each now returns contract-valid records only.
 */
type ControlStringBound = { field: string; minLength?: number; maxLength?: number };

function controlRecordStringBounds(): ControlStringBound[] {
  const specificationPath = path.resolve(__dirname, "..", "..", "..", "..", "..", "docs", "references", "specification.json");
  const specification = JSON.parse(readFileSync(specificationPath, "utf8")) as {
    components: { schemas: Record<string, { properties: Record<string, { type: string | string[]; minLength?: number; maxLength?: number }> }> };
  };
  return Object.entries(specification.components.schemas.ControlsAdministrationRecord.properties)
    .filter(([, schema]) => [schema.type].flat().includes("string") && (schema.minLength !== undefined || schema.maxLength !== undefined))
    .map(([field, schema]) => ({ field, minLength: schema.minLength, maxLength: schema.maxLength }));
}

function controlBoundBreaches(records: ReadonlyArray<Record<string, unknown>>, bounds: readonly ControlStringBound[]): string[] {
  const breaches: string[] = [];
  for (const record of records) {
    for (const { field, minLength, maxLength } of bounds) {
      const value = record[field];
      if (value === null || value === undefined) continue;
      const length = String(value).length;
      if (maxLength !== undefined && length > maxLength) breaches.push(`${String(record.controlNumber)} ${field} ${length} > ${maxLength}`);
      if (minLength !== undefined && length < minLength) breaches.push(`${String(record.controlNumber)} ${field} ${length} < ${minLength}`);
    }
  }
  return breaches;
}

test("ADMIN-05 the walkthrough's control searches return contract-valid records on every page", async () => {
  const harness = await harnessPromise;
  const bounds = controlRecordStringBounds();
  assert.ok(bounds.some(({ field, maxLength }) => field === "description" && maxLength === 10_000));
  for (const search of ["APP", "APP-13", "Privacy Act", "data", "personal"]) {
    const controlNumbers: string[] = [];
    for (let page = 1; ; page += 1) {
      const response = await harness.request({
        path: `/api/v1/controls?q=${encodeURIComponent(search)}&sort=controlNumber%3Aasc&page=${page}&pageSize=100`,
        identity: harness.identities.analyst,
      });
      assert.equal(response.status, 200, `${search} page ${page}: ${await response.clone().text()}`);
      const body = await responseJson(response) as { data: Array<Record<string, unknown>>; meta: { pagination: { pageCount: number } } };
      assert.deepEqual(controlBoundBreaches(body.data, bounds), [], `${search} page ${page} serves only contract-valid records`);
      controlNumbers.push(...body.data.map((record) => String(record.controlNumber)));
      if (page >= body.meta.pagination.pageCount) break;
    }
    assert.ok(controlNumbers.includes("APP-13"), `${search} finds APP-13`);
  }
});

test("ADMIN-05 a stored control description beyond the bound is served shortened, visibly, with a warning that names the control", async () => {
  const harness = await harnessPromise;
  const controlNumber = `OVER-LONG-${process.pid}`;
  const stored = Array.from({ length: 1_500 }, (_, index) => `clause${index}`).join(" ");
  assert.ok(stored.length > 10_000);
  const documentId = await harness.createFixtureDocument("api::csrm-control.csrm-control", {
    controlNumber, name: `${controlNumber} — Over-long description fixture`, framework: "CSRM acceptance", description: stored,
  });
  const log = (globalThis as unknown as { strapi: { log: { warn: (...args: unknown[]) => unknown } } }).strapi.log;
  const originalWarn = log.warn;
  const warnings: string[] = [];
  log.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
    return originalWarn.apply(log, args);
  };
  try {
    for (const requestPath of [
      `/api/v1/controls/${documentId}`,
      `/api/v1/controls?q=${controlNumber}&sort=controlNumber%3Aasc&page=1&pageSize=25`,
    ]) {
      const response = await harness.request({ path: requestPath, identity: harness.identities.analyst });
      assert.equal(response.status, 200, `${requestPath}: ${await response.clone().text()}`);
      const body = await responseJson(response) as { data: Record<string, unknown> | Array<Record<string, unknown>> };
      const record = [body.data].flat().find((candidate) => candidate.documentId === documentId);
      assert.ok(record, `${requestPath} serves the fixture`);
      const served = String(record.description);
      assert.ok(served.length <= 10_000, `${requestPath} serves ${served.length} characters`);
      assert.ok(served.endsWith("…"), `${requestPath} marks the shortening with an ellipsis`);
      const kept = served.slice(0, -1);
      assert.ok(stored.startsWith(kept), `${requestPath} serves the start of the stored text`);
      assert.match(stored.slice(kept.length), /^\s/, `${requestPath} cuts at a word boundary`);
      assert.ok(kept.length > 9_000, `${requestPath} keeps most of the text`);
    }
  } finally {
    log.warn = originalWarn;
  }
  const named = warnings.filter((warning) => warning.includes(documentId));
  assert.equal(named.length, 2, `one warning per read names the control: ${JSON.stringify(warnings)}`);
  assert.ok(named.every((warning) => warning.includes(controlNumber) && !warning.includes("clause1 ")), "the warning names the control, never its text");
  assert.equal(String((await harness.getAdministrationRecord("controls", documentId))?.description), stored, "a read never rewrites the stored text");
});

test("ADMIN-05 control writes refuse a description beyond the bound and never shorten it", async () => {
  const harness = await harnessPromise;
  const countBefore = await harness.countAdministrationRecords("controls");
  const controlNumber = `DESCRIPTION-BOUND-${process.pid}`;
  const tooLong = "d".repeat(10_001);
  const refusedCreate = await harness.request({
    path: "/api/v1/controls", identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ controlNumber, name: "Description bound", framework: "CSRM acceptance", description: tooLong }) },
  });
  assert.equal(refusedCreate.status, 400);
  assert.equal(((await responseJson(refusedCreate)).error as { code: string }).code, "INVALID_ADMINISTRATION_DATA");
  assert.equal(await harness.countAdministrationRecords("controls"), countBefore);

  const created = await harness.request({
    path: "/api/v1/controls", identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ controlNumber, name: "Description bound", framework: "CSRM acceptance", description: "d".repeat(10_000) }) },
  });
  assert.equal(created.status, 201, await created.clone().text());
  const createdBody = await responseJson(created) as { data: { documentId: string; description: string } };
  assert.equal(createdBody.data.description, "d".repeat(10_000), "a description at the bound is served whole");

  const refusedUpdate = await harness.request({
    path: `/api/v1/controls/${createdBody.data.documentId}`, identity: harness.identities.analyst,
    init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: tooLong }) },
  });
  assert.equal(refusedUpdate.status, 400);
  assert.equal(((await responseJson(refusedUpdate)).error as { code: string }).code, "INVALID_ADMINISTRATION_DATA");
  assert.equal(String((await harness.getAdministrationRecord("controls", createdBody.data.documentId))?.description), "d".repeat(10_000));

  const bytes = Buffer.from(["controlNumber,name,framework,description", `${controlNumber}-CSV,Description bound CSV,CSRM acceptance,${tooLong}`].join("\r\n"));
  const preview = await harness.request({
    path: "/api/v1/controls/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "control-description-over.csv", bytes }) },
  });
  assert.equal(preview.status, 200, await preview.clone().text());
  const previewBody = await responseJson(preview) as { data: { summary: Record<string, number>; rows: Array<{ issues: Array<{ code: string; field: string | null }> }> } };
  assert.deepEqual(previewBody.data.summary, { create: 0, update: 0, unchanged: 0, rejected: 1, ambiguous: 0, similar: 0 });
  assert.deepEqual(previewBody.data.rows[0]?.issues.map(({ code, field }) => ({ code, field })), [{ code: "VALUE_TOO_LONG", field: "description" }]);
  assert.equal(await harness.countAdministrationRecords("controls"), countBefore + 1, "the refused rows write nothing");
});

test("ADMIN-03 Systems and Assets preserve exact fields, owner scope, and normalized concurrency", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();

  const systemCreate = await harness.request({
    path: "/api/v1/information_systems",
    identity: harness.identities.analyst,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `Mounted system ${process.pid}`,
        description: "System acceptance record",
        systemType: "Customer portal",
        owner: harness.users.owner,
        environment: "Production",
        deploymentModel: "Cloud",
        businessCriticality: "High",
        internetFacing: true,
        externalAccessRequired: false,
        hostingLocation: "Australia East",
        lifecycleState: "Existing",
      }),
    },
  });
  assert.equal(systemCreate.status, 201, `PHASE6_SYSTEM_CREATE_ROUTE_MISSING: ${await systemCreate.clone().text()}`);
  const system = (await responseJson(systemCreate) as { data: Record<string, unknown> }).data;
  assert.deepEqual(system, {
    documentId: system.documentId,
    name: `Mounted system ${process.pid}`,
    description: "System acceptance record",
    systemType: "Customer portal",
    owner: harness.users.owner,
    ownerName: "Jane Doe",
    environment: "Production",
    deploymentModel: "Cloud",
    businessCriticality: "High",
    internetFacing: true,
    externalAccessRequired: false,
    hostingLocation: "Australia East",
    lifecycleState: "Existing",
    updatedAt: system.updatedAt,
  });
  assert.equal(typeof system.updatedAt, "string");

  const forgedOwner = await harness.request({
    path: "/api/v1/information_systems",
    identity: harness.identities.analyst,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Forged owner ${process.pid}`, owner: "not-an-active-user" }),
    },
  });
  assert.equal(forgedOwner.status, 400, "T-06-02_FORGED_SYSTEM_OWNER_ACCEPTED");

  const assetCreate = await harness.request({
    path: "/api/v1/information_assets",
    identity: harness.identities.analyst,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `Mounted asset ${process.pid}`,
        description: "Asset acceptance record",
        type: "Customer records",
        location: "Australia East",
        dataClassification: "Critical Infrastructure Sensitive",
        confidentialityRating: "High",
        integrityRating: "High",
        availabilityRating: "Medium",
        containsPersonalData: true,
        containsLegalData: false,
        containsCreditCardData: true,
        comments: "Retain under policy.",
      }),
    },
  });
  assert.equal(assetCreate.status, 201, `PHASE6_ASSET_CREATE_ROUTE_MISSING: ${await assetCreate.clone().text()}`);
  const asset = (await responseJson(assetCreate) as { data: Record<string, unknown> }).data;
  assert.deepEqual(asset, {
    documentId: asset.documentId,
    name: `Mounted asset ${process.pid}`,
    description: "Asset acceptance record",
    type: "Customer records",
    location: "Australia East",
    dataClassification: "Critical Infrastructure Sensitive",
    confidentialityRating: "High",
    integrityRating: "High",
    availabilityRating: "Medium",
    containsPersonalData: true,
    containsLegalData: false,
    containsCreditCardData: true,
    comments: "Retain under policy.",
    updatedAt: asset.updatedAt,
  });
  assert.equal(typeof asset.updatedAt, "string");

  const update = await harness.request({
    path: `/api/v1/information_assets/${String(asset.documentId)}`,
    identity: harness.identities.analyst,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ containsLegalData: true, comments: "Edited and reloaded." }),
    },
  });
  assert.equal(update.status, 200);
  const reloaded = await harness.request({
    path: `/api/v1/information_assets/${String(asset.documentId)}`,
    identity: harness.identities.analyst,
  });
  assert.equal(reloaded.status, 200);
  assert.deepEqual(
    ((await responseJson(reloaded) as { data: { containsLegalData: boolean; comments: string } }).data),
    { ...(await responseJson(update) as { data: Record<string, unknown> }).data, containsLegalData: true, comments: "Edited and reloaded." },
  );

  for (const [path, field] of [["information_systems", "systemType"], ["information_assets", "type"]] as const) {
    const name = `Concurrent ${path} ${process.pid}`;
    const before = await harness.countAdministrationRecords(path === "information_systems" ? "information-systems" : "information-assets");
    const responses = await harness.simultaneousRequests([name, `  ${name.toLocaleUpperCase("en-AU")}  `].map((candidate) => ({
      path: `/api/v1/${path}`,
      identity: harness.identities.analyst,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: candidate, [field]: "Concurrency proof" }),
      },
    })));
    assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
    assert.equal(await harness.countAdministrationRecords(path === "information_systems" ? "information-systems" : "information-assets"), before + 1);
  }
});

test("ADMIN-05 UAT-053 the Information System record and list name the owner and nothing more of the owner's record", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const displayName = `System Owner Proof ${process.pid}`;
  const namedOwner = await harness.createUserFixture({
    email: `system-owner-${process.pid}@example.test`, username: `system-owner-${process.pid}`,
    displayName: `  ${displayName}  `, accountStatus: "active",
  });
  // Strapi already caps displayName at 255; an owner whose name is only spaces has no name to serve.
  const blankOwner = await harness.createUserFixture({
    email: `system-owner-blank-${process.pid}@example.test`, username: `system-owner-blank-${process.pid}`,
    displayName: "   ", accountStatus: "active",
  });

  const cases = [
    { name: `Owned system ${process.pid}`, owner: namedOwner, ownerName: displayName },
    { name: `Unnamed owner system ${process.pid}`, owner: blankOwner, ownerName: null },
    { name: `Unowned system ${process.pid}`, owner: null, ownerName: null },
  ] as const;

  for (const entry of cases) {
    const created = await harness.request({
      path: "/api/v1/information_systems",
      identity: harness.identities.analyst,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: entry.name, owner: entry.owner, businessCriticality: "High" }),
      },
    });
    assert.equal(created.status, 201, `UAT053_SYSTEM_CREATE_FAILED: ${await created.clone().text()}`);
    const record = (await responseJson(created) as { data: Record<string, unknown> }).data;
    assert.equal(record.owner, entry.owner);
    assert.equal(record.ownerName, entry.ownerName, `UAT053_RECORD_OWNER_NAME_MISSING: ${entry.name}`);

    const detail = await harness.request({
      path: `/api/v1/information_systems/${String(record.documentId)}`, identity: harness.identities.analyst,
    });
    assert.equal(detail.status, 200);
    const detailText = await detail.text();
    assert.doesNotMatch(detailText, /@example\.test|"email"|"username"|"accountStatus"|"firstName"|"lastName"/, "UAT053_OWNER_RECORD_WIDENED");
    const detailRecord = (JSON.parse(detailText) as { data: Record<string, unknown> }).data;
    assert.equal(detailRecord.owner, entry.owner);
    assert.equal(detailRecord.ownerName, entry.ownerName, `UAT053_DETAIL_OWNER_NAME_MISSING: ${entry.name}`);

    const list = await harness.request({
      path: `/api/v1/information_systems?q=${encodeURIComponent(entry.name)}&sort=name%3Aasc&page=1&pageSize=25`,
      identity: harness.identities.analyst,
    });
    assert.equal(list.status, 200);
    const listText = await list.text();
    assert.doesNotMatch(listText, /@example\.test|"email"|"username"|"accountStatus"|"firstName"|"lastName"/, "UAT053_OWNER_LIST_WIDENED");
    const listed = (JSON.parse(listText) as { data: Array<Record<string, unknown>> }).data
      .find((row) => row.documentId === record.documentId);
    assert.ok(listed, `UAT053_LIST_ROW_MISSING: ${entry.name}`);
    assert.equal(listed.ownerName, entry.ownerName, `UAT053_LIST_OWNER_NAME_MISSING: ${entry.name}`);
    assert.equal(listed.businessCriticality, "High");
  }

  const forgedName = await harness.request({
    path: "/api/v1/information_systems",
    identity: harness.identities.analyst,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Forged owner name ${process.pid}`, ownerName: "Forged" }),
    },
  });
  assert.equal(forgedName.status, 400, "UAT053_OWNER_NAME_WRITABLE");
});

test("ADMIN-04 T-06-04 preview and commit bind the same digest and keep unchanged rows write-free", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAdministrationFixtures();
  const unchangedBefore = await harness.getAdministrationRecord("risk-types", fixtures.riskTypes.unchanged);
  const countBefore = await harness.countAdministrationRecords("risk-types");
  const bytes = Buffer.from([
    "name,description", "Administration import create integration,new value",
    "Administration import update fixture,updated value",
    "Administration import unchanged fixture,existing value", ",missing name",
    "AMBIGUOUS,first duplicate", " ambiguous ,second duplicate",
  ].join("\r\n"));

  const rawDigest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const directCommit = await harness.request({
    path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "administration.csv", bytes, digest: rawDigest, confirmed: true }) },
  });
  assert.equal(directCommit.status, 409, "T-06-11_RAW_SHA256_ACCEPTED_WITHOUT_SERVER_PREVIEW");
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore);
  assert.deepEqual(await harness.getAdministrationRecord("risk-types", fixtures.riskTypes.unchanged), unchangedBefore);

  const preview = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "administration.csv", bytes }) },
  });
  assert.equal(preview.status, 200, `PHASE6_IMPORT_PREVIEW_ROUTE_MISSING: ${await preview.clone().text()}`);
  const previewBody = await responseJson(preview) as { data: { previewDigest: string; summary: Record<string, number>; rows: Array<{ state: string }> } };
  assert.deepEqual(previewBody.data.summary, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 2, similar: 0 });
  assert.deepEqual(previewBody.data.rows.map(({ state }) => state), ["create", "update", "unchanged", "rejected", "ambiguous", "ambiguous"]);

  const drift = await harness.request({
    path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "administration.csv", bytes, digest: `sha256:${"0".repeat(64)}`, confirmed: true }) },
  });
  assert.equal(drift.status, 409, "T-06-04_PREVIEW_DIGEST_DRIFT_ACCEPTED");
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore);
  assert.deepEqual(await harness.getAdministrationRecord("risk-types", fixtures.riskTypes.unchanged), unchangedBefore);

  for (const confirmed of [undefined, false]) {
    const unconfirmed = await harness.request({
      path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "administration.csv", bytes, digest: previewBody.data.previewDigest, ...(confirmed === undefined ? {} : { confirmed }) }) },
    });
    assert.equal(unconfirmed.status, 400, "T-06-04_IMPORT_ACCEPTED_WITHOUT_LITERAL_CONFIRMATION");
    assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore);
  }

  const committed = await harness.request({
    path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "administration.csv", bytes, digest: previewBody.data.previewDigest, confirmed: true }) },
  });
  assert.equal(committed.status, 200, `PHASE6_IMPORT_COMMIT_ROUTE_MISSING: ${await committed.clone().text()}`);
  const result = await responseJson(committed) as { data: { summary: Record<string, number>; rows: Array<{ state: string }> } };
  assert.deepEqual(result.data.summary, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 2, skipped: 0 });
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore + 1);
  assert.deepEqual(await harness.getAdministrationRecord("risk-types", fixtures.riskTypes.unchanged), unchangedBefore);

  const replay = await harness.request({
    path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "administration.csv", bytes, digest: previewBody.data.previewDigest, confirmed: true }) },
  });
  assert.equal(replay.status, 409, "T-06-11_CONSUMED_PREVIEW_TOKEN_REPLAYED");
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore + 1);
});

test("ADMIN-04 reports preview create drift before writes and never overwrites a concurrent natural-key insertion", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const name = `Preview drift ${process.pid}`;
  const reviewedDescription = "reviewed create description";
  const concurrentDescription = "concurrent authoritative description";
  const bytes = Buffer.from(`name,description\r\n${name},${reviewedDescription}`);

  const preview = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "preview-drift.csv", bytes }) },
  });
  assert.equal(preview.status, 200);
  const previewBody = await responseJson(preview) as { data: { previewDigest: string; summary: Record<string, number>; rows: Array<{ state: string; matchedDocumentId: string | null }> } };
  assert.deepEqual(previewBody.data.summary, { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, similar: 0 });
  assert.deepEqual(previewBody.data.rows.map(({ state, matchedDocumentId }) => ({ state, matchedDocumentId })), [{ state: "create", matchedDocumentId: null }]);

  const concurrent = await harness.request({
    path: "/api/v1/risk_types", identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description: concurrentDescription }) },
  });
  assert.equal(concurrent.status, 201);
  const concurrentBody = await responseJson(concurrent) as { data: { documentId: string } };
  const countAfterConcurrentCreate = await harness.countAdministrationRecords("risk-types");

  const committed = await harness.request({
    path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "preview-drift.csv", bytes, digest: previewBody.data.previewDigest, confirmed: true }) },
  });
  assert.equal(committed.status, 200, await committed.clone().text());
  const result = await responseJson(committed) as { data: { previewChanged: number; summary: Record<string, number>; rows: Array<{ state: string; documentId?: string; issues: Array<{ code: string }> }> } };
  assert.equal(result.data.previewChanged, 1);
  assert.deepEqual(result.data.summary, { create: 0, update: 0, unchanged: 0, rejected: 1, ambiguous: 0, skipped: 0 });
  assert.equal(result.data.rows[0]?.state, "rejected");
  assert.equal(result.data.rows[0]?.documentId, undefined);
  assert.equal(result.data.rows[0]?.issues[0]?.code, "ROW_PREVIEW_DRIFT");
  assert.equal(await harness.countAdministrationRecords("risk-types"), countAfterConcurrentCreate, "drifted import must perform zero writes");
  const preserved = await harness.getAdministrationRecord("risk-types", concurrentBody.data.documentId) as { description?: string };
  assert.equal(preserved.description, concurrentDescription, "drifted import must not overwrite the concurrent record");
});

test("ADMIN-04 applies five-state imports for every remaining Administration collection", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAdministrationFixtures();
  const cases = [
    {
      kind: "controls", path: "controls", fixture: fixtures.controls.unchanged,
      csv: "controlNumber,name,description,framework\r\nPLAN-06-10-CONTROL,Plan 06-10 Control,new value,CSRM acceptance\r\nADMIN-UPDATE-001,Administration update control,updated value,CSRM acceptance\r\nADMIN-UNCHANGED-001,Administration unchanged control,,CSRM acceptance\r\n,Missing control number,,CSRM acceptance",
      ambiguousCsv: "controlNumber,name,framework\r\nPLAN-06-10-CONTROL-DUP,Duplicate one,CSRM acceptance\r\n plan-06-10-control-dup ,Duplicate two,CSRM acceptance",
    },
    {
      kind: "information-systems", path: "information_systems", fixture: fixtures.informationSystems.unchanged,
      csv: "name,description\r\nPlan 06-10 System,new value\r\nAdministration update system,updated value\r\nAdministration unchanged system,existing value\r\n,Missing name",
      ambiguousCsv: "name,description\r\nPlan 06-10 System duplicate,first\r\n plan 06-10 system duplicate ,second",
    },
    {
      kind: "information-assets", path: "information_assets", fixture: fixtures.informationAssets.unchanged,
      csv: "name,description\r\nPlan 06-10 Asset,new value\r\nAdministration update asset,updated value\r\nAdministration unchanged asset,existing value\r\n,Missing name",
      ambiguousCsv: "name,description\r\nPlan 06-10 Asset duplicate,first\r\n plan 06-10 asset duplicate ,second",
    },
  ] as const;

  for (const candidate of cases) {
    const countBefore = await harness.countAdministrationRecords(candidate.kind);
    const unchangedBefore = await harness.getAdministrationRecord(candidate.kind, candidate.fixture);
    const bytes = Buffer.from(candidate.csv);
    const preview = await harness.request({
      path: `/api/v1/${candidate.path}/import/preview`,
      identity: harness.identities.analyst,
      init: {
        method: "POST",
        body: harness.createCsvMultipart({ filename: `${candidate.path}.csv`, bytes }),
      },
    });
    assert.equal(preview.status, 200, `PHASE6_IMPORT_PREVIEW_ROUTE_MISSING_${candidate.path}: ${await preview.clone().text()}`);
    const body = await responseJson(preview) as { data: { previewDigest: string; summary: Record<string, number>; rows: Array<{ state: string }> } };
    assert.deepEqual(body.data.summary, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 0, similar: 0 });
    assert.deepEqual(body.data.rows.map(({ state }) => state), ["create", "update", "unchanged", "rejected"]);
    assert.equal(await harness.countAdministrationRecords(candidate.kind), countBefore, "preview must be write-free");
    assert.deepEqual(await harness.getAdministrationRecord(candidate.kind, candidate.fixture), unchangedBefore);

    const committed = await harness.request({
      path: `/api/v1/${candidate.path}/import`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: `${candidate.path}.csv`, bytes, digest: body.data.previewDigest, confirmed: true }) },
    });
    assert.equal(committed.status, 200, `PHASE6_IMPORT_COMMIT_ROUTE_MISSING_${candidate.path}: ${await committed.clone().text()}`);
    const committedBody = await responseJson(committed) as { data: { summary: Record<string, number> } };
    assert.deepEqual(committedBody.data.summary, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 0, skipped: 0 });
    assert.equal(await harness.countAdministrationRecords(candidate.kind), countBefore + 1);
    assert.deepEqual(await harness.getAdministrationRecord(candidate.kind, candidate.fixture), unchangedBefore, "unchanged rows must never write");

    const ambiguousBytes = Buffer.from(candidate.ambiguousCsv);
    const ambiguousPreview = await harness.request({
      path: `/api/v1/${candidate.path}/import/preview`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: `${candidate.path}-ambiguous.csv`, bytes: ambiguousBytes }) },
    });
    assert.equal(ambiguousPreview.status, 200);
    const ambiguousBody = await responseJson(ambiguousPreview) as { data: { previewDigest: string; summary: Record<string, number> } };
    assert.deepEqual(ambiguousBody.data.summary, { create: 0, update: 0, unchanged: 0, rejected: 0, ambiguous: 2, similar: 0 });
    const countBeforeAmbiguousCommit = await harness.countAdministrationRecords(candidate.kind);
    const ambiguousCommit = await harness.request({
      path: `/api/v1/${candidate.path}/import`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: `${candidate.path}-ambiguous.csv`, bytes: ambiguousBytes, digest: ambiguousBody.data.previewDigest, confirmed: true }) },
    });
    assert.equal(ambiguousCommit.status, 200);
    assert.equal(await harness.countAdministrationRecords(candidate.kind), countBeforeAmbiguousCommit, "ambiguous rows must never write");
  }
});

/* D-38 (UI-SPEC §17.1): a mounted preview names a repeated key by the collection's own column, never "natural key". */
test("UAT-054 a mounted CSV preview names a repeated key by its column", async () => {
  const harness = await harnessPromise;
  for (const candidate of [
    { path: "controls", csv: "controlNumber,name,framework\r\nUAT-054-DUP,Duplicate one,CSRM acceptance\r\n uat-054-dup ,Duplicate two,CSRM acceptance", message: "This control number appears more than once in the file." },
    { path: "risk_types", csv: "name,description\r\nUAT 054 duplicate,first\r\n uat 054 duplicate ,second", message: "This name appears more than once in the file." },
  ] as const) {
    const preview = await harness.request({
      path: `/api/v1/${candidate.path}/import/preview`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: `${candidate.path}-uat-054.csv`, bytes: Buffer.from(candidate.csv) }) },
    });
    assert.equal(preview.status, 200, await preview.clone().text());
    const body = await responseJson(preview) as { data: { rows: Array<{ state: string; issues: Array<{ message: string }> }> } };
    assert.deepEqual(body.data.rows.map((row) => row.state), ["ambiguous", "ambiguous"]);
    for (const row of body.data.rows) assert.deepEqual(row.issues.map((item) => item.message), [candidate.message], candidate.path);
    assert.doesNotMatch(JSON.stringify(body), /natural key|Invalid Administration CSV/i);
  }
});

test("ADMIN-02 ADMIN-04 carries exact frozen Control caps from preview through commit and rejects cap plus one", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const countBefore = await harness.countAdministrationRecords("controls");
  const controlNumber = `BOUNDARY-${process.pid}`;
  const reference = "r".repeat(500);
  const version = "v".repeat(255);
  const source = "s".repeat(2_000);
  const bytes = Buffer.from([
    "controlNumber,name,framework,controlReference,frameworkVersion,frameworkSource",
    `${controlNumber},Boundary Control,Boundary Framework,${reference},${version},${source}`,
  ].join("\r\n"));

  const preview = await harness.request({
    path: "/api/v1/controls/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "control-boundary.csv", bytes }) },
  });
  assert.equal(preview.status, 200, await preview.clone().text());
  const previewBody = await responseJson(preview) as { data: { previewDigest: string; summary: Record<string, number> } };
  assert.deepEqual(previewBody.data.summary, { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, similar: 0 });

  const committed = await harness.request({
    path: "/api/v1/controls/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "control-boundary.csv", bytes, digest: previewBody.data.previewDigest, confirmed: true }) },
  });
  assert.equal(committed.status, 200, await committed.clone().text());
  const committedBody = await responseJson(committed) as { data: { summary: Record<string, number>; rows: Array<{ documentId?: string }> } };
  assert.deepEqual(committedBody.data.summary, { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 0 });
  const created = await harness.getAdministrationRecord("controls", String(committedBody.data.rows[0]?.documentId)) as Record<string, unknown>;
  assert.equal(String(created.controlReference).length, 500);
  assert.equal(String(created.frameworkVersion).length, 255);
  assert.equal(String(created.frameworkSource).length, 2_000);
  assert.equal(await harness.countAdministrationRecords("controls"), countBefore + 1);

  const overBytes = Buffer.from([
    "controlNumber,name,framework,controlReference",
    `${controlNumber}-OVER,Boundary Over,Boundary Framework,${"r".repeat(501)}`,
  ].join("\r\n"));
  const overPreview = await harness.request({
    path: "/api/v1/controls/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "control-over.csv", bytes: overBytes }) },
  });
  assert.equal(overPreview.status, 200);
  const overBody = await responseJson(overPreview) as { data: { summary: Record<string, number> } };
  assert.deepEqual(overBody.data.summary, { create: 0, update: 0, unchanged: 0, rejected: 1, ambiguous: 0, similar: 0 });
  assert.equal(await harness.countAdministrationRecords("controls"), countBefore + 1, "cap-plus-one preview must be write-free");
});

test("ADMIN-01 persists a blank Risk Type description as null on create and clear", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAdministrationFixtures();
  const created = await harness.request({
    path: "/api/v1/risk_types", identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `Nullable description ${process.pid}`, description: null }) },
  });
  assert.equal(created.status, 201, await created.clone().text());
  const cleared = await harness.request({
    path: `/api/v1/risk_types/${fixtures.riskTypes.update}`, identity: harness.identities.analyst,
    init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: null }) },
  });
  assert.equal(cleared.status, 200, await cleared.clone().text());
  assert.equal(((await responseJson(cleared) as { data: { description: unknown } }).data.description), null);
  const reread = await harness.request({ path: `/api/v1/risk_types/${fixtures.riskTypes.update}`, identity: harness.identities.analyst });
  assert.equal(((await responseJson(reread) as { data: { description: unknown } }).data.description), null);
});

test("ADMIN-03 ADMIN-04 persists exact 500-character System and Asset locations and rejects cap plus one", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  for (const candidate of [
    { kind: "information-systems", path: "information_systems", field: "hostingLocation" },
    { kind: "information-assets", path: "information_assets", field: "location" },
  ] as const) {
    const exact = "x".repeat(500);
    const name = `${candidate.kind} boundary ${process.pid}`;
    const direct = await harness.request({
      path: `/api/v1/${candidate.path}`, identity: harness.identities.analyst,
      init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, [candidate.field]: exact }) },
    });
    assert.equal(direct.status, 201, await direct.clone().text());
    const directBody = await responseJson(direct) as { data: { documentId: string } };
    assert.equal(String((await harness.getAdministrationRecord(candidate.kind, directBody.data.documentId))?.[candidate.field]).length, 500);

    const over = await harness.request({
      path: `/api/v1/${candidate.path}`, identity: harness.identities.analyst,
      init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `${name} over`, [candidate.field]: "x".repeat(501) }) },
    });
    assert.equal(over.status, 400);

    const csvName = `${name} import`;
    const bytes = Buffer.from(`name,${candidate.field}\r\n${csvName},${exact}`);
    const preview = await harness.request({
      path: `/api/v1/${candidate.path}/import/preview`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: "location-boundary.csv", bytes }) },
    });
    assert.equal(preview.status, 200, await preview.clone().text());
    const previewBody = await responseJson(preview) as { data: { previewDigest: string; summary: Record<string, number> } };
    assert.equal(previewBody.data.summary.create, 1);
    const committed = await harness.request({
      path: `/api/v1/${candidate.path}/import`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: "location-boundary.csv", bytes, digest: previewBody.data.previewDigest, confirmed: true }) },
    });
    assert.equal(committed.status, 200, await committed.clone().text());
    const committedBody = await responseJson(committed) as { data: { rows: Array<{ documentId?: string }> } };
    assert.equal(String((await harness.getAdministrationRecord(candidate.kind, String(committedBody.data.rows[0]?.documentId)))?.[candidate.field]).length, 500);

    const overBytes = Buffer.from(`name,${candidate.field}\r\n${csvName} over,${"x".repeat(501)}`);
    const overPreview = await harness.request({
      path: `/api/v1/${candidate.path}/import/preview`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: "location-over.csv", bytes: overBytes }) },
    });
    assert.equal(overPreview.status, 200);
    assert.equal(((await responseJson(overPreview) as { data: { summary: Record<string, number> } }).data.summary.rejected), 1);
  }
});

test("ADMIN-04 rejects update value drift by updatedAt and preserves the concurrent edit", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAdministrationFixtures();
  const bytes = Buffer.from("name,description\r\nAdministration import update fixture,reviewed import value");
  const preview = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "value-drift.csv", bytes }) },
  });
  assert.equal(preview.status, 200);
  const previewDigest = ((await responseJson(preview) as { data: { previewDigest: string } }).data.previewDigest);
  const concurrentDescription = `concurrent value ${Date.now()}`;
  const concurrent = await harness.request({
    path: `/api/v1/risk_types/${fixtures.riskTypes.update}`, identity: harness.identities.analyst,
    init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: concurrentDescription }) },
  });
  assert.equal(concurrent.status, 200);
  const committed = await harness.request({
    path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "value-drift.csv", bytes, digest: previewDigest, confirmed: true }) },
  });
  assert.equal(committed.status, 200, await committed.clone().text());
  const result = await responseJson(committed) as { data: { previewChanged: number; rows: Array<{ state: string; issues: Array<{ code: string }> }> } };
  assert.equal(result.data.previewChanged, 1);
  assert.equal(result.data.rows[0]?.state, "rejected");
  assert.equal(result.data.rows[0]?.issues[0]?.code, "ROW_PREVIEW_DRIFT");
  assert.equal((await harness.getAdministrationRecord("risk-types", fixtures.riskTypes.update))?.description, concurrentDescription);
});

test("ADMIN-04 rejects duplicate and unexpected multipart file fields with zero writes", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const countBefore = await harness.countAdministrationRecords("risk-types");
  const bytes = Buffer.from("name,description\r\nMultipart boundary row,never written");
  const duplicate = new FormData();
  duplicate.append("file", new File([bytes], "first.csv", { type: "text/csv" }));
  duplicate.append("file", new File([bytes], "second.csv", { type: "text/csv" }));
  const duplicateResponse = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: duplicate },
  });
  assert.ok([400, 413].includes(duplicateResponse.status), `T-06-11_DUPLICATE_FILE_PARTS_ACCEPTED: ${duplicateResponse.status}`);
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore);

  const unexpected = new FormData();
  unexpected.set("file", new File([bytes], "expected.csv", { type: "text/csv" }));
  unexpected.set("attachment", new File([bytes], "unexpected.csv", { type: "text/csv" }));
  const unexpectedResponse = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: unexpected },
  });
  assert.ok([400, 413].includes(unexpectedResponse.status), `T-06-11_UNEXPECTED_FILE_FIELD_ACCEPTED: ${unexpectedResponse.status}`);
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore);
});

test("ADMIN-04 commits successful rows, rolls back only a failed row, and returns a formula-safe bounded report", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const countBefore = await harness.countAdministrationRecords("risk-types");
  const bytes = Buffer.from('name,description\r\nSuccessful import row,Safe value\r\nFormula report row,"=HYPERLINK(""https://invalid.test"")"');
  const preview = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "formula.csv", bytes }) },
  });
  assert.equal(preview.status, 200, "PHASE6_IMPORT_PREVIEW_ROUTE_MISSING");
  const digest = ((await responseJson(preview) as { data: { previewDigest: string } }).data.previewDigest);
  const result = await harness.withDocumentWriteFailure("api::csrm-risk-type.csrm-risk-type", "create", 2, () =>
    harness.request({
      path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: "formula.csv", bytes, digest, confirmed: true }) },
    }));
  assert.equal(result.status, 200, `PHASE6_PER_ROW_ROLLBACK_ROUTE_MISSING: ${await result.clone().text()}`);
  const text = await result.text();
  assert.doesNotMatch(text, /(?:^|[,\r\n])[=+\-@\t\r]/);
  assert.doesNotMatch(text, /https:\/\/invalid\.test/);
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore + 1);
});

/*
 * Phase 19 (19-13 Task 1; D-25 to D-27, ROADMAP criterion 3): the four imports read every upload through the one reader
 * of 19-03 and map headers by field name or label. The UAT's "Name" file with an extra Owner column previews with Owner
 * named in a warning; the same rows as an .xlsx preview alike; a file CSRM cannot read is refused with its closed
 * reason and safe found details, never the generic could-not-be-validated message, and nothing is written.
 */
type ImportPreviewBody = {
  data: {
    previewDigest: string;
    summary: Record<string, number>;
    warnings: string[];
    notes: string[];
    readOnlyColumns: string[];
    rows: Array<{ rowNumber: number; state: string; naturalKey: string | null; values: Record<string, unknown>; issues: Array<{ code: string }> }>;
  };
};
type RefusalBody = { error: { status: number; code?: string; message: string; details?: { reason?: string; found?: Record<string, unknown> } } };

test("CSV-02 UAT-051 the Name file with an Owner column previews with Owner in a warning, and its .xlsx previews alike", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const countBefore = await harness.countAdministrationRecords("risk-types");
  const csvPreview = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "rt-2-headers.csv", bytes: rt2Headers() }) },
  });
  assert.equal(csvPreview.status, 200, await csvPreview.clone().text());
  const csvBody = await responseJson(csvPreview) as ImportPreviewBody;
  assert.deepEqual(csvBody.data.warnings, ["Owner"]);
  assert.deepEqual(csvBody.data.notes, []);
  assert.deepEqual(csvBody.data.readOnlyColumns, []);
  assert.deepEqual(csvBody.data.rows.map((row) => row.naturalKey), ["Credential misuse", "Supplier outage"]);
  assert.equal(csvBody.data.summary.rejected, 0, "the extra column rejects no row");
  for (const row of csvBody.data.rows) {
    assert.deepEqual(row.issues, []);
    assert.equal("Owner" in row.values || "owner" in row.values, false, "the ignored column fills no value");
  }

  const workbook = await writeWorkbook([{
    name: "Risk types",
    header: ["Name", "Description", "Owner"],
    rows: [
      [{ kind: "text", value: "Credential misuse" }, { kind: "text", value: "Stolen or shared credentials" }, { kind: "text", value: "Dana Lee" }],
      [{ kind: "text", value: "Supplier outage" }, { kind: "text", value: "A key supplier stops delivering" }, { kind: "text", value: "Sam Ortiz" }],
    ],
    widths: [30, 40, 20],
  }]);
  const xlsxPreview = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createXlsxMultipart({ filename: "rt-2-headers.xlsx", bytes: workbook }) },
  });
  assert.equal(xlsxPreview.status, 200, await xlsxPreview.clone().text());
  const xlsxBody = await responseJson(xlsxPreview) as ImportPreviewBody;
  const comparable = ({ previewDigest: _digest, ...data }: ImportPreviewBody["data"] & { fileName?: string }) => ({ ...data, fileName: undefined });
  assert.deepEqual(comparable(xlsxBody.data), comparable(csvBody.data), "the .xlsx previews exactly as the CSV does");
  assert.notEqual(xlsxBody.data.previewDigest, csvBody.data.previewDigest);
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore, "a preview writes nothing");
});

test("CSV-03 an unreadable file is refused with IMPORT_ENCODING_WINDOWS_1252, IMPORT_DELIMITER, IMPORT_CSV_MALFORMED or IMPORT_FILE_TYPE and writes nothing", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const countBefore = await harness.countAdministrationRecords("risk-types");
  const refused = async (filename: string, bytes: Buffer, status: number, reason: string): Promise<RefusalBody> => {
    const response = await harness.request({
      path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename, bytes }) },
    });
    const text = await response.text();
    assert.equal(response.status, status, `${reason}: ${text}`);
    const body = JSON.parse(text) as RefusalBody;
    assert.equal(body.error.details?.reason, reason, text);
    assert.doesNotMatch(text, /could not be validated/i);
    return body;
  };

  const windows1252 = await refused("rt-3-cp1252.csv", rt3Cp1252(), 422, "IMPORT_ENCODING_WINDOWS_1252");
  assert.equal(windows1252.error.details?.found, undefined);
  assert.doesNotMatch(JSON.stringify(windows1252), /Caf|Point-of-sale|terminals/);

  const semicolons = await refused("semicolons.csv", Buffer.from("Name;Description\r\nPayroll;Payroll system\r\n"), 422, "IMPORT_DELIMITER");
  assert.deepEqual(semicolons.error.details?.found, { delimiter: "semicolon" });

  const malformed = await refused("broken.csv", Buffer.from('Name,Description\r\nPayroll,ok\r\nBilling,"secret"tail\r\n'), 422, "IMPORT_CSV_MALFORMED");
  assert.deepEqual(malformed.error.details?.found, { line: 3 });
  assert.doesNotMatch(JSON.stringify(malformed), /secret|Billing/);

  const text = await refused("risk-types.txt", rt2Headers(), 415, "IMPORT_FILE_TYPE");
  assert.equal(text.error.details?.found, undefined);

  const missing = await refused("no-name.csv", Buffer.from("Description,Owner\r\nNo name,Dana Lee\r\n"), 422, "IMPORT_MISSING_COLUMN");
  assert.deepEqual(missing.error.details?.found, { labels: ["Name"] });

  const duplicate = await refused("two-names.csv", Buffer.from("Name,name\r\nPayroll,Payroll\r\n"), 422, "IMPORT_DUPLICATE_HEADER");
  assert.deepEqual(duplicate.error.details?.found, { headers: ["Name", "name"], labels: ["Name"] });

  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore, "a refused file writes nothing");
});

/*
 * Phase 19 (19-13 Task 2; D-28): the mounted imports read the values people type. IS-1's Yes, No and Y flags classify
 * with booleans; #CLEAR empties an optional field on an update and the commit stores it empty; the template's example
 * row is skipped with a note; an Information System file's Owner column is a read-only note; a 70,000-byte row is one
 * rejected row and the others still classify.
 */
test("CSV-02 IS-1 flags, #CLEAR, the example row, the read-only Owner and a 70,000-byte row import the way people type them", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const preview = async (path: string, filename: string, bytes: Buffer) => {
    const response = await harness.request({
      path: `/api/v1/${path}/import/preview`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename, bytes }) },
    });
    assert.equal(response.status, 200, await response.clone().text());
    return (await responseJson(response) as ImportPreviewBody).data;
  };

  const flags = await preview("information_systems", "is-1.csv", is1());
  for (const row of flags.rows) assert.equal(row.issues.some((item) => item.code === "INVALID_BOOLEAN"), false, `row ${row.rowNumber}`);
  const intranet = flags.rows.find((row) => row.naturalKey === "UAT-D: Intranet");
  assert.equal(intranet?.values.internetFacing, true, "Yes reads as a flag");

  const name = `Cleared hosting ${process.pid}`;
  const created = await harness.request({
    path: "/api/v1/information_systems", identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, hostingLocation: "Sydney", systemType: "Kept type" }) },
  });
  assert.equal(created.status, 201, await created.clone().text());
  const documentId = (await responseJson(created) as { data: { documentId: string } }).data.documentId;
  const clearBytes = Buffer.from([
    "Name,Hosting location,Type,Owner,Issues",
    "Example (CSRM skips this row),Nowhere,Example,Dana Lee,",
    `${name},#CLEAR,,Dana Lee,Row 3: fixed`,
  ].join("\r\n"));
  const cleared = await preview("information_systems", "clear.csv", clearBytes);
  assert.deepEqual(cleared.rows.map((row) => [row.rowNumber, row.state]), [[3, "update"]], "the example row is skipped");
  assert.deepEqual(cleared.warnings, []);
  assert.deepEqual([...cleared.notes].sort(), ["example-row", "issues-column", "read-only-columns"]);
  assert.deepEqual(cleared.readOnlyColumns, ["Owner"]);
  assert.equal(cleared.rows[0]?.values.hostingLocation, null);
  const committed = await harness.request({
    path: "/api/v1/information_systems/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "clear.csv", bytes: clearBytes, digest: cleared.previewDigest, confirmed: true }) },
  });
  assert.equal(committed.status, 200, await committed.clone().text());
  const stored = await harness.getAdministrationRecord("information-systems", documentId) as Record<string, unknown>;
  assert.equal(stored.hostingLocation, null, "#CLEAR empties the optional field");
  assert.equal(stored.systemType, "Kept type", "a blank cell leaves the field unchanged");

  const longBytes = Buffer.from(`Name,Description\r\nLong row ${process.pid},${"d".repeat(70_000)}\r\nShort row ${process.pid},fine\r\n`);
  const long = await preview("risk_types", "long-row.csv", longBytes);
  assert.deepEqual(long.rows.map((row) => row.state), ["rejected", "create"]);
  assert.deepEqual(long.rows[0]?.issues.map(({ code }) => code), ["VALUE_TOO_LONG"]);
  assert.doesNotMatch(JSON.stringify(long), /d{1000}/, "the over-long row's values never return");
});

/*
 * Phase 19 (19-13 Task 3; D-30, D-32, D-18; ROADMAP criterion 5, CSV-03): a name that equals a stored one only after
 * NFKC, lower case and collapsed whitespace is "Matched by similar name" (similar), named with the stored name, and is
 * neither created nor updated until the commit carries a decision for it.
 */
type ImportResultBody = {
  data: {
    resultToken: string;
    previewChanged: number;
    summary: Record<string, number>;
    rows: Array<{ rowNumber: number; state: string; decision?: string; documentId?: string; issues: Array<{ code: string }> }>;
  };
};
type SimilarPreviewBody = { data: Omit<ImportPreviewBody["data"], "rows"> & { rows: Array<ImportPreviewBody["data"]["rows"][number] & { matchedDocumentId: string | null; matchedName: string | null }> } };

async function createInformationSystem(harness: Awaited<typeof harnessPromise>, name: string, description: string): Promise<string> {
  const created = await harness.request({
    path: "/api/v1/information_systems", identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description }) },
  });
  assert.equal(created.status, 201, await created.clone().text());
  return (await responseJson(created) as { data: { documentId: string } }).data.documentId;
}

async function previewSystems(harness: Awaited<typeof harnessPromise>, filename: string, bytes: Buffer, identity = harness.identities.analyst) {
  const response = await harness.request({
    path: "/api/v1/information_systems/import/preview", identity,
    init: { method: "POST", body: harness.createCsvMultipart({ filename, bytes }) },
  });
  assert.equal(response.status, 200, await response.clone().text());
  return (await responseJson(response) as SimilarPreviewBody).data;
}

async function commitSystems(harness: Awaited<typeof harnessPromise>, filename: string, bytes: Buffer, digest: string, decisions?: string, identity = harness.identities.analyst) {
  return harness.request({
    path: "/api/v1/information_systems/import", identity,
    init: { method: "POST", body: harness.createCsvMultipart({ filename, bytes, digest, confirmed: true, ...(decisions === undefined ? {} : { decisions }) }) },
  });
}

test("CSV-03 Matched by similar name: a lower-case or re-spaced copy of a stored name is similar, an exact name is not, and two rows of one file stay ambiguous", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const stored = `UAT-B: Core customer billing system ${process.pid}`;
  const documentId = await createInformationSystem(harness, stored, "Billing");
  for (const name of [stored.toLowerCase(), stored.replace(": ", ":  ")]) {
    const preview = await previewSystems(harness, "similar.csv", Buffer.from(`Name,Description\r\n${name},Billing\r\n`));
    assert.deepEqual(preview.rows.map((row) => [row.state, row.matchedDocumentId, row.matchedName, row.naturalKey]), [["similar", documentId, stored, name]], name);
    assert.equal(preview.summary.similar, 1);
  }
  const exact = await previewSystems(harness, "exact.csv", Buffer.from(`Name,Description\r\n${stored},Billing\r\n`));
  assert.deepEqual(exact.rows.map((row) => [row.state, row.matchedName]), [["unchanged", stored]]);
  const pair = await previewSystems(harness, "pair.csv", Buffer.from(`Name\r\nabc ${process.pid}\r\nABC ${process.pid}\r\n`));
  assert.deepEqual(pair.rows.map((row) => row.state), ["ambiguous", "ambiguous"]);
  assert.deepEqual(Object.keys(pair.summary), ["create", "update", "unchanged", "rejected", "ambiguous", "similar"]);
});

test("CSV-03 IMPORT_DECISION_MISSING: a similar row waits for its decision; update keeps the stored name, skip leaves the record deep-equal, drift rejects it", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const stored = `Similar decision system ${process.pid}`;
  const documentId = await createInformationSystem(harness, stored, "old description");
  const before = await harness.getAdministrationRecord("information-systems", documentId);
  const bytes = Buffer.from(`Name,Description\r\n${stored.toUpperCase()},new description\r\nDecision companion ${process.pid},created\r\n`);
  const countBefore = await harness.countAdministrationRecords("information-systems");

  const preview = await previewSystems(harness, "decisions.csv", bytes);
  assert.deepEqual(preview.rows.map((row) => row.state), ["similar", "create"]);
  const missing = await commitSystems(harness, "decisions.csv", bytes, preview.previewDigest);
  assert.equal(missing.status, 409, await missing.clone().text());
  assert.equal(((await responseJson(missing)) as RefusalBody).error.details?.reason, "IMPORT_DECISION_MISSING");
  for (const decisions of [JSON.stringify({ 2: "update", 3: "update" }), "{not json", JSON.stringify(Object.fromEntries(Array.from({ length: 5_001 }, (_, index) => [String(index + 2), "skip"])))]) {
    const invalid = await commitSystems(harness, "decisions.csv", bytes, preview.previewDigest, decisions);
    assert.equal(invalid.status, 400, `${decisions.slice(0, 40)}: ${await invalid.clone().text()}`);
  }
  assert.equal(await harness.countAdministrationRecords("information-systems"), countBefore, "a refused commit writes nothing");
  assert.deepEqual(await harness.getAdministrationRecord("information-systems", documentId), before);

  const skipped = await commitSystems(harness, "decisions.csv", bytes, preview.previewDigest, JSON.stringify({ 2: "skip" }));
  assert.equal(skipped.status, 200, await skipped.clone().text());
  const skippedBody = await responseJson(skipped) as ImportResultBody;
  assert.deepEqual(skippedBody.data.summary, { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 1 });
  assert.deepEqual(skippedBody.data.rows.map(({ state, decision }) => [state, decision]), [["similar", "skip"], ["create", undefined]]);
  assert.match(skippedBody.data.resultToken, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(await harness.getAdministrationRecord("information-systems", documentId), before, "skip leaves the record deep-equal");

  const again = await previewSystems(harness, "decisions.csv", bytes);
  const updated = await commitSystems(harness, "decisions.csv", bytes, again.previewDigest, JSON.stringify({ 2: "update" }));
  assert.equal(updated.status, 200, await updated.clone().text());
  const updatedBody = await responseJson(updated) as ImportResultBody;
  assert.deepEqual(updatedBody.data.rows[0] && [updatedBody.data.rows[0].state, updatedBody.data.rows[0].decision, updatedBody.data.rows[0].documentId], ["similar", "update", documentId]);
  assert.equal(updatedBody.data.summary.update, 1);
  const after = await harness.getAdministrationRecord("information-systems", documentId) as Record<string, unknown>;
  assert.deepEqual([after.name, after.description], [stored, "new description"], "update applies the description and keeps the stored name");

  const drift = await previewSystems(harness, "drift.csv", Buffer.from(`Name,Description\r\n${stored.toLowerCase()},drifted import\r\n`));
  const concurrent = await harness.request({
    path: `/api/v1/information_systems/${documentId}`, identity: harness.identities.analyst,
    init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: "concurrent edit" }) },
  });
  assert.equal(concurrent.status, 200);
  const drifted = await commitSystems(harness, "drift.csv", Buffer.from(`Name,Description\r\n${stored.toLowerCase()},drifted import\r\n`), drift.previewDigest, JSON.stringify({ 2: "update" }));
  assert.equal(drifted.status, 200, await drifted.clone().text());
  const driftedBody = await responseJson(drifted) as ImportResultBody;
  assert.deepEqual(driftedBody.data.rows.map((row) => [row.state, row.issues[0]?.code]), [["rejected", "ROW_PREVIEW_DRIFT"]]);
  assert.equal((await harness.getAdministrationRecord("information-systems", documentId) as Record<string, unknown>).description, "concurrent edit");
});

test("CSV-03 IMPORT_REVIEW_EXPIRED: an unknown or another analyst's preview token, where bdd0f698 answered IMPORT_PREVIEW_CHANGED; a different file keeps IMPORT_PREVIEW_CHANGED", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const bytes = Buffer.from(`Name\r\nExpiry check ${process.pid}\r\n`);
  const reasonOf = async (response: Response) => {
    assert.equal(response.status, 409, await response.clone().text());
    const { error } = (await responseJson(response)) as RefusalBody;
    // IMPORT_PREVIEW_CHANGED is not a closed reason: it keeps the Administration envelope's code (Phase 06).
    return error.details?.reason ?? error.code;
  };
  // Deliberate change (19-13; the import record's "Decisions on Similar Rows"): an unknown or foreign token is expired.
  assert.equal(await reasonOf(await commitSystems(harness, "expiry.csv", bytes, `sha256:${"0".repeat(64)}`)), "IMPORT_REVIEW_EXPIRED");
  const preview = await previewSystems(harness, "expiry.csv", bytes);
  assert.equal(await reasonOf(await commitSystems(harness, "expiry.csv", bytes, preview.previewDigest, undefined, harness.identities.secondAnalyst)), "IMPORT_REVIEW_EXPIRED");
  assert.equal(await reasonOf(await commitSystems(harness, "expiry.csv", Buffer.from(`Name\r\nA different file ${process.pid}\r\n`), preview.previewDigest)), "IMPORT_PREVIEW_CHANGED");
});

test("CSV-03 import.committed: one line per commit with the counts, digest, format and file name, and no cell value", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const cell = `Logged import cell ${process.pid}`;
  const bytes = Buffer.from(`Name,Description\r\n${cell},secret description value\r\n`);
  const preview = await previewSystems(harness, "logged-import.csv", bytes);
  const { result, events } = await captureSecurityEvents(() => commitSystems(harness, "logged-import.csv", bytes, preview.previewDigest));
  assert.equal(result.status, 200, await result.clone().text());
  const committed = events.filter(({ event }) => event.event === "import.committed");
  assert.equal(committed.length, 1, "one import.committed line per commit");
  const line = committed[0]!.event as Record<string, unknown>;
  assert.deepEqual(line.counts, { created: 1, updated: 0, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 0 });
  assert.equal(line.collection, "information-systems");
  assert.equal(line.fileName, "logged-import.csv");
  assert.equal(line.format, "csv");
  assert.equal(line.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(line.outcome, "committed");
  assert.equal((line.actor as Record<string, unknown>).documentId, harness.users.analyst);
  assert.doesNotMatch(committed[0]!.line, /Logged import cell|secret description value/);
  assert.equal(events.filter(({ event }) => event.event === "import.committed").length, 1);
});

/*
 * Phase 19 (19-14 Task 1; D-31, D-12, D-18; CSV-02 criterion 3): each collection's import template comes from the import
 * contract on request, with display-label headers, one example row the import skips and, in XLSX, a Notes sheet. It
 * is not an export of records, so it writes no export event and carries no row count.
 */
const XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MEDIA_TYPE = "text/csv; charset=utf-8";
const TEMPLATE_RULES = (singular: string) => [
  "Yes/No columns accept Yes, No, Y, N, TRUE or FALSE.",
  `#CLEAR on its own empties an optional value when a row updates an existing ${singular}.`,
  "Row 2 is an example. CSRM skips it, so you can keep it or delete it.",
  "Columns CSRM doesn’t recognise are ignored, and the import tells you which.",
  "A cell showing an Excel error, such as #DIV/0!, imports as blank.",
  "Keep this file as an Excel workbook (.xlsx). Excel removes leading zeros (0042) and changes date-like text when it opens a CSV.",
];
const TEMPLATE_RESOURCES = [
  { kind: "risk-types", path: "risk_types", slug: "risk-types" },
  { kind: "controls", path: "controls", slug: "controls" },
  { kind: "information-systems", path: "information_systems", slug: "information-systems" },
  { kind: "information-assets", path: "information_assets", slug: "information-assets" },
] as const;

function sheetText(rows: readonly (readonly XlsxCell[])[]): string[][] {
  return rows.map((row) => row.map(xlsxCellText));
}

async function downloadTemplate(harness: Awaited<typeof harnessPromise>, segment: string, query: string, identity = harness.identities.analyst) {
  return harness.request({ path: `/api/v1/${segment}/import/template${query}`, identity });
}

function assertDownload(response: Response, mediaType: string, fileName: string, label: string): void {
  assert.equal(response.headers.get("content-type"), mediaType, `${label}_CONTENT_TYPE`);
  assert.equal(response.headers.get("content-disposition")?.includes(`filename*=UTF-8''${fileName}`), true, `${label}_DISPOSITION: ${response.headers.get("content-disposition")}`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${label}_NOSNIFF`);
  assert.equal(response.headers.get("cache-control"), "no-store", `${label}_CACHE`);
}

test("CSV-02 D-31 the Information Systems template downloads as a workbook that explains itself and as a BOM-led CSV, with no export event", async () => {
  const harness = await harnessPromise;
  const spec = importColumns("information-systems");
  const labels = spec.columns.map((column) => column.label);

  const { result: xlsx, events } = await captureSecurityEvents(() => downloadTemplate(harness, "information_systems", "?format=xlsx", harness.identities.analyst));
  assert.equal(xlsx.status, 200, await xlsx.clone().text());
  assertDownload(xlsx, XLSX_MEDIA_TYPE, "information-systems-import-template.xlsx", "TEMPLATE_XLSX");
  assert.equal(xlsx.headers.get("x-csrm-row-count"), null, "a template carries no row count");
  assert.deepEqual(events.filter(({ event }) => String(event.event).startsWith("export.")), [], "a template is not an export");
  const sheets = await readExportWorkbook(Buffer.from(await xlsx.arrayBuffer()));
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Information Systems import", "Notes"]);
  const [header, example, ...rest] = sheetText(sheets[0]!.rows);
  assert.deepEqual(header, labels, "the header row is the import labels in contract order");
  assert.equal(rest.length, 0, "one example row");
  assert.equal(example?.[0], "Example (CSRM skips this row)");
  assert.equal(example?.[labels.indexOf("Internet-facing")], "Yes");
  assert.equal(example?.[labels.indexOf("Environment")], "Production");
  assert.equal(example?.[labels.indexOf("Description")], "Example description");

  const notes = sheetText(sheets[1]!.rows);
  assert.deepEqual(notes[0], ["Column", "Also accepted as", "Required", "Format and allowed values", "A blank cell"]);
  const columnRows = notes.slice(1, 1 + spec.columns.length);
  assert.deepEqual(columnRows.map((row) => row.slice(0, 4)), spec.columns.map((column) => [column.label, column.field, column.required ? "Required" : "Optional", column.format]));
  assert.ok(columnRows.every((row) => (row[4] ?? "").length > 0), "each column says what a blank cell does");
  assert.equal(columnRows.find((row) => row[0] === "Lifecycle")?.[3], "One of: New, Changed, Existing, Decommissioning");
  assert.deepEqual(notes[1 + spec.columns.length]?.every((cell) => cell === ""), true, "an empty row before the rules");
  assert.deepEqual(notes.slice(2 + spec.columns.length).map((row) => row[0]), TEMPLATE_RULES("Information System"));

  const csv = await downloadTemplate(harness, "information_systems", "?format=csv");
  assert.equal(csv.status, 200, await csv.clone().text());
  assertDownload(csv, CSV_MEDIA_TYPE, "information-systems-import-template.csv", "TEMPLATE_CSV");
  const records = readExportCsv(Buffer.from(await csv.arrayBuffer()));
  assert.deepEqual(records[0], labels);
  assert.deepEqual(records.slice(1), [example]);

  for (const query of ["?format=pdf", "", "?format=csv&format=xlsx", "?format=csv&page=1"]) {
    const refused = await downloadTemplate(harness, "information_systems", query);
    assert.equal(refused.status, 400, `TEMPLATE_QUERY_${query}: ${await refused.clone().text()}`);
  }
});

test("CSV-02 D-31 every collection's template carries its import labels and its reserved example row", async () => {
  const harness = await harnessPromise;
  for (const resource of TEMPLATE_RESOURCES) {
    const spec = importColumns(resource.kind);
    for (const format of ["csv", "xlsx"] as const) {
      const response = await downloadTemplate(harness, resource.path, `?format=${format}`, harness.identities.analyst);
      assert.equal(response.status, 200, `${resource.path}_${format}: ${await response.clone().text()}`);
      assertDownload(response, format === "csv" ? CSV_MEDIA_TYPE : XLSX_MEDIA_TYPE, `${resource.slug}-import-template.${format}`, `${resource.path}_${format}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const rows = format === "csv" ? readExportCsv(bytes) : sheetText((await readExportWorkbook(bytes))[0]!.rows);
      assert.deepEqual(rows[0], spec.columns.map((column) => column.label), `${resource.path}_${format}_HEADER`);
      assert.equal(rows[1]?.[0], spec.exampleKey, `${resource.path}_${format}_EXAMPLE_KEY`);
    }
  }
  const controls = sheetText((await readExportWorkbook(Buffer.from(await (await downloadTemplate(harness, "controls", "?format=xlsx")).arrayBuffer())))[1]!.rows);
  assert.equal(controls.at(-5)?.[0], `#CLEAR on its own empties an optional value when a row updates an existing Control.`);
});

test("CSV-02 D-31 the Information Systems XLSX template, filled in and imported, skips its example row and creates the new rows", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const template = await downloadTemplate(harness, "information_systems", "?format=xlsx", harness.identities.analyst);
  assert.equal(template.status, 200, await template.clone().text());
  const [sheet] = await readExportWorkbook(Buffer.from(await template.arrayBuffer()));
  const [header, example] = sheetText(sheet!.rows);
  const labels = header!;
  const first = `Template system ${process.pid}`;
  const second = `Template system two ${process.pid}`;
  const row = (name: string, internetFacing: string) => labels.map((label) => (label === "Name" ? name : label === "Internet-facing" ? internetFacing : label === "Description" ? "Filled in from the template" : ""));
  const asCells = (values: readonly string[]) => values.map((value) => (value === "" ? null : { kind: "text" as const, value }));
  const filled = await writeWorkbook([{
    name: sheet!.name,
    header: labels,
    rows: [asCells(example!), asCells(row(first, "Y")), asCells(row(second, "No"))],
    widths: labels.map(() => 20),
  }]);
  const countBefore = await harness.countAdministrationRecords("information-systems");
  const preview = await harness.request({
    path: "/api/v1/information_systems/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createXlsxMultipart({ filename: "information-systems-import-template.xlsx", bytes: filled }) },
  });
  assert.equal(preview.status, 200, await preview.clone().text());
  const previewed = (await responseJson(preview) as ImportPreviewBody).data;
  assert.deepEqual(previewed.rows.map((entry) => [entry.rowNumber, entry.state, entry.naturalKey]), [[3, "create", first], [4, "create", second]]);
  assert.deepEqual(previewed.notes, ["example-row"]);
  assert.deepEqual(previewed.warnings, []);
  assert.equal(previewed.rows[0]?.values.internetFacing, true, "Y reads as Yes");

  const committed = await harness.request({
    path: "/api/v1/information_systems/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createXlsxMultipart({ filename: "information-systems-import-template.xlsx", bytes: filled, digest: previewed.previewDigest, confirmed: true }) },
  });
  assert.equal(committed.status, 200, await committed.clone().text());
  assert.equal((await responseJson(committed) as ImportResultBody).data.summary.create, 2);
  assert.equal(await harness.countAdministrationRecords("information-systems"), countBefore + 2);
});

/*
 * Phase 19 (19-14 Task 2; D-32, D-11, D-18; ROADMAP criterion 4): the error report is rebuilt by Strapi from the uploaded
 * file and its own preview or result record for the same analyst and collection: the header as typed, the rows not (or
 * not yet) imported with their cells as typed and neutralised, and a last Issues column. Issues never come from the client.
 */
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const SIMILAR_ISSUE = (stored: string) => `Matches the existing name “${stored}” except for capitals or spacing. Type the existing name exactly to update it.`;

async function createRiskType(harness: Awaited<typeof harnessPromise>, name: string): Promise<string> {
  const created = await harness.request({
    path: "/api/v1/risk_types", identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description: "Stored" }) },
  });
  assert.equal(created.status, 201, await created.clone().text());
  return (await responseJson(created) as { data: { documentId: string } }).data.documentId;
}

/** The error report's three rows: one that imports, one rejected (VALUE_TOO_LONG, with a formula-like cell), one similar. */
function errorReportFixture(stored: string): { okName: string; longName: string; bytes: Buffer } {
  // Each test's importable row is its own, so a commit in one test never leaves another's row unchanged.
  const okName = `${stored} ok`;
  const longName = "x".repeat(300);
  // The header is typed as people type it: the report writes it back exactly so.
  const bytes = Buffer.from(`name,DESCRIPTION\r\n${okName},fine\r\n${longName},=1+2\r\n${stored.toLowerCase()},similar description\r\n`);
  return { okName, longName, bytes };
}

async function previewRiskTypes(harness: Awaited<typeof harnessPromise>, filename: string, bytes: Buffer, identity = harness.identities.analyst) {
  const response = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity,
    init: { method: "POST", body: harness.createCsvMultipart({ filename, bytes }) },
  });
  assert.equal(response.status, 200, await response.clone().text());
  return (await responseJson(response) as ImportPreviewBody).data;
}

function errorReport(harness: Awaited<typeof harnessPromise>, segment: string, form: FormData, identity = harness.identities.analyst): Promise<Response> {
  return harness.request({ path: `/api/v1/${segment}/import/error_report`, identity, init: { method: "POST", body: form } });
}

/** A CSV as Excel saves one after an edit: BOM, every cell quoted, CRLF. */
function csvBytes(records: readonly (readonly string[])[]): Buffer {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return Buffer.concat([BOM, Buffer.from(`${records.map((record) => record.map(quote).join(",")).join("\r\n")}\r\n`)]);
}

function reportFileName(prefix: string, extension: string): RegExp {
  return new RegExp(`filename\\*=UTF-8''${prefix}-import-issues-\\d{4}-\\d{2}-\\d{2}\\.${extension}$`);
}

test("CSV-02 D-32 the error report at Review is the rejected and similar rows as typed, the header as typed, and an Issues column, with a BOM and no event", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const stored = `Error report stored ${process.pid}`;
  await createRiskType(harness, stored);
  const { okName, longName, bytes } = errorReportFixture(stored);
  const preview = await previewRiskTypes(harness, "risk-types.csv", bytes);
  assert.deepEqual(preview.rows.map((row) => row.state), ["create", "rejected", "similar"]);
  const countBefore = await harness.countAdministrationRecords("risk-types");

  const { result: response, events } = await captureSecurityEvents(() => errorReport(harness, "risk_types", harness.createCsvMultipart({ filename: "risk-types.csv", bytes, digest: preview.previewDigest }), harness.identities.analyst));
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("content-type"), CSV_MEDIA_TYPE);
  assert.match(response.headers.get("content-disposition") ?? "", reportFileName("risk-types", "csv"));
  assert.equal(response.headers.get("x-csrm-row-count"), "2");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(events.filter(({ event }) => /^(export|import)\./.test(String(event.event))), [], "an error report writes no event");
  const file = Buffer.from(await response.arrayBuffer());
  assert.ok(file.subarray(0, 3).equals(BOM), "the CSV starts with the BOM");
  assert.deepEqual(readExportCsv(file), [
    ["name", "DESCRIPTION", "Issues"],
    [longName, "'=1+2", "Row 3: Name must be at most 255 characters."],
    [stored.toLowerCase(), "similar description", `Row 4: ${SIMILAR_ISSUE(stored)}`],
  ]);
  assert.doesNotMatch(file.toString("utf8"), new RegExp(okName), "a row that imports is not in the report");
  assert.equal(await harness.countAdministrationRecords("risk-types"), countBefore, "a report writes nothing");

  // The report reads the preview record without using it up: the reviewed file still commits.
  const committed = await harness.request({
    path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "risk-types.csv", bytes, digest: preview.previewDigest, confirmed: true, decisions: JSON.stringify({ 4: "skip" }) }) },
  });
  assert.equal(committed.status, 200, await committed.clone().text());
});

test("CSV-02 D-32 the error report at Results holds only the rows not imported, without the analyst's own skips", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const stored = `Error report result ${process.pid}`;
  await createRiskType(harness, stored);
  const { okName, longName, bytes } = errorReportFixture(stored);
  const preview = await previewRiskTypes(harness, "results.csv", bytes);
  const committed = await harness.request({
    path: "/api/v1/risk_types/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "results.csv", bytes, digest: preview.previewDigest, confirmed: true, decisions: JSON.stringify({ 4: "skip" }) }) },
  });
  assert.equal(committed.status, 200, await committed.clone().text());
  const result = (await responseJson(committed) as ImportResultBody).data;
  assert.deepEqual(result.summary, { create: 1, update: 0, unchanged: 0, rejected: 1, ambiguous: 0, skipped: 1 });

  const response = await errorReport(harness, "risk_types", harness.createCsvMultipart({ filename: "results.csv", bytes, resultToken: result.resultToken, timeZone: "Australia/Sydney" }), harness.identities.analyst);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("x-csrm-row-count"), "1");
  assert.match(response.headers.get("content-disposition") ?? "", reportFileName("risk-types", "csv"));
  const records = readExportCsv(Buffer.from(await response.arrayBuffer()));
  assert.deepEqual(records, [
    ["name", "DESCRIPTION", "Issues"],
    [longName, "'=1+2", "Row 3: Name must be at most 255 characters."],
  ], "the imported row and the skipped similar row are excluded");
  assert.doesNotMatch(JSON.stringify(records), new RegExp(`${okName}|similar description`));
});

test("CSV-02 D-32 criterion 4: a corrected error report re-imports with its Issues column noted, through CSV and through XLSX", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const stored = `Error report reimport ${process.pid}`;
  await createRiskType(harness, stored);
  const { bytes } = errorReportFixture(stored);
  const preview = await previewRiskTypes(harness, "reimport.csv", bytes);
  const report = await errorReport(harness, "risk_types", harness.createCsvMultipart({ filename: "reimport.csv", bytes, digest: preview.previewDigest }), harness.identities.analyst);
  assert.equal(report.status, 200, await report.clone().text());
  const records = readExportCsv(Buffer.from(await report.arrayBuffer()));
  const corrected = `Corrected in Excel ${process.pid}`;
  // The person fixes the name Row 3 names and types the existing name exactly for Row 4, keeping the Issues column.
  const edited = [records[0]!, [corrected, records[1]![1]!, records[1]![2]!], [stored, records[2]![1]!, records[2]![2]!]];
  const again = await previewRiskTypes(harness, "risk-types-import-issues.csv", csvBytes(edited));
  assert.deepEqual(again.notes, ["issues-column"]);
  assert.deepEqual(again.warnings, []);
  assert.deepEqual(again.rows.map((row) => [row.rowNumber, row.state, row.naturalKey]), [[2, "create", corrected], [3, "update", stored]]);
  assert.equal(again.rows[0]?.values.description, "=1+2", "the neutraliser's mark is removed on import");

  const xlsxName = `Workbook row ${process.pid}`;
  const workbook = await writeWorkbook([{
    name: "Risk Types",
    header: ["Name", "Description"],
    rows: [[{ kind: "text", value: "y".repeat(256) }, { kind: "text", value: "from a workbook" }], [{ kind: "text", value: `Workbook ok ${process.pid}` }, null]],
    widths: [30, 30],
  }]);
  const xlsxPreview = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createXlsxMultipart({ filename: "risk-types.xlsx", bytes: workbook }) },
  });
  assert.equal(xlsxPreview.status, 200, await xlsxPreview.clone().text());
  const xlsxDigest = (await responseJson(xlsxPreview) as ImportPreviewBody).data.previewDigest;
  const xlsxReport = await errorReport(harness, "risk_types", harness.createXlsxMultipart({ filename: "risk-types.xlsx", bytes: workbook, digest: xlsxDigest }), harness.identities.analyst);
  assert.equal(xlsxReport.status, 200, await xlsxReport.clone().text());
  assert.equal(xlsxReport.headers.get("content-type"), XLSX_MEDIA_TYPE, "the report follows the upload's format");
  assert.match(xlsxReport.headers.get("content-disposition") ?? "", reportFileName("risk-types", "xlsx"));
  const [sheet] = await readExportWorkbook(Buffer.from(await xlsxReport.arrayBuffer()));
  const rows = sheetText(sheet!.rows);
  assert.deepEqual(rows, [["Name", "Description", "Issues"], ["y".repeat(256), "from a workbook", "Row 2: Name must be at most 255 characters."]]);
  const fixed = await writeWorkbook([{
    name: sheet!.name,
    header: rows[0]!,
    rows: [[{ kind: "text", value: xlsxName }, { kind: "text", value: rows[1]![1]! }, { kind: "text", value: rows[1]![2]! }]],
    widths: [30, 30, 60],
  }]);
  const fixedPreview = await harness.request({
    path: "/api/v1/risk_types/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createXlsxMultipart({ filename: "risk-types-import-issues.xlsx", bytes: fixed }) },
  });
  assert.equal(fixedPreview.status, 200, await fixedPreview.clone().text());
  const fixedBody = (await responseJson(fixedPreview) as ImportPreviewBody).data;
  assert.deepEqual(fixedBody.notes, ["issues-column"]);
  assert.deepEqual(fixedBody.rows.map((row) => [row.state, row.naturalKey]), [["create", xlsxName]]);
});

test("CSV-02 D-32 error report refusals: another analyst's or collection's token, a different file, both or neither token and a client's issues", async () => {
  const harness = await harnessPromise;
  await harness.seedAdministrationFixtures();
  const stored = `Error report refusal ${process.pid}`;
  await createRiskType(harness, stored);
  const { bytes } = errorReportFixture(stored);
  const preview = await previewRiskTypes(harness, "refusals.csv", bytes);
  const digest = preview.previewDigest;
  const reasonOf = async (response: Response, status: number, label: string) => {
    assert.equal(response.status, status, `${label}: ${await response.clone().text()}`);
    const body = await response.text();
    assert.doesNotMatch(body, /similar description|xxxxxxxxxx|=1\+2/, `${label}_DISCLOSES_A_CELL`);
    const { error } = JSON.parse(body) as RefusalBody;
    return error.details?.reason ?? error.code;
  };
  const csv = (fields: Partial<Parameters<typeof harness.createCsvMultipart>[0]> = {}) => harness.createCsvMultipart({ filename: "refusals.csv", bytes, ...fields });

  assert.equal(await reasonOf(await errorReport(harness, "risk_types", csv({ digest }), harness.identities.secondAnalyst), 409, "ANOTHER_ANALYST"), "IMPORT_REVIEW_EXPIRED");
  assert.equal(await reasonOf(await errorReport(harness, "controls", csv({ digest }), harness.identities.analyst), 409, "ANOTHER_COLLECTION"), "IMPORT_REVIEW_EXPIRED");
  assert.equal(await reasonOf(await errorReport(harness, "risk_types", csv({ digest: `sha256:${"0".repeat(64)}` })), 409, "UNKNOWN_TOKEN"), "IMPORT_REVIEW_EXPIRED");
  const otherFile = harness.createCsvMultipart({ filename: "refusals.csv", bytes: Buffer.from(`Name\r\nA different file ${process.pid}\r\n`), digest });
  await reasonOf(await errorReport(harness, "risk_types", otherFile), 400, "DIFFERENT_FILE");
  await reasonOf(await errorReport(harness, "risk_types", csv({ digest, resultToken: digest })), 400, "BOTH_TOKENS");
  await reasonOf(await errorReport(harness, "risk_types", csv()), 400, "NEITHER_TOKEN");
  await reasonOf(await errorReport(harness, "risk_types", csv({ digest: "sha256:not-a-token" })), 400, "MALFORMED_TOKEN");
  await reasonOf(await errorReport(harness, "risk_types", csv({ digest, timeZone: "Mars/Olympus_Mons" })), 400, "UNKNOWN_ZONE");
  const withIssues = csv({ digest });
  withIssues.set("issues", JSON.stringify([{ rowNumber: 2, message: "=HYPERLINK(\"https://example.test\")" }]));
  await reasonOf(await errorReport(harness, "risk_types", withIssues), 400, "CLIENT_ISSUES");

  // The preview still stands after every refusal: the report reads it without using it up.
  const response = await errorReport(harness, "risk_types", csv({ digest }), harness.identities.analyst);
  assert.equal(response.status, 200, await response.clone().text());
});
