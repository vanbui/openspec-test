/** Authored in-memory protocol simulations only; never live connector evidence. */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
const nativeImport = new Function("url", "return import(url)");
const dir = path.resolve(process.cwd(), "../../docker/midpoint/e2e");
const runner = () => nativeImport(pathToFileURL(path.join(dir, "capture-lifecycle.mjs")).href);
const evidence = () => nativeImport(pathToFileURL(path.join(dir, "scim-evidence.mjs")).href);
const runId = "iam-scim-gate-00000000-0000-4000-8000-000000000001";
const oid = (suffix: string) => `11000000-0000-4000-8000-000000000${suffix}`;
const enterprise = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
function caseData() {
  const identity = { oid: oid("901"), name: { orig: "940002" }, personalNumber: "940002" };
  const shadow = { oid: oid("902"), resourceRef: { oid: oid("110") }, correlation: { ownerOptions: { option: [{ identifier: `existing-${identity.oid}` }] } } };
  const c = { oid: oid("903"), name: { orig: "Correlation of account 'maya.requestor' on IdamBox (SCIM)" }, state: "open", targetRef: { oid: shadow.oid }, workItem: [{ id: 1 }] };
  return { cases: { object: { object: [c] } }, c, shadow, identity };
}
async function authored() {
  const { LIFECYCLE_INVOCATIONS } = await evidence();
  const user = { id: "created-user", userName: "lifecycle.iris", active: true, externalId: "940001", title: "Lifecycle Lead", [enterprise]: { department: "Lifecycle Operations" }, emails: [{ value: "lifecycle.mover@idambox.test" }] };
  const manual = { id: "manual-user", userName: "maya.requestor", active: true, emails: [{ value: "maya.requestor@idambox.com" }] };
  const rows: Array<[string, string, string, unknown, number, unknown]> = [
    ["connection", "GET", "/scim/v2/ResourceTypes", null, 200, {}],
    ["initial-import", "POST", "/scim/v2/Users", {}, 201, user],
    ["mover", "PUT", "/scim/v2/Users/created-user", { title: "Lifecycle Lead", [enterprise]: { department: "Lifecycle Operations" } }, 200, user],
    ["mover", "PATCH", "/scim/v2/Users/created-user", { Operations: [{ op: "remove", path: 'emails[value eq "lifecycle.joiner@idambox.test"]' }, { op: "add", path: "emails", value: [{ value: "lifecycle.mover@idambox.test", primary: "true" }] }] }, 200, user],
    ["leaver", "PUT", "/scim/v2/Users/created-user", { active: false }, 200, { ...user, active: false }],
    ["claim-conflict", "POST", "/scim/v2/Users", { userName: "lifecycle.maya", emails: manual.emails }, 409, { status: "409" }],
    ["claim-case", "GET", "/scim/v2/Users/manual-user", null, 200, manual],
    ["claim-confirm", "PUT", "/scim/v2/Users/manual-user", { [enterprise]: { employeeNumber: "940002" } }, 200, { ...manual, externalId: "940002" }],
    ["reconciliation", "GET", "/scim/v2/Users?count=100&startIndex=1", null, 200, { Resources: [user, { ...manual, externalId: "940002" }] }],
    ["reconciliation", "GET", "/scim/v2/Users/manual-user", null, 200, { ...manual, externalId: "940002" }],
  ];
  return rows.map(([scenario, method, url, body, status, response], i) => ({ sequence: i + 1, scenario, origin: "connector", invocation: LIFECYCLE_INVOCATIONS[scenario],
    request: { method, path: url, headers: {}, body }, response: { status, headers: {}, body: response } }));
}

test("Phase 4 offline check validates scripts, pins and exact CSV header", async () => {
  const { check, main } = await runner();
  assert.equal(await check(), true);
  await assert.rejects(main([])); await assert.rejects(main(["--check", "--run"]));
});

