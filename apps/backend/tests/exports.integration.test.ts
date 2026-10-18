import assert from "node:assert/strict";
import test, { after } from "node:test";

import { exportViewColumns, importColumns } from "../src/csrm/exports/export-vocabulary";
import { utcToday } from "../src/csrm/insights/utc-date";
import { xlsxCellText, type XlsxCell } from "../src/csrm/spreadsheets/xlsx-reader";
import { sanitizeSpreadsheetCell } from "../src/csrm/spreadsheets/neutralise";
import { writeWorkbook } from "../src/csrm/spreadsheets/xlsx-writer";
import csrmAuthorization from "../src/policies/csrm-authorization";
import { captureSecurityEvents, readExportCsv, readExportWorkbook, readSheetXml, type CapturedSecurityEvent } from "./helpers/export-files";
import { startAuthorizationHttpHarness, type AuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 19 exports over HTTP (19-05; D-02, D-05, D-11, D-13, D-16 to D-18). The Risk register export is the first one
 * served: the human Security Analyst's filtered register comes back as a typed workbook or a safe CSV at the URL the
 * catalogue reserved, through one grant and the register read, with one security event line per admitted attempt.
 * Plans 19-07 to 19-10 and 19-14 add their exports' proofs here.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV = "text/csv; charset=utf-8";
const HYPERLINK = '=HYPERLINK("https://example.test","Click")';
const REGISTER_EXPORT = "/api/v1/risks/export";
const VISIBLE_LABELS = ["Risk number", "Statement", "Inherent rating", "Residual rating", "Treatment status", "Treatment owner", "Target date", "Related assessment"];
const WITHDRAWAL_REASON = "Raised against the wrong system";

type Json = Record<string, unknown>;

/** The Risk register's export fixture: one active formula-like Risk and one withdrawn Risk, both found by `HYPERLINK`. */
type RegisterFixture = {
  assessmentId: string;
  assessmentNumber: string;
  active: { documentId: string; riskNumber: string };
  withdrawn: { documentId: string; riskNumber: string };
};

let registerFixture: Promise<RegisterFixture> | null = null;

function json(method: string, payload: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

/*
 * A draft (unreleased, editable) assessment on Jane's request: the register lists its Risks, and the withdrawal endpoint
 * refuses a released or non-editable one. The active Risk names an owner, a Risk Type and an impacted system, and no
 * impacted asset; the second is withdrawn by Bob through Phase 16's endpoint.
 */
function seedRegisterFixture(harness: AuthorizationHttpHarness): Promise<RegisterFixture> {
  registerFixture ??= (async () => {
    const library = await harness.seedUatALikeFixture();
    const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      requestNumber: "REQ-EXPORT-001", title: "Export request", requestStatus: "risk-assessment-drafted", requestor: harness.users.owner,
    });
    const assessmentNumber = "ASM-2026-EXP001";
    const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber, assessmentStatus: "draft", assessmentRequest: requestId,
    });
    const active = {
      riskNumber: "RSK-EXPORT-001",
      documentId: await harness.createRiskRegisterFixture(assessmentId, {
        riskNumber: "RSK-EXPORT-001",
        riskStatement: HYPERLINK,
        riskOwner: harness.users.owner,
        riskType: library.riskTypeIds[0],
        informationSystemImpacted: library.systemIds[0],
      }),
    };
    const withdrawn = {
      riskNumber: "RSK-EXPORT-002",
      documentId: await harness.createRiskRegisterFixture(assessmentId, { riskNumber: "RSK-EXPORT-002", riskStatement: "HYPERLINK risk taken out of the assessment" }),
    };
    const response = await harness.request({
      path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risk_withdrawals`,
      identity: harness.identities.analyst,
      init: json("POST", { riskIds: [withdrawn.documentId], reason: WITHDRAWAL_REASON }),
    });
    assert.equal(response.status, 200, `EXPORT_FIXTURE_WITHDRAWAL_FAILED: ${await response.text()}`);
    return { assessmentId, assessmentNumber, active, withdrawn };
  })();
  return registerFixture;
}

/** Bob's export unless another identity is named; `null` sends no identity at all. */
async function exportAs(harness: AuthorizationHttpHarness, query: string, identity: string | null = harness.identities.analyst, omitApiToken = false): Promise<Response> {
  return harness.request({ path: `${REGISTER_EXPORT}?${query}`, identity: identity ?? undefined, omitApiToken });
}

/** Runs `action` while recording the security event lines Strapi's logger writes. */
async function withSecurityEvents<T>(harness: AuthorizationHttpHarness, action: () => Promise<T>): Promise<{ result: T; events: readonly CapturedSecurityEvent[] }> {
  const capture = await harness.withBackendFixture(async (backend) => captureSecurityEvents(backend));
  try {
    const result = await action();
    return { result, events: capture.events() };
  } finally {
    capture.restore();
  }
}

async function displayNameOf(harness: AuthorizationHttpHarness, userDocumentId: string): Promise<string> {
  return harness.withBackendFixture(async (backend) => {
    const user = await (backend.documents("api::idambox-user.idambox-user") as unknown as {
      findOne: (input: Json) => Promise<Json | null>;
    }).findOne({ documentId: userDocumentId, fields: ["displayName"] });
    assert.ok(user && typeof user.displayName === "string", "EXPORT_USER_MISSING");
    return user.displayName as string;
  });
}

function assertFileHeaders(response: Response, contentType: string, extension: "csv" | "xlsx", rowCount: number, label: string, slug = "risk-register"): void {
  assert.equal(response.headers.get("content-type"), contentType, `${label}_CONTENT_TYPE`);
  const disposition = response.headers.get("content-disposition") ?? "";
  // The name is the viewer's local date; with no timeZone it is UTC's, read on either side of the request.
  const named = [utcToday(new Date(Date.now() - 60_000)), utcToday(new Date())].some((day) =>
    disposition.startsWith("attachment;") && disposition.includes(`filename*=UTF-8''${slug}-${day}.${extension}`));
  assert.ok(named, `${label}_DISPOSITION: ${disposition}`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${label}_NOSNIFF`);
  assert.equal(response.headers.get("cache-control"), "no-store", `${label}_CACHE`);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox", `${label}_CSP`);
  assert.equal(response.headers.get("x-csrm-row-count"), String(rowCount), `${label}_ROW_COUNT`);
}

async function fileOf(response: Response, label: string): Promise<Buffer> {
  if (response.status !== 200) assert.fail(`${label}_STATUS_${response.status}: ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

test("risk-register: Bob's filtered Risk register exports as a workbook at its reserved URL, a formula-like statement as text, with one log line", async () => {
  const harness = await harnessPromise;
  const fixture = await seedRegisterFixture(harness);
  const bob = await displayNameOf(harness, harness.users.analyst);

  const { result: response, events } = await withSecurityEvents(harness, () => exportAs(harness, "format=xlsx&q=HYPERLINK", harness.identities.analyst));
  const bytes = await fileOf(response, "REGISTER_XLSX");
  // Route order: the export is a file, never the detail route's JSON for a Risk called "export".
  assertFileHeaders(response, XLSX, "xlsx", 1, "REGISTER_XLSX");
  assert.equal(bytes.subarray(0, 4).toString("latin1"), "PK\u0003\u0004", "REGISTER_XLSX_NOT_A_ZIP");

  const [register] = await readExportWorkbook(bytes);
  assert.equal(register.name, "Risk register");
  assert.deepEqual(register.rows[0], VISIBLE_LABELS, "REGISTER_XLSX_HEADER");
  assert.equal(register.rows.length, 2, "REGISTER_XLSX_ROWS");
  assert.equal(register.rows[1][0], fixture.active.riskNumber);
  assert.equal(register.rows[1][1], `'${HYPERLINK}`, "REGISTER_XLSX_STATEMENT_NOT_TEXT");
  assert.equal(register.rows[1][7], fixture.assessmentNumber);
  const sheetXml = readSheetXml(bytes, "xl/worksheets/sheet1.xml");
  assert.doesNotMatch(sheetXml, /<f[\s>]/, "REGISTER_XLSX_HOLDS_A_FORMULA");

  const exported = events.filter(({ event }) => typeof event.event === "string" && String(event.event).startsWith("export."));
  assert.equal(exported.length, 1, `REGISTER_XLSX_EVENTS: ${JSON.stringify(exported)}`);
  const [{ level, event }] = exported;
  assert.equal(level, "info");
  assert.equal(event.event, "export.completed");
  assert.equal(event.view, "risk-register");
  assert.deepEqual(event.actor, { documentId: harness.users.analyst, displayName: bob });
  assert.equal(event.format, "xlsx");
  assert.equal(event.search, "HYPERLINK");
  assert.equal(event.rowCount, 1);
  assert.equal(event.outcome, "exported");
  assert.equal("reason" in event, false, "REGISTER_XLSX_COMPLETED_WITH_REASON");
  assert.doesNotMatch(JSON.stringify(event), /example\.test|Click/, "REGISTER_XLSX_EVENT_HOLDS_A_CELL");
});

test("risk-register: the CSV export starts with the BOM and quotes and marks the formula-like statement, under the declared media type", async () => {
  const harness = await harnessPromise;
  const fixture = await seedRegisterFixture(harness);

  const response = await exportAs(harness, "format=csv&q=HYPERLINK");
  const bytes = await fileOf(response, "REGISTER_CSV");
  assertFileHeaders(response, CSV, "csv", 1, "REGISTER_CSV");
  const text = bytes.toString("utf8");
  assert.ok(text.includes(`"'=HYPERLINK(""https://example.test"",""Click"")"`), `REGISTER_CSV_STATEMENT_NOT_QUOTED_AND_MARKED: ${text}`);
  const records = readExportCsv(bytes);
  assert.deepEqual(records[0], VISIBLE_LABELS, "REGISTER_CSV_HEADER");
  assert.equal(records.length, 2, "REGISTER_CSV_ROWS");
  assert.equal(records[1][0], fixture.active.riskNumber);
  assert.equal(records[1][1], `'${HYPERLINK}`);
});

test("risk-register: the default export holds no withdrawn Risk, and state=withdrawn exports the withdrawn Risks alone", async () => {
  const harness = await harnessPromise;
  const fixture = await seedRegisterFixture(harness);

  const active = await exportAs(harness, "format=csv&q=HYPERLINK&columns=riskNumber");
  const activeRows = readExportCsv(await fileOf(active, "REGISTER_ACTIVE"));
  assert.equal(active.headers.get("x-csrm-row-count"), "1");
  assert.deepEqual(activeRows, [["Risk number"], [fixture.active.riskNumber]], "REGISTER_DEFAULT_HOLDS_WITHDRAWN");

  const withdrawn = await exportAs(harness, "q=HYPERLINK&state=withdrawn&format=csv&columns=riskNumber,riskState");
  const withdrawnRows = readExportCsv(await fileOf(withdrawn, "REGISTER_WITHDRAWN"));
  assert.equal(withdrawn.headers.get("x-csrm-row-count"), "1");
  assert.deepEqual(withdrawnRows, [["Risk number", "State"], [fixture.withdrawn.riskNumber, "Withdrawn"]], "REGISTER_WITHDRAWN_EXPORT");
});

test("risk-register: the relation columns write the names the Risk's detail shows, and an empty cell where a relation is absent", async () => {
  const harness = await harnessPromise;
  const fixture = await seedRegisterFixture(harness);

  const detailResponse = await harness.request({ path: `/api/v1/risks/${fixture.active.documentId}`, identity: harness.identities.analyst });
  assert.equal(detailResponse.status, 200, `REGISTER_DETAIL_FAILED: ${await detailResponse.clone().text()}`);
  const detail = ((await detailResponse.json()) as { data: Json }).data;
  const nameOf = (value: unknown, field: string) => String((value as Json)[field]);
  assert.equal(detail.informationAssetImpacted, null, "REGISTER_FIXTURE_HAS_AN_ASSET");

  const response = await exportAs(harness, "format=csv&q=HYPERLINK&columns=riskNumber,riskOwner,riskType,informationSystem,informationAsset");
  const rows = readExportCsv(await fileOf(response, "REGISTER_RELATIONS"));
  assert.deepEqual(rows, [
    ["Risk number", "Risk owner", "Risk Type", "Impacted system", "Impacted asset"],
    [
      fixture.active.riskNumber,
      nameOf(detail.riskOwner, "displayName"),
      nameOf(detail.riskType, "name"),
      nameOf(detail.informationSystemImpacted, "name"),
      "",
    ],
  ], "REGISTER_RELATION_COLUMNS");
});

/*
 * D-13, D-16: every refusal of the register export. A policy refusal writes no export event (Strapi's request log records
 * it); an export the policy admits but refuses writes exactly one `export.refused` line. Nothing persisted changes. Strapi
 * answers every policy refusal with its generic 403 body, so the two export sentences are proven by the policy's unit
 * cases (authorization-policy.unit.test.ts); here each refusal is a 403 that discloses nothing.
 */

function registerSnapshot(harness: AuthorizationHttpHarness, fixture: RegisterFixture): Promise<unknown[]> {
  return harness.snapshot([
    () => harness.getRisk(fixture.active.documentId),
    () => harness.getRisk(fixture.withdrawn.documentId),
    () => harness.countRisksForAssessment(fixture.assessmentId),
  ]);
}

function exportEvents(events: readonly CapturedSecurityEvent[]): CapturedSecurityEvent[] {
  return events.filter(({ event }) => typeof event.event === "string" && String(event.event).startsWith("export."));
}

async function errorOf(response: Response): Promise<Json> {
  const body = (await response.json()) as { data?: unknown; error?: Json };
  assert.equal(body.data, null, "EXPORT_REFUSAL_HAS_DATA");
  assert.ok(body.error, "EXPORT_REFUSAL_WITHOUT_ERROR");
  return body.error;
}

/**
 * Runs `action` while the seeded Role `roleName` also holds the Function `functionName` in this test's database (a
 * mis-grant a later catalogue edit could make), then gives the Role its Functions back.
 */
async function withRoleGrantedFunction<T>(harness: AuthorizationHttpHarness, roleName: string, functionName: string, action: () => Promise<T>): Promise<T> {
  type RoleService = {
    findMany: (query: Json) => Promise<Array<{ documentId: string; functions?: Array<{ documentId: string }> }>>;
    update: (query: { documentId: string; data: Json }) => Promise<unknown>;
  };
  const { roles, role, granted } = await harness.withBackendFixture(async (backend) => {
    const roleService = backend.documents("api::role.role") as unknown as RoleService;
    const [found] = await roleService.findMany({ filters: { name: { $eq: roleName } }, populate: { functions: true }, limit: 1 });
    const functions = backend.documents("api::function.function") as unknown as { findMany: (query: Json) => Promise<Array<{ documentId: string }>> };
    const [grant] = await functions.findMany({ filters: { name: { $eq: functionName } }, limit: 1 });
    assert.ok(found && grant, `EXPORT_GRANT_FIXTURE_MISSING_${roleName}_${functionName}`);
    return { roles: roleService, role: found, granted: grant };
  });
  const held = (role.functions ?? []).map((grant) => grant.documentId);
  assert.ok(!held.includes(granted.documentId), `THE_ROLE_${roleName}_ALREADY_HOLDS_${functionName}`);
  await roles.update({ documentId: role.documentId, data: { functions: [...held, granted.documentId] } });
  try {
    return await action();
  } finally {
    await roles.update({ documentId: role.documentId, data: { functions: held } });
  }
}

/** Runs `action` while the seeded Security Analyst Agent role also holds the Risk Register Export API Function. */
function withAgentGrantedRegisterExport<T>(harness: AuthorizationHttpHarness, action: () => Promise<T>): Promise<T> {
  return withRoleGrantedFunction(harness, "Security Analyst Agent", "Risk Register Export API", action);
}

test("risk-register: a Requestor, the service agent (even when its role is granted the export), an analyst without the underlying read and a caller with no identity are 403, and no token is 401", async () => {
  const harness = await harnessPromise;
  const fixture = await seedRegisterFixture(harness);
  const before = await registerSnapshot(harness, fixture);

  const { events } = await withSecurityEvents(harness, async () => {
    for (const [label, identity] of [
      ["REQUESTOR", harness.identities.owner],
      ["OTHER_REQUESTOR", harness.identities.otherRequestor],
      ["SERVICE_AGENT", harness.identities.serviceAnalystAgent],
      ["AGENT_WITHOUT_ROLE", harness.identities.analystAgent],
      ["INACTIVE_ANALYST", harness.identities.inactiveAnalyst],
      ["NO_IDENTITY", null],
    ] as const) {
      const response = await exportAs(harness, "format=xlsx&q=HYPERLINK", identity);
      assert.equal(response.status, 403, `${label}_NOT_REFUSED`);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/, `${label}_REFUSAL_NOT_JSON`);
      assert.doesNotMatch(await response.text(), /HYPERLINK|RSK-EXPORT|example\.test/, `${label}_REFUSAL_DISCLOSES`);
    }

    // The set is a second refusal: the agent stays refused when a catalogue edit grants its role the export.
    await withAgentGrantedRegisterExport(harness, async () => {
      const response = await exportAs(harness, "format=csv&q=HYPERLINK", harness.identities.serviceAnalystAgent);
      assert.equal(response.status, 403, "GRANTED_SERVICE_AGENT_NOT_REFUSED");
      assert.equal((await errorOf(response)).status, 403, "GRANTED_SERVICE_AGENT_BODY");
    });

    // The underlying read: a human analyst holding the export but not the register read is refused.
    await harness.withRoleOperationWithdrawn("Security Analyst", "GET:/api/v1/risks", async () => {
      const response = await exportAs(harness, "format=csv&q=HYPERLINK");
      assert.equal(response.status, 403, "ANALYST_WITHOUT_UNDERLYING_READ_NOT_REFUSED");
      assert.equal((await errorOf(response)).status, 403, "UNDERLYING_READ_BODY");
    });

    const noToken = await exportAs(harness, "format=csv&q=HYPERLINK", harness.identities.analyst, true);
    assert.equal(noToken.status, 401, "NO_TOKEN_NOT_401");
  });

  assert.deepEqual(exportEvents(events), [], "A_POLICY_REFUSAL_WROTE_AN_EXPORT_EVENT");
  assert.deepEqual(await registerSnapshot(harness, fixture), before, "A_REFUSED_EXPORT_CHANGED_PERSISTENCE");
});

test("risk-register: a page, pageSize, unknown or repeated column, unknown or missing format, unknown time zone or a filter the list refuses is 400 with no reason and one export.refused line", async () => {
  const harness = await harnessPromise;
  const fixture = await seedRegisterFixture(harness);
  const before = await registerSnapshot(harness, fixture);

  for (const query of [
    "format=csv&page=2",
    "format=csv&pageSize=50",
    "format=csv&columns=nope",
    "format=csv&columns=riskNumber,riskNumber",
    "format=pdf",
    "q=HYPERLINK",
    "format=xlsx&timeZone=Mars/Base",
    "format=csv&treatmentStatus=Sometimes",
  ]) {
    const { result: response, events } = await withSecurityEvents(harness, () => exportAs(harness, query));
    assert.equal(response.status, 400, `INVALID_EXPORT_QUERY_ADMITTED_${query}`);
    const error = await errorOf(response);
    assert.equal((error.details as Json | undefined)?.reason, undefined, `INVALID_EXPORT_QUERY_NAMES_A_REASON_${query}`);
    const refused = exportEvents(events);
    assert.equal(refused.length, 1, `INVALID_EXPORT_QUERY_EVENTS_${query}: ${JSON.stringify(refused)}`);
    assert.equal(refused[0].event.event, "export.refused", query);
    assert.equal(refused[0].event.reason, "INVALID_QUERY", query);
    assert.equal(refused[0].event.view, "risk-register", query);
    assert.equal(refused[0].event.rowCount, null, query);
  }

  assert.deepEqual(await registerSnapshot(harness, fixture), before, "AN_INVALID_EXPORT_CHANGED_PERSISTENCE");
});

/*
 * D-17: the cap. 10,001 minimal Risks are inserted into one released assessment of this test's own database, with knex
 * in batches of 500, the Risk table and its assessment link table resolved from Strapi's metadata; nothing is added to
 * any seed, and the rows are removed again afterwards.
 */
const CAP_PREFIX = "CAPROW";
const CAP_ROWS = 10_001;

type JoinTable = { name: string; joinColumn: { name: string }; inverseJoinColumn: { name: string }; orderColumnName?: string };
/** The few knex builder methods the cap fixture uses. */
type KnexQuery = {
  insert(rows: Json[]): Promise<unknown>;
  where(column: string, operator: string, value: unknown): KnexQuery;
  whereIn(column: string, values: readonly number[]): KnexQuery;
  select(column: string): Promise<Array<{ id: number }>>;
  first(column: string): Promise<{ id: number } | undefined>;
  delete(): Promise<number>;
};
type KnexLike = (table: string) => KnexQuery;

