/** Authored in-memory envelopes; these tests are never connector capture evidence. */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const nativeImport = new Function("url", "return import(url)");
const directory = path.resolve(process.cwd(), "../../docker/midpoint/e2e");
const evidence = () => nativeImport(pathToFileURL(path.join(directory, "scim-evidence.mjs")).href);

const secret = "authored-secret-only";
function envelope() {
  return { sequence: 1, scenario: "create", origin: "connector", invocation: "POST /shadows",
    request: { method: "POST", path: "/scim/v2/Users", headers: {
      Authorization: `Bearer ${secret}`, Cookie: secret, Accept: "application/json",
      "Content-Type": "application/json", "X-Untrusted": secret },
      body: { userName: "iam-scim-gate-person", password: secret, credentials: { token: secret },
        groups: [], emails: [{ value: "person@idambox.test", primary: true }], active: true } },
    response: { status: 201, headers: { "Content-Type": "application/json", "Set-Cookie": secret },
      body: { id: "user-1", active: true, emails: [{ value: "person@idambox.test", primary: true }] } } };
}

test("authored sanitation removes credentials and non-content headers before persistence", async () => {
  const { sanitizeEnvelope } = await evidence();
  const input = envelope();
  const sanitized = sanitizeEnvelope(input, { secrets: [secret] });
  assert.equal(JSON.stringify(sanitized).includes(secret), false);
  assert.deepEqual(sanitized.request.headers, { accept: "application/json", "content-type": "application/json" });
  assert.deepEqual(sanitized.response.headers, { "content-type": "application/json" });
  assert.deepEqual(sanitized.request.body.emails, input.request.body.emails);
  assert.equal(sanitized.request.body.password, undefined);
  assert.equal(input.request.headers.Authorization, `Bearer ${secret}`);
});

const runner = () => nativeImport(pathToFileURL(path.join(directory, "capture-scim.mjs")).href);

function authoredCapture() {
  const scenarios = ["connection", "lookup", "create", "read", "list", "filter", "page", "mover", "multi-value", "leaver", "delete", "schemas", "config", "groups"];
  const user = { id: "user-1", userName: "iam-scim-gate-person", active: true, title: "Gate Mover",
    emails: [{ value: "gate.mover@idambox.test", primary: true }] };
  const list = { totalResults: 1, itemsPerPage: 1, Resources: [user] };
  const definitions: Record<string, [string, string, unknown, number, unknown]> = {
    connection: ["GET", "/scim/v2/ResourceTypes", null, 200, { totalResults: 2, Resources: [] }],
    lookup: ["GET", '/scim/v2/Users?filter=userName%20eq%20%22iam-scim-gate-person%22', null, 200, { totalResults: 0, Resources: [] }],
    create: ["POST", "/scim/v2/Users", envelope().request.body, 201, user],
    read: ["GET", "/scim/v2/Users/user-1", null, 200, user],
    list: ["GET", "/scim/v2/Users", null, 200, list],
    filter: ["GET", '/scim/v2/Users?filter=userName%20eq%20%22iam-scim-gate-person%22', null, 200, list],
    page: ["GET", "/scim/v2/Users?startIndex=1&count=1", null, 200, list],
    mover: ["PUT", "/scim/v2/Users/user-1", { active: true, title: "Gate Mover", groups: [] }, 200, user],
    "multi-value": ["PATCH", "/scim/v2/Users/user-1", { Operations: [
      { op: "remove", path: 'emails[value eq "gate.joiner@idambox.test"]' },
      { op: "add", path: "emails", value: [{ value: "gate.mover@idambox.test", primary: "true" }] },
    ] }, 200, user],
    leaver: ["PUT", "/scim/v2/Users/user-1", { active: false }, 200, { ...user, active: false }],
    delete: ["DELETE", "/scim/v2/Users/user-1", null, 204, null],
    schemas: ["GET", "/scim/v2/Schemas", null, 200, { totalResults: 3 }],
    config: ["GET", "/scim/v2/ServiceProviderConfig", null, 200, { patch: { supported: true }, filter: { supported: true } }],
    groups: ["GET", "/scim/v2/Groups", null, 200, { totalResults: 0, Resources: [] }],
  };
  return scenarios.map((scenario, index) => {
    const [method, url, body, status, response] = definitions[scenario];
    const direct = ["schemas", "config", "groups"].includes(scenario);
    return { sequence: index + 1, scenario, origin: direct ? "direct-probe" : "connector",
      invocation: ({ connection: "POST /resources/{resource}/test", lookup: "POST /shadows/search", create: "POST /shadows",
        read: "GET /shadows/{shadow}", list: "POST /shadows/search", filter: "POST /shadows/search", page: "POST /shadows/search",
        mover: "PATCH /shadows/{shadow}", "multi-value": "PATCH /shadows/{shadow}", leaver: "PATCH /shadows/{shadow}",
        delete: "DELETE /shadows/{shadow}" } as Record<string, string>)[scenario] ?? `GET ${url}`, request: { method, path: url, body,
        headers: { accept: "application/json" } }, response: { status, body: response, headers: { "content-type": "application/json" } } };
  });
}