test("task completion requires a finish strictly after this trigger and no running execution", async () => {
  const { taskFinished } = await runner();
  const time = Date.parse("2026-10-16T00:00:00Z");
  assert.equal(taskFinished({ executionState: "runnable", lastRunFinishTimestamp: "2026-10-16T00:00:01Z" }, time), true);
  for (const executionState of ["running", "runnable"]) {
    assert.equal(taskFinished({ executionState, lastRunFinishTimestamp: "2026-10-16T00:00:00Z" }, time), false);
    assert.equal(taskFinished({ executionState, lastRunFinishTimestamp: "invalid" }, time), false);
  }
  assert.equal(taskFinished({ executionState: "running", lastRunFinishTimestamp: "2026-10-16T00:00:01Z" }, time), false);
});

test("case decision uses only the unique open case, HR Identity and real owner option", async () => {
  const { selectCase, decisionScript } = await runner();
  const data = caseData(); const decision = selectCase(data.cases, data.shadow, data.identity);
  const script = decisionScript(decision);
  assert.match(script, /<s:pipeline><s:search>/); assert.match(script, /<q:inOid>/);
  assert.match(script, /execute-script/); assert.match(script, /completeWorkItem/); assert.match(script, /1L/);
  for (const mutate of [
    (d: ReturnType<typeof caseData>) => { d.cases.object.object.push(d.c); },
    (d: ReturnType<typeof caseData>) => { d.c.state = "closed"; },
    (d: ReturnType<typeof caseData>) => { d.shadow.resourceRef.oid = oid("100"); },
    (d: ReturnType<typeof caseData>) => { d.shadow.correlation.ownerOptions.option = []; },
    (d: ReturnType<typeof caseData>) => { d.identity.personalNumber = "wrong"; },
    (d: ReturnType<typeof caseData>) => { d.c.workItem.push({ id: 2 }); },
  ]) { const d = caseData(); mutate(d); assert.throws(() => selectCase(d.cases, d.shadow, d.identity)); }
  assert.throws(() => decisionScript({ ...decision, workItemId: "1);bad" }));
});

test("Phase 4 evidence retains conflict, background traffic and declared user ids only", async () => {
  const { evidenceBundle } = await runner(); const { sanitizeEnvelope, verifyEvidence } = await evidence();
  const input = await authored();
  const background = { ...input[0], scenario: "mover", invocation: input[2].invocation };
  input.splice(2, 0, background);
  input.forEach((entry, i) => { entry.sequence = i + 1; });
  const bundle = evidenceBundle(input.map(entry => sanitizeEnvelope(entry, { profile: "phase4" })), runId);
  assert.equal(verifyEvidence(bundle.capture, bundle.manifest, { profile: "phase4" }), true);
  assert.deepEqual(Object.values(bundle.manifest.substitutions), [{ kind: "user-id" }, { kind: "user-id" }]);
  assert.equal(bundle.capture.filter((e: { response: { status: number } }) => e.response.status === 409).length, 1);
  assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest));
  assert.throws(() => sanitizeEnvelope(input[0], { profile: "unknown" }));
});

test("Phase 4 publication refuses every missing required operation and modified contract", async () => {
  const { evidenceBundle } = await runner(); const { verifyEvidence } = await evidence();
  const input = await authored();
  for (let i = 0; i < input.length; i++) {
    const less = input.filter((_, index) => index !== i).map((e, index) => ({ ...e, sequence: index + 1 }));
    assert.throws(() => evidenceBundle(less, runId), `missing ${i}`);
  }
  for (const mutate of [
    (c: typeof input) => { c[2].request.body = { title: "Lifecycle Lead" }; },
    (c: typeof input) => { c[3].request.body = { Operations: [{ op: "add", path: "emails" }, { op: "remove", path: "emails[x]" }] }; },
    (c: typeof input) => { c[4].request.body = { active: true }; },
    (c: typeof input) => { c[5].response.status = 500; },
    (c: typeof input) => { c[7].request.body = { active: true }; },
    (c: typeof input) => { c[8].request.path = "/scim/v2/Users"; },
    (c: typeof input) => { c[2].request.path = "/scim/v2/Users/another-user"; },
    (c: typeof input) => { c[0].request.headers = { accept: "Bearer unregistered-secret" }; },
    (c: typeof input) => { c[0].scenario = "live-sync-baseline"; c[0].request.method = "PUT"; },
  ]) { const c = structuredClone(input); mutate(c); assert.throws(() => evidenceBundle(c, runId)); }
  const bundle = evidenceBundle(input, runId);
  bundle.manifest.substitutions.UNUSED = { kind: "timestamp" };
  assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest, { profile: "phase4" }));
});