async function withCapRisks<T>(harness: AuthorizationHttpHarness, action: () => Promise<T>): Promise<{ result: T; seededMs: number }> {
  const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "REQ-EXPORT-CAP", title: "Export cap request", requestStatus: "risk-assessment-drafted", requestor: harness.users.owner,
  });
  const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "ASM-2026-EXPCAP", assessmentStatus: "approved", approvalDate: "2026-09-01T00:00:00.000Z", approvedBy: harness.users.analyst, assessmentRequest: requestId,
  });
  const started = Date.now();
  const { connection, riskTable, link, riskIds } = await harness.withBackendFixture(async (backend) => {
    const db = (backend as unknown as { db: { connection: KnexLike; metadata: { get: (uid: string) => { tableName: string; attributes: Record<string, { joinTable?: JoinTable }> } } } }).db;
    const riskMeta = db.metadata.get("api::csrm-risk.csrm-risk");
    const assessmentMeta = db.metadata.get("api::csrm-assessment.csrm-assessment");
    const joinTable = riskMeta.attributes.assessment?.joinTable;
    assert.ok(joinTable, "RISK_ASSESSMENT_LINK_TABLE_UNRESOLVED");
    const assessmentRow = await db.connection(assessmentMeta.tableName).where("document_id", "=", assessmentId).first("id");
    assert.ok(assessmentRow, "CAP_ASSESSMENT_ROW_MISSING");
    const now = new Date().toISOString();
    for (let start = 0; start < CAP_ROWS; start += 500) {
      const rows = Array.from({ length: Math.min(500, CAP_ROWS - start) }, (_, offset) => {
        const sequence = String(start + offset + 1).padStart(5, "0");
        return { document_id: `${CAP_PREFIX.toLowerCase()}-${sequence}`, risk_number: `${CAP_PREFIX}-${sequence}`, risk_statement: `${CAP_PREFIX} capped Risk ${sequence}`, created_at: now, updated_at: now, published_at: now };
      });
      await db.connection(riskMeta.tableName).insert(rows);
    }
    const inserted = await db.connection(riskMeta.tableName).where("document_id", "like", `${CAP_PREFIX.toLowerCase()}-%`).select("id");
    assert.equal(inserted.length, CAP_ROWS, "CAP_RISKS_NOT_INSERTED");
    const ids = inserted.map((row) => row.id);
    for (let start = 0; start < ids.length; start += 500) {
      await db.connection(joinTable.name).insert(ids.slice(start, start + 500).map((id, offset) => ({
        [joinTable.joinColumn.name]: id,
        [joinTable.inverseJoinColumn.name]: assessmentRow.id,
        ...(joinTable.orderColumnName ? { [joinTable.orderColumnName]: start + offset + 1 } : {}),
      })));
    }
    return { connection: db.connection, riskTable: riskMeta.tableName, link: joinTable, riskIds: ids };
  });
  const seededMs = Date.now() - started;
  try {
    return { result: await action(), seededMs };
  } finally {
    for (let start = 0; start < riskIds.length; start += 500) {
      const batch = riskIds.slice(start, start + 500);
      await connection(link.name).whereIn(link.joinColumn.name, batch).delete();
      await connection(riskTable).whereIn("id", batch).delete();
    }
  }
}

test("risk-register: EXPORT_ROW_LIMIT refuses more than 10,000 matching Risks with the count and the cap, no file and one export.refused line at warn", async () => {
  const harness = await harnessPromise;
  const fixture = await seedRegisterFixture(harness);
  const before = await registerSnapshot(harness, fixture);

  const { result: { response, events }, seededMs } = await withCapRisks(harness, async () => {
    const { result, events: captured } = await withSecurityEvents(harness, () => exportAs(harness, `format=xlsx&q=${CAP_PREFIX}`));
    return { response: result, events: captured };
  });
  console.log(`# EXPORT_ROW_LIMIT cap fixture: ${CAP_ROWS} Risks seeded in ${seededMs} ms`);

  assert.equal(response.status, 422, "OVER_CAP_EXPORT_NOT_REFUSED");
  assert.match(response.headers.get("content-type") ?? "", /application\/json/, "OVER_CAP_EXPORT_SENT_A_FILE");
  assert.equal(response.headers.get("content-disposition"), null, "OVER_CAP_EXPORT_HAS_A_DISPOSITION");
  const error = await errorOf(response);
  assert.equal(error.status, 422);
  assert.deepEqual(error.details, { reason: "EXPORT_ROW_LIMIT", rowCount: CAP_ROWS, rowCap: 10_000 }, "OVER_CAP_DETAILS");
  const refused = exportEvents(events);
  assert.equal(refused.length, 1, `OVER_CAP_EVENTS: ${JSON.stringify(refused)}`);
  assert.equal(refused[0].level, "warn", "OVER_CAP_EVENT_NOT_AT_WARN");
  assert.equal(refused[0].event.event, "export.refused");
  assert.equal(refused[0].event.reason, "EXPORT_ROW_LIMIT");
  assert.equal(refused[0].event.rowCount, CAP_ROWS);
  assert.equal(refused[0].event.search, CAP_PREFIX);

  assert.deepEqual(await registerSnapshot(harness, fixture), before, "AN_OVER_CAP_EXPORT_CHANGED_PERSISTENCE");
});

/*
 * 19-07 (D-04, D-05, D-07, D-13): the request lists' exports. The review queue exports whole through the queue's own
 * parser, repository and projection: Bob's file equals the list's pages for the same query, in the same order, with
 * Phase 13's assignee column and filter. 27 of Jane's requests across every queue status, numbered REQ-EXPQ-001 to 027,
 * are found by `filters[q]=REQ-EXPQ`; a third are Bob's, a third the second analyst's, a third nobody's.
 */
const QUEUE_EXPORT = "/api/v1/assessment_requests/export";
const QUEUE_PREFIX = "REQ-EXPQ";
const QUEUE_SIZE = 27;
const QUEUE_QUERY = `filters[queue]=all&filters[q]=${QUEUE_PREFIX}&sort=requestNumber:desc`;
const QUEUE_LABELS = ["Request", "Title", "Requestor", "Assessment type", "Business criticality", "Status", "Assigned to", "Due date", "Age", "Submitted"];
const QUEUE_STATUSES = ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review", "approved", "closed"] as const;
/** The request status words the web shows (status-labels), restated here rather than read from the vocabulary. */
const REQUEST_STATUS_WORDS: Readonly<Record<string, string>> = {
  draft: "Draft",
  submitted: "Submitted",
  "questionnaire-in-progress": "Questionnaire in progress",
  "risk-assessment-drafted": "Risk assessment drafted",
  "under-review": "Under review",
  approved: "Released",
  closed: "Closed",
};
/** REQ-EXPQ-001 was submitted at 20:00 UTC on 1 May, which is 2 May in Sydney (UTC+10). */
const SYDNEY_SUBMISSION = { requestNumber: `${QUEUE_PREFIX}-001`, utc: "2026-05-01T20:00:00.000Z", sydneyDate: "2026-05-02" };

type QueueItem = Json & { requestNumber: string; assignee: { displayName: string } | null };

let queueFixture: Promise<readonly string[]> | null = null;

/** The 27 queue requests, seeded once; returns their request numbers. */
function seedQueueFixture(harness: AuthorizationHttpHarness): Promise<readonly string[]> {
  queueFixture ??= (async () => {
    const numbers: string[] = [];
    for (let index = 1; index <= QUEUE_SIZE; index += 1) {
      const sequence = String(index).padStart(3, "0");
      const requestNumber = `${QUEUE_PREFIX}-${sequence}`;
      const assignee = index % 3 === 0 ? harness.users.analyst : index % 3 === 1 ? harness.users.secondAnalyst : null;
      await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber,
        title: `Export queue request ${sequence}`,
        requestStatus: QUEUE_STATUSES[index % QUEUE_STATUSES.length],
        requestor: harness.users.owner,
        submittedDate: index === 1 ? SYDNEY_SUBMISSION.utc : `2026-05-${String(index).padStart(2, "0")}T09:00:00.000Z`,
        ...(index % 2 === 0 ? { dueDate: `2026-11-${String(index).padStart(2, "0")}` } : {}),
        assessmentType: (["BAU", "Project", "Other"] as const)[index % 3],
        businessCriticality: (["Low", "Moderate", "High", "Critical"] as const)[index % 4],
        ...(assignee ? { assignedAnalyst: assignee } : {}),
      });
      numbers.push(requestNumber);
    }
    return numbers;
  })();
  return queueFixture;
}

function exportAt(harness: AuthorizationHttpHarness, exportPath: string, query: string, identity: string | null, omitApiToken = false): Promise<Response> {
  return harness.request({ path: `${exportPath}?${query}`, identity: identity ?? undefined, omitApiToken });
}

/** Every item of a paged list, page by page at `pageParameter`, as `identity` reads it. */
async function readAllPages(harness: AuthorizationHttpHarness, listPath: string, query: string, pageParameter: string, identity: string): Promise<{ items: Json[]; pageCount: number; total: number }> {
  const items: Json[] = [];
  let pageCount = 1;
  let total = 0;
  for (let page = 1; page <= pageCount; page += 1) {
    const response = await harness.request({ path: `${listPath}?${query}&${pageParameter}=${page}`, identity });
    assert.equal(response.status, 200, `LIST_READ_FAILED_${listPath}_${page}: ${await response.clone().text()}`);
    const body = (await response.json()) as { data: Json[]; meta: { pagination: { pageCount: number; total: number } } };
    items.push(...body.data);
    pageCount = body.meta.pagination.pageCount;
    total = body.meta.pagination.total;
  }
  return { items, pageCount, total };
}

/** The queue's list for the same query, in pages of ten, as Bob reads it. */
function readQueuePages(harness: AuthorizationHttpHarness, query: string): Promise<{ items: Json[]; pageCount: number; total: number }> {
  return readAllPages(harness, "/api/v1/assessment_requests", `${query}&pagination[pageSize]=10`, "pagination[page]", harness.identities.analyst);
}

test("requests: Bob's review queue exports whole as a workbook equal to the list's three pages in order, with one log line", async () => {
  const harness = await harnessPromise;
  await seedQueueFixture(harness);
  const bob = await displayNameOf(harness, harness.users.analyst);

  const list = await readQueuePages(harness, QUEUE_QUERY);
  assert.equal(list.total, QUEUE_SIZE, "QUEUE_FIXTURE_TOTAL");
  assert.equal(list.pageCount, 3, "QUEUE_FIXTURE_PAGES");

  const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, QUEUE_EXPORT, `format=xlsx&${QUEUE_QUERY}`, harness.identities.analyst));
  const bytes = await fileOf(response, "QUEUE_XLSX");
  assertFileHeaders(response, XLSX, "xlsx", QUEUE_SIZE, "QUEUE_XLSX", "requests");
  const [sheet, about] = await readExportWorkbook(bytes);
  assert.equal(sheet.name, "Requests");
  assert.deepEqual(sheet.rows[0], QUEUE_LABELS, "QUEUE_XLSX_HEADER");
  assert.deepEqual(sheet.rows.slice(1).map((row) => row[0]), list.items.map((item) => item.requestNumber), "QUEUE_XLSX_NOT_THE_LIST_IN_ORDER");
  assert.equal(about.name, "About this export");
  const aboutRows = new Map(about.rows.map((row) => [String(row[0]), String(row[1])]));
  assert.equal(aboutRows.get("Filters"), "Queue: All requests", "QUEUE_ABOUT_FILTERS");
  assert.equal(aboutRows.get("Sorted by"), "Request, descending", "QUEUE_ABOUT_SORT");

  const exported = exportEvents(events);
  assert.equal(exported.length, 1, `QUEUE_XLSX_EVENTS: ${JSON.stringify(exported)}`);
  const [{ level, event }] = exported;
  assert.equal(level, "info");
  assert.equal(event.event, "export.completed");
  assert.equal(event.view, "requests");
  assert.deepEqual(event.actor, { documentId: harness.users.analyst, displayName: bob });
  assert.deepEqual(event.filters, { queue: "all" });
  assert.equal(event.search, QUEUE_PREFIX);
  assert.equal(event.sort, "requestNumber:desc");
  assert.equal(event.rowCount, QUEUE_SIZE);
});

test("requests: the CSV writes the queue's visible columns as the list shows them, Released for approved, an empty Assigned to when nobody holds it, the assignee filter and the viewer's local Submitted date", async () => {
  const harness = await harnessPromise;
  await seedQueueFixture(harness);

  const list = await readQueuePages(harness, QUEUE_QUERY);
  const response = await exportAt(harness, QUEUE_EXPORT, `format=csv&${QUEUE_QUERY}`, harness.identities.analyst);
  const rows = readExportCsv(await fileOf(response, "QUEUE_CSV"));
  assertFileHeaders(response, CSV, "csv", QUEUE_SIZE, "QUEUE_CSV", "requests");
  assert.deepEqual(rows[0], QUEUE_LABELS, "QUEUE_CSV_HEADER");
  const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  assert.deepEqual(rows.slice(1), list.items.map((item) => [
    text(item.requestNumber),
    text(item.title),
    text(item.requestorName),
    text(item.assessmentType),
    text(item.businessCriticality),
    REQUEST_STATUS_WORDS[String(item.requestStatus)],
    text((item as QueueItem).assignee?.displayName),
    text(item.dueDate),
    text(item.daysSinceSubmission),
    text(item.submittedDate).slice(0, 10),
  ]), "QUEUE_CSV_NOT_THE_LIST");
  assert.ok(rows.some((row) => row[5] === "Released"), "QUEUE_CSV_HAS_NO_RELEASED_REQUEST");
  assert.ok(rows.slice(1).some((row) => row[6] === ""), "QUEUE_CSV_HAS_NO_UNASSIGNED_REQUEST");

  // Phase 13's assignee filter, the list's own parameter: only the requests Bob holds.
  const bob = await displayNameOf(harness, harness.users.analyst);
  const mine = await readQueuePages(harness, `${QUEUE_QUERY}&filters[assignee]=me`);
  assert.equal(mine.total, QUEUE_SIZE / 3, "QUEUE_FIXTURE_BOBS_SHARE");
  const mineFile = readExportCsv(await fileOf(await exportAt(harness, QUEUE_EXPORT, `format=csv&${QUEUE_QUERY}&filters[assignee]=me&columns=requestNumber,assignee`, harness.identities.analyst), "QUEUE_MINE"));
  assert.deepEqual(mineFile, [["Request", "Assigned to"], ...mine.items.map((item) => [String(item.requestNumber), bob])], "QUEUE_ASSIGNEE_FILTER");

  // Submitted is an instant, written as the viewer's local calendar date.
  const sydney = readExportCsv(await fileOf(await exportAt(harness, QUEUE_EXPORT,
    `format=csv&filters[queue]=all&filters[requestNumber]=${SYDNEY_SUBMISSION.requestNumber}&columns=requestNumber,submittedAt&timeZone=Australia/Sydney`, harness.identities.analyst), "QUEUE_SYDNEY"));
  assert.deepEqual(sydney, [["Request", "Submitted"], [SYDNEY_SUBMISSION.requestNumber, SYDNEY_SUBMISSION.sydneyDate]], "QUEUE_LOCAL_SUBMITTED_DATE");
});

test("requests: chosen columns are written in the queue's order whatever order they are named", async () => {
  const harness = await harnessPromise;
  await seedQueueFixture(harness);

  const response = await exportAt(harness, QUEUE_EXPORT, `format=csv&${QUEUE_QUERY}&columns=title,requestNumber`, harness.identities.analyst);
  const rows = readExportCsv(await fileOf(response, "QUEUE_COLUMNS"));
  assert.deepEqual(rows[0], ["Request", "Title"], "QUEUE_COLUMN_ORDER");
  assert.equal(rows.length, QUEUE_SIZE + 1);
  assert.deepEqual(rows[1], [`${QUEUE_PREFIX}-027`, "Export queue request 027"]);
});

/*
 * 19-07 (D-04, D-06, D-13, D-16): My requests exports the caller's own requests, for every person, a Security Analyst
 * included, through the list's owner scope, parser and projection. Jane also has a returned-to-her draft (Needs your
 * action) beside the queue fixture's requests (with the Security Analyst, or released); Bob raised one request.
 */
const MY_EXPORT = "/api/v1/my_requests/export";
const MY_LABELS = ["Request ID", "Title", "Status", "Security Analyst", "Next step", "Due date", "Updated"];
/** The holder words the web shows (requestHolderPresentation), restated here. */
const HOLDER_WORDS: Readonly<Record<string, string>> = { requestor: "Needs your action", analyst: "With the Security Analyst", none: "No action needed" };
const MY_DRAFT = "REQ-EXPMY-DRAFT";
const BOBS_REQUEST = "REQ-EXPMY-BOB";

let myRequestsFixture: Promise<void> | null = null;

function seedMyRequestsFixture(harness: AuthorizationHttpHarness): Promise<void> {
  myRequestsFixture ??= (async () => {
    await seedQueueFixture(harness);
    await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      requestNumber: MY_DRAFT, title: "Export my draft request", requestStatus: "draft", requestor: harness.users.owner,
    });
    await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      requestNumber: BOBS_REQUEST, title: "Export request Bob raised", requestStatus: "submitted", requestor: harness.users.analyst,
      submittedDate: "2026-06-01T09:00:00.000Z",
    });
  })();
  return myRequestsFixture;
}

/** The caller's whole My requests list for `query`, in pages of fifty. */
function readMyRequests(harness: AuthorizationHttpHarness, identity: string, query = ""): Promise<{ items: Json[]; pageCount: number; total: number }> {
  return readAllPages(harness, "/api/v1/my_requests", `pageSize=50${query ? `&${query}` : ""}`, "page", identity);
}

/** A My requests item as the default columns write it (no timeZone: Updated is the UTC calendar date). */
function myRequestRow(item: Json): string[] {
  const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  const assignee = item.assignee as { displayName?: string } | null;
  const nextAction = item.nextAction as { summary?: string } | null;
  return [
    text(item.requestNumber),
    text(item.title),
    REQUEST_STATUS_WORDS[String(item.requestStatus)],
    text(assignee?.displayName),
    text(nextAction?.summary),
    text(item.dueDate),
    text(item.updatedAt).slice(0, 10),
  ];
}

/** The authorization policy configuration of one mounted route of the API `apiName`, as Strapi registered it. */
type PolicyConfig = Parameters<typeof csrmAuthorization>[1];
type MountedRouter = { type?: string; routes: Array<{ method: string; path: string; config?: { policies?: unknown[] } }> };
function mountedPolicyConfig(harness: AuthorizationHttpHarness, apiName: string, method: string, routePath: string): Promise<PolicyConfig> {
  return harness.withBackendFixture(async (backend) => {
    const routers = (backend as unknown as { apis: Record<string, { routes: Record<string, MountedRouter> }> }).apis[apiName]?.routes ?? {};
    const route = Object.values(routers).flatMap((router) => router.routes).find((candidate) => candidate.method === method && candidate.path === routePath);
    assert.ok(route, `EXPORT_ROUTE_MISSING_${routePath}`);
    const policy = route.config?.policies?.find((entry) => typeof entry === "object" && entry !== null && (entry as { name?: string }).name === "global::csrm-authorization");
    assert.ok(policy, `EXPORT_ROUTE_POLICY_MISSING_${routePath}`);
    return (policy as { config: PolicyConfig }).config;
  });
}

/*
 * Strapi answers a policy refusal over HTTP with its generic body, so the exact sentence is read by running the route's
 * own policy configuration through the mounted policy, against this database's grants, for one IdamBox User. Null when
 * the policy admits the caller.
 */
async function policyRefusal(harness: AuthorizationHttpHarness, config: PolicyConfig, userDocumentId: string): Promise<string | null> {
  return harness.withBackendFixture(async (backend) => {
    let refusal: string | null = null;
    const allowed = await csrmAuthorization(
      { state: { idamboxUser: { documentId: userDocumentId } }, params: {}, query: {}, forbidden: (message: string) => { refusal = message; } },
      config,
      { strapi: backend },
    );
    return allowed ? null : refusal ?? "REFUSED_WITHOUT_A_MESSAGE";
  });
}