async function authoredBundle() {
  const { sanitizeEnvelope, substitute, PIN, COMMAND, SCENARIOS } = await evidence();
  const sanitized = authoredCapture().map((entry) => sanitizeEnvelope(entry, { secrets: [secret] }));
  const result = substitute(sanitized, [{ name: "USER_ID", kind: "user-id", value: "user-1" }]);
  return { capture: result.capture, manifest: { format: 1, provenance: "live-connector", versions: {
    midpoint: PIN.midpoint, connector: PIN.connector, sourceCommit: PIN.sourceCommit }, command: COMMAND,
    runId: "iam-scim-gate-00000000-0000-4000-8000-000000000001", date: "2026-10-16T00:00:00.000Z",
    endpoint: PIN.endpoint, scenarios: [...SCENARIOS], substitutions: result.substitutions, cleanup: true } };
}

test("authored envelopes retain connector spelling, email string primary, partial PUT and ordering", async () => {
  const { verifyEvidence } = await evidence();
  const bundle = await authoredBundle();
  assert.equal(verifyEvidence(bundle.capture, bundle.manifest), true);
  const patch = bundle.capture.find((entry: { scenario: string }) => entry.scenario === "multi-value");
  assert.equal(patch.request.body.Operations[1].value[0].primary, "true");
  assert.equal(bundle.capture.find((entry: { scenario: string }) => entry.scenario === "mover").request.body.emails, undefined);
  assert.equal(bundle.capture[3].request.path, "/scim/v2/Users/{{USER_ID}}");
});

test("authored sanitation refuses secrets in values, escaped query strings and closed metadata", async () => {
  const { sanitizeEnvelope } = await evidence();
  for (const change of [
    (entry: ReturnType<typeof envelope>) => { entry.request.body.userName = secret; },
    (entry: ReturnType<typeof envelope>) => { entry.request.path += `?filter=${encodeURIComponent(secret)}`; },
    (entry: ReturnType<typeof envelope>) => { entry.request.path = "/scim/v2/Users?token=hidden"; },
    (entry: ReturnType<typeof envelope>) => { entry.request.path = "https://elsewhere.test/scim/v2/Users"; },
    (entry: ReturnType<typeof envelope>) => { entry.invocation = secret; },
  ]) {
    const entry = envelope(); change(entry);
    assert.throws(() => sanitizeEnvelope(entry, { secrets: [secret] }));
  }
  assert.throws(() => sanitizeEnvelope({ ...envelope(), extra: secret }));
  const entry = envelope(); entry.request.body.userName = "Bearer unregistered-secret";
  assert.throws(() => sanitizeEnvelope(entry));
});