function dependencies(entries: unknown[]) {
  const calls: Array<{ method: string; endpoint: string; input: string }> = [];
  const controls: Array<{ action: string; scenario?: string; profile?: string }> = [];
  let lastStage = "";
  const data = caseData();
  const runCommand = async (_program: string, args: string[], options: { input?: string }): Promise<string> => {
    if (args[0] === "inspect") return "idambox/midpoint:4.8.14-scim2-1.2.9";
    if (args.includes("--version")) return "midPoint 4.8.14";
    if (args.includes("/opt/midpoint/connector-bundle/source-commit.txt")) return "05c404bbecf9c28938e2183411c7b04b4f8f4226";
    if (_program === "bash") { assert.ok(lastStage); return "published"; }
    const method = args.at(-3)!; const endpoint = args.at(-2)!;
    calls.push({ method, endpoint, input: options.input ?? "" });
    let response: unknown = null;
    if (endpoint === "/connectors/search") response = { object: { object: [{ connectorVersion: "1.2.9" }] } };
    else if (endpoint.endsWith("/test")) response = { object: { status: "success" } };
    else if (endpoint.endsWith("/run")) assert.ok(lastStage);
    else if (endpoint === "/users/search") response = options.input?.includes("940002") ? { object: { object: [data.identity] } } : { object: { object: [] } };
    else if (endpoint === "/cases/search") response = lastStage === "claim-case" ? data.cases : { object: { object: [] } };
    else if (endpoint.startsWith("/shadows/")) response = data.shadow;
    else if (endpoint.startsWith("/cases/")) response = { state: "closed", workItem: [{ closeTimestamp: "2026-10-16T00:00:02Z" }] };
    else if (endpoint === `/resources/${oid("110")}`) response = { oid: oid("110"), connectorConfiguration: { configurationProperties: { serviceUrl: "http://host.docker.internal:1337/scim/v2", pagination: true, importBatchSize: 100 } } };
    else if (method === "GET") response = { oid: endpoint.split("/").at(-1), executionState: "runnable", lastRunFinishTimestamp: "2026-10-16T00:00:01Z" };
    return `${response ? JSON.stringify(response) : ""}\n200`;
  };
  return { calls, controls, runCommand, now: () => Date.parse("2026-10-16T00:00:00Z"),
    control: async (_socket: string, message: { action: string; scenario?: string; profile?: string }) => {
      controls.push(message); if (message.action === "stage") lastStage = message.scenario!;
      return message.action === "drain" ? entries : true;
    }, transport: async () => new Response(JSON.stringify({ totalResults: 1, Resources: [{ id: "manual-user", active: true, emails: [{ value: "maya.requestor@idambox.com" }] }] })),
  };
}

test("persistent runtime marks ordered stages, runs tasks and decides via RPC without object creation or deletion", async () => {
  const { createRuntime } = await runner(); const { executeStages, LIFECYCLE_SCENARIOS } = await evidence();
  const deps = dependencies(await authored());
  const runtime = createRuntime({ ...deps, runId, token: "authored-only" });
  await executeStages(runtime, { scenarios: LIFECYCLE_SCENARIOS });
  assert.deepEqual(deps.controls.filter(c => c.action === "stage").map(c => c.scenario), LIFECYCLE_SCENARIOS);
  assert.equal(deps.controls[0].profile, "phase4"); assert.equal(deps.controls.at(-1)?.action, "close");
  assert.ok(deps.calls.some(c => c.endpoint === `/tasks/${oid("310")}/run`));
  assert.ok(deps.calls.some(c => c.endpoint === "/rpc/executeScript"));
  assert.equal(deps.calls.some(c => c.method === "DELETE" || (c.method === "POST" && /^\/(resources|users|shadows)$/.test(c.endpoint))), false);
  assert.ok(runtime.evidence().capture.length);
});