test("my-requests: Jane, the Secondary Requestor and Bob each export their own records only, in the list's order, with one log line each", async () => {
  const harness = await harnessPromise;
  await seedMyRequestsFixture(harness);

  const files = new Map<string, string[][]>();
  for (const [label, identity, user] of [
    ["JANE", harness.identities.owner, harness.users.owner],
    ["SECONDARY_REQUESTOR", harness.identities.otherRequestor, harness.users.otherRequestor],
    ["BOB", harness.identities.analyst, harness.users.analyst],
  ] as const) {
    const list = await readMyRequests(harness, identity);
    const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, MY_EXPORT, "format=csv", identity));
    const rows = readExportCsv(await fileOf(response, `MY_${label}`));
    assertFileHeaders(response, CSV, "csv", list.total, `MY_${label}`, "my-requests");
    assert.deepEqual(rows, [MY_LABELS, ...list.items.map(myRequestRow)], `MY_${label}_NOT_THE_LIST`);
    files.set(label, rows);
    const exported = exportEvents(events);
    assert.equal(exported.length, 1, `MY_${label}_EVENTS: ${JSON.stringify(exported)}`);
    assert.equal(exported[0].event.event, "export.completed");
    assert.equal(exported[0].event.view, "my-requests");
    assert.equal((exported[0].event.actor as Json).documentId, user);
    assert.equal(exported[0].event.rowCount, list.total);
  }

  const numbers = (label: string) => new Set((files.get(label) ?? []).slice(1).map((row) => row[0]));
  const jane = numbers("JANE");
  const other = numbers("SECONDARY_REQUESTOR");
  const bob = numbers("BOB");
  assert.ok(jane.has(`${QUEUE_PREFIX}-001`) && jane.has(MY_DRAFT), "MY_JANE_MISSES_HER_REQUESTS");
  assert.ok(other.size > 0, "MY_SECONDARY_REQUESTOR_HAS_NO_REQUEST");
  assert.deepEqual([...bob], [BOBS_REQUEST], "MY_BOB_NOT_ONLY_HIS_OWN");
  for (const number of jane) assert.ok(!other.has(number) && !bob.has(number), `MY_EXPORT_DISCLOSES_JANES_${number}`);
  for (const number of other) assert.ok(!jane.has(number) && !bob.has(number), `MY_EXPORT_DISCLOSES_THE_SECONDARY_REQUESTORS_${number}`);
});

test("my-requests: the Holder column writes who holds each request, and holder=requestor narrows the rows as the list does", async () => {
  const harness = await harnessPromise;
  await seedMyRequestsFixture(harness);

  const list = await readMyRequests(harness, harness.identities.owner);
  const holders = readExportCsv(await fileOf(await exportAt(harness, MY_EXPORT, "format=csv&columns=requestNumber,holder", harness.identities.owner), "MY_HOLDERS"));
  assert.deepEqual(holders, [["Request ID", "Holder"], ...list.items.map((item) => [String(item.requestNumber), HOLDER_WORDS[String(item.holder)]])], "MY_HOLDER_COLUMN");
  for (const word of Object.values(HOLDER_WORDS)) assert.ok(holders.some((row) => row[1] === word), `MY_HOLDER_FIXTURE_LACKS_${word}`);

  const waiting = await readMyRequests(harness, harness.identities.owner, "holder=requestor");
  const narrowed = readExportCsv(await fileOf(await exportAt(harness, MY_EXPORT, "format=csv&holder=requestor&columns=requestNumber", harness.identities.owner), "MY_HOLDER_FILTER"));
  assert.deepEqual(narrowed, [["Request ID"], ...waiting.items.map((item) => [String(item.requestNumber)])], "MY_HOLDER_FILTER_ROWS");
  assert.ok(narrowed.some((row) => row[0] === MY_DRAFT), "MY_HOLDER_FILTER_LACKS_THE_DRAFT");
  assert.ok(narrowed.length < holders.length, "MY_HOLDER_FILTER_DID_NOT_NARROW");
});

test("my-requests: the service agent is refused although its birthright holds the export, in the exports' automation wording; no identity is 403, no token 401 and a page 400", async () => {
  const harness = await harnessPromise;
  await seedMyRequestsFixture(harness);

  const { events } = await withSecurityEvents(harness, async () => {
    for (const [label, identity] of [["SERVICE_AGENT", harness.identities.serviceAnalystAgent], ["NO_IDENTITY", null]] as const) {
      const response = await exportAt(harness, MY_EXPORT, "format=csv", identity);
      assert.equal(response.status, 403, `MY_${label}_NOT_REFUSED`);
      assert.equal((await errorOf(response)).status, 403, `MY_${label}_BODY`);
    }
    const noToken = await exportAt(harness, MY_EXPORT, "format=csv", harness.identities.owner, true);
    assert.equal(noToken.status, 401, "MY_NO_TOKEN_NOT_401");
  });
  assert.deepEqual(exportEvents(events), [], "MY_POLICY_REFUSAL_WROTE_AN_EXPORT_EVENT");

  const config = await mountedPolicyConfig(harness, "csrm-assessment-request", "GET", "/v1/my_requests/export");
  assert.equal(await policyRefusal(harness, config, harness.users.serviceAnalystAgent), "CSRM exports are refused to automation identities.", "MY_AGENT_REFUSAL_WORDING");
  assert.equal(await policyRefusal(harness, config, harness.users.owner), null, "MY_JANE_REFUSED_BY_THE_POLICY");

  const { result: paged, events: pagedEvents } = await withSecurityEvents(harness, () => exportAt(harness, MY_EXPORT, "format=csv&page=1", harness.identities.owner));
  assert.equal(paged.status, 400, "MY_PAGE_NOT_REFUSED");
  const refused = exportEvents(pagedEvents);
  assert.equal(refused.length, 1, `MY_PAGE_EVENTS: ${JSON.stringify(refused)}`);
  assert.equal(refused[0].event.reason, "INVALID_QUERY");
  assert.equal(refused[0].event.view, "my-requests");
});

/*
 * D-13, D-16: every refusal of the Requests export. Each policy refusal is a 403 over HTTP that writes no export event;
 * its exact sentence is read by running the mounted route's policy configuration against this database's grants. Each
 * mis-grant and withdrawn read is made in the test database for one action and restored afterwards.
 */
function queueSnapshot(harness: AuthorizationHttpHarness): Promise<unknown[]> {
  return harness.snapshot([
    () => harness.getRequest(harness.requests.owner),
    () => harness.getRequest(harness.requests.otherRequestor),
    async () => (await readQueuePages(harness, QUEUE_QUERY)).items,
  ]);
}

test("requests: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the queue read and no identity are 403 in the exports' words, and no token is 401", async () => {
  const harness = await harnessPromise;
  await seedQueueFixture(harness);
  const before = await queueSnapshot(harness);
  const config = await mountedPolicyConfig(harness, "csrm-assessment-request", "GET", "/v1/assessment_requests/export");
  const refusedOverHttp = async (label: string, identity: string | null) => {
    const response = await exportAt(harness, QUEUE_EXPORT, `format=csv&${QUEUE_QUERY}`, identity);
    assert.equal(response.status, 403, `QUEUE_${label}_NOT_REFUSED`);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/, `QUEUE_${label}_REFUSAL_NOT_JSON`);
    assert.doesNotMatch(await response.text(), new RegExp(`${QUEUE_PREFIX}|Export queue request`), `QUEUE_${label}_REFUSAL_DISCLOSES`);
  };

  const { events } = await withSecurityEvents(harness, async () => {
    await refusedOverHttp("JANE", harness.identities.owner);
    await refusedOverHttp("SECONDARY_REQUESTOR", harness.identities.otherRequestor);
    await refusedOverHttp("SERVICE_AGENT", harness.identities.serviceAnalystAgent);
    await refusedOverHttp("NO_IDENTITY", null);
    assert.equal(await policyRefusal(harness, config, harness.users.owner), "CSRM FunctionAPI access is denied.", "QUEUE_JANE_WORDING");

    // The refusal set is a second refusal: the agent stays refused, in the automation wording, when its role holds the export.
    await withRoleGrantedFunction(harness, "Security Analyst Agent", "Analyst List Export API", async () => {
      await refusedOverHttp("GRANTED_SERVICE_AGENT", harness.identities.serviceAnalystAgent);
      const wording = await policyRefusal(harness, config, harness.users.serviceAnalystAgent);
      assert.equal(wording, "CSRM exports are refused to automation identities.", "QUEUE_GRANTED_AGENT_WORDING");
      assert.notEqual(wording, "CSRM questionnaire governance requires a human Security Analyst.");
    });

    // A human who holds the export other than through the Security Analyst role is refused in the analyst exports' words.
    await withRoleGrantedFunction(harness, "Requestor", "Analyst List Export API", async () => {
      await refusedOverHttp("MIS_GRANTED_JANE", harness.identities.owner);
      assert.equal(await policyRefusal(harness, config, harness.users.owner), "CSRM analyst exports require a human Security Analyst.", "QUEUE_MIS_GRANTED_JANE_WORDING");
    });

    // The underlying read: Bob holding the export but not the queue read is refused.
    await harness.withRoleOperationWithdrawn("Security Analyst", "GET:/api/v1/assessment_requests", async () => {
      await refusedOverHttp("ANALYST_WITHOUT_THE_QUEUE_READ", harness.identities.analyst);
      assert.equal(await policyRefusal(harness, config, harness.users.analyst), "CSRM export requires the list read.", "QUEUE_UNDERLYING_READ_WORDING");
    });
    assert.equal(await policyRefusal(harness, config, harness.users.analyst), null, "QUEUE_BOB_REFUSED_BY_THE_POLICY");

    const noToken = await exportAt(harness, QUEUE_EXPORT, `format=csv&${QUEUE_QUERY}`, harness.identities.analyst, true);
    assert.equal(noToken.status, 401, "QUEUE_NO_TOKEN_NOT_401");
  });

  assert.deepEqual(exportEvents(events), [], "A_QUEUE_POLICY_REFUSAL_WROTE_AN_EXPORT_EVENT");
  assert.deepEqual(await queueSnapshot(harness), before, "A_REFUSED_QUEUE_EXPORT_CHANGED_PERSISTENCE");
});

test("requests: a page or pageSize, an unknown column or an unknown format is 400 with no reason and one export.refused line", async () => {
  const harness = await harnessPromise;
  await seedQueueFixture(harness);
  const before = await queueSnapshot(harness);

  for (const query of [
    `format=csv&${QUEUE_QUERY}&pagination[page]=2`,
    `format=csv&${QUEUE_QUERY}&pagination[pageSize]=10`,
    `format=csv&${QUEUE_QUERY}&page=2`,
    `format=csv&${QUEUE_QUERY}&columns=nope`,
    `format=pdf&${QUEUE_QUERY}`,
  ]) {
    const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, QUEUE_EXPORT, query, harness.identities.analyst));
    assert.equal(response.status, 400, `INVALID_QUEUE_EXPORT_ADMITTED_${query}`);
    const error = await errorOf(response);
    assert.equal((error.details as Json | undefined)?.reason, undefined, `INVALID_QUEUE_EXPORT_NAMES_A_REASON_${query}`);
    const refused = exportEvents(events);
    assert.equal(refused.length, 1, `INVALID_QUEUE_EXPORT_EVENTS_${query}: ${JSON.stringify(refused)}`);
    assert.equal(refused[0].event.event, "export.refused", query);
    assert.equal(refused[0].event.reason, "INVALID_QUERY", query);
    assert.equal(refused[0].event.view, "requests", query);
  }

  assert.deepEqual(await queueSnapshot(harness), before, "AN_INVALID_QUEUE_EXPORT_CHANGED_PERSISTENCE");
});

/*
 * 19-08 (D-04, D-05, D-07, D-13): the questionnaire review list exports whole, through the list's own parser, scope,
 * complete-scope read and projection. Twenty-three questionnaires, found by their number, belong to Jane, the Secondary
 * Requestor and Bob; five are not released yet (Analyst review), and the rest are not started, in draft or submitted.
 * Every question, answer and description holds the word Secret, which no export may write (T-19-27).
 */
const QUESTIONNAIRES_EXPORT = "/api/v1/questionnaires/export";
const QUESTIONNAIRE_PREFIX = "QUES-EXP";
const QUESTIONNAIRE_COUNT = 23;
const QUESTIONNAIRES_QUERY = `q=${QUESTIONNAIRE_PREFIX}&sort=questionnaireNumber:desc`;
const QUESTIONNAIRE_LABELS = ["Questionnaire ID", "Title", "Assessment request", "Status"];
/** The questionnaire status words the web shows (status-badge.tsx), restated here rather than read from the vocabulary. */
const QUESTIONNAIRE_STATUS_WORDS: Readonly<Record<string, string>> = {
  "analyst-review": "Analyst review",
  "not-started": "Not started",
  draft: "Draft",
  submitted: "Submitted",
};
const SECRET = /Secret/;

type QuestionnaireFixtureOwner = "owner" | "otherRequestor" | "analyst";

let questionnaireFixture: Promise<void> | null = null;

/** The 23 export questionnaires, each on its own request, seeded once. */
function seedQuestionnaireExportFixture(harness: AuthorizationHttpHarness): Promise<void> {
  questionnaireFixture ??= (async () => {
    const owners: readonly QuestionnaireFixtureOwner[] = ["analyst", "owner", "otherRequestor"];
    for (let index = 1; index <= QUESTIONNAIRE_COUNT; index += 1) {
      const sequence = String(index).padStart(3, "0");
      const owner = owners[index % owners.length];
      const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: `REQ-QEXP-${sequence}`, title: `Export questionnaire request ${sequence}`, requestStatus: "questionnaire-in-progress", requestor: harness.users[owner],
      });
      const released = index % 4 !== 0;
      const at = "2026-08-15T00:00:00.000Z";
      const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
        questionnaireNumber: `${QUESTIONNAIRE_PREFIX}-${sequence}`,
        title: `Export questionnaire ${sequence}`,
        description: `Secret description ${sequence}`,
        assessmentRequest: requestId,
        ...(released ? { releasedAt: at, releasedBy: harness.users.analyst, governanceLog: [{ schemaVersion: 1, kind: "released", at, by: harness.users.analyst }] } : {}),
      });
      const answerState = index % 3;
      const answer = answerState === 0
        ? null
        : answerState === 1
          ? { schemaVersion: 1, value: `Secret draft answer ${sequence}`, state: "draft", updatedAt: "2026-08-16T00:00:00.000Z" }
          : { schemaVersion: 1, value: `Secret submitted answer ${sequence}`, state: "submitted", updatedAt: "2026-08-16T00:00:00.000Z", submittedAt: "2026-08-16T00:00:00.000Z" };
      await harness.createFixtureDocument("api::csrm-question.csrm-question", {
        questionText: `Secret question ${sequence}`,
        answerType: "Text",
        options: { schemaVersion: 1, questionKey: `export-${sequence}`, section: { key: "context", title: "Context", order: 1 }, order: 1, required: true },
        ...(answer ? { answer } : {}),
        questionnaire: questionnaireId,
      });
    }
  })();
  return questionnaireFixture;
}

/** A questionnaire's Status as the list shows it: Analyst review until it is released, then its state. */
function questionnaireStatusWord(item: Json): string {
  return QUESTIONNAIRE_STATUS_WORDS[item.release === null ? "analyst-review" : String(item.state)];
}

/** A questionnaire item's request number, or empty when it has none. */
function questionnaireRequestNumber(item: Json): string {
  const request = item.assessmentRequest as { availability?: string; requestNumber?: string } | null;
  return request?.availability === "available" && typeof request.requestNumber === "string" ? request.requestNumber : "";
}

/** The analyst review list for `query`, in pages of ten, as Bob reads it. */
function readQuestionnairePages(harness: AuthorizationHttpHarness, query: string): Promise<{ items: Json[]; pageCount: number; total: number }> {
  return readAllPages(harness, "/api/v1/questionnaires", `${query}&pageSize=10`, "page", harness.identities.analyst);
}

test("questionnaires: Bob's questionnaire review list exports whole as a workbook equal to the list's three pages in order, with no question, answer or description, and one log line", async () => {
  const harness = await harnessPromise;
  await seedQuestionnaireExportFixture(harness);
  const bob = await displayNameOf(harness, harness.users.analyst);

  const list = await readQuestionnairePages(harness, QUESTIONNAIRES_QUERY);
  assert.equal(list.total, QUESTIONNAIRE_COUNT, "QUESTIONNAIRE_FIXTURE_TOTAL");
  assert.equal(list.pageCount, 3, "QUESTIONNAIRE_FIXTURE_PAGES");

  const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, QUESTIONNAIRES_EXPORT, `format=xlsx&${QUESTIONNAIRES_QUERY}`, harness.identities.analyst));
  const bytes = await fileOf(response, "QUESTIONNAIRES_XLSX");
  assertFileHeaders(response, XLSX, "xlsx", QUESTIONNAIRE_COUNT, "QUESTIONNAIRES_XLSX", "questionnaires");
  const [sheet, about] = await readExportWorkbook(bytes);
  assert.equal(sheet.name, "Questionnaires");
  assert.deepEqual(sheet.rows[0], QUESTIONNAIRE_LABELS, "QUESTIONNAIRES_XLSX_HEADER");
  assert.deepEqual(sheet.rows.slice(1), list.items.map((item) => [
    String(item.questionnaireNumber),
    String(item.title),
    questionnaireRequestNumber(item),
    questionnaireStatusWord(item),
  ]), "QUESTIONNAIRES_XLSX_NOT_THE_LIST_IN_ORDER");
  const statuses = new Set(sheet.rows.slice(1).map((row) => String(row[3])));
  for (const word of Object.values(QUESTIONNAIRE_STATUS_WORDS)) assert.ok(statuses.has(word), `QUESTIONNAIRES_FIXTURE_LACKS_${word}`);
  for (const row of [...sheet.rows, ...about.rows]) for (const cell of row) assert.doesNotMatch(String(cell ?? ""), SECRET, "QUESTIONNAIRES_XLSX_WRITES_CONTENT");
  const aboutRows = new Map(about.rows.map((row) => [String(row[0]), String(row[1])]));
  assert.equal(aboutRows.get("Search"), `“${QUESTIONNAIRE_PREFIX}”`, "QUESTIONNAIRES_ABOUT_SEARCH");
  assert.equal(aboutRows.get("Sorted by"), "Questionnaire ID, descending", "QUESTIONNAIRES_ABOUT_SORT");

  const exported = exportEvents(events);
  assert.equal(exported.length, 1, `QUESTIONNAIRES_XLSX_EVENTS: ${JSON.stringify(exported)}`);
  const [{ level, event }] = exported;
  assert.equal(level, "info");
  assert.equal(event.event, "export.completed");
  assert.equal(event.view, "questionnaires");
  assert.deepEqual(event.actor, { documentId: harness.users.analyst, displayName: bob });
  assert.deepEqual(event.filters, {});
  assert.equal(event.search, QUESTIONNAIRE_PREFIX);
  assert.equal(event.sort, "questionnaireNumber:desc");
  assert.equal(event.rowCount, QUESTIONNAIRE_COUNT);
});

test("questionnaires: the export URL reaches the export, not the questionnaire detail, and the CSV narrows by status as the list does, writing no content", async () => {
  const harness = await harnessPromise;
  await seedQuestionnaireExportFixture(harness);

  const response = await exportAt(harness, QUESTIONNAIRES_EXPORT, `format=csv&${QUESTIONNAIRES_QUERY}`, harness.identities.analyst);
  const bytes = await fileOf(response, "QUESTIONNAIRES_CSV");
  assertFileHeaders(response, CSV, "csv", QUESTIONNAIRE_COUNT, "QUESTIONNAIRES_CSV", "questionnaires");
  assert.doesNotMatch(bytes.toString("utf8"), SECRET, "QUESTIONNAIRES_CSV_WRITES_CONTENT");
  assert.equal(readExportCsv(bytes).length, QUESTIONNAIRE_COUNT + 1, "QUESTIONNAIRES_CSV_ROWS");

  const submitted = await readQuestionnairePages(harness, `${QUESTIONNAIRES_QUERY}&status=submitted`);
  assert.ok(submitted.total > 0 && submitted.total < QUESTIONNAIRE_COUNT, "QUESTIONNAIRES_STATUS_FIXTURE");
  const narrowed = readExportCsv(await fileOf(await exportAt(harness, QUESTIONNAIRES_EXPORT, `format=csv&${QUESTIONNAIRES_QUERY}&status=submitted&columns=questionnaireNumber,status`, harness.identities.analyst), "QUESTIONNAIRES_STATUS"));
  assert.deepEqual(narrowed, [["Questionnaire ID", "Status"], ...submitted.items.map((item) => [String(item.questionnaireNumber), questionnaireStatusWord(item)])], "QUESTIONNAIRES_STATUS_FILTER");
});

/*
 * 19-08 (D-04, D-13, D-16; T-19-26): My questionnaires exports the caller's own questionnaires, for every person, a
 * Security Analyst included, through the list's owner scope: only the released questionnaires of requests the caller
 * raised, read from the Requestor's side, as the list shows them.
 */
const MY_QUESTIONNAIRES_EXPORT = "/api/v1/my_questionnaires/export";
const MY_QUESTIONNAIRE_LABELS = ["Questionnaire ID", "Title", "Assessment request", "Progress", "Status"];

/** The fixture questionnaires `owner` raised and that are released, by number. */
function ownReleasedFixtureNumbers(owner: QuestionnaireFixtureOwner): string[] {
  const owners: readonly QuestionnaireFixtureOwner[] = ["analyst", "owner", "otherRequestor"];
  const numbers: string[] = [];
  for (let index = 1; index <= QUESTIONNAIRE_COUNT; index += 1) {
    if (owners[index % owners.length] === owner && index % 4 !== 0) numbers.push(`${QUESTIONNAIRE_PREFIX}-${String(index).padStart(3, "0")}`);
  }
  return numbers;
}

/** A My questionnaires item as the default columns write it. */
function myQuestionnaireRow(item: Json): string[] {
  const progress = item.progress as { answered: number; total: number };
  return [
    String(item.questionnaireNumber),
    String(item.title),
    questionnaireRequestNumber(item),
    `${progress.answered} of ${progress.total} answered`,
    questionnaireStatusWord(item),
  ];
}