test("authored evidence rejects every missing scenario, direct lifecycle, unknown versions and invented provenance", async () => {
  const { verifyEvidence, SCENARIOS } = await evidence();
  for (const scenario of SCENARIOS) {
    const bundle = await authoredBundle();
    bundle.capture = bundle.capture.filter((entry: { scenario: string }) => entry.scenario !== scenario)
      .map((entry: object, index: number) => ({ ...entry, sequence: index + 1 }));
    assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest), scenario);
  }
  for (const change of [
    (bundle: Awaited<ReturnType<typeof authoredBundle>>) => { bundle.manifest.provenance = "authored"; },
    (bundle: Awaited<ReturnType<typeof authoredBundle>>) => { bundle.manifest.versions.connector = "unknown"; },
    (bundle: Awaited<ReturnType<typeof authoredBundle>>) => { bundle.manifest.versions.midpoint = "4.9.0"; },
    (bundle: Awaited<ReturnType<typeof authoredBundle>>) => { bundle.manifest.versions.sourceCommit = "unknown"; },
    (bundle: Awaited<ReturnType<typeof authoredBundle>>) => { bundle.manifest.cleanup = false; },
    (bundle: Awaited<ReturnType<typeof authoredBundle>>) => { bundle.capture[2].origin = "direct-probe"; },
    (bundle: Awaited<ReturnType<typeof authoredBundle>>) => { bundle.capture[7].response.body.title = "unchanged"; },
    (bundle: Awaited<ReturnType<typeof authoredBundle>>) => { bundle.capture.reverse(); },
    (bundle: Awaited<ReturnType<typeof authoredBundle>>) => { bundle.manifest.command += ` ${secret}`; },
  ]) {
    const bundle = await authoredBundle(); change(bundle);
    assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest));
  }
});

test("authored page evidence accepts the connector's unpaged list but not partial paging or a filter (P3-36)", async () => {
  const { verifyEvidence } = await evidence();
  const pageOf = (bundle: Awaited<ReturnType<typeof authoredBundle>>) =>
    bundle.capture.find((entry: { scenario: string }) => entry.scenario === "page");
  const unpaged = await authoredBundle();
  pageOf(unpaged).request.path = "/scim/v2/Users";
  assert.equal(verifyEvidence(unpaged.capture, unpaged.manifest), true);
  for (const path of ["/scim/v2/Users?startIndex=1", "/scim/v2/Users?startIndex=1&count=0",
    '/scim/v2/Users?filter=userName%20eq%20%22iam-scim-gate-person%22']) {
    const bundle = await authoredBundle();
    pageOf(bundle).request.path = path;
    assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest), path);
  }
  const empty = await authoredBundle();
  pageOf(empty).response.body = { totalResults: 0, itemsPerPage: 0, Resources: [] };
  assert.throws(() => verifyEvidence(empty.capture, empty.manifest));
});

test("authored substitutions reject undeclared, malformed, duplicate, unused and non-dynamic replacements", async () => {
  const { substitute, verifyEvidence } = await evidence();
  for (const declarations of [
    [{ name: "USER_ID", kind: "user-id", value: "user-1" }, { name: "USER_ID", kind: "user-id", value: "user-2" }],
    [{ name: "UNUSED", kind: "user-id", value: "absent-id" }],
    [{ name: "EMAIL", kind: "email", value: "person@idambox.test" }],
    [{ name: "TIME", kind: "timestamp", value: "not-a-timestamp" }],
  ]) assert.throws(() => substitute(authoredCapture(), declarations));
  for (const marker of ["{{UNKNOWN}}", "{{bad-marker}}"] ) {
    const bundle = await authoredBundle(); bundle.capture[3].request.path = `/scim/v2/Users/${marker}`;
    assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest));
  }
  const bundle = await authoredBundle(); bundle.manifest.substitutions.UNUSED = { kind: "user-id" };
  assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest));
});

test("authored stages have bounded timeouts and cleanup runs after prepare or scenario failure", async () => {
  const { executeStages, SCENARIOS } = await evidence();
  for (const failing of ["prepare", ...SCENARIOS]) {
    const visited: string[] = [];
    await assert.rejects(executeStages({
      prepare: async () => { visited.push("prepare"); if (failing === "prepare") throw new Error(secret); },
      stage: async (scenario: string) => { visited.push(scenario); if (failing === scenario) throw new Error(secret); },
      cleanup: async (signal: AbortSignal) => { assert.equal(signal.aborted, false); visited.push("cleanup"); },
    }, { stageMs: 100, overallMs: 1000, cleanupMs: 100 }), /SCIM_CAPTURE_STAGE_FAILED/);
    assert.equal(visited.at(-1), "cleanup");
    assert.equal(visited.filter((item) => item === "cleanup").length, 1);
  }
  let cleanup = false; let cancelled = false;
  await assert.rejects(executeStages({
    prepare: async () => {},
    stage: (_name: string, signal: AbortSignal) => new Promise((resolve) => {
      signal.addEventListener("abort", () => { cancelled = true; resolve(undefined); }, { once: true });
    }),
    cleanup: async () => { cleanup = true; },
  }, { stageMs: 10, overallMs: 100, cleanupMs: 100 }));
  assert.equal(cleanup, true); assert.equal(cancelled, true);
  await assert.rejects(executeStages({ prepare: async () => {}, stage: async () => {},
    cleanup: () => new Promise(() => {}) }, { stageMs: 100, overallMs: 1000, cleanupMs: 10 }), /CLEANUP_FAILED/);
});