test("persistent failures close only the owned capture session and block publication", async () => {
  const { createRuntime } = await runner(); const { executeStages, LIFECYCLE_SCENARIOS } = await evidence();
  for (const failure of ["version", "task", "drain"]) {
    const deps = dependencies(await authored()); const base = deps.runCommand; const ctl = deps.control;
    deps.runCommand = async (program, args, options) => {
      if (failure === "version" && args.includes("--version")) return "4.9.0";
      if (failure === "task" && args.at(-2)?.endsWith("/run")) throw new Error("authored failure");
      return base(program, args, options);
    };
    deps.control = async (socket, message) => { if (failure === "drain" && message.action === "drain") throw new Error("failed drain"); return ctl(socket, message); };
    const runtime = createRuntime({ ...deps, runId, token: "authored-only" });
    await assert.rejects(executeStages(runtime, { scenarios: LIFECYCLE_SCENARIOS }));
    assert.throws(() => runtime.evidence());
    if (failure === "version") assert.equal(deps.controls.length, 0);
    else assert.equal(deps.controls.at(-1)?.action, "close");
    assert.equal(deps.calls.some(c => c.method === "DELETE"), false);
  }
});

test("invalid evidence is refused before creating any output directory", async () => {
  const { persistEvidence, evidenceBundle } = await runner();
  const temp = await mkdtemp(path.join(tmpdir(), "phase4-capture-"));
  try {
    const bundle = evidenceBundle(await authored(), runId); bundle.manifest.cleanup = false;
    await assert.rejects(persistEvidence(bundle, path.join(temp, "evidence")));
    assert.deepEqual(await readdir(temp), []);
  } finally { await rm(temp, { recursive: true, force: true }); }
});


test("persistent resource preflight refuses a different endpoint or disabled connector paging", async () => {
  const { assertResource } = await runner();
  const properties = { 'cfg:serviceUrl': 'http://host.docker.internal:1337/scim/v2', 'cfg:pagination': true, 'cfg:importBatchSize': 100 };
  assert.equal(assertResource({ connectorConfiguration: { configurationProperties: properties } }), true);
  for (const [key, value] of [['cfg:serviceUrl', 'http://developer.test/scim/v2'], ['cfg:pagination', false], ['cfg:importBatchSize', 1]]) {
    assert.throws(() => assertResource({ connectorConfiguration: { configurationProperties: { ...properties, [String(key)]: value } } }));
  }
});


test("manual candidate preflight failure never begins or closes somebody else's session", async () => {
  const { createRuntime } = await runner(); const { executeStages, LIFECYCLE_SCENARIOS } = await evidence();
  const deps = dependencies([]);
  deps.transport = async () => new Response(JSON.stringify({ totalResults: 0, Resources: [] }));
  const runtime = createRuntime({ ...deps, runId, token: 'authored-only' });
  await assert.rejects(executeStages(runtime, { scenarios: LIFECYCLE_SCENARIOS }), /STAGE_FAILED:prepare/);
  assert.deepEqual(deps.controls, []);
  assert.throws(() => runtime.evidence());
});

test("begin refusal never closes a pre-existing capture session", async () => {
  const { createRuntime } = await runner(); const { executeStages, LIFECYCLE_SCENARIOS } = await evidence();
  const deps = dependencies([]); const base = deps.control;
  deps.control = async (socket, message) => { await base(socket, message); if (message.action === 'begin') throw new Error('occupied'); return true; };
  await assert.rejects(executeStages(createRuntime({ ...deps, runId, token: 'authored-only' }), { scenarios: LIFECYCLE_SCENARIOS }));
  assert.deepEqual(deps.controls.map(message => message.action), ['begin']);
});
