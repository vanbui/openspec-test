import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
const nativeImport = new Function("url", "return import(url)");
const runner = () => nativeImport(pathToFileURL(path.resolve(process.cwd(), "../../docker/midpoint/e2e/refusal-scim.mjs")).href);

function runtime(fail?: string) {
  const calls: string[] = [];
  const port = Object.fromEntries(["prepare", "baseline", "stop", "deactivate", "refusal", "pending", "browser", "start", "recover", "close"].map(stage => [stage, async () => {
    calls.push(stage); if (fail === stage) throw new Error("private-token-cookie-body");
  }]));
  return { calls, port };
}
test("refusal and pending work precede recovery; only closed outcomes leave the runner", async () => {
  const { executeRefusal } = await runner();
  const { calls, port } = runtime(); const lines: string[] = [];
  await executeRefusal(port, { emit: (line: string) => lines.push(line) });
  assert.deepEqual(calls, ["prepare", "baseline", "stop", "deactivate", "refusal", "pending", "browser", "start", "recover", "close"]);
  assert.equal(lines.some(line => /token|cookie|body/.test(line)), false);
});
test("every failed stage cleans up; attempted stop always restores even when stop fails", async () => {
  const { executeRefusal } = await runner();
  for (const stage of ["prepare", "baseline", "stop", "deactivate", "refusal", "pending", "browser", "start", "recover", "close"]) {
    const { calls, port } = runtime(stage);
    await assert.rejects(executeRefusal(port), /REFUSAL_GATE_FAILED/);
    assert.equal(calls.at(-1), "close", stage);
    if (calls.includes("stop")) assert.ok(calls.includes("start"), stage);
    if (["deactivate", "refusal", "pending", "browser"].includes(stage)) assert.equal(calls.includes("recover"), false);
  }
});
test("expired stages are bounded and reserve independent restore and close budgets", async () => {
  const { executeRefusal } = await runner();
  const { calls, port } = runtime();
  port.refusal = async () => { calls.push("refusal"); await new Promise(() => {}); };
  await assert.rejects(executeRefusal(port, { stageMs: 10, overallMs: 100 }), /REFUSAL_GATE_FAILED/);
  assert.deepEqual(calls.slice(-2), ["start", "close"]);
});
test("evidence validator rejects missing, failed, fabricated extras and credential-bearing records", async () => {
  const { verifyRefusalEvidence, proofRows } = await runner();
  const rows = proofRows();
  assert.throws(() => verifyRefusalEvidence(rows));
  const complete = rows.map((row: object) => ({ ...row, passed: true }));
  assert.equal(verifyRefusalEvidence(complete), true);
  for (const invalid of [complete.slice(1), [...complete, complete[0]], complete.map((row: object) => ({ ...row, token: "secret" }))]) {
    assert.throws(() => verifyRefusalEvidence(invalid));
  }
});

test("web listeners use a separate loopback gate band and reject product or idp ports", async () => {
  const { refusalWebOrigin } = await runner();
  assert.equal(refusalWebOrigin().origin, "http://127.0.0.1:3307");
  for (const value of ["http://127.0.0.1:1337", "http://127.0.0.1:3000", "http://127.0.0.1:8080", "http://example.test:3307", "http://secret@127.0.0.1:3307", "http://127.0.0.1:3307/?token=secret"])
    assert.throws(() => refusalWebOrigin(value));
});

test("an exhausted overall deadline still closes the runtime", async () => {
  const { executeRefusal } = await runner();
  const { calls, port } = runtime();
  await assert.rejects(executeRefusal(port, { overallMs: 0, stageMs: 100 }), /REFUSAL_GATE_FAILED/);
  assert.deepEqual(calls, ["close"]);
});