test("authored isolation guard accepts only the disposable database for the exact run on port 1337", async () => {
  const { assertIsolation } = await runner();
  const runId = "iam-scim-gate-00000000-0000-4000-8000-000000000001";
  const settings: Record<string, unknown> = { "server.port": 1337, "database.connection.client": "sqlite",
    "database.connection.connection.filename": path.resolve(process.cwd(), `.tmp/${runId}.sqlite`) };
  const strapi = { config: { get: (key: string) => settings[key] } };
  assert.equal(assertIsolation(strapi, runId), true);
  for (const [key, bad] of [["server.port", 1338], ["database.connection.client", "postgres"],
    ["database.connection.connection.filename", "/tmp/developer.sqlite"]] as const) {
    const original = settings[key]; settings[key] = bad;
    assert.throws(() => assertIsolation(strapi, runId)); settings[key] = original;
  }
  assert.throws(() => assertIsolation(strapi, "developer"));
});

test("offline check validates pinned files without credentials, Docker, listeners or evidence", async () => {
  const { check, main } = await runner();
  assert.equal(await check(), true);
  await assert.rejects(main(["--run", "--unknown"]));
  await assert.rejects(main(["--secret", secret]));
});

test("evidence verification reads the published gate output by default or an explicit checked-in copy", async () => {
  const { evidenceFiles, main } = await runner();
  assert.deepEqual(evidenceFiles([], "/gate/output"), { capture: path.join("/gate/output", "capture.json"), manifest: path.join("/gate/output", "manifest.json") });
  assert.deepEqual(evidenceFiles(["a/capture.json", "b/manifest.json"], "/gate/output"),
    { capture: path.resolve("a/capture.json"), manifest: path.resolve("b/manifest.json") });
  assert.throws(() => evidenceFiles(["a/capture.json"], "/gate/output"));
  assert.throws(() => evidenceFiles(["a/capture.json", "b/manifest.txt"], "/gate/output"));
  await assert.rejects(main(["--check", "a/capture.json", "b/manifest.json"]));
});

test("authored token handoff rejects unsafe files and never reads the shared environment file", async () => {
  const { readToken } = await runner();
  const file = path.resolve(process.cwd(), ".tmp/.env.scim-capture");
  const token = `idb_scim_v1.${"a".repeat(24)}.${"b".repeat(43)}`;
  const seen: string[] = [];
  let mode = 0o600;
  const filesystem = {
    lstat: async (requested: string) => { assert.equal(requested, file); return {
      isFile: () => true, isSymbolicLink: () => false, nlink: 1, mode, size: 150 }; },
    readFile: async (requested: string) => { seen.push(requested); return `MIDPOINT_SCIM_TOKEN=${token}\n`; },
  };
  const runCommand = async (_program: string, args: string[]) => {
    assert.ok(args.every((argument) => !argument.includes(token)));
    assert.equal(args.at(-1), "apps/backend/.tmp/.env.scim-capture"); return "";
  };
  assert.equal(await readToken(file, runCommand, filesystem), token);
  mode = 0o644;
  await assert.rejects(readToken(file, runCommand, filesystem));
  await assert.rejects(readToken(path.resolve(process.cwd(), "../../docker/.env"), runCommand, filesystem));
  assert.deepEqual(seen, [file]);
  mode = 0o600;
  await assert.rejects(readToken(file, async () => { throw new Error("not ignored"); }, filesystem));
  await assert.rejects(readToken(file, async (_program: string, args: string[]) => args[0] === "ls-files" ? "tracked" : "", filesystem));
});