test("my-questionnaires: Jane, the Secondary Requestor and Bob each export their own records only, in the list's order, with one log line each", async () => {
  const harness = await harnessPromise;
  await seedQuestionnaireExportFixture(harness);

  const files = new Map<string, string[][]>();
  for (const [label, identity, user] of [
    ["JANE", harness.identities.owner, harness.users.owner],
    ["SECONDARY_REQUESTOR", harness.identities.otherRequestor, harness.users.otherRequestor],
    ["BOB", harness.identities.analyst, harness.users.analyst],
  ] as const) {
    const list = await readAllPages(harness, "/api/v1/my_questionnaires", "pageSize=10", "page", identity);
    const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, MY_QUESTIONNAIRES_EXPORT, "format=csv", identity));
    const bytes = await fileOf(response, `MYQ_${label}`);
    assertFileHeaders(response, CSV, "csv", list.total, `MYQ_${label}`, "my-questionnaires");
    assert.doesNotMatch(bytes.toString("utf8"), SECRET, `MYQ_${label}_WRITES_CONTENT`);
    const rows = readExportCsv(bytes);
    assert.deepEqual(rows, [MY_QUESTIONNAIRE_LABELS, ...list.items.map(myQuestionnaireRow)], `MYQ_${label}_NOT_THE_LIST`);
    files.set(label, rows);
    const exported = exportEvents(events);
    assert.equal(exported.length, 1, `MYQ_${label}_EVENTS: ${JSON.stringify(exported)}`);
    assert.equal(exported[0].event.event, "export.completed");
    assert.equal(exported[0].event.view, "my-questionnaires");
    assert.equal((exported[0].event.actor as Json).documentId, user);
    assert.equal(exported[0].event.rowCount, list.total);
  }

  const fixtureNumbers = (label: string) => new Set((files.get(label) ?? []).slice(1).map((row) => row[0]).filter((number) => number.startsWith(QUESTIONNAIRE_PREFIX)));
  assert.deepEqual([...fixtureNumbers("JANE")].sort(), ownReleasedFixtureNumbers("owner"), "MYQ_JANE_NOT_HER_RELEASED_QUESTIONNAIRES");
  assert.deepEqual([...fixtureNumbers("SECONDARY_REQUESTOR")].sort(), ownReleasedFixtureNumbers("otherRequestor"), "MYQ_SECONDARY_REQUESTOR_NOT_THEIR_OWN");
  assert.deepEqual([...fixtureNumbers("BOB")].sort(), ownReleasedFixtureNumbers("analyst"), "MYQ_BOB_NOT_ONLY_HIS_OWN");
  const all = (label: string) => new Set((files.get(label) ?? []).slice(1).map((row) => row[0]));
  for (const [label, others] of [["JANE", ["SECONDARY_REQUESTOR", "BOB"]], ["SECONDARY_REQUESTOR", ["JANE", "BOB"]], ["BOB", ["JANE", "SECONDARY_REQUESTOR"]]] as const) {
    for (const number of all(label)) for (const other of others) assert.ok(!all(other).has(number), `MYQ_${other}_DISCLOSES_${label}_${number}`);
  }
});

test("my-questionnaires: the service agent is refused although its birthright holds the export, in the exports' automation wording; no identity is 403, no token 401 and a page size 400", async () => {
  const harness = await harnessPromise;
  await seedQuestionnaireExportFixture(harness);

  const { events } = await withSecurityEvents(harness, async () => {
    for (const [label, identity] of [["SERVICE_AGENT", harness.identities.serviceAnalystAgent], ["NO_IDENTITY", null]] as const) {
      const response = await exportAt(harness, MY_QUESTIONNAIRES_EXPORT, "format=csv", identity);
      assert.equal(response.status, 403, `MYQ_${label}_NOT_REFUSED`);
      assert.equal((await errorOf(response)).status, 403, `MYQ_${label}_BODY`);
    }
    const noToken = await exportAt(harness, MY_QUESTIONNAIRES_EXPORT, "format=csv", harness.identities.owner, true);
    assert.equal(noToken.status, 401, "MYQ_NO_TOKEN_NOT_401");
  });
  assert.deepEqual(exportEvents(events), [], "MYQ_POLICY_REFUSAL_WROTE_AN_EXPORT_EVENT");

  const config = await mountedPolicyConfig(harness, "csrm-questionnaire", "GET", "/v1/my_questionnaires/export");
  assert.equal(await policyRefusal(harness, config, harness.users.serviceAnalystAgent), "CSRM exports are refused to automation identities.", "MYQ_AGENT_REFUSAL_WORDING");
  assert.equal(await policyRefusal(harness, config, harness.users.owner), null, "MYQ_JANE_REFUSED_BY_THE_POLICY");

  const { result: paged, events: pagedEvents } = await withSecurityEvents(harness, () => exportAt(harness, MY_QUESTIONNAIRES_EXPORT, "format=csv&pageSize=50", harness.identities.owner));
  assert.equal(paged.status, 400, "MYQ_PAGE_SIZE_NOT_REFUSED");
  const refused = exportEvents(pagedEvents);
  assert.equal(refused.length, 1, `MYQ_PAGE_SIZE_EVENTS: ${JSON.stringify(refused)}`);
  assert.equal(refused[0].event.reason, "INVALID_QUERY");
  assert.equal(refused[0].event.view, "my-questionnaires");
});

/*
 * 19-08 (D-04, D-07, D-13; G-16): the alert list exports whole, through the alert list's own parser and derivation
 * (the alert repository's count and pages, ruled by the active-risk rule), so each row's urgency, condition and date
 * are the list's own and nothing in the export recomputes a due state. The fixture's draft assessment holds an overdue
 * treatment, a treatment due soon, an untreated Critical Risk and a withdrawn Risk whose treatment is overdue, which no
 * row may name; three requests the analyst is working on are overdue.
 */
const ALERTS_EXPORT = "/api/v1/alerts/export";
const ALERT_LABELS = ["Urgency", "Residual rating", "Condition", "Record", "Date"];
/** The alert words the web shows (alert-domain.ts), restated here rather than read from the vocabulary. */
const ALERT_URGENCY_WORDS: Readonly<Record<string, string>> = { overdue: "Overdue", "due-soon": "Due soon", attention: "Needs attention" };
const ALERT_KIND_WORDS: Readonly<Record<string, string>> = {
  "risk-treatment-overdue": "Treatment overdue",
  "risk-treatment-due-soon": "Treatment due soon",
  "request-overdue": "Request overdue",
  "request-due-soon": "Request due soon",
  "control-implementation-overdue": "Control Implementation overdue",
  "assessment-review-due": "Risk Assessment review due",
  "critical-residual-risk-untreated": "Critical Risk not treated",
  "ineffective-control": "Ineffective Control Implementation",
};
const ALERT_OVERDUE_RISK = "RSK-EXPALERT-001";
const ALERT_WITHDRAWN_RISK = "RSK-EXPALERT-004";

type AlertItem = Json & { kind: string; urgency: string; governingDate: string | null; residualRating: string | null; source: { identifier: string } };

let alertFixture: Promise<{ today: string }> | null = null;

function alertDay(today: string, offset: number): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** The alert export fixture, seeded once against today's UTC date. */
function seedAlertExportFixture(harness: AuthorizationHttpHarness): Promise<{ today: string }> {
  alertFixture ??= (async () => {
    const today = utcToday(new Date());
    const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      requestNumber: "REQ-EXPALERT-001", title: "Export alert request", requestStatus: "risk-assessment-drafted", requestor: harness.users.owner,
    });
    const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: "ASM-2026-EXPALERT", assessmentStatus: "draft", assessmentRequest: requestId,
    });
    await harness.createRiskRegisterFixture(assessmentId, { riskNumber: ALERT_OVERDUE_RISK, riskStatement: "Export alert overdue treatment", targetDate: alertDay(today, -3), treatmentStatus: "In Progress", residualRating: "High" });
    await harness.createRiskRegisterFixture(assessmentId, { riskNumber: "RSK-EXPALERT-002", riskStatement: "Export alert treatment due soon", targetDate: alertDay(today, 5), treatmentStatus: "Not Started", residualRating: "Moderate" });
    await harness.createRiskRegisterFixture(assessmentId, { riskNumber: "RSK-EXPALERT-003", riskStatement: "Export alert untreated Critical Risk", residualRating: "Critical", treatmentStatus: "Not Started", identifiedDate: alertDay(today, -20) });
    const withdrawn = await harness.createRiskRegisterFixture(assessmentId, { riskNumber: ALERT_WITHDRAWN_RISK, riskStatement: "Export alert withdrawn Risk", targetDate: alertDay(today, -2), treatmentStatus: "In Progress", residualRating: "High" });
    const response = await harness.request({
      path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risk_withdrawals`,
      identity: harness.identities.analyst,
      init: json("POST", { riskIds: [withdrawn], reason: WITHDRAWAL_REASON }),
    });
    assert.equal(response.status, 200, `ALERT_FIXTURE_WITHDRAWAL_FAILED: ${await response.text()}`);
    // Three overdue requests, so the alert list runs past one page of five.
    for (const [index, status] of (["under-review", "submitted", "questionnaire-in-progress"] as const).entries()) {
      await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: `REQ-EXPALERT-00${index + 2}`, title: "Export alert overdue request", requestStatus: status, requestor: harness.users.owner, dueDate: alertDay(today, -1 - index),
      });
    }
    return { today };
  })();
  return alertFixture;
}

/** The alert list for `query`, in pages of five, as Bob reads it. */
function readAlertPages(harness: AuthorizationHttpHarness, query: string): Promise<{ items: Json[]; pageCount: number; total: number }> {
  return readAllPages(harness, "/api/v1/alerts", `pageSize=5${query ? `&${query}` : ""}`, "page", harness.identities.analyst);
}

/** An alert item as the default columns write it. */
function alertRow(item: Json): string[] {
  const alert = item as AlertItem;
  return [ALERT_URGENCY_WORDS[alert.urgency], alert.residualRating ?? "", ALERT_KIND_WORDS[alert.kind], alert.source.identifier, alert.governingDate ?? ""];
}

test("alerts: Bob's alert list exports whole as a CSV equal to the list's pages in order, the overdue treatment as the list derives it and no withdrawn Risk, with one log line", async () => {
  const harness = await harnessPromise;
  const { today } = await seedAlertExportFixture(harness);
  const bob = await displayNameOf(harness, harness.users.analyst);

  const list = await readAlertPages(harness, "");
  assert.ok(list.pageCount > 1, "ALERT_FIXTURE_NOT_PAGED");
  const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, ALERTS_EXPORT, "format=csv", harness.identities.analyst));
  const rows = readExportCsv(await fileOf(response, "ALERTS_CSV"));
  assertFileHeaders(response, CSV, "csv", list.total, "ALERTS_CSV", "alerts");
  assert.deepEqual(rows, [ALERT_LABELS, ...list.items.map(alertRow)], "ALERTS_CSV_NOT_THE_LIST_IN_ORDER");

  // The overdue treatment reads as the list derives it: Overdue, its rating, Treatment overdue and its target date.
  assert.ok(rows.some((row) => row.join("|") === ["Overdue", "High", "Treatment overdue", ALERT_OVERDUE_RISK, alertDay(today, -3)].join("|")), "ALERTS_OVERDUE_TREATMENT_ROW");
  for (const kind of ["Treatment due soon", "Critical Risk not treated", "Request overdue"]) assert.ok(rows.some((row) => row[2] === kind), `ALERTS_FIXTURE_LACKS_${kind}`);
  assert.ok(!rows.some((row) => row[3] === ALERT_WITHDRAWN_RISK), "ALERTS_EXPORT_NAMES_A_WITHDRAWN_RISK");

  const exported = exportEvents(events);
  assert.equal(exported.length, 1, `ALERTS_CSV_EVENTS: ${JSON.stringify(exported)}`);
  const [{ level, event }] = exported;
  assert.equal(level, "info");
  assert.equal(event.event, "export.completed");
  assert.equal(event.view, "alerts");
  assert.deepEqual(event.actor, { documentId: harness.users.analyst, displayName: bob });
  assert.deepEqual(event.filters, {});
  assert.equal(event.rowCount, list.total);
});

test("alerts: the list's kind and urgency filters narrow the workbook as they narrow the list, named on the About sheet and in the log line", async () => {
  const harness = await harnessPromise;
  await seedAlertExportFixture(harness);

  const query = "kind=risk-treatment-overdue&kind=risk-treatment-due-soon&urgency=overdue";
  const list = await readAlertPages(harness, query);
  assert.ok(list.total > 0, "ALERT_FILTER_FIXTURE");
  const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, ALERTS_EXPORT, `format=xlsx&${query}`, harness.identities.analyst));
  const [sheet, about] = await readExportWorkbook(await fileOf(response, "ALERTS_XLSX"));
  assertFileHeaders(response, XLSX, "xlsx", list.total, "ALERTS_XLSX", "alerts");
  assert.equal(sheet.name, "Alerts");
  assert.deepEqual(sheet.rows[0], ALERT_LABELS, "ALERTS_XLSX_HEADER");
  assert.deepEqual(sheet.rows.slice(1).map((row) => [row[2], row[3]]), list.items.map((item) => [ALERT_KIND_WORDS[String(item.kind)], (item as AlertItem).source.identifier]), "ALERTS_XLSX_NOT_THE_FILTERED_LIST");
  assert.ok(sheet.rows.slice(1).every((row) => row[0] === "Overdue"), "ALERTS_XLSX_URGENCY_FILTER");
  const aboutRows = new Map(about.rows.map((row) => [String(row[0]), String(row[1])]));
  assert.equal(aboutRows.get("Filters"), "Alert type: Treatment overdue, Treatment due soon\nUrgency: Overdue", "ALERTS_ABOUT_FILTERS");
  const [{ event }] = exportEvents(events);
  assert.deepEqual(event.filters, { kind: ["risk-treatment-overdue", "risk-treatment-due-soon"], urgency: "overdue" });
  assert.equal(event.view, "alerts");
});

/*
 * 19-08 (D-13, D-16, D-18; T-19-28): every refusal of the questionnaire and alert exports. Each policy refusal is a 403
 * over HTTP that writes no export event; its exact sentence is read by running the mounted route's policy configuration
 * against this database's grants. Each mis-grant and withdrawn read is made in the test database for one action and
 * restored afterwards. Neither analyst export ever refuses in the questionnaire governance or insight words.
 */
const GOVERNANCE_WORDING = "CSRM questionnaire governance requires a human Security Analyst.";
const INSIGHT_WORDING = "CSRM analyst insights require a human Security Analyst.";

function questionnaireAndAlertSnapshot(harness: AuthorizationHttpHarness): Promise<unknown[]> {
  return harness.snapshot([
    () => harness.getRequest(harness.requests.owner),
    async () => (await readQuestionnairePages(harness, QUESTIONNAIRES_QUERY)).items,
    async () => (await readAlertPages(harness, "")).items,
  ]);
}

/** Every refusal of one analyst export (`exportPath`, mounted by `apiName` at `routePath`), with its list read `listRead`. */
async function assertAnalystExportRefusals(harness: AuthorizationHttpHarness, input: { label: string; exportPath: string; query: string; apiName: string; routePath: string; listRead: string; discloses: RegExp }): Promise<void> {
  const { label } = input;
  const before = await questionnaireAndAlertSnapshot(harness);
  const config = await mountedPolicyConfig(harness, input.apiName, "GET", input.routePath);
  const refusedOverHttp = async (who: string, identity: string | null) => {
    const response = await exportAt(harness, input.exportPath, input.query, identity);
    assert.equal(response.status, 403, `${label}_${who}_NOT_REFUSED`);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/, `${label}_${who}_REFUSAL_NOT_JSON`);
    assert.doesNotMatch(await response.text(), input.discloses, `${label}_${who}_REFUSAL_DISCLOSES`);
  };

  const { events } = await withSecurityEvents(harness, async () => {
    await refusedOverHttp("JANE", harness.identities.owner);
    await refusedOverHttp("SECONDARY_REQUESTOR", harness.identities.otherRequestor);
    await refusedOverHttp("SERVICE_AGENT", harness.identities.serviceAnalystAgent);
    await refusedOverHttp("NO_IDENTITY", null);
    assert.equal(await policyRefusal(harness, config, harness.users.owner), "CSRM FunctionAPI access is denied.", `${label}_JANE_WORDING`);

    // The refusal set is a second refusal: the agent stays refused, in the automation wording, when its role holds the export.
    await withRoleGrantedFunction(harness, "Security Analyst Agent", "Analyst List Export API", async () => {
      await refusedOverHttp("GRANTED_SERVICE_AGENT", harness.identities.serviceAnalystAgent);
      const wording = await policyRefusal(harness, config, harness.users.serviceAnalystAgent);
      assert.equal(wording, "CSRM exports are refused to automation identities.", `${label}_GRANTED_AGENT_WORDING`);
      assert.notEqual(wording, GOVERNANCE_WORDING);
      assert.notEqual(wording, INSIGHT_WORDING);
    });

    // A human who holds the export other than through the Security Analyst role is refused in the analyst exports' words.
    await withRoleGrantedFunction(harness, "Requestor", "Analyst List Export API", async () => {
      await refusedOverHttp("MIS_GRANTED_JANE", harness.identities.owner);
      assert.equal(await policyRefusal(harness, config, harness.users.owner), "CSRM analyst exports require a human Security Analyst.", `${label}_MIS_GRANTED_JANE_WORDING`);
    });

    // The underlying read: Bob holding the export but not the list read is refused.
    await harness.withRoleOperationWithdrawn("Security Analyst", input.listRead, async () => {
      await refusedOverHttp("ANALYST_WITHOUT_THE_LIST_READ", harness.identities.analyst);
      assert.equal(await policyRefusal(harness, config, harness.users.analyst), "CSRM export requires the list read.", `${label}_UNDERLYING_READ_WORDING`);
    });
    assert.equal(await policyRefusal(harness, config, harness.users.analyst), null, `${label}_BOB_REFUSED_BY_THE_POLICY`);

    const noToken = await exportAt(harness, input.exportPath, input.query, harness.identities.analyst, true);
    assert.equal(noToken.status, 401, `${label}_NO_TOKEN_NOT_401`);
  });

  assert.deepEqual(exportEvents(events), [], `A_${label}_POLICY_REFUSAL_WROTE_AN_EXPORT_EVENT`);
  assert.deepEqual(await questionnaireAndAlertSnapshot(harness), before, `A_REFUSED_${label}_EXPORT_CHANGED_PERSISTENCE`);
}

test("questionnaires: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the review list read and no identity are 403 in the exports' words, and no token is 401", async () => {
  const harness = await harnessPromise;
  await seedQuestionnaireExportFixture(harness);
  await seedAlertExportFixture(harness);
  await assertAnalystExportRefusals(harness, {
    label: "QUESTIONNAIRES",
    exportPath: QUESTIONNAIRES_EXPORT,
    query: `format=csv&${QUESTIONNAIRES_QUERY}`,
    apiName: "csrm-questionnaire",
    routePath: "/v1/questionnaires/export",
    listRead: "GET:/api/v1/questionnaires",
    discloses: new RegExp(`${QUESTIONNAIRE_PREFIX}|Export questionnaire|Secret`),
  });
});

test("alerts: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the alert read and no identity are 403 in the exports' words, and no token is 401", async () => {
  const harness = await harnessPromise;
  await seedQuestionnaireExportFixture(harness);
  await seedAlertExportFixture(harness);
  await assertAnalystExportRefusals(harness, {
    label: "ALERTS",
    exportPath: ALERTS_EXPORT,
    query: "format=csv",
    apiName: "csrm-analyst-insight",
    routePath: "/v1/alerts/export",
    listRead: "GET:/api/v1/alerts",
    discloses: /EXPALERT|Export alert/,
  });
});

test("questionnaires, my-questionnaires and alerts: a page or pageSize, an unknown column or an unknown format is 400 with no reason and one export.refused line", async () => {
  const harness = await harnessPromise;
  await seedQuestionnaireExportFixture(harness);
  await seedAlertExportFixture(harness);
  const before = await questionnaireAndAlertSnapshot(harness);

  for (const [view, exportPath, identity, base] of [
    ["questionnaires", QUESTIONNAIRES_EXPORT, harness.identities.analyst, QUESTIONNAIRES_QUERY],
    ["my-questionnaires", MY_QUESTIONNAIRES_EXPORT, harness.identities.owner, "sort=title:asc"],
    ["alerts", ALERTS_EXPORT, harness.identities.analyst, "urgency=overdue"],
  ] as const) {
    for (const query of [`format=csv&${base}&page=1`, `format=csv&${base}&pageSize=10`, `format=csv&${base}&columns=nope`, `format=pdf&${base}`]) {
      const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, exportPath, query, identity));
      assert.equal(response.status, 400, `INVALID_EXPORT_ADMITTED_${view}_${query}`);
      const error = await errorOf(response);
      assert.equal((error.details as Json | undefined)?.reason, undefined, `INVALID_EXPORT_NAMES_A_REASON_${view}_${query}`);
      const refused = exportEvents(events);
      assert.equal(refused.length, 1, `INVALID_EXPORT_EVENTS_${view}_${query}: ${JSON.stringify(refused)}`);
      assert.equal(refused[0].event.event, "export.refused", query);
      assert.equal(refused[0].event.reason, "INVALID_QUERY", query);
      assert.equal(refused[0].event.view, view, query);
    }
  }

  assert.deepEqual(await questionnaireAndAlertSnapshot(harness), before, "AN_INVALID_QUESTIONNAIRE_OR_ALERT_EXPORT_CHANGED_PERSISTENCE");
});

/*
 * 19-09 (D-03, D-13, D-22; UI-D5): the report export, served at the URL the catalogue reserved in Phase 7. XLSX holds
 * one sheet per report table, in page order, then About this export with the report's As at and, for throughput, its
 * Period; CSV holds the one table the body names. Every value is the report read's own figure for the same database,
 * restated here in the words the report page shows (report-presentation.ts), never recomputed.
 */
const REPORT_EXPORT = (reportKey: string) => `/api/v1/reports/${reportKey}/export`;
const REPORT_PREFIX = "EXPREPORT";

type ReportFigures = Json & { key: string; today: string };
type ExpectedSheet = { name: string; rows: unknown[][] };

let reportFixture: Promise<void> | null = null;

/**
 * Released open Risks on an Information System and one without a rating, and one Control Implementation, so every risk
 * exposure table holds non-zero rows and throughput counts a release this month.
 */
function seedReportExportFixture(harness: AuthorizationHttpHarness): Promise<void> {
  reportFixture ??= (async () => {
    const systemId = await harness.createFixtureDocument("api::csrm-information-system.csrm-information-system", { name: `${REPORT_PREFIX} payroll system` });
    const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      requestNumber: `REQ-${REPORT_PREFIX}-001`, title: "Export report request", requestStatus: "approved", requestor: harness.users.owner, submittedDate: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    });
    const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: `ASM-2026-${REPORT_PREFIX}`, assessmentStatus: "approved", approvalDate: new Date().toISOString(), approvedBy: harness.users.analyst, reviewedBy: harness.users.analyst, assessmentRequest: requestId,
    });
    const critical = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
      riskNumber: `RSK-${REPORT_PREFIX}-001`, riskStatement: "Export report Critical Risk", assessment: assessmentId, residualRating: "Critical", inherentRating: "Critical", treatmentStatus: "In Progress", informationSystemImpacted: systemId,
    });
    await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
      riskNumber: `RSK-${REPORT_PREFIX}-002`, riskStatement: "Export report accepted High Risk", assessment: assessmentId, residualRating: "High", inherentRating: "Moderate", treatmentStatus: "Not Started", treatmentAction: "Accept", informationSystemImpacted: systemId,
    });
    await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
      riskNumber: `RSK-${REPORT_PREFIX}-003`, riskStatement: "Export report unrated Risk", assessment: assessmentId,
    });
    const control = await harness.createFixtureDocument("api::csrm-control.csrm-control", { controlNumber: `CTL-${REPORT_PREFIX}-001`, name: "Export report control", framework: "Export report fixtures" });
    await harness.createFixtureDocument("api::csrm-control-implementation.csrm-control-implementation", {
      risk: critical, control, controlStatus: "Implemented", effectivenessRating: "Partially Effective",
    });
  })();
  return reportFixture;
}

/** One report as Bob reads it from the report route. */
async function readReportFigures(harness: AuthorizationHttpHarness, reportKey: string, query = ""): Promise<ReportFigures> {
  const response = await harness.request({ path: `/api/v1/reports/${reportKey}${query}`, identity: harness.identities.analyst });
  assert.equal(response.status, 200, `REPORT_READ_FAILED_${reportKey}: ${await response.clone().text()}`);
  return ((await response.json()) as { data: ReportFigures }).data;
}

/** Bob's report export unless another identity is named; `null` sends no identity at all. */
function exportReportAs(harness: AuthorizationHttpHarness, reportKey: string, body: unknown, identity: string | null = harness.identities.analyst, omitApiToken = false): Promise<Response> {
  return harness.request({ path: REPORT_EXPORT(reportKey), identity: identity ?? undefined, omitApiToken, init: json("POST", body) });
}

const RATING_ROWS = [["Critical", "Critical"], ["High", "High"], ["Moderate", "Moderate"], ["Low", "Low"], ["notRated", "Not rated"]] as const;
const TREATMENT_STATUS_KEYS = [["notStarted", "Not Started"], ["inProgress", "In Progress"], ["overdue", "Overdue"], ["complete", "Complete"], ["notProvided", "Not provided"]] as const;
/** A sheet is named by its table heading, cut to Excel's 31 characters. */
const sheetName = (heading: string) => heading.slice(0, 31).trimEnd();
const counts = (value: unknown) => value as Record<string, number>;

/** The risk exposure page's four tables, from the report's figures. */
function riskExposureSheets(report: ReportFigures): ExpectedSheet[] {
  const inherent = counts(report.byInherentRating);
  const residual = counts(report.byResidualRating);
  const accepted = counts(report.acceptedByResidualRating);
  // The page shows Not rated in the rating table only when either chart has an unrated Risk.
  const ratings = RATING_ROWS.filter(([key]) => key !== "notRated" || inherent.notRated > 0 || residual.notRated > 0);
  const matrix = report.residualByTreatmentStatus as Record<string, Record<string, number>>;
  const exposed = (report.exposedSystems as { rows: Array<{ name: string; critical: number; high: number; total: number }> }).rows;
  const underAssessment = counts((report.underAssessment as Json).byResidualRating);
  return [
    { name: sheetName("Inherent and residual rating"), rows: [["Rating", "Inherent", "Residual", "Accepted"], ...ratings.map(([key, label]) => [label, inherent[key], residual[key], accepted[key]])] },
    {
      name: sheetName("Residual rating by treatment status"),
      rows: [["Residual rating", ...TREATMENT_STATUS_KEYS.map(([, label]) => label), "Total"], ...RATING_ROWS.map(([key, label]) => [label, ...TREATMENT_STATUS_KEYS.map(([status]) => matrix[key][status]), matrix[key].total])],
    },
    { name: sheetName("Most exposed Information Systems"), rows: [["Information System", "Critical", "High", "Total"], ...exposed.map((system) => [system.name, system.critical, system.high, system.total])] },
    { name: sheetName("Under assessment"), rows: [["Residual rating", "Risks"], ...RATING_ROWS.map(([key, label]) => [label, underAssessment[key]])] },
  ];
}

const REQUEST_LIFECYCLE_ROWS = [
  ["submitted", "Submitted"], ["questionnaireInProgress", "Questionnaire in progress"], ["riskAssessmentDrafted", "Risk assessment drafted"],
  ["underReview", "Under review"], ["approved", "Released"], ["closed", "Closed"],
] as const;
const monthLong = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
const monthLabel = (monthStart: string) => monthLong.format(new Date(`${monthStart}T00:00:00.000Z`));

/** The assessment throughput page's two tables, from the report's figures. */
function throughputSheets(report: ReportFigures): ExpectedSheet[] {
  const months = (report.released as { months: Array<{ monthStart: string; count: number; partial: boolean }> }).months;
  const requests = counts(report.requestsByStatus);
  return [
    { name: sheetName("Released per month"), rows: [["Month", "Released"], ...months.map((month) => [`${monthLabel(month.monthStart)}${month.partial ? " (to date)" : ""}`, month.count])] },
    { name: sheetName("Assessment Requests by lifecycle state"), rows: [["Lifecycle state", "Assessment Requests"], ...REQUEST_LIFECYCLE_ROWS.map(([key, label]) => [label, requests[key]])] },
  ];
}

/** "17 Oct 2026": the report's as-at date as the report page shows it. */
function asAtText(today: string): string {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${today}T00:00:00.000Z`));
}

