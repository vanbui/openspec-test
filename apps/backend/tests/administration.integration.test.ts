import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { after } from "node:test";

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
  assert.deepEqual(previewBody.data.summary, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 2 });
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
  assert.deepEqual(result.data.summary, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 2 });
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
  assert.deepEqual(previewBody.data.summary, { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0 });
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
  assert.deepEqual(result.data.summary, { create: 0, update: 0, unchanged: 0, rejected: 1, ambiguous: 0 });
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
    assert.deepEqual(body.data.summary, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 0 });
    assert.deepEqual(body.data.rows.map(({ state }) => state), ["create", "update", "unchanged", "rejected"]);
    assert.equal(await harness.countAdministrationRecords(candidate.kind), countBefore, "preview must be write-free");
    assert.deepEqual(await harness.getAdministrationRecord(candidate.kind, candidate.fixture), unchangedBefore);

    const committed = await harness.request({
      path: `/api/v1/${candidate.path}/import`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: `${candidate.path}.csv`, bytes, digest: body.data.previewDigest, confirmed: true }) },
    });
    assert.equal(committed.status, 200, `PHASE6_IMPORT_COMMIT_ROUTE_MISSING_${candidate.path}: ${await committed.clone().text()}`);
    const committedBody = await responseJson(committed) as { data: { summary: Record<string, number> } };
    assert.deepEqual(committedBody.data.summary, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 0 });
    assert.equal(await harness.countAdministrationRecords(candidate.kind), countBefore + 1);
    assert.deepEqual(await harness.getAdministrationRecord(candidate.kind, candidate.fixture), unchangedBefore, "unchanged rows must never write");

    const ambiguousBytes = Buffer.from(candidate.ambiguousCsv);
    const ambiguousPreview = await harness.request({
      path: `/api/v1/${candidate.path}/import/preview`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: `${candidate.path}-ambiguous.csv`, bytes: ambiguousBytes }) },
    });
    assert.equal(ambiguousPreview.status, 200);
    const ambiguousBody = await responseJson(ambiguousPreview) as { data: { previewDigest: string; summary: Record<string, number> } };
    assert.deepEqual(ambiguousBody.data.summary, { create: 0, update: 0, unchanged: 0, rejected: 0, ambiguous: 2 });
    const countBeforeAmbiguousCommit = await harness.countAdministrationRecords(candidate.kind);
    const ambiguousCommit = await harness.request({
      path: `/api/v1/${candidate.path}/import`, identity: harness.identities.analyst,
      init: { method: "POST", body: harness.createCsvMultipart({ filename: `${candidate.path}-ambiguous.csv`, bytes: ambiguousBytes, digest: ambiguousBody.data.previewDigest, confirmed: true }) },
    });
    assert.equal(ambiguousCommit.status, 200);
    assert.equal(await harness.countAdministrationRecords(candidate.kind), countBeforeAmbiguousCommit, "ambiguous rows must never write");
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
  assert.deepEqual(previewBody.data.summary, { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0 });

  const committed = await harness.request({
    path: "/api/v1/controls/import", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createCsvMultipart({ filename: "control-boundary.csv", bytes, digest: previewBody.data.previewDigest, confirmed: true }) },
  });
  assert.equal(committed.status, 200, await committed.clone().text());
  const committedBody = await responseJson(committed) as { data: { summary: Record<string, number>; rows: Array<{ documentId?: string }> } };
  assert.deepEqual(committedBody.data.summary, { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0 });
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
  assert.deepEqual(overBody.data.summary, { create: 0, update: 0, unchanged: 0, rejected: 1, ambiguous: 0 });
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