test("authored capture observer preserves body streams, ordered JSON and the original response writer", async () => {
  const { Readable } = await import("node:stream");
  const { EventEmitter } = await import("node:events");
  const { observeRequest } = await runner();
  const { sanitizeEnvelope } = await evidence();
  const req = Object.assign(new Readable({ read() {} }), { method: "POST", url: "/scim/v2/Users",
    headers: { authorization: `Bearer ${secret}`, accept: "application/json" } });
  const written: string[] = [];
  const res = Object.assign(new EventEmitter(), { statusCode: 201,
    getHeaders: () => ({ "content-type": "application/json", "set-cookie": secret }),
    write: (chunk: string) => { written.push(chunk); return true; },
    end: (chunk?: string) => { if (chunk) written.push(chunk); res.emit("finish"); },
  });
  const originalPush = req.push; const originalWrite = res.write; const originalEnd = res.end;
  let result;
  observeRequest(req, res, (wire: object) => { result = sanitizeEnvelope({ ...envelope(), ...wire }, { secrets: [secret] }); });
  const input = '{"active":true,"groups":[],"userName":"gate"}';
  req.push(input); req.push(null);
  assert.equal(req.read().toString(), input);
  res.write('{"id":'); res.end('"user-1"}');
  assert.deepEqual(written, ['{"id":', '"user-1"}']);
  assert.deepEqual(JSON.parse(JSON.stringify(result)).request.body, { active: true, groups: [], userName: "gate" });
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(req.push, originalPush); assert.equal(res.write, originalWrite); assert.equal(res.end, originalEnd);
});

function simulatedRuntimeDependencies(capture: unknown[]) {
  const calls: { method: string; endpoint: string; input: string }[] = [];
  const controls: string[] = [];
  const runCommand = async (_program: string, args: string[], options: { input?: string }): Promise<string> => {
    if (args[0] === "inspect") return "idambox/midpoint:4.8.14-scim2-1.2.9\n";
    if (args.includes("--version")) return "midPoint 4.8.14";
    if (args.includes("/opt/midpoint/connector-bundle/source-commit.txt")) return "05c404bbecf9c28938e2183411c7b04b4f8f4226";
    const method = args.at(-3) ?? ""; const endpoint = args.at(-2) ?? "";
    calls.push({ method, endpoint, input: options.input ?? "" });
    if (endpoint === "/connectors/search") return '{"object":{"object":[{"connectorVersion":"1.2.9"}]}}\n200';
    if (endpoint.endsWith("/test")) return '{"object":{"status":"success"}}\n200';
    return "\n204";
  };
  const control = async (_socket: string, message: { action: string; runId: string }) => {
    assert.match(message.runId, /^iam-scim-gate-/);
    controls.push(message.action); return message.action === "drain" ? capture : true;
  };
  return { calls, controls, runCommand, control, transport: async (url: string) => {
    assert.match(url, /^http:\/\/127\.0\.0\.1:1337\/scim\/v2\/(Schemas|ServiceProviderConfig|Groups)$/);
    return new Response("{}", { status: 200 });
  } };
}

test("authored runtime drives only midPoint lifecycle operations and isolates direct conformance probes", async () => {
  const { createRuntime } = await runner();
  const { executeStages, sanitizeEnvelope } = await evidence();
  const sanitized = authoredCapture().map((entry) => sanitizeEnvelope(entry, { secrets: [secret] }));
  const deps = simulatedRuntimeDependencies(sanitized);
  const runtime = createRuntime({ ...deps, runId: "iam-scim-gate-00000000-0000-4000-8000-000000000001", token: secret, socketPath: "/unused" });
  await executeStages(runtime);
  assert.ok(deps.calls.some((call) => call.method === "POST" && call.endpoint === "/shadows"));
  const deltas = deps.calls.filter((call) => call.method === "PATCH" && call.endpoint.startsWith("/shadows/"));
  assert.equal(deltas.length, 3);
  assert.ok(deltas.every((delta) => delta.input.includes('xmlns="http://midpoint.evolveum.com/xml/ns/public/common/api-types-3"')));
  assert.match(deltas[2].input, /<t:path>c:activation\/c:administrativeStatus<\/t:path>/);
  assert.match(deltas[1].input, /<t:modificationType>delete<\/t:modificationType>/);
  assert.match(deltas[1].input, /<t:modificationType>add<\/t:modificationType>/);
  assert.match(deltas[1].input, /&quot;primary&quot;:true/);
  assert.equal(deps.calls.filter((call) => call.method === "DELETE").length, 3);
  assert.equal(deps.controls.at(-1), "close");
  assert.ok(runtime.evidence().capture.length > 0);
});

