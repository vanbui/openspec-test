#!/usr/bin/env node
/** Opt-in refusal gate. No live listener, process or outage is started on import or --check. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rm, lstat, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUTPUT = path.join(ROOT, '.planning/workstreams/iam/phases/03-strapi-scim-2-0-service/evidence/browser-refusal');
const fail = () => new Error('REFUSAL_GATE_FAILED');
export const STAGES = ['prepare', 'baseline', 'stop', 'deactivate', 'refusal', 'pending', 'browser', 'start', 'recover', 'close'];

export function refusalWebOrigin(value = 'http://127.0.0.1:3307') {
  const url = new URL(value);
  const port = Number(url.port);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || !Number.isInteger(port) || port < 3307 || port > 3399
    || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw fail();
  return url;
}

export function proofRows() {
  return ['put-1440', 'put-375', 'patch-1440', 'patch-375', 'delete-api'].flatMap(scenario => STAGES.map(stage => ({ scenario, stage, passed: false })));
}
export function verifyRefusalEvidence(rows) {
  const expected = proofRows();
  assert.equal(rows.length, expected.length);
  for (let index = 0; index < expected.length; index++) {
    assert.deepEqual(rows[index], { ...expected[index], passed: true });
  }
  return true;
}

/** Independent stage and cleanup budgets; restoration starts even after a failed stop. */
export async function executeRefusal(runtime, { stageMs = 180000, overallMs = 1800000, emit = () => {} } = {}) {
  const end = Date.now() + overallMs;
  let restore = false; let failure;
  async function stage(name, cleanup = false) {
    let timer;
    try {
      const budget = cleanup ? stageMs : Math.min(stageMs, end - Date.now());
      if (budget <= 0) throw fail();
      await Promise.race([runtime[name](), new Promise((_, reject) => { timer = setTimeout(() => reject(fail()), budget); })]);
      emit(JSON.stringify({ stage: name, passed: true }));
    } catch { throw fail(); }
    finally { clearTimeout(timer); }
  }
  try {
    for (const name of STAGES.slice(0, -1)) {
      if (name === 'stop') restore = true;
      await stage(name);
      if (name === 'start') restore = false;
    }
  } catch { failure = fail(); }
  finally {
    if (restore) try { await stage('start', true); } catch { failure = fail(); }
    try { await stage('close', true); } catch { failure = fail(); }
  }
  if (failure) throw failure;
}

function processRun(program, args, options = {}) {
  const child = spawn(program, args, { cwd: ROOT, stdio: 'ignore', detached: process.platform !== 'win32', ...options });
  function kill(signal) {
    try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal); else child.kill(signal); } catch { /* Already exited. */ }
  }
  const done = new Promise((resolve, reject) => {
    child.once('error', () => reject(fail()));
    child.once('exit', code => code === 0 ? resolve() : reject(fail()));
  });
  void done.catch(() => {});
  return { child, done, async close() {
    if (child.exitCode !== null || child.signalCode) return;
    kill('SIGTERM');
    let timer;
    await Promise.race([done.catch(() => {}), new Promise(resolve => { timer = setTimeout(() => { kill('SIGKILL'); resolve(); }, 5000); })]);
    clearTimeout(timer);
  } };
}