/** The viewer-local dates a file exported in `zone` may be named with, read on either side of the request. */
function localDates(zone: string): string[] {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  return [format.format(new Date(Date.now() - 60_000)), format.format(new Date())];
}

function assertReportFileHeaders(response: Response, contentType: string, fileNames: readonly string[], rowCount: number, label: string): void {
  assert.equal(response.headers.get("content-type"), contentType, `${label}_CONTENT_TYPE`);
  const disposition = response.headers.get("content-disposition") ?? "";
  assert.ok(disposition.startsWith("attachment;") && fileNames.some((name) => disposition.includes(`filename*=UTF-8''${name}`)), `${label}_DISPOSITION: ${disposition}`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${label}_NOSNIFF`);
  assert.equal(response.headers.get("cache-control"), "no-store", `${label}_CACHE`);
  assert.equal(response.headers.get("x-csrm-row-count"), String(rowCount), `${label}_ROW_COUNT`);
}

const dataRows = (sheets: readonly ExpectedSheet[]) => sheets.reduce((sum, sheet) => sum + sheet.rows.length - 1, 0);

test("reports: Bob's risk exposure report exports as a workbook of its tables in page order, each equal to the report's figures, with As at and one log line", async () => {
  const harness = await harnessPromise;
  await seedReportExportFixture(harness);
  const bob = await displayNameOf(harness, harness.users.analyst);

  const report = await readReportFigures(harness, "risk-exposure");
  const expected = riskExposureSheets(report);
  assert.ok(expected[2].rows.length > 1, "REPORT_FIXTURE_HAS_NO_EXPOSED_SYSTEM");
  const { result: response, events } = await withSecurityEvents(harness, () => exportReportAs(harness, "risk-exposure", { format: "xlsx", timeZone: "Australia/Sydney" }, harness.identities.analyst));
  const sheets = await readExportWorkbook(await fileOf(response, "RISK_EXPOSURE_XLSX"));
  assertReportFileHeaders(response, XLSX, localDates("Australia/Sydney").map((day) => `risk-exposure-report-${day}.xlsx`), dataRows(expected), "RISK_EXPOSURE_XLSX");

  assert.deepEqual(sheets.map((sheet) => sheet.name), [...expected.map((sheet) => sheet.name), "About this export"], "RISK_EXPOSURE_SHEETS_NOT_IN_PAGE_ORDER");
  for (const [index, sheet] of expected.entries()) assert.deepEqual(sheets[index].rows, sheet.rows, `RISK_EXPOSURE_TABLE_${sheet.name}`);
  const about = new Map(sheets[sheets.length - 1].rows.map((row) => [String(row[0]), row[1]]));
  assert.equal(about.get("View"), "Risk exposure");
  assert.equal(about.get("As at"), asAtText(report.today), "RISK_EXPOSURE_AS_AT");
  assert.equal(about.get("Rows"), dataRows(expected));
  assert.equal(about.has("Period"), false, "RISK_EXPOSURE_HAS_A_PERIOD");
  assert.equal(about.has("Columns"), false, "A_REPORT_EXPORT_NAMES_COLUMNS");
  assert.match(String(about.get("Exported")), /\(Australia\/Sydney\)$/);
  assert.equal(about.get("Exported by"), bob);

  const exported = exportEvents(events);
  assert.equal(exported.length, 1, `RISK_EXPOSURE_EVENTS: ${JSON.stringify(exported)}`);
  const [{ event }] = exported;
  assert.equal(event.event, "export.completed");
  assert.equal(event.view, "report:risk-exposure");
  assert.equal(event.format, "xlsx");
  assert.equal(event.table, null);
  assert.deepEqual(event.columns, []);
  assert.equal(event.timeZone, "Australia/Sydney");
  assert.equal(event.rowCount, dataRows(expected));
  assert.deepEqual(event.actor, { documentId: harness.users.analyst, displayName: bob });
});

test("reports: the assessment throughput workbook holds the period the body names, with its Period row, and a period the report refuses is 400", async () => {
  const harness = await harnessPromise;
  await seedReportExportFixture(harness);

  const report = await readReportFigures(harness, "assessment-throughput", "?period=12");
  const expected = throughputSheets(report);
  assert.equal(expected[0].rows.length, 13, "THROUGHPUT_NOT_TWELVE_MONTHS");
  const response = await exportReportAs(harness, "assessment-throughput", { format: "xlsx", query: { period: "12" } });
  const sheets = await readExportWorkbook(await fileOf(response, "THROUGHPUT_XLSX"));
  assertReportFileHeaders(response, XLSX, localDates("UTC").map((day) => `assessment-throughput-report-${day}.xlsx`), dataRows(expected), "THROUGHPUT_XLSX");
  assert.deepEqual(sheets.map((sheet) => sheet.name), [...expected.map((sheet) => sheet.name), "About this export"], "THROUGHPUT_SHEETS");
  for (const [index, sheet] of expected.entries()) assert.deepEqual(sheets[index].rows, sheet.rows, `THROUGHPUT_TABLE_${sheet.name}`);
  const months = (report.released as { months: Array<{ monthStart: string }> }).months;
  const about = new Map(sheets[sheets.length - 1].rows.map((row) => [String(row[0]), row[1]]));
  assert.equal(about.get("View"), "Assessment throughput");
  assert.equal(about.get("As at"), asAtText(report.today));
  assert.equal(about.get("Period"), `12 months, ${monthLabel(months[0].monthStart)} to ${monthLabel(months[months.length - 1].monthStart)}`, "THROUGHPUT_PERIOD");

  // With no query the report's own default period (six months) applies.
  const defaulted = await exportReportAs(harness, "assessment-throughput", { format: "xlsx" });
  const defaultSheets = await readExportWorkbook(await fileOf(defaulted, "THROUGHPUT_DEFAULT_XLSX"));
  assert.equal(defaultSheets[0].rows.length, 7, "THROUGHPUT_DEFAULT_NOT_SIX_MONTHS");

  for (const period of ["7", "6,12"]) {
    const refused = await exportReportAs(harness, "assessment-throughput", { format: "xlsx", query: { period } });
    assert.equal(refused.status, 400, `THROUGHPUT_PERIOD_ADMITTED_${period}`);
  }
});

const RISK_EXPOSURE_TABLES = [
  ["ratings", "inherent-and-residual-rating"],
  ["residual-by-treatment-status", "residual-rating-by-treatment-status"],
  ["exposed-systems", "most-exposed-information-systems"],
  ["under-assessment", "under-assessment"],
] as const;

test("reports: each risk exposure table exports alone as a BOM-led CSV named for its table, equal to the report's figures, with one log line naming the table", async () => {
  const harness = await harnessPromise;
  await seedReportExportFixture(harness);

  const expected = riskExposureSheets(await readReportFigures(harness, "risk-exposure"));
  for (const [index, [table, slug]] of RISK_EXPOSURE_TABLES.entries()) {
    const { result: response, events } = await withSecurityEvents(harness, () => exportReportAs(harness, "risk-exposure", { format: "csv", table, timeZone: "Australia/Sydney" }));
    const rows = readExportCsv(await fileOf(response, `RISK_EXPOSURE_CSV_${table}`));
    assertReportFileHeaders(response, CSV, localDates("Australia/Sydney").map((day) => `risk-exposure-${slug}-${day}.csv`), expected[index].rows.length - 1, `RISK_EXPOSURE_CSV_${table}`);
    assert.deepEqual(rows, expected[index].rows.map((row) => row.map(String)), `RISK_EXPOSURE_CSV_NOT_THE_TABLE_${table}`);
    const exported = exportEvents(events);
    assert.equal(exported.length, 1, `RISK_EXPOSURE_CSV_EVENTS_${table}: ${JSON.stringify(exported)}`);
    assert.equal(exported[0].event.event, "export.completed");
    assert.equal(exported[0].event.view, "report:risk-exposure");
    assert.equal(exported[0].event.format, "csv");
    assert.equal(exported[0].event.table, table);
    assert.equal(exported[0].event.rowCount, expected[index].rows.length - 1);
  }
});

test("reports: no columns parameter: a columns key, an unknown key, a body that is not an object, a CSV without its table, an XLSX with one, an unknown table or format, a 17-key or non-text query and an unknown zone are 400 with no reason and one export.refused line", async () => {
  const harness = await harnessPromise;
  await seedReportExportFixture(harness);
  const before = await readReportFigures(harness, "risk-exposure");

  const seventeen = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`key${index}`, "6"]));
  for (const [label, reportKey, body] of [
    ["COLUMNS", "risk-exposure", { format: "xlsx", columns: "rating,inherent" }],
    ["COLUMNS_ON_CSV", "risk-exposure", { format: "csv", table: "ratings", columns: "rating" }],
    ["UNKNOWN_KEY", "risk-exposure", { format: "xlsx", page: 1 }],
    ["NOT_AN_OBJECT", "risk-exposure", ["xlsx"]],
    ["CSV_WITHOUT_TABLE", "risk-exposure", { format: "csv" }],
    ["XLSX_WITH_TABLE", "risk-exposure", { format: "xlsx", table: "ratings" }],
    ["UNKNOWN_TABLE", "risk-exposure", { format: "csv", table: "released-per-month" }],
    ["UNKNOWN_FORMAT", "risk-exposure", { format: "pdf" }],
    ["MISSING_FORMAT", "risk-exposure", { timeZone: "UTC" }],
    ["SEVENTEEN_KEY_QUERY", "assessment-throughput", { format: "xlsx", query: seventeen }],
    ["NUMBER_IN_QUERY", "assessment-throughput", { format: "xlsx", query: { period: 12 } }],
    ["LONG_QUERY_VALUE", "assessment-throughput", { format: "xlsx", query: { period: "6".repeat(201) } }],
    ["QUERY_NOT_AN_OBJECT", "assessment-throughput", { format: "xlsx", query: "period=12" }],
    ["UNKNOWN_ZONE", "risk-exposure", { format: "xlsx", timeZone: "Mars/Base" }],
  ] as const) {
    const { result: response, events } = await withSecurityEvents(harness, () => exportReportAs(harness, reportKey, body));
    assert.equal(response.status, 400, `INVALID_REPORT_EXPORT_ADMITTED_${label}`);
    const error = await errorOf(response);
    assert.equal(error.message, "CSRM export query is invalid.", `INVALID_REPORT_EXPORT_MESSAGE_${label}`);
    assert.equal((error.details as Json | undefined)?.reason, undefined, `INVALID_REPORT_EXPORT_NAMES_A_REASON_${label}`);
    const refused = exportEvents(events);
    assert.equal(refused.length, 1, `INVALID_REPORT_EXPORT_EVENTS_${label}: ${JSON.stringify(refused)}`);
    assert.equal(refused[0].event.event, "export.refused", label);
    assert.equal(refused[0].event.reason, "INVALID_QUERY", label);
    assert.equal(refused[0].event.view, `report:${reportKey}`, label);
    assert.equal(refused[0].event.rowCount, null, label);
  }

  assert.deepEqual(await readReportFigures(harness, "risk-exposure"), before, "AN_INVALID_REPORT_EXPORT_CHANGED_A_FIGURE");
});

test("reports: a report key that names no report is the report read's 404, with no export event", async () => {
  const harness = await harnessPromise;
  for (const reportKey of ["unknown", "RISK-EXPOSURE"]) {
    const { result: response, events } = await withSecurityEvents(harness, () => exportReportAs(harness, reportKey, { format: "xlsx" }));
    assert.equal(response.status, 404, `UNKNOWN_REPORT_EXPORT_${reportKey}`);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.equal(((await response.json()) as { error?: Json }).error?.message, "CSRM report was not found.");
    assert.deepEqual(exportEvents(events), [], `UNKNOWN_REPORT_EXPORT_LOGGED_${reportKey}`);
  }
});

const REPORT_EXPORT_FUNCTION = "Report Export API";
const REPORT_READ = "GET:/api/v1/reports/{reportKey}";

test("reports: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the report read and no identity are 403 in the exports' words, and no token is 401", async () => {
  const harness = await harnessPromise;
  await seedReportExportFixture(harness);
  const before = await readReportFigures(harness, "risk-exposure");
  const config = await mountedPolicyConfig(harness, "csrm-analyst-insight", "POST", "/v1/reports/:reportKey/export");
  const body = { format: "csv", table: "exposed-systems" };
  const refusedOverHttp = async (who: string, identity: string | null) => {
    const response = await exportReportAs(harness, "risk-exposure", body, identity);
    assert.equal(response.status, 403, `REPORT_EXPORT_${who}_NOT_REFUSED`);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/, `REPORT_EXPORT_${who}_REFUSAL_NOT_JSON`);
    assert.doesNotMatch(await response.text(), new RegExp(`${REPORT_PREFIX}|payroll`), `REPORT_EXPORT_${who}_REFUSAL_DISCLOSES`);
  };

  const { events } = await withSecurityEvents(harness, async () => {
    await refusedOverHttp("JANE", harness.identities.owner);
    await refusedOverHttp("SECONDARY_REQUESTOR", harness.identities.otherRequestor);
    await refusedOverHttp("SERVICE_AGENT", harness.identities.serviceAnalystAgent);
    await refusedOverHttp("NO_IDENTITY", null);
    assert.equal(await policyRefusal(harness, config, harness.users.owner), "CSRM FunctionAPI access is denied.", "REPORT_EXPORT_JANE_WORDING");

    // The refusal set is a second refusal: the agent stays refused, in the automation wording, when its role holds the export.
    await withRoleGrantedFunction(harness, "Security Analyst Agent", REPORT_EXPORT_FUNCTION, async () => {
      await refusedOverHttp("GRANTED_SERVICE_AGENT", harness.identities.serviceAnalystAgent);
      const wording = await policyRefusal(harness, config, harness.users.serviceAnalystAgent);
      assert.equal(wording, "CSRM exports are refused to automation identities.", "REPORT_EXPORT_GRANTED_AGENT_WORDING");
      assert.notEqual(wording, GOVERNANCE_WORDING);
      assert.notEqual(wording, INSIGHT_WORDING);
    });

    // A human who holds the export other than through the Security Analyst role is refused in the analyst exports' words.
    await withRoleGrantedFunction(harness, "Requestor", REPORT_EXPORT_FUNCTION, async () => {
      await refusedOverHttp("MIS_GRANTED_JANE", harness.identities.owner);
      const wording = await policyRefusal(harness, config, harness.users.owner);
      assert.equal(wording, "CSRM analyst exports require a human Security Analyst.", "REPORT_EXPORT_MIS_GRANTED_JANE_WORDING");
      assert.notEqual(wording, GOVERNANCE_WORDING);
      assert.notEqual(wording, INSIGHT_WORDING);
    });

    // The underlying read: Bob holding the export but not the report read is refused.
    await harness.withRoleOperationWithdrawn("Security Analyst", REPORT_READ, async () => {
      await refusedOverHttp("ANALYST_WITHOUT_THE_REPORT_READ", harness.identities.analyst);
      assert.equal(await policyRefusal(harness, config, harness.users.analyst), "CSRM export requires the list read.", "REPORT_EXPORT_UNDERLYING_READ_WORDING");
    });
    assert.equal(await policyRefusal(harness, config, harness.users.analyst), null, "REPORT_EXPORT_BOB_REFUSED_BY_THE_POLICY");

    const noToken = await exportReportAs(harness, "risk-exposure", body, harness.identities.analyst, true);
    assert.equal(noToken.status, 401, "REPORT_EXPORT_NO_TOKEN_NOT_401");
  });

  assert.deepEqual(exportEvents(events), [], "A_REPORT_EXPORT_POLICY_REFUSAL_WROTE_AN_EXPORT_EVENT");
  assert.deepEqual(await readReportFigures(harness, "risk-exposure"), before, "A_REFUSED_REPORT_EXPORT_CHANGED_A_FIGURE");
});

/*
 * 19-10 (D-14, D-15, D-21; ROADMAP Phase 19 criterion 2): the released assessment leaves CSRM as a file through the one
 * record-read check (released-assessment-read.ts). Its tables are the released reads' own projections: the detail, the
 * risks read (active Risks only) and the control-implementation read of each of those Risks. Jane's released
 * assessment was drafted with AI and holds two active Risks and a withdrawn one; she also has an unreleased assessment.
 */
const RELEASED_PREFIX = "EXPREL";
const RELEASED_NUMBER = `ASM-2026-${RELEASED_PREFIX}1`;
const UNRELEASED_NUMBER = `ASM-2026-${RELEASED_PREFIX}2`;
const RELEASED_TITLE = "Export released payroll request";
const RELEASED_WITHDRAWN_RISK = `RSK-${RELEASED_PREFIX}-003`;
/** Phase 12 §10.1's notice, the About sheet's AI assistance row when the released read says AI assisted. */
const RELEASED_AI_NOTICE = "AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.";
const RELEASED_SUMMARY_LABELS = ["Assessment", "Request", "Request title", "Released", "Released by", "Overall rating", "Overall control effectiveness", "Summary", "Overall rationale", "Recommendations", "Next review date"];
const RELEASED_RISK_LABELS = ["Risk", "Risk statement", "Inherent rating", "Residual rating", "Treatment", "Treatment plan", "Risk owner", "Treatment owner", "Target date", "Treatment status"];
const RELEASED_MITIGATION_LABELS = ["Risk", "Control number", "Control", "Status", "Effectiveness"];

type ReleasedFixture = { assessmentId: string; unreleasedId: string; withdrawnRiskId: string };

let releasedFixture: Promise<ReleasedFixture> | null = null;

function seedReleasedExportFixture(harness: AuthorizationHttpHarness): Promise<ReleasedFixture> {
  releasedFixture ??= (async () => {
    const library = await harness.seedUatALikeFixture();
    const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      requestNumber: `REQ-${RELEASED_PREFIX}-001`, title: RELEASED_TITLE, requestStatus: "approved", requestor: harness.users.owner,
    });
    const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: RELEASED_NUMBER,
      assessmentStatus: "approved",
      // 22:30 UTC on 30 August is 31 August in Sydney: the Released cell is the viewer's local date.
      approvalDate: "2026-08-30T22:30:00.000Z",
      assessmentDate: "2026-08-30T22:30:00.000Z",
      approvedBy: harness.users.analyst,
      reviewedBy: harness.users.analyst,
      // Drafted with AI: the released read says only that AI assisted.
      generatedBy: harness.users.analyst,
      generatedDate: "2026-08-20T00:00:00.000Z",
      providerName: "deterministic-assessment-draft",
      providerVersion: "1",
      summary: "=HYPERLINK(\"https://example.test\",\"Payroll exposure\")",
      overallRating: "High",
      overallControlEffectiveness: "Partially Effective",
      recommendationsSummary: "Review payroll access each quarter",
      overallRiskRationale: "Internet-facing payroll processing",
      nextReviewDate: "2027-02-01",
      assessmentRequest: requestId,
    });
    const treated = await harness.createRiskRegisterFixture(assessmentId, {
      riskNumber: `RSK-${RELEASED_PREFIX}-001`,
      riskStatement: "Payroll records could be changed without approval",
      riskType: library.riskTypeIds[0],
      inherentRating: "High",
      residualRating: "Moderate",
      treatmentAction: "Treat",
      treatmentPlan: "Add a second approval to payroll changes",
      treatmentStatus: "In Progress",
      riskOwner: harness.users.owner,
      treatmentOwner: harness.users.analyst,
      targetDate: "2026-12-01",
    });
    await harness.createRiskRegisterFixture(assessmentId, { riskNumber: `RSK-${RELEASED_PREFIX}-002`, riskStatement: "Payroll exports are emailed in clear text", residualRating: "Low" });
    const withdrawnRiskId = await harness.createRiskRegisterFixture(assessmentId, {
      riskNumber: RELEASED_WITHDRAWN_RISK,
      riskStatement: "Withdrawn payroll duplicate",
      residualRating: "Critical",
      withdrawnAt: "2026-08-29T00:00:00.000Z",
      withdrawnBy: harness.users.analyst,
      withdrawalReason: "Raised twice by mistake",
    });
    await harness.createRiskRegisterMitigationFixture(treated, library.controlIds[0], "Implemented", { effectivenessRating: "Effective" });
    await harness.createRiskRegisterMitigationFixture(treated, library.controlIds[1], "Planned");
    // A withdrawn Risk's mitigation control is never in the file: its Risk is not in the released read.
    await harness.createRiskRegisterMitigationFixture(withdrawnRiskId, library.controlIds[2], "Implemented", { effectivenessRating: "Ineffective" });

    const unreleasedRequest = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      requestNumber: `REQ-${RELEASED_PREFIX}-002`, title: "Export unreleased payroll request", requestStatus: "under-review", requestor: harness.users.owner,
    });
    const unreleasedId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: UNRELEASED_NUMBER, assessmentStatus: "in-review", summary: "Export unreleased summary", assessmentRequest: unreleasedRequest,
    });
    await harness.createRiskRegisterFixture(unreleasedId, { riskNumber: `RSK-${RELEASED_PREFIX}-004`, riskStatement: "Unreleased payroll risk" });
    return { assessmentId, unreleasedId, withdrawnRiskId };
  })();
  return releasedFixture;
}

function releasedExportPath(assessmentId: string): string {
  return `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/export`;
}

/** The released assessment export as `identity`; `null` sends no identity at all. */
function exportReleasedAs(harness: AuthorizationHttpHarness, assessmentId: string, query: string, identity: string | null, omitApiToken = false): Promise<Response> {
  return harness.request({ path: `${releasedExportPath(assessmentId)}?${query}`, identity: identity ?? undefined, omitApiToken });
}

async function readData(harness: AuthorizationHttpHarness, path: string, identity: string): Promise<unknown> {
  const response = await harness.request({ path, identity });
  assert.equal(response.status, 200, `RELEASED_READ_FAILED_${path}: ${await response.clone().text()}`);
  return ((await response.json()) as { data: unknown }).data;
}

/** Jane's three released reads of the assessment, as the tables the export writes (dates as the UTC calendar date). */
async function releasedTablesAsRead(harness: AuthorizationHttpHarness, assessmentId: string): Promise<{ summary: string[][]; risks: string[][]; mitigation: string[][]; aiAssisted: boolean; heading: string }> {
  const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  const person = (value: unknown) => text((value as { displayName?: string } | null)?.displayName);
  const detail = await readData(harness, `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.owner) as Json;
  const request = detail.assessmentRequest as Json;
  const risks = await readData(harness, `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risks`, harness.identities.owner) as Json[];
  const mitigation: string[][] = [RELEASED_MITIGATION_LABELS];
  for (const risk of risks) {
    const implementations = await readData(harness, `/api/v1/risks/${encodeURIComponent(String(risk.documentId))}/control_implementations`, harness.identities.owner) as Json[];
    for (const implementation of implementations) {
      const control = implementation.controlSummary as Json | null;
      mitigation.push([text(risk.riskNumber), text(control?.controlNumber), text(control?.name), text(implementation.controlStatus), text(implementation.effectivenessRating)]);
    }
  }
  return {
    heading: `${text(detail.assessmentNumber)} · ${text(request.title)}`,
    aiAssisted: detail.aiAssisted === true,
    summary: [RELEASED_SUMMARY_LABELS, [
      text(detail.assessmentNumber), text(request.requestNumber), text(request.title), text(detail.approvalDate).slice(0, 10), person(detail.approvedBy),
      text(detail.overallRating), text(detail.overallControlEffectiveness), text(detail.summary), text(detail.overallRiskRationale),
      text(detail.recommendationsSummary), text(detail.nextReviewDate),
    ]],
    risks: [RELEASED_RISK_LABELS, ...risks.map((risk) => [
      text(risk.riskNumber), text(risk.riskStatement), text(risk.inherentRating), text(risk.residualRating), text(risk.treatmentAction),
      text(risk.treatmentPlan), person(risk.riskOwner), person(risk.treatmentOwner), text(risk.targetDate), text(risk.treatmentStatus),
    ])],
    mitigation,
  };
}