test("authored partial create failure cleans up its allocated resource and closes capture", async () => {
  const { createRuntime } = await runner(); const { executeStages } = await evidence();
  const deps = simulatedRuntimeDependencies([]); const base = deps.runCommand;
  deps.runCommand = async (program, args, options) => {
    const output = await base(program, args, options);
    if (args.at(-3) === "POST" && args.at(-2) === "/resources") throw new Error(secret);
    return output;
  };
  const runtime = createRuntime({ ...deps, runId: "iam-scim-gate-00000000-0000-4000-8000-000000000001", token: secret, socketPath: "/unused" });
  await assert.rejects(executeStages(runtime), /STAGE_FAILED:prepare/);
  assert.equal(deps.calls.filter((call) => call.method === "DELETE" && call.endpoint.startsWith("/resources/")).length, 1);
  assert.equal(deps.controls.at(-1), "close");
  assert.throws(() => runtime.evidence());
});

test("authored runtime version mismatch performs no mutations or capture-session cleanup", async () => {
  const { createRuntime } = await runner(); const { executeStages } = await evidence();
  const deps = simulatedRuntimeDependencies([]); const base = deps.runCommand;
  deps.runCommand = async (program, args, options) => args.includes("--version") ? "midPoint 4.9.0" : base(program, args, options);
  await assert.rejects(executeStages(createRuntime({ ...deps,
    runId: "iam-scim-gate-00000000-0000-4000-8000-000000000001", token: secret, socketPath: "/unused" })), /STAGE_FAILED:prepare/);
  assert.deepEqual(deps.calls, []); assert.deepEqual(deps.controls, []);
});

test("authored invalid evidence is rejected before creating its destination", async () => {
  const { persistEvidence } = await runner();
  const { mkdtemp, readdir, rm } = await import("node:fs/promises"); const { tmpdir } = await import("node:os");
  const temp = await mkdtemp(path.join(tmpdir(), "iam-scim-tooling-"));
  try {
    const bundle = await authoredBundle(); bundle.capture[2].request.body.userName = `Bearer ${secret}`;
    await assert.rejects(persistEvidence(bundle, path.join(temp, "capture")));
    assert.deepEqual(await readdir(temp), []);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("authored discovery retains nonsecret authentication descriptions and disabled password capability", async () => {
  const { sanitizeEnvelope } = await evidence();
  const input = { ...envelope(), scenario: "config", origin: "direct-probe", invocation: "GET /scim/v2/ServiceProviderConfig",
    request: { method: "GET", path: "/scim/v2/ServiceProviderConfig", headers: {}, body: null },
    response: { status: 200, headers: {}, body: {
      changePassword: { supported: false }, authenticationSchemes: [{ name: "Bearer Token", description: "Identity Source bearer token", type: "oauthbearertoken" }],
    } } };
  assert.deepEqual(sanitizeEnvelope(input).response.body, input.response.body);
});

test("authored substitutions cannot relabel a username as a dynamic identifier", async () => {
  const { substitute } = await evidence();
  assert.throws(() => substitute([{ userName: "gate-person" }], [{ name: "USER_ID", kind: "user-id", value: "gate-person" }]));
});

test("authored evidence rejects failed extra traffic and reordered email operations", async () => {
  const { verifyEvidence } = await evidence();
  const bundle = await authoredBundle();
  bundle.capture[8].request.body.Operations.reverse();
  assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest));
  const failed = await authoredBundle();
  failed.capture[7].response.status = 500;
  assert.throws(() => verifyEvidence(failed.capture, failed.manifest));
});

test("authored evidence rejects declared markers in identity values and mismatched lifecycle ids", async () => {
  const { verifyEvidence } = await evidence();
  const bundle = await authoredBundle(); bundle.capture[2].request.body.userName = "{{USER_ID}}";
  assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest));
  const mismatched = await authoredBundle(); mismatched.capture[3].request.path = "/scim/v2/Users/other-id";
  assert.throws(() => verifyEvidence(mismatched.capture, mismatched.manifest));
});