export async function runLive(env = process.env) {
  // Reuse installed compiled gate utilities and the existing PKCE/session boundary.
  const require = createRequire(path.join(ROOT, 'apps/backend/package.json'));
  const { isolatedGateEnvironment, GateDeadline, cleanupGateResources } = require(path.join(ROOT, 'apps/backend/.tmp/tests-dist/tests/helpers/iam-gate-harness.js'));
  const { createLiveScimRuntime } = require(path.join(ROOT, 'apps/backend/.tmp/tests-dist/tests/helpers/iam-live-scim-gate.js'));
  const deadline = new GateDeadline(1680000); // Reserve 120 seconds of the 30-minute budget for restoration/cleanup.
  const runId = randomUUID();
  const runDir = path.join(ROOT, 'apps/csrm/.tmp', `iam-refusal-${runId}`);
  const controlToken = randomBytes(32).toString('base64url');
  const rows = [];
  let live; let web; let browser; let listener; let current; let gate; let proof;
  let browserReady; let browserDone; let browserResolve; let readyResolve; let readyReject;
  const webUrl = refusalWebOrigin(env.IAM_SCIM_WEB_ORIGIN);
  // The dev server listens on 127.0.0.1 only but reports its request host as localhost, and Auth.js builds the
  // callback's redirect_uri from that host. Sign-in, callback and the browser therefore all use the localhost name.
  const publicOrigin = `http://localhost:${webUrl.port}`;
  try {
    // Preserve existing published proof. A rerun requires the orchestrator to archive it first.
    try { await lstat(OUTPUT); throw fail(); } catch (error) { if (error.code !== 'ENOENT') throw fail(); }
    // A gate never adopts an already listening web server.
    const probe = createServer();
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(Number(webUrl.port), '127.0.0.1', resolve); });
    await new Promise(resolve => probe.close(resolve));
    await mkdir(path.dirname(runDir), { recursive: true });
    await mkdir(runDir, { recursive: false });
    const screenshots = path.join(runDir, 'browser-refusal');
    await mkdir(screenshots);
    live = await new GateDeadline(Math.min(180000, deadline.remaining())).run('refusal-setup', () => createLiveScimRuntime(env));
    listener = createServer(async (req, res) => {
      if (req.headers.authorization !== `Bearer ${controlToken}` || req.method !== 'POST') { res.writeHead(403).end(); return; }
      try {
        const operation = req.url;
        let result = { passed: true };
        if (operation === '/setup') {
          if (gate || current) throw fail();
          const chunks = []; for await (const chunk of req) { chunks.push(chunk); if (Buffer.concat(chunks).length > 1024) throw fail(); }
          const { method, width } = JSON.parse(Buffer.concat(chunks).toString());
          if (!['PUT', 'PATCH'].includes(method) || ![1440, 375].includes(width)) throw fail();
          current = await new GateDeadline(Math.min(180000, deadline.remaining())).run('refusal-scenario', () => live.scenario(method));
          current.scenario = `${method.toLowerCase()}-${width}`;
          result = { username: current.username, password: current.password, detail: current.detail };
        } else if (operation === '/deactivate') {
          if (!current || gate) throw fail();
          browserReady = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
          browserDone = new Promise(resolve => { browserResolve = resolve; });
          gate = executeRefusal({ ...current, browser: async () => { readyResolve(); await browserDone; } },
            { overallMs: deadline.remaining(), emit: line => rows.push({ scenario: current.scenario, ...JSON.parse(line) }) });
          void gate.catch(() => readyReject(fail()));
          await browserReady;
        } else if (operation === '/browser-done') {
          if (!gate) throw fail();
          await current.refusal(); browserResolve(); await gate; gate = undefined; current = undefined;
        } else if (operation === '/hold') live.holdAccess();
        else if (operation === '/release') live.releaseAccess();
        else if (operation === '/held') result = { passed: true, held: live.accessHeld() };
        else throw fail();
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
      } catch { res.writeHead(500).end('{"passed":false}'); }
    });
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    const control = `http://127.0.0.1:${listener.address().port}`;
    const webEnv = isolatedGateEnvironment({ NODE_ENV: 'development', CSRM_AUTH_OIDC_ENABLED: 'true', CSRM_DEV_IDENTITY: 'false',
      AUTH_URL: publicOrigin, NEXT_TELEMETRY_DISABLED: '1', AUTH_SECRET: randomBytes(32).toString('base64url'), AUTH_KEYCLOAK_ID: env.IAM_LIVE_CLIENT_ID,
      AUTH_KEYCLOAK_SECRET: env.IAM_LIVE_CLIENT_SECRET, AUTH_KEYCLOAK_ISSUER: env.KEYCLOAK_ISSUER,
      CSRM_API_BASE_URL: `${live.baseUrl}/api`, CSRM_API_TOKEN: live.apiToken,
      CSRM_NEXT_DIST_DIR: `.tmp/iam-refusal-${runId}/next` });
    web = processRun('pnpm', ['exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', webUrl.port], { cwd: path.join(ROOT, 'apps/csrm'), env: webEnv });
    await new GateDeadline(Math.min(180000, deadline.remaining())).run('refusal-web-ready', async () => {
      for (;;) {
        if (web.child.exitCode !== null) throw fail();
        try { if ((await fetch(`${webUrl.origin}/sign-in`, { signal: AbortSignal.timeout(3000) })).ok) break; } catch { /* Bounded readiness poll. */ }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    });
    const config = path.join(runDir, 'playwright.config.mjs');
    // A plain configuration object: the installed runner is CommonJS, so a named defineConfig import fails to load.
    await writeFile(config, `export default ${JSON.stringify({
      testDir: path.join(ROOT, 'apps/csrm/e2e'), testMatch: 'iam-scim-refusal.spec.ts', timeout: 180000,
      workers: 1, retries: 0, reporter: 'line', outputDir: path.join(runDir, 'results'),
      use: { baseURL: publicOrigin, trace: 'off', screenshot: 'off', video: 'off' },
    })};\n`);
    browser = processRun('pnpm', ['exec', 'playwright', 'test', '--config', config], { cwd: path.join(ROOT, 'apps/csrm'),
      env: isolatedGateEnvironment({ NEXT_TELEMETRY_DISABLED: '1', IAM_SCIM_REFUSAL_LIVE: 'true', IAM_SCIM_REFUSAL_CONTROL: control, IAM_SCIM_REFUSAL_CONTROL_TOKEN: controlToken, IAM_SCIM_REFUSAL_SCREENSHOT_DIR: screenshots }) });
    await deadline.run('refusal-browser', () => Promise.race([browser.done, web.done.then(() => { throw fail(); })]));
    const deletion = await live.scenario('DELETE');
    await executeRefusal({ ...deletion, browser: async () => {} }, { overallMs: deadline.remaining(), emit: line => rows.push({ scenario: 'delete-api', ...JSON.parse(line) }) });
    verifyRefusalEvidence(rows);
    const images = [];
    for (const method of ['put', 'patch']) for (const width of [1440, 375]) {
      const name = `${method}-${width}.png`;
      const bytes = await readFile(path.join(screenshots, name));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      images.push({ name, bytes });
    }
    proof = { rows, images };
  } finally {
    live?.releaseAccess(); browserResolve?.();
    await cleanupGateResources([
      { stage: 'refusal-browser-close', close: async () => { await browser?.close(); } },
      { stage: 'refusal-gate-close', close: async () => { await gate?.catch(() => {}); } },
      { stage: 'refusal-web-close', close: async () => { await web?.close(); } },
      { stage: 'refusal-listener-close', close: async () => { listener?.closeAllConnections(); if (listener) await new Promise(resolve => listener.close(resolve)); } },
      { stage: 'refusal-live-close', close: async () => { await live?.close(); } },
      // The stopped dev server may still be flushing its build output, so removal retries.
      { stage: 'refusal-files-close', close: async () => { await rm(runDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } },
    ], 120000);
  }
  // Only a successfully cleaned-up run can publish completed proof.
  if (!proof) throw fail();
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  const publication = `${OUTPUT}-pending-${runId}`;
  await mkdir(publication);
  try {
    await writeFile(path.join(publication, 'outcomes.json'), `${JSON.stringify(proof.rows, null, 2)}\n`);
    for (const image of proof.images) await writeFile(path.join(publication, image.name), image.bytes);
    await rename(publication, OUTPUT);
  } finally { await rm(publication, { recursive: true, force: true }); }
}