/** A workbook sheet as text, each row as wide as its header, dates as the calendar date the cell holds. */
function sheetText(sheet: { readonly rows: readonly (readonly XlsxCell[])[] }): string[][] {
  const width = sheet.rows[0]?.length ?? 0;
  return sheet.rows.map((row) => Array.from({ length: width }, (_, index) => xlsxCellText(row[index] ?? null)));
}

/** A table's rows as a workbook stores them: a formula-like text starts with an apostrophe (D-36). */
function neutralised(rows: string[][]): string[][] {
  return rows.map((row) => row.map((cell) => (/^[=+\-@\t\r\n]/.test(cell) ? `'${cell}` : cell)));
}

test("released-assessment: Jane exports her released assessment as Summary, Risks and Mitigation controls equal to her released reads, with no withdrawn Risk, the AI notice and one log line", async () => {
  const harness = await harnessPromise;
  const fixture = await seedReleasedExportFixture(harness);
  const jane = await displayNameOf(harness, harness.users.owner);
  const expected = await releasedTablesAsRead(harness, fixture.assessmentId);
  assert.equal(expected.risks.length, 3, "RELEASED_FIXTURE_NOT_TWO_ACTIVE_RISKS");
  assert.equal(expected.mitigation.length, 3, "RELEASED_FIXTURE_NOT_TWO_ACTIVE_IMPLEMENTATIONS");
  assert.equal(expected.aiAssisted, true, "RELEASED_FIXTURE_NOT_AI_ASSISTED");
  const rowCount = expected.risks.length - 1 + expected.mitigation.length - 1;

  const { result: response, events } = await withSecurityEvents(harness, () => exportReleasedAs(harness, fixture.assessmentId, "format=xlsx", harness.identities.owner));
  const bytes = await fileOf(response, "RELEASED_XLSX");
  assertReportFileHeaders(response, XLSX, localDates("UTC").map((day) => `${RELEASED_NUMBER.toLowerCase()}-risk-assessment-${day}.xlsx`), rowCount, "RELEASED_XLSX");
  const sheets = await readExportWorkbook(bytes);
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Summary", "Risks", "Mitigation controls", "About this export"], "RELEASED_SHEETS");
  assert.deepEqual(sheetText(sheets[0]), neutralised(expected.summary), "RELEASED_SUMMARY_NOT_THE_RELEASED_DETAIL");
  assert.deepEqual(sheetText(sheets[1]), neutralised(expected.risks), "RELEASED_RISKS_NOT_THE_RELEASED_RISKS_READ");
  assert.deepEqual(sheetText(sheets[2]), neutralised(expected.mitigation), "RELEASED_MITIGATION_NOT_THE_RELEASED_CONTROL_READS");
  // The summary text is formula-like: it is written as text, never as a formula element.
  assert.doesNotMatch(readSheetXml(bytes, "xl/worksheets/sheet1.xml"), /<f[\s>]/, "RELEASED_SUMMARY_WRITTEN_AS_A_FORMULA");
  for (const sheet of sheets) {
    assert.ok(!JSON.stringify(sheet.rows).includes(RELEASED_WITHDRAWN_RISK), `RELEASED_FILE_HOLDS_THE_WITHDRAWN_RISK_${sheet.name}`);
  }

  const about = new Map(sheets[3].rows.map((row) => [String(row[0]), row[1]]));
  assert.equal(about.get("View"), expected.heading, "RELEASED_ABOUT_VIEW");
  assert.equal(about.get("Rows"), rowCount, "RELEASED_ABOUT_ROWS");
  assert.equal(about.get("Exported by"), jane);
  assert.equal(about.get("AI assistance"), RELEASED_AI_NOTICE, "RELEASED_ABOUT_AI_NOTICE");
  assert.equal(about.has("Columns"), false, "A_RELEASED_EXPORT_NAMES_COLUMNS");

  const exported = exportEvents(events);
  assert.equal(exported.length, 1, `RELEASED_EVENTS: ${JSON.stringify(exported)}`);
  const [{ event }] = exported;
  assert.equal(event.event, "export.completed");
  assert.equal(event.view, "released-assessment");
  assert.deepEqual(event.subject, { kind: "risk-assessment", documentId: fixture.assessmentId });
  assert.equal(event.format, "xlsx");
  assert.equal(event.table, null);
  assert.deepEqual(event.columns, []);
  assert.equal(event.rowCount, rowCount);
  assert.deepEqual(event.actor, { documentId: harness.users.owner, displayName: jane });
});

/*
 * 19-10 (D-15, D-16, D-18): who may not export a released assessment. A Requestor who may not read the released record
 * gets the refusal a missing record gets, and a 404 stays in the request log, never an export event. The analyst can
 * read an unreleased assessment, so it is refused for what it is: 409 ASSESSMENT_NOT_RELEASED, logged.
 */
test("released-assessment: another Requestor at Jane's released assessment and Jane at her own unreleased one get the missing record's 404, with no file and no export event", async () => {
  const harness = await harnessPromise;
  const fixture = await seedReleasedExportFixture(harness);

  const { events } = await withSecurityEvents(harness, async () => {
    const missing = await exportReleasedAs(harness, "no-such-assessment", "format=xlsx", harness.identities.otherRequestor);
    assert.equal(missing.status, 404, "RELEASED_MISSING_RECORD_NOT_404");
    const missingBody = await missing.json();
    for (const [label, assessmentId, identity] of [
      ["SECONDARY_REQUESTOR_AT_JANES_RELEASE", fixture.assessmentId, harness.identities.otherRequestor],
      ["JANE_AT_HER_UNRELEASED_ASSESSMENT", fixture.unreleasedId, harness.identities.owner],
    ] as const) {
      for (const query of ["format=xlsx", "format=csv&table=risks"]) {
        const response = await exportReleasedAs(harness, assessmentId, query, identity);
        assert.equal(response.status, 404, `${label}_NOT_404_${query}`);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/, `${label}_NOT_JSON`);
        assert.equal(response.headers.get("content-disposition"), null, `${label}_SENT_A_FILE`);
        const text = await response.text();
        assert.deepEqual(JSON.parse(text), missingBody, `${label}_NOT_THE_MISSING_RECORD_BODY`);
        assert.doesNotMatch(text, new RegExp(`${RELEASED_PREFIX}|payroll`, "i"), `${label}_DISCLOSES`);
      }
    }
  });
  assert.deepEqual(exportEvents(events), [], "A_RELEASED_404_WROTE_AN_EXPORT_EVENT");
});

test("released-assessment: Bob's export of an unreleased assessment is 409 ASSESSMENT_NOT_RELEASED with one export.refused line", async () => {
  const harness = await harnessPromise;
  const fixture = await seedReleasedExportFixture(harness);

  for (const query of ["format=xlsx", "format=csv&table=mitigation-controls"]) {
    const { result: response, events } = await withSecurityEvents(harness, () => exportReleasedAs(harness, fixture.unreleasedId, query, harness.identities.analyst));
    assert.equal(response.status, 409, `ASSESSMENT_NOT_RELEASED_NOT_409_${query}`);
    assert.equal(response.headers.get("content-disposition"), null, "AN_UNRELEASED_EXPORT_SENT_A_FILE");
    const error = await errorOf(response);
    assert.equal((error.details as Json | undefined)?.reason, "ASSESSMENT_NOT_RELEASED", `ASSESSMENT_NOT_RELEASED_REASON_${query}`);
    const refused = exportEvents(events);
    assert.equal(refused.length, 1, `ASSESSMENT_NOT_RELEASED_EVENTS: ${JSON.stringify(refused)}`);
    assert.equal(refused[0].event.event, "export.refused");
    assert.equal(refused[0].event.reason, "ASSESSMENT_NOT_RELEASED");
    assert.equal(refused[0].event.view, "released-assessment");
    assert.deepEqual(refused[0].event.subject, { kind: "risk-assessment", documentId: fixture.unreleasedId });
    assert.equal(refused[0].event.rowCount, null);
  }

  // An assessment that does not exist is the analyst read's 404, not a refusal of an unreleased record.
  const { result: missing, events: missingEvents } = await withSecurityEvents(harness, () => exportReleasedAs(harness, "no-such-assessment", "format=xlsx", harness.identities.analyst));
  assert.equal(missing.status, 404, "ANALYST_MISSING_ASSESSMENT_NOT_404");
  assert.deepEqual(exportEvents(missingEvents), [], "ANALYST_MISSING_ASSESSMENT_LOGGED");
});

/** A workbook's sheets as text, the About sheet without the two rows that name who exported it and when. */
function comparableWorkbook(sheets: readonly { readonly name: string; readonly rows: readonly (readonly XlsxCell[])[] }[]): unknown[] {
  return sheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.name === "About this export" ? sheetText(sheet).filter((row) => row[0] !== "Exported by" && row[0] !== "Exported") : sheetText(sheet),
  }));
}

test("released-assessment: Bob's export of Jane's released assessment holds the same tables as Jane's, sheet by sheet and cell by cell, its Mitigation controls only the active Risks' implementations", async () => {
  const harness = await harnessPromise;
  const fixture = await seedReleasedExportFixture(harness);
  const bob = await displayNameOf(harness, harness.users.analyst);

  const files = new Map<string, Awaited<ReturnType<typeof readExportWorkbook>>>();
  for (const [label, identity] of [["JANE", harness.identities.owner], ["BOB", harness.identities.analyst]] as const) {
    const { result: response, events } = await withSecurityEvents(harness, () => exportReleasedAs(harness, fixture.assessmentId, "format=xlsx&timeZone=Australia/Sydney", identity));
    const sheets = await readExportWorkbook(await fileOf(response, `RELEASED_${label}_XLSX`));
    assertReportFileHeaders(response, XLSX, localDates("Australia/Sydney").map((day) => `${RELEASED_NUMBER.toLowerCase()}-risk-assessment-${day}.xlsx`), 4, `RELEASED_${label}_XLSX`);
    files.set(label, sheets);
    const exported = exportEvents(events);
    assert.equal(exported.length, 1, `RELEASED_${label}_EVENTS: ${JSON.stringify(exported)}`);
    assert.equal(exported[0].event.event, "export.completed");
    assert.deepEqual(exported[0].event.subject, { kind: "risk-assessment", documentId: fixture.assessmentId });
  }
  const jane = files.get("JANE") ?? [];
  const analyst = files.get("BOB") ?? [];
  assert.deepEqual(comparableWorkbook(analyst), comparableWorkbook(jane), "RELEASED_ANALYST_FILE_NOT_THE_SAME_TABLES");
  assert.equal(new Map(analyst[3].rows.map((row) => [String(row[0]), row[1]])).get("Exported by"), bob, "RELEASED_ANALYST_FILE_EXPORTED_BY");
  // The Released date is the viewer's local date: 22:30 UTC on 30 August is 31 August in Sydney.
  assert.equal(xlsxCellText(jane[0].rows[1][3] ?? null), "2026-08-31", "RELEASED_DATE_NOT_LOCAL");
  const mitigation = sheetText(analyst[2]);
  assert.equal(mitigation.length, 3, "RELEASED_ANALYST_MITIGATION_NOT_THE_ACTIVE_RISKS_TWO");
  assert.ok(mitigation.slice(1).every((row) => row[0] === `RSK-${RELEASED_PREFIX}-001`), "RELEASED_ANALYST_MITIGATION_HOLDS_ANOTHER_RISK");
  assert.ok(!JSON.stringify(analyst).includes(RELEASED_WITHDRAWN_RISK), "RELEASED_ANALYST_FILE_HOLDS_THE_WITHDRAWN_RISK");
});

test("released-assessment: each record table exports alone as a CSV; CSV without a table, XLSX with one, the Summary table, columns, an unknown key or format are 400 with one export.refused line", async () => {
  const harness = await harnessPromise;
  const fixture = await seedReleasedExportFixture(harness);
  const expected = await releasedTablesAsRead(harness, fixture.assessmentId);

  for (const [table, slug, rows] of [["risks", "risks", expected.risks], ["mitigation-controls", "mitigation-controls", expected.mitigation]] as const) {
    for (const [label, identity] of [["JANE", harness.identities.owner], ["BOB", harness.identities.analyst]] as const) {
      const { result: response, events } = await withSecurityEvents(harness, () => exportReleasedAs(harness, fixture.assessmentId, `format=csv&table=${table}`, identity));
      const csv = readExportCsv(await fileOf(response, `RELEASED_CSV_${table}_${label}`));
      assertReportFileHeaders(response, CSV, localDates("UTC").map((day) => `${RELEASED_NUMBER.toLowerCase()}-${slug}-${day}.csv`), rows.length - 1, `RELEASED_CSV_${table}_${label}`);
      assert.deepEqual(csv, neutralised(rows), `RELEASED_CSV_NOT_THE_TABLE_${table}_${label}`);
      const exported = exportEvents(events);
      assert.equal(exported.length, 1, `RELEASED_CSV_EVENTS_${table}_${label}`);
      assert.equal(exported[0].event.table, table);
      assert.equal(exported[0].event.format, "csv");
    }
  }

  for (const [label, query] of [
    ["CSV_WITHOUT_TABLE", "format=csv"],
    ["XLSX_WITH_TABLE", "format=xlsx&table=risks"],
    ["SUMMARY_TABLE", "format=csv&table=summary"],
    ["UNKNOWN_TABLE", "format=csv&table=controls"],
    ["COLUMNS", "format=xlsx&columns=riskNumber"],
    ["COLUMNS_ON_CSV", "format=csv&table=risks&columns=riskNumber"],
    ["UNKNOWN_KEY", "format=xlsx&page=1"],
    ["UNKNOWN_FORMAT", "format=pdf"],
    ["MISSING_FORMAT", "timeZone=UTC"],
    ["UNKNOWN_ZONE", "format=xlsx&timeZone=Mars/Base"],
  ] as const) {
    const { result: response, events } = await withSecurityEvents(harness, () => exportReleasedAs(harness, fixture.assessmentId, query, harness.identities.owner));
    assert.equal(response.status, 400, `INVALID_RELEASED_EXPORT_ADMITTED_${label}`);
    const error = await errorOf(response);
    assert.equal(error.message, "CSRM export query is invalid.", `INVALID_RELEASED_EXPORT_MESSAGE_${label}`);
    assert.equal((error.details as Json | undefined)?.reason, undefined, `INVALID_RELEASED_EXPORT_NAMES_A_REASON_${label}`);
    const refused = exportEvents(events);
    assert.equal(refused.length, 1, `INVALID_RELEASED_EXPORT_EVENTS_${label}: ${JSON.stringify(refused)}`);
    assert.equal(refused[0].event.event, "export.refused", label);
    assert.equal(refused[0].event.reason, "INVALID_QUERY", label);
    assert.equal(refused[0].event.view, "released-assessment", label);
    assert.deepEqual(refused[0].event.subject, { kind: "risk-assessment", documentId: fixture.assessmentId }, label);
  }
});

const RELEASED_EXPORT_FUNCTION = "Risk Assessment Export API";

test("released-assessment: the service agent (even when its role is granted the export) and no identity are 403 in the exports' automation words, and no token is 401", async () => {
  const harness = await harnessPromise;
  const fixture = await seedReleasedExportFixture(harness);
  const config = await mountedPolicyConfig(harness, "csrm-assessment", "GET", "/v1/risk_assessments/:assessmentId/export");
  const refusedOverHttp = async (label: string, identity: string | null) => {
    const response = await exportReleasedAs(harness, fixture.assessmentId, "format=xlsx", identity);
    assert.equal(response.status, 403, `RELEASED_${label}_NOT_REFUSED`);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/, `RELEASED_${label}_REFUSAL_NOT_JSON`);
    assert.doesNotMatch(await response.text(), new RegExp(`${RELEASED_PREFIX}|payroll`, "i"), `RELEASED_${label}_REFUSAL_DISCLOSES`);
  };

  const { events } = await withSecurityEvents(harness, async () => {
    // The agent holds the export through its Requestor birthright; the refusal set refuses it whatever it holds.
    await refusedOverHttp("SERVICE_AGENT", harness.identities.serviceAnalystAgent);
    const wording = await policyRefusal(harness, config, harness.users.serviceAnalystAgent);
    assert.equal(wording, "CSRM exports are refused to automation identities.", "RELEASED_AGENT_WORDING");
    assert.notEqual(wording, GOVERNANCE_WORDING);
    await withRoleGrantedFunction(harness, "Security Analyst Agent", RELEASED_EXPORT_FUNCTION, async () => {
      await refusedOverHttp("GRANTED_SERVICE_AGENT", harness.identities.serviceAnalystAgent);
      const granted = await policyRefusal(harness, config, harness.users.serviceAnalystAgent);
      assert.equal(granted, "CSRM exports are refused to automation identities.", "RELEASED_GRANTED_AGENT_WORDING");
      assert.notEqual(granted, GOVERNANCE_WORDING);
    });
    await refusedOverHttp("NO_IDENTITY", null);
    const noToken = await exportReleasedAs(harness, fixture.assessmentId, "format=xlsx", harness.identities.owner, true);
    assert.equal(noToken.status, 401, "RELEASED_NO_TOKEN_NOT_401");
  });
  assert.deepEqual(exportEvents(events), [], "A_RELEASED_POLICY_REFUSAL_WROTE_AN_EXPORT_EVENT");

  // Every person holding the grant passes the policy; the record-read check then decides what each may export.
  for (const user of [harness.users.owner, harness.users.otherRequestor, harness.users.analyst]) {
    assert.equal(await policyRefusal(harness, config, user), null, `RELEASED_POLICY_REFUSED_${user}`);
  }
  assert.equal(config.underlyingRead, "GET:/api/v1/risk_assessments/{assessmentId}", "RELEASED_EXPORT_UNDERLYING_READ");
});

/*
 * 19-10 (D-04, D-05, D-13; Phase 16 D-13): the two assessment lists export whole in their viewer's scope, through the
 * lists' own parser, order and projection, each row's Risks and Highest residual rating from the lists' active-risk-ruled
 * aggregate. Jane has two released assessments (one with two active Risks and a withdrawn Critical one) and one in
 * review; the Secondary Requestor and Bob each raised one released assessment.
 */
const RISK_ASSESSMENTS_EXPORT = "/api/v1/risk_assessments/export";
const MY_RISK_ASSESSMENTS_EXPORT = "/api/v1/my_risk_assessments/export";
const LIST_PREFIX = "EXPLIST";
const RISK_ASSESSMENT_LABELS = ["Assessment", "Request title", "Status", "Risks", "Highest residual rating", "Draft initiated by", "Released"];
const MY_RISK_ASSESSMENT_LABELS = ["Assessment", "Request title", "Overall rating", "Released"];
/** The assessment status words the web shows (statusLabel('assessment', …)), restated here. */
const ASSESSMENT_STATUS_WORDS: Readonly<Record<string, string>> = { draft: "Draft", "in-review": "In review", approved: "Released", closed: "Closed" };
const LIST_RISKED = `ASM-2026-${LIST_PREFIX}1`;

let listFixture: Promise<void> | null = null;

function seedAssessmentListExportFixture(harness: AuthorizationHttpHarness): Promise<void> {
  listFixture ??= (async () => {
    const assessment = async (suffix: string, requestor: string, rating: string, approvalDate: string | null) => {
      const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: `REQ-${LIST_PREFIX}-${suffix}`, title: `Export list request ${suffix}`, requestStatus: approvalDate ? "approved" : "under-review", requestor,
      });
      return harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
        assessmentNumber: `ASM-2026-${LIST_PREFIX}${suffix}`,
        assessmentStatus: approvalDate ? "approved" : "in-review",
        overallRating: rating,
        summary: `Export list assessment ${suffix}`,
        generatedBy: harness.users.analyst,
        generatedDate: "2026-06-01T00:00:00.000Z",
        assessmentRequest: requestId,
        ...(approvalDate ? { approvalDate, assessmentDate: approvalDate, approvedBy: harness.users.analyst } : {}),
      });
    };
    const risked = await assessment("1", harness.users.owner, "High", "2026-07-10T03:00:00.000Z");
    await harness.createRiskRegisterFixture(risked, { riskNumber: `RSK-${LIST_PREFIX}-001`, riskStatement: "Export list moderate risk", residualRating: "Moderate" });
    await harness.createRiskRegisterFixture(risked, { riskNumber: `RSK-${LIST_PREFIX}-002`, riskStatement: "Export list high risk", residualRating: "High" });
    await harness.createRiskRegisterFixture(risked, {
      riskNumber: `RSK-${LIST_PREFIX}-003`, riskStatement: "Export list withdrawn critical risk", residualRating: "Critical",
      withdrawnAt: "2026-07-01T00:00:00.000Z", withdrawnBy: harness.users.analyst, withdrawalReason: "Duplicate of another Risk",
    });
    await assessment("2", harness.users.owner, "Low", "2026-09-05T03:00:00.000Z");
    await assessment("3", harness.users.owner, "Moderate", null);
    await assessment("4", harness.users.otherRequestor, "Moderate", "2026-08-01T03:00:00.000Z");
    await assessment("5", harness.users.analyst, "Critical", "2026-08-15T03:00:00.000Z");
  })();
  return listFixture;
}

/** An analyst list item as the default columns write it (no timeZone: Released is the UTC calendar date). */
function riskAssessmentRow(item: Json): string[] {
  const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  return [
    text(item.assessmentNumber), text(item.requestTitle), ASSESSMENT_STATUS_WORDS[String(item.assessmentStatus)], text(item.riskCount),
    text(item.highestResidualRating), text((item.generatedBy as { displayName?: string } | null)?.displayName), text(item.approvalDate).slice(0, 10),
  ];
}

function myRiskAssessmentRow(item: Json): string[] {
  const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  return [text(item.assessmentNumber), text(item.requestTitle), text(item.overallRating), text(item.approvalDate).slice(0, 10)];
}

test("risk-assessments: Bob's Risk assessments list exports whole as a workbook equal to the list's pages in order, Released for approved and the Risk figures without the withdrawn Risk, with one log line", async () => {
  const harness = await harnessPromise;
  await seedAssessmentListExportFixture(harness);
  const query = `q=${LIST_PREFIX}&sort=assessmentNumber:asc`;
  const list = await readAllPages(harness, "/api/v1/risk_assessments", `${query}&pageSize=2`, "page", harness.identities.analyst);
  assert.equal(list.total, 5, "LIST_FIXTURE_NOT_FIVE_ASSESSMENTS");
  assert.ok(list.pageCount > 1, "LIST_FIXTURE_NOT_PAGED");

  const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, RISK_ASSESSMENTS_EXPORT, `format=xlsx&${query}`, harness.identities.analyst));
  const sheets = await readExportWorkbook(await fileOf(response, "RISK_ASSESSMENTS_XLSX"));
  assertFileHeaders(response, XLSX, "xlsx", list.total, "RISK_ASSESSMENTS_XLSX", "risk-assessments");
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Risk assessments", "About this export"]);
  assert.deepEqual(sheetText(sheets[0]), [RISK_ASSESSMENT_LABELS, ...list.items.map(riskAssessmentRow)], "RISK_ASSESSMENTS_NOT_THE_LIST");
  // Phase 16 D-13: both figures come from the lists' active-risk-ruled aggregate, so the withdrawn Critical Risk sets neither.
  const risked = sheetText(sheets[0]).find((row) => row[0] === LIST_RISKED);
  assert.deepEqual(risked?.slice(2, 5), ["Released", "2", "High"], "RISK_ASSESSMENTS_COUNTED_THE_WITHDRAWN_RISK");
  assert.ok(sheetText(sheets[0]).some((row) => row[2] === "In review"), "RISK_ASSESSMENTS_LACK_THE_UNRELEASED_ASSESSMENT");

  const exported = exportEvents(events);
  assert.equal(exported.length, 1, `RISK_ASSESSMENTS_EVENTS: ${JSON.stringify(exported)}`);
  assert.equal(exported[0].event.event, "export.completed");
  assert.equal(exported[0].event.view, "risk-assessments");
  assert.equal(exported[0].event.search, LIST_PREFIX);
  assert.equal(exported[0].event.rowCount, list.total);
});

test("risk-assessments: the overall rating and released date filters narrow the file as they narrow the list, named on the About sheet", async () => {
  const harness = await harnessPromise;
  await seedAssessmentListExportFixture(harness);
  for (const [label, filter, expected] of [
    ["OVERALL_RATING", "overallRating=High", 1],
    ["RELEASED_RANGE", "approvedFrom=2026-08-01&approvedTo=2026-08-31", 2],
  ] as const) {
    const query = `q=${LIST_PREFIX}&${filter}`;
    const list = await readAllPages(harness, "/api/v1/risk_assessments", `${query}&pageSize=25`, "page", harness.identities.analyst);
    assert.equal(list.total, expected, `RISK_ASSESSMENTS_${label}_FIXTURE`);
    const csv = readExportCsv(await fileOf(await exportAt(harness, RISK_ASSESSMENTS_EXPORT, `format=csv&${query}`, harness.identities.analyst), `RISK_ASSESSMENTS_${label}_CSV`));
    assert.deepEqual(csv, [RISK_ASSESSMENT_LABELS, ...list.items.map(riskAssessmentRow)], `RISK_ASSESSMENTS_${label}_NOT_THE_LIST`);
  }
  const sheets = await readExportWorkbook(await fileOf(await exportAt(harness, RISK_ASSESSMENTS_EXPORT, `format=xlsx&q=${LIST_PREFIX}&overallRating=High&approvedFrom=2026-07-01`, harness.identities.analyst), "RISK_ASSESSMENTS_ABOUT"));
  const about = new Map(sheets[1].rows.map((row) => [String(row[0]), row[1]]));
  assert.equal(about.get("View"), "Risk assessments");
  assert.equal(about.get("Search"), `“${LIST_PREFIX}”`);
  // The chip's date as the list's chip writes it (formatRequestDate: en-AU, day, short month and year, in UTC).
  const chipDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date("2026-07-01T00:00:00.000Z"));
  assert.equal(about.get("Filters"), `Overall rating: High\nReleased from (UTC): ${chipDate}`, "RISK_ASSESSMENTS_ABOUT_FILTERS");
});

test("my-risk-assessments: Jane, the Secondary Requestor and Bob each export their own released assessments only, in the list's order, with one log line each", async () => {
  const harness = await harnessPromise;
  await seedAssessmentListExportFixture(harness);

  const files = new Map<string, Set<string>>();
  for (const [label, identity, user] of [
    ["JANE", harness.identities.owner, harness.users.owner],
    ["SECONDARY_REQUESTOR", harness.identities.otherRequestor, harness.users.otherRequestor],
    ["BOB", harness.identities.analyst, harness.users.analyst],
  ] as const) {
    const list = await readAllPages(harness, "/api/v1/my_risk_assessments", "pageSize=10", "page", identity);
    const { result: response, events } = await withSecurityEvents(harness, () => exportAt(harness, MY_RISK_ASSESSMENTS_EXPORT, "format=csv", identity));
    const rows = readExportCsv(await fileOf(response, `MY_RISK_ASSESSMENTS_${label}`));
    assertFileHeaders(response, CSV, "csv", list.total, `MY_RISK_ASSESSMENTS_${label}`, "my-risk-assessments");
    assert.deepEqual(rows, [MY_RISK_ASSESSMENT_LABELS, ...list.items.map(myRiskAssessmentRow)], `MY_RISK_ASSESSMENTS_${label}_NOT_THE_LIST`);
    files.set(label, new Set(rows.slice(1).map((row) => row[0])));
    const exported = exportEvents(events);
    assert.equal(exported.length, 1, `MY_RISK_ASSESSMENTS_${label}_EVENTS: ${JSON.stringify(exported)}`);
    assert.equal(exported[0].event.view, "my-risk-assessments");
    assert.equal((exported[0].event.actor as Json).documentId, user);
    assert.equal(exported[0].event.rowCount, list.total);
  }
  const jane = files.get("JANE") ?? new Set();
  const other = files.get("SECONDARY_REQUESTOR") ?? new Set();
  const bob = files.get("BOB") ?? new Set();
  assert.ok(jane.has(`ASM-2026-${LIST_PREFIX}1`) && jane.has(`ASM-2026-${LIST_PREFIX}2`), "MY_RISK_ASSESSMENTS_JANE_MISSES_HER_RELEASES");
  assert.equal(jane.has(`ASM-2026-${LIST_PREFIX}3`), false, "MY_RISK_ASSESSMENTS_JANE_HOLDS_HER_UNRELEASED_ASSESSMENT");
  assert.ok(other.has(`ASM-2026-${LIST_PREFIX}4`), "MY_RISK_ASSESSMENTS_SECONDARY_REQUESTOR_MISSES_THEIR_RELEASE");
  assert.ok(bob.has(`ASM-2026-${LIST_PREFIX}5`), "MY_RISK_ASSESSMENTS_BOB_MISSES_HIS_RELEASE");
  for (const number of jane) assert.ok(!other.has(number) && !bob.has(number), `MY_RISK_ASSESSMENTS_DISCLOSES_JANES_${number}`);
  for (const number of other) assert.ok(!jane.has(number) && !bob.has(number), `MY_RISK_ASSESSMENTS_DISCLOSES_THE_SECONDARY_REQUESTORS_${number}`);
});

test("risk-assessments: Jane, the service agent (even when its role is granted the export), Jane mis-granted the export, Bob without the list read and no identity are 403 in the exports' words, and no token is 401", async () => {
  const harness = await harnessPromise;
  await seedAssessmentListExportFixture(harness);
  await assertAnalystExportRefusals(harness, {
    label: "RISK_ASSESSMENTS",
    exportPath: RISK_ASSESSMENTS_EXPORT,
    query: `format=csv&q=${LIST_PREFIX}`,
    apiName: "csrm-assessment",
    routePath: "/v1/risk_assessments/export",
    listRead: "GET:/api/v1/risk_assessments",
    discloses: new RegExp(`${LIST_PREFIX}|Export list`),
  });
});