async function main(args) {
  if (args.length !== 1) throw fail();
  if (args[0] === '--check') {
    assert.equal(proofRows().length, 50);
    const spec = await readFile(path.join(ROOT, 'apps/csrm/e2e/iam-scim-refusal.spec.ts'), 'utf8');
    assert.ok(spec.includes('IAM_SCIM_REFUSAL_LIVE'));
    const calls = [];
    const offline = Object.fromEntries(STAGES.map(stage => [stage, async () => { calls.push(stage); }]));
    await executeRefusal(offline);
    assert.deepEqual(calls, STAGES);
    await assert.rejects(executeRefusal({ ...offline, refusal: async () => { throw fail(); } }), /REFUSAL_GATE_FAILED/);
    verifyRefusalEvidence(proofRows().map(row => ({ ...row, passed: true })));
    const require = createRequire(path.join(ROOT, 'apps/backend/package.json'));
    assert.equal(typeof require(path.join(ROOT, 'apps/backend/.tmp/tests-dist/tests/helpers/iam-live-scim-gate.js')).createLiveScimRuntime, 'function');
    createRequire(path.join(ROOT, 'apps/csrm/package.json')).resolve('@playwright/test');
    console.log('Refusal tooling offline check passed; live evidence remains pending.');
  } else if (args[0] === '--run') await runLive();
  else if (args[0] === '--verify-evidence') {
    verifyRefusalEvidence(JSON.parse(await readFile(path.join(OUTPUT, 'outcomes.json'), 'utf8')));
    for (const method of ['put', 'patch']) for (const width of [1440, 375]) {
      const bytes = await readFile(path.join(OUTPUT, `${method}-${width}.png`));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
    console.log('Refusal evidence verified.');
  } else throw fail();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => { process.stderr.write('REFUSAL_GATE_FAILED\n'); process.exitCode = 1; });
}