test("my-risk-assessments: the service agent is refused although its birthright holds the export, in the exports' automation wording; no identity is 403, no token 401, and a page is 400 at both list exports", async () => {
  const harness = await harnessPromise;
  await seedAssessmentListExportFixture(harness);

  const { events } = await withSecurityEvents(harness, async () => {
    for (const [label, identity] of [["SERVICE_AGENT", harness.identities.serviceAnalystAgent], ["NO_IDENTITY", null]] as const) {
      const response = await exportAt(harness, MY_RISK_ASSESSMENTS_EXPORT, "format=csv", identity);
      assert.equal(response.status, 403, `MY_RISK_ASSESSMENTS_${label}_NOT_REFUSED`);
      assert.equal((await errorOf(response)).status, 403, `MY_RISK_ASSESSMENTS_${label}_BODY`);
    }
    const noToken = await exportAt(harness, MY_RISK_ASSESSMENTS_EXPORT, "format=csv", harness.identities.owner, true);
    assert.equal(noToken.status, 401, "MY_RISK_ASSESSMENTS_NO_TOKEN_NOT_401");
  });
  assert.deepEqual(exportEvents(events), [], "MY_RISK_ASSESSMENTS_POLICY_REFUSAL_WROTE_AN_EXPORT_EVENT");

  const config = await mountedPolicyConfig(harness, "csrm-assessment", "GET", "/v1/my_risk_assessments/export");
  const wording = await policyRefusal(harness, config, harness.users.serviceAnalystAgent);
  assert.equal(wording, "CSRM exports are refused to automation identities.", "MY_RISK_ASSESSMENTS_AGENT_WORDING");
  assert.notEqual(wording, GOVERNANCE_WORDING);
  for (const user of [harness.users.owner, harness.users.otherRequestor, harness.users.analyst]) {
    assert.equal(await policyRefusal(harness, config, user), null, `MY_RISK_ASSESSMENTS_POLICY_REFUSED_${user}`);
  }
  assert.equal(config.underlyingRead, "GET:/api/v1/my_risk_assessments", "MY_RISK_ASSESSMENTS_UNDERLYING_READ");

  for (const [label, exportPath, view, identity] of [
    ["MY_PAGE", MY_RISK_ASSESSMENTS_EXPORT, "my-risk-assessments", harness.identities.owner],
    ["ANALYST_PAGE", RISK_ASSESSMENTS_EXPORT, "risk-assessments", harness.identities.analyst],
  ] as const) {
    for (const query of ["format=csv&page=1", "format=csv&pageSize=25", "format=csv&columns=assessmentNumber,unknown", "format=csv&overallRating=Severe"]) {
      const { result: response, events: refusedEvents } = await withSecurityEvents(harness, () => exportAt(harness, exportPath, query, identity));
      assert.equal(response.status, 400, `${label}_NOT_REFUSED_${query}`);
      const refused = exportEvents(refusedEvents);
      assert.equal(refused.length, 1, `${label}_EVENTS_${query}: ${JSON.stringify(refused)}`);
      assert.equal(refused[0].event.reason, "INVALID_QUERY");
      assert.equal(refused[0].event.view, view);
    }
  }
});

/*
 * 19-14 (D-04, D-13, D-33): the four reference lists export in their import shape, the import columns then the list's
 * read-only columns, at GET /api/v1/{segment}/export?format={format}, through the collection's Administration Function
 * and its list read, human Security Analyst only. An exported list, edited and imported again, updates by natural key.
 */
const REFERENCE_PREFIX = `EXPREF${process.pid}`;
const REFERENCE_LISTS = [
  { kind: "risk-types", segment: "risk_types", functionName: "Risk Types" },
  { kind: "controls", segment: "controls", functionName: "Controls" },
  { kind: "information-systems", segment: "information_systems", functionName: "Information Systems" },
  { kind: "information-assets", segment: "information_assets", functionName: "Information Assets" },
] as const;
const REFERENCE_SYSTEM_COUNT = 12;
/** A control number of digits with leading zeros: Excel would read it as 42 unless the cell is text. */
const LEADING_ZERO_CONTROL = `00${process.pid}`;

let referenceFixture: Promise<void> | null = null;

function seedReferenceFixture(harness: AuthorizationHttpHarness): Promise<void> {
  referenceFixture ??= (async () => {
    const create = async (segment: string, body: Json) => {
      const response = await harness.request({ path: `/api/v1/${segment}`, identity: harness.identities.analyst, init: json("POST", body) });
      assert.equal(response.status, 201, `REFERENCE_FIXTURE_${segment}: ${await response.clone().text()}`);
    };
    for (let index = 1; index <= REFERENCE_SYSTEM_COUNT; index += 1) {
      const number = String(index).padStart(2, "0");
      await create("information_systems", {
        name: `${REFERENCE_PREFIX} system ${number}`,
        description: index === 3 ? "=SUM(1,2)" : `System ${number} description`,
        ...(index % 2 === 0 ? { internetFacing: true, environment: "Production", lifecycleState: "Existing" } : { deploymentModel: "SaaS" }),
        ...(index <= 4 ? { owner: harness.users.owner } : {}),
      });
    }
    await create("risk_types", { name: `${REFERENCE_PREFIX} risk type`, description: "Reference risk type" });
    await create("controls", { controlNumber: LEADING_ZERO_CONTROL, name: `${REFERENCE_PREFIX} control`, framework: "Reference framework", controlType: "Detective" });
    await create("information_assets", { name: `${REFERENCE_PREFIX} asset`, dataClassification: "Internal", containsPersonalData: true });
  })();
  return referenceFixture;
}

/*
 * Runs `action` while the Function `functionName` no longer lists the FunctionApi `url` in this test's database, then
 * lists it again. An Administration Function holds both a list read and its export, so withdrawing the Function from
 * the role (withRoleOperationWithdrawn) would withdraw the export too; this leaves the analyst the export alone.
 */
async function withFunctionApiWithdrawn<T>(harness: AuthorizationHttpHarness, functionName: string, url: string, action: () => Promise<T>): Promise<T> {
  type FunctionService = {
    findMany: (query: Json) => Promise<Array<{ documentId: string; functionApis?: Array<{ documentId: string; url: string }> }>>;
    update: (query: { documentId: string; data: Json }) => Promise<unknown>;
  };
  const { functions, grant } = await harness.withBackendFixture(async (backend) => {
    const service = backend.documents("api::function.function") as unknown as FunctionService;
    const [found] = await service.findMany({ filters: { name: { $eq: functionName } }, populate: { functionApis: true }, limit: 1 });
    assert.ok(found, `EXPORT_FUNCTION_FIXTURE_MISSING_${functionName}`);
    return { functions: service, grant: found };
  });
  const held = (grant.functionApis ?? []).map((api) => api.documentId);
  const kept = (grant.functionApis ?? []).filter((api) => api.url !== url).map((api) => api.documentId);
  assert.equal(kept.length, held.length - 1, `THE_FUNCTION_${functionName}_MUST_LIST_${url}`);
  await functions.update({ documentId: grant.documentId, data: { functionApis: kept } });
  try {
    return await action();
  } finally {
    await functions.update({ documentId: grant.documentId, data: { functionApis: held } });
  }
}

function referenceExport(harness: AuthorizationHttpHarness, segment: string, query: string, identity: string | null = harness.identities.analyst, omitApiToken = false): Promise<Response> {
  return exportAt(harness, `/api/v1/${segment}/export`, query, identity, omitApiToken);
}

function referenceHeader(kind: string): string[] {
  return exportViewColumns(kind).map((column) => column.label);
}

/** An Information System as the admin list serves it, as its export row: import columns, flags as Yes/No, then Owner. */
function systemRow(item: Json): string[] {
  // Every text cell passes the neutraliser, so a formula-like value is written with its mark.
  const text = (value: unknown) => (typeof value === "string" ? sanitizeSpreadsheetCell(value) : "");
  const flag = (value: unknown) => (value === true ? "Yes" : value === false ? "No" : "");
  return [
    text(item.name), text(item.description), text(item.systemType), text(item.environment), text(item.deploymentModel),
    text(item.businessCriticality), flag(item.internetFacing), flag(item.externalAccessRequired), text(item.hostingLocation),
    text(item.lifecycleState), text(item.ownerName),
  ];
}

test("reference-lists: Bob's Information Systems list exports as a workbook equal to the admin list's pages in order, its import columns then Owner, with one log line", async () => {
  const harness = await harnessPromise;
  await seedReferenceFixture(harness);
  const list = await readAllPages(harness, "/api/v1/information_systems", `q=${REFERENCE_PREFIX}&sort=name:asc&pageSize=10`, "page", harness.identities.analyst);
  assert.equal(list.total, REFERENCE_SYSTEM_COUNT, "REFERENCE_FIXTURE_SIZE");
  assert.equal(list.pageCount, 2, "the list pages; the export does not");
  const { result: response, events } = await withSecurityEvents(harness, () => referenceExport(harness, "information_systems", `format=xlsx&q=${REFERENCE_PREFIX}&sort=name:asc`, harness.identities.analyst));
  const bytes = await fileOf(response, "REFERENCE_SYSTEMS");
  assertFileHeaders(response, XLSX, "xlsx", REFERENCE_SYSTEM_COUNT, "REFERENCE_SYSTEMS", "information-systems");
  const [sheet, about] = await readExportWorkbook(bytes);
  assert.equal(sheet?.name, "Information Systems");
  assert.equal(about?.name, "About this export");
  const rows = sheetText(sheet!);
  const template = importColumns("information-systems").columns.map((column) => column.label);
  assert.deepEqual(rows[0], [...template, "Owner"], "the import columns (the template's labels) then the read-only Owner");
  assert.deepEqual(rows.slice(1), list.items.map(systemRow), "every system in the admin list's order");
  const jane = await displayNameOf(harness, harness.users.owner);
  assert.equal(rows.slice(1).filter((row) => row[10] === jane).length, 4, "the owner by display name");
  assert.equal(rows.find((row) => row[0] === `${REFERENCE_PREFIX} system 03`)?.[1], "'=SUM(1,2)", "a formula-like value is marked");
  const exported = exportEvents(events);
  assert.equal(exported.length, 1, `REFERENCE_SYSTEMS_EVENTS: ${JSON.stringify(exported)}`);
  assert.equal(exported[0].event.event, "export.completed");
  assert.equal(exported[0].event.view, "information-systems");
  assert.equal(exported[0].event.rowCount, REFERENCE_SYSTEM_COUNT);
  assert.equal((exported[0].event.actor as Json).documentId, harness.users.analyst);
});

test("reference-lists: each reference list exports as a BOM-led CSV with its import columns then its read-only columns, the leading-zero control number as text, and one export.completed line each", async () => {
  const harness = await harnessPromise;
  await seedReferenceFixture(harness);
  for (const list of REFERENCE_LISTS) {
    const query = list.kind === "controls" ? `format=csv&q=${LEADING_ZERO_CONTROL}` : `format=csv&q=${REFERENCE_PREFIX}`;
    const { result: response, events } = await withSecurityEvents(harness, () => referenceExport(harness, list.segment, query, harness.identities.analyst));
    const bytes = await fileOf(response, `REFERENCE_${list.kind}`);
    const records = readExportCsv(bytes);
    assert.equal(response.headers.get("content-type"), CSV, `REFERENCE_${list.kind}_CONTENT_TYPE`);
    const spec = importColumns(list.kind);
    assert.deepEqual(records[0], [...spec.columns.map((column) => column.label), ...spec.readOnlyLabels], `REFERENCE_${list.kind}_HEADER`);
    assert.deepEqual(records[0], referenceHeader(list.kind));
    assertFileHeaders(response, CSV, "csv", records.length - 1, `REFERENCE_${list.kind}`, list.kind);
    assert.ok(records.length > 1, `REFERENCE_${list.kind}_EMPTY`);
    const completed = exportEvents(events);
    assert.deepEqual(completed.map(({ event }) => [event.event, event.view]), [["export.completed", list.kind]], `REFERENCE_${list.kind}_EVENTS`);
  }
  const controls = await referenceExport(harness, "controls", `format=xlsx&q=${LEADING_ZERO_CONTROL}`, harness.identities.analyst);
  const [sheet] = await readExportWorkbook(await fileOf(controls, "REFERENCE_CONTROLS_XLSX"));
  const cell = sheet!.rows[1]![0];
  assert.equal(cell, LEADING_ZERO_CONTROL, "the control number stays text, leading zeros and all");
  const riskTypes = readExportCsv(await fileOf(await referenceExport(harness, "risk_types", `format=csv&q=${REFERENCE_PREFIX}`), "REFERENCE_RISK_TYPES_COUNT"));
  assert.deepEqual(riskTypes[1], [`${REFERENCE_PREFIX} risk type`, "Reference risk type", "0"], "Applicable controls is a count");
});

test("reference-lists: the exported Information Systems workbook, one description edited, imports back: that row updates by name, the rest are unchanged, and Owner is noted as read-only", async () => {
  const harness = await harnessPromise;
  await seedReferenceFixture(harness);
  const response = await referenceExport(harness, "information_systems", `format=xlsx&q=${REFERENCE_PREFIX}`, harness.identities.analyst);
  const [sheet] = await readExportWorkbook(await fileOf(response, "REFERENCE_ROUND_TRIP"));
  const [header, ...rows] = sheetText(sheet!);
  const edited = `${REFERENCE_PREFIX} system 05`;
  const changed = rows.map((row) => (row[0] === edited ? row.map((value, index) => (index === 1 ? "Edited after export" : value)) : row));
  const workbook = await writeWorkbook([{
    name: sheet!.name,
    header: header!,
    // The cells as the person's workbook holds them: the neutraliser's mark comes back off on import, so a marked cell is
    // written as its value.
    rows: changed.map((row) => row.map((value) => (value === "" ? null : { kind: "text" as const, value: value.startsWith("'=") ? value.slice(1) : value }))),
    widths: header!.map(() => 20),
  }]);
  const preview = await harness.request({
    path: "/api/v1/information_systems/import/preview", identity: harness.identities.analyst,
    init: { method: "POST", body: harness.createXlsxMultipart({ filename: "information-systems.xlsx", bytes: workbook }) },
  });
  assert.equal(preview.status, 200, await preview.clone().text());
  const data = ((await preview.json()) as { data: { warnings: string[]; notes: string[]; readOnlyColumns: string[]; rows: Array<{ naturalKey: string; state: string; changes: Array<{ field: string }> }> } }).data;
  assert.deepEqual(data.warnings, [], "no warning");
  assert.deepEqual(data.notes, ["read-only-columns"]);
  assert.deepEqual(data.readOnlyColumns, ["Owner"]);
  for (const row of data.rows) {
    assert.equal(row.state, row.naturalKey === edited ? "update" : "unchanged", `REFERENCE_ROUND_TRIP_${row.naturalKey}: ${JSON.stringify(row.changes)}`);
  }
  assert.deepEqual(data.rows.find((row) => row.naturalKey === edited)?.changes.map(({ field }) => field), ["description"]);
});

/*
 * Validation audit 2026-10-17 (D-11, D-28, D-33): the round trip above writes a marked cell back without its mark. This
 * proves the file exactly as the export wrote it, the neutraliser's mark still on `=SUM(1,2)`, imports back with every
 * row unchanged, in both formats: the import strips the mark it reads, so the stored value is never rewritten as `'=…`.
 */
test("reference-lists: the Information Systems export, imported back byte for byte in CSV and XLSX, previews every row unchanged, the marked formula-like description included", async () => {
  const harness = await harnessPromise;
  await seedReferenceFixture(harness);
  const marked = `${REFERENCE_PREFIX} system 03`;
  for (const format of ["csv", "xlsx"] as const) {
    const response = await referenceExport(harness, "information_systems", `format=${format}&q=${REFERENCE_PREFIX}`, harness.identities.analyst);
    const bytes = await fileOf(response, `REFERENCE_VERBATIM_${format}`);
    if (format === "csv") {
      const records = readExportCsv(bytes);
      assert.equal(records.find((row) => row[0] === marked)?.[1], "'=SUM(1,2)", "the exported CSV carries the mark");
    } else {
      const [sheet] = await readExportWorkbook(bytes);
      assert.equal(sheetText(sheet!).find((row) => row[0] === marked)?.[1], "'=SUM(1,2)", "the exported workbook carries the mark");
    }
    const filename = `information-systems.${format}`;
    const body = format === "csv" ? harness.createCsvMultipart({ filename, bytes }) : harness.createXlsxMultipart({ filename, bytes });
    const preview = await harness.request({ path: "/api/v1/information_systems/import/preview", identity: harness.identities.analyst, init: { method: "POST", body } });
    assert.equal(preview.status, 200, `REFERENCE_VERBATIM_${format}_PREVIEW: ${await preview.clone().text()}`);
    const data = ((await preview.json()) as { data: { warnings: string[]; notes: string[]; rows: Array<{ naturalKey: string; state: string; changes: Array<{ field: string }> }> } }).data;
    assert.deepEqual(data.warnings, [], `REFERENCE_VERBATIM_${format}_WARNINGS`);
    assert.deepEqual(data.notes, ["read-only-columns"], `REFERENCE_VERBATIM_${format}_NOTES`);
    assert.equal(data.rows.length, REFERENCE_SYSTEM_COUNT, `REFERENCE_VERBATIM_${format}_ROWS`);
    for (const row of data.rows) {
      assert.equal(row.state, "unchanged", `REFERENCE_VERBATIM_${format}_${row.naturalKey}: ${JSON.stringify(row.changes)}`);
    }
    assert.ok(data.rows.some((row) => row.naturalKey === marked), `REFERENCE_VERBATIM_${format}_MARKED_ROW_PRESENT`);
  }
});

test("reference-lists: Jane, the service agent (even when its role is granted the Function), Jane mis-granted the Function, Bob without the list read and no identity are 403 in the exports' words at all four exports, and no token is 401", async () => {
  const harness = await harnessPromise;
  await seedReferenceFixture(harness);
  const { events } = await withSecurityEvents(harness, async () => {
    for (const list of REFERENCE_LISTS) {
      const label = `REFERENCE_${list.kind}`;
      const config = await mountedPolicyConfig(harness, "csrm-administration", "GET", `/v1/${list.segment}/export`);
      assert.equal(config.operation, `GET:/api/v1/${list.segment}/export?format={format}`, `${label}_OPERATION`);
      assert.equal(config.underlyingRead, `GET:/api/v1/${list.segment}`, `${label}_UNDERLYING_READ`);
      const refusedOverHttp = async (who: string, identity: string | null) => {
        const response = await referenceExport(harness, list.segment, "format=csv", identity);
        assert.equal(response.status, 403, `${label}_${who}_NOT_REFUSED`);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/, `${label}_${who}_REFUSAL_NOT_JSON`);
        assert.doesNotMatch(await response.text(), new RegExp(REFERENCE_PREFIX), `${label}_${who}_REFUSAL_DISCLOSES`);
      };
      await refusedOverHttp("JANE", harness.identities.owner);
      await refusedOverHttp("SECONDARY_REQUESTOR", harness.identities.otherRequestor);
      await refusedOverHttp("SERVICE_AGENT", harness.identities.serviceAnalystAgent);
      await refusedOverHttp("NO_IDENTITY", null);
      assert.equal(await policyRefusal(harness, config, harness.users.owner), "CSRM FunctionAPI access is denied.", `${label}_JANE_WORDING`);
      await withRoleGrantedFunction(harness, "Security Analyst Agent", list.functionName, async () => {
        await refusedOverHttp("GRANTED_SERVICE_AGENT", harness.identities.serviceAnalystAgent);
        const wording = await policyRefusal(harness, config, harness.users.serviceAnalystAgent);
        assert.equal(wording, "CSRM exports are refused to automation identities.", `${label}_GRANTED_AGENT_WORDING`);
        assert.notEqual(wording, GOVERNANCE_WORDING);
      });
      await withRoleGrantedFunction(harness, "Requestor", list.functionName, async () => {
        await refusedOverHttp("MIS_GRANTED_JANE", harness.identities.owner);
        assert.equal(await policyRefusal(harness, config, harness.users.owner), "CSRM analyst exports require a human Security Analyst.", `${label}_MIS_GRANTED_JANE_WORDING`);
      });
      await withFunctionApiWithdrawn(harness, list.functionName, `GET:/api/v1/${list.segment}`, async () => {
        await refusedOverHttp("ANALYST_WITHOUT_THE_LIST_READ", harness.identities.analyst);
        assert.equal(await policyRefusal(harness, config, harness.users.analyst), "CSRM export requires the list read.", `${label}_UNDERLYING_READ_WORDING`);
      });
      assert.equal(await policyRefusal(harness, config, harness.users.analyst), null, `${label}_BOB_REFUSED_BY_THE_POLICY`);
      const noToken = await referenceExport(harness, list.segment, "format=csv", harness.identities.analyst, true);
      assert.equal(noToken.status, 401, `${label}_NO_TOKEN_NOT_401`);
    }
  });
  assert.deepEqual(exportEvents(events), [], "A_REFERENCE_POLICY_REFUSAL_WROTE_AN_EXPORT_EVENT");
});

test("reference-lists: a page, pageSize, unknown column or format or a filter the list refuses is 400 with one export.refused line, and a template or an error report writes no export event", async () => {
  const harness = await harnessPromise;
  await seedReferenceFixture(harness);
  for (const query of ["format=csv&page=1", "format=csv&pageSize=25", "format=csv&columns=name,unknown", "format=pdf", "format=csv&environment=Mars", "format=csv&sort=owner:asc"]) {
    const { result: response, events } = await withSecurityEvents(harness, () => referenceExport(harness, "information_systems", query, harness.identities.analyst));
    assert.equal(response.status, 400, `REFERENCE_NOT_REFUSED_${query}: ${await response.clone().text()}`);
    const refused = exportEvents(events);
    assert.equal(refused.length, 1, `REFERENCE_EVENTS_${query}: ${JSON.stringify(refused)}`);
    assert.equal(refused[0].event.reason, "INVALID_QUERY");
    assert.equal(refused[0].event.view, "information-systems");
  }
  const { result: template, events } = await withSecurityEvents(harness, () => harness.request({ path: "/api/v1/controls/import/template?format=xlsx", identity: harness.identities.analyst }));
  assert.equal(template.status, 200, await template.clone().text());
  assert.equal(template.headers.get("content-type"), XLSX);
  assert.deepEqual(exportEvents(events), [], "a template is not an export");
});
