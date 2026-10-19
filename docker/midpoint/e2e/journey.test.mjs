import assert from 'node:assert/strict';
import test from 'node:test';
import { executeJourney, STAGES, BUDGETS, main, parseArguments } from './journey.mjs';
import { assembleJourneyEvidence, verifyJourneyEvidence, verifyContractEvidence, validatePrivateContract, persistJourneyEvidence, verifyEvidenceDirectory, EVIDENCE_ROOT } from './journey-evidence.mjs';
import { PIN } from './scim-evidence.mjs';
import { mkdtemp, mkdir, writeFile, chmod, symlink, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './journey.mjs';
import { composeEnvironment, foreignCompiler, parseCompose, parseIssuedToken, backendEnvironment, privateFile, replacePrivate,
  awaitNativeTask, createSnapshots, assertStableLink, createRevocationWindow, createLoopbackControl, createJourneyRuntime, createJourneyBrowser, validateLifecycleObservation, LISTENER } from './journey-runtime.mjs';
import { createRequire } from 'node:module';
import * as runtimeFs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { Script } from 'node:vm';
import { parseCsv } from '../hr-validate.mjs';
import { selectFreshMessage, validateActionUrl, extractActionUrl, awaitPasswordMail } from './journey-mail.mjs';

const mailRecipient = 'journey-012345abcdef-0@hr.idambox.test';
const mailAfter = '2026-10-17T00:00:00.000Z';
const mailRow = { ID: 'fresh-message', Created: '2026-10-17T00:00:01.000Z', To: [{ Address: mailRecipient }] };
const actionUrl = 'http://localhost:8080/realms/idambox/login-actions/action-token?key=synthetic';
test('fresh mail selection requires exact synthetic recipient, timestamp and unseen identity', () => {
  assert.equal(selectFreshMessage([mailRow], { recipient: mailRecipient, after: mailAfter, seen: new Set() }).ID, 'fresh-message');
  for (const row of [{ ...mailRow, Created: mailAfter }, { ...mailRow, To: [{ Address: 'foreign@hr.idambox.test' }] }, { ...mailRow, To: [...mailRow.To, { Address: 'other@hr.idambox.test' }] }]) {
    assert.equal(selectFreshMessage([row], { recipient: mailRecipient, after: mailAfter, seen: new Set() }), undefined);
  }
  assert.equal(selectFreshMessage([mailRow], { recipient: mailRecipient, after: mailAfter, seen: new Set(['fresh-message']) }), undefined);
  assert.throws(() => selectFreshMessage([mailRow, { ...mailRow, ID: 'second' }], { recipient: mailRecipient, after: mailAfter, seen: new Set() }), /JOURNEY_MAIL_AMBIGUOUS/);
});
test('action URL accepts only the exact local realm action endpoint without credentials or fragments', () => {
  assert.equal(validateActionUrl(actionUrl), actionUrl);
  for (const value of [actionUrl.replace('localhost', 'evil.invalid'), actionUrl.replace('idambox', 'foreign'), actionUrl.replace('action-token', 'authenticate'), `${actionUrl}#private`, actionUrl.replace('localhost', 'user@localhost'), actionUrl.replace('key=synthetic', 'key='), `${actionUrl}&key=second`]) {
    assert.throws(() => validateActionUrl(value), /JOURNEY_MAIL_LINK_INVALID/);
  }
  assert.equal(extractActionUrl({ Text: `Follow this link: ${actionUrl}` }), actionUrl);
  assert.equal(extractActionUrl({ HTML: `<a href="${actionUrl}&amp;execution=setup">Set password</a>` }), `${actionUrl}&execution=setup`);
  assert.throws(() => extractActionUrl({ Text: `${actionUrl} ${actionUrl}&extra=1` }), /JOURNEY_MAIL_AMBIGUOUS/);
});
test('mail poll is bounded, follows exact selected message and closes transport errors', async () => {
  const calls = []; const seen = new Set();
  const result = await awaitPasswordMail({ recipient: mailRecipient, after: mailAfter, seen,
    transport: async url => { calls.push(url); return { ok: true, json: async () => url.endsWith('/messages?limit=100&start=0') ? { messages: [mailRow], total: 1 } : { ...mailRow, Text: actionUrl } }; } });
  assert.equal(result.actionUrl, actionUrl); assert.ok(seen.has(mailRow.ID)); assert.equal(calls.length, 2);
  let now = 0;
  await assert.rejects(awaitPasswordMail({ recipient: mailRecipient, after: mailAfter, timeoutMs: 2, now: () => now, pause: async () => { now += 2; }, transport: async () => ({ ok: true, json: async () => ({ messages: [], total: 0 }) }) }), /JOURNEY_MAIL_TIMEOUT/);
  await assert.rejects(awaitPasswordMail({ recipient: mailRecipient, after: mailAfter, transport: async () => { throw Error(actionUrl); } }), error => error.message === 'JOURNEY_MAIL_FAILED' && error.cause === undefined);
});

test('dedicated browser config and reporter suppress automatic artifacts and raw diagnostics', async () => {
  const require = createRequire(path.join(ROOT, 'apps/csrm/package.json'));
  const ts = require('typescript');
  const source = await runtimeFs.readFile(path.join(ROOT, 'apps/csrm/e2e/iam-journey-reporter.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const lines = []; const exports = {};
  new Script(output).runInNewContext({ exports, process: { stdout: { write: row => lines.push(row) }, stderr: { write: row => lines.push(row) } } });
  const reporter = new exports.default();
  reporter.onError(Error(actionUrl)); reporter.onStdOut(actionUrl); reporter.onStdErr(actionUrl);
  reporter.onTestEnd({ title: actionUrl }, { status: 'failed', errors: [Error(actionUrl)] }); reporter.onEnd({ status: actionUrl });
  assert.deepEqual(lines, ['journey-browser:failed\n', 'journey-browser:failed\n', 'journey-browser-run:failed\n']);
  const configSource = await runtimeFs.readFile(path.join(ROOT, 'apps/csrm/playwright.iam-journey.config.ts'), 'utf8');
  const configExports = {}; const environment = {};
  new Script(ts.transpileModule(configSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)
    .runInNewContext({ exports: configExports, require: name => { assert.equal(name, '@playwright/test'); return { defineConfig: value => value }; }, process: { env: environment } });
  const config = configExports.default;
  assert.equal(config.workers, 1); assert.equal(config.retries, 0); assert.equal(config.webServer, undefined);
  for (const key of ['trace', 'video', 'screenshot']) assert.equal(config.use[key], 'off');
  assert.equal(environment.PLAYWRIGHT_NO_COPY_PROMPT, '1'); assert.equal(config.preserveOutput, 'never');
});

test('owned browser starts exact OIDC origin with isolated build and stops both processes', async () => {
  const calls = []; const stopped = [];
  const browser = createJourneyBrowser({ env: { IAM_JOURNEY_RUN_DIR: `/private/${runId}`, AUTH_KEYCLOAK_ID: 'synthetic-client', AUTH_KEYCLOAK_SECRET: 'synthetic-private', AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/idambox', CSRM_API_TOKEN: 'synthetic-api' },
    start: (program, args, options) => { calls.push({ program, args, options }); return { alive: () => true, close: async () => stopped.push(program) }; },
    transport: async () => ({ ok: true }) });
  try {
    await browser.start({ origin: 'http://localhost:3000', env: { IAM_JOURNEY_CONTROL_TOKEN: 'synthetic-control', IAM_JOURNEY_CONTROL_URL: 'http://127.0.0.1:32123' } });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.env.CSRM_DEV_IDENTITY, 'false'); assert.equal(calls[0].options.env.CSRM_AUTH_OIDC_ENABLED, 'true');
    assert.equal(calls[0].options.env.CSRM_API_BASE_URL, 'http://127.0.0.1:1337/api');
    assert.equal(calls[0].options.env.CSRM_API_TOKEN, 'synthetic-api');
    assert.equal(calls[1].options.env.IAM_JOURNEY_LIVE, 'true');
    assert.equal(calls[1].options.env.AUTH_KEYCLOAK_SECRET, undefined);
    assert.ok(createSnapshots(runId).people.slice(0, 2).every(person => /^journey\.[a-f0-9]{12}\.[01]$/.test(person.username)));
  } finally { await browser.close(); }
  assert.equal(stopped.length, 2);
});

test('private browser input requires authenticated loopback current stage and is delivered once', async () => {
  let handler; const server = new EventEmitter();
  server.listen = (_port, _host, ready) => ready(); server.address = () => ({ port: 32123 });
  server.closeAllConnections = () => {}; server.close = callback => callback();
  const control = await createLoopbackControl({ token: 'private-control', serve: value => { handler = value; return server; } });
  const request = async (headers = {}, method = 'GET') => {
    const req = Readable.from(method === 'POST' ? ['{"passed":true}'] : []);
    Object.assign(req, { method, url: `${method === 'GET' ? '/input' : ''}/password-setup-1440`, headers: { authorization: 'Bearer private-control', host: '127.0.0.1:32123', ...headers }, socket: { remoteAddress: '127.0.0.1' } });
    const response = { status: 0, body: '', writeHead(status) { this.status = status; return this; }, end(body = '') { this.body = body; return this; } };
    await handler(req, response); return response;
  };
  try {
    assert.equal((await request()).status, 409);
    const waiting = control.wait('password-setup-1440', undefined, { username: 'journey.012345abcdef.0', actionUrl });
    for (const headers of [{ origin: 'https://foreign.invalid' }, { host: 'foreign.invalid:32123' }, { authorization: 'Bearer ééééééééééééééé' }]) {
      const response = await request(headers); assert.equal(response.status, 403); assert.equal(response.body, '');
    }
    assert.equal(JSON.parse((await request()).body).actionUrl, actionUrl);
    assert.equal((await request()).status, 409);
    assert.equal((await request({}, 'POST')).status, 200); await waiting;
  } finally { await control.close(); }
});

test('compose environment excludes ambient interpolation values and legacy aliases', () => {
  const clean = composeEnvironment({ PATH: '/installed/bin', HOME: '/home/test',
    KC_BOOTSTRAP_ADMIN_PASSWORD: 'ambient-private', MIDPOINT_SCIM_TOKEN: 'ambient-private',
    KEYCLOAK_ADMIN: 'legacy', DOCKER_HOST: 'foreign', COMPOSE_PROJECT_NAME: 'foreign' });
  assert.equal(clean.PATH, '/installed/bin');
  for (const key of ['KC_BOOTSTRAP_ADMIN_PASSWORD', 'MIDPOINT_SCIM_TOKEN', 'KEYCLOAK_ADMIN', 'DOCKER_HOST', 'COMPOSE_PROJECT_NAME']) {
    assert.equal(clean[key], undefined);
  }
});

const runId = 'iam-journey-11111111-1111-4111-8111-111111111111';
const assertionKeys = ['freshMatchedMail', 'actualPasswordLink', 'freshOidcSignIn', 'requestorOnly',
  'restrictedRoutesRefused', 'foreignRecordRefused', 'moverLinkageUnchanged', 'moverAttributesMirrored', 'moverNoInvitation',
  'sameBrowserSession', 'terminatedPut', 'localInactive', 'remoteDisabled', 'remoteSessionsEnded', 'freshSignInRefused',
  'keyboard', 'visibleFocus', 'readableErrors', 'noHorizontalOverflow'];
function fixture() {
  const at = ms => new Date(Date.parse('2026-10-17T00:00:00.000Z') + ms).toISOString();
  return { format: 1, runId, date: '2026-10-17T00:00:00.000Z', provenance: 'live-journey',
    reset: { idpVolumesRemoved: true, freshDatabase: true, exclusiveListeners: true, exclusiveCompiler: true, schedulesSuspended: true },
    versions: { midpoint: PIN.midpoint, connector: PIN.connector, sourceCommit: PIN.sourceCommit, keycloak: '26.6.1' },
    stages: STAGES.map((stage, index) => ({ stage, outcome: 'passed', startedMs: index * 10000 + (stage === 'evidence' ? 390000 : 0), durationMs: stage === 'in03-conflict' ? 400000 : 10000 })),
    tasks: [...[1440, 375].flatMap(width => ['joiner', 'mover', 'leaver'].map(kind => `${kind}-${width}`)), 'in03-conflict', 'in03-recovery']
      .map((stage, index) => ({ stage, taskOid: index === 7 ? '00000000-0000-4000-8000-000000000007' : `11000000-0000-4000-8000-000000000${stage.startsWith('joiner-') ? '310' : '300'}`, invocation: index === 7 ? 'native-retry-scanner' : 'on-demand',
        triggeredAt: at(index === 7 ? 583000 : STAGES.indexOf(stage.startsWith('in03-') ? 'in03-conflict' : `csv-${stage}`) * 10000 + 1000),
        finishedAt: at(index === 7 ? 584000 : STAGES.indexOf(stage.startsWith('in03-') ? 'in03-conflict' : `csv-${stage}`) * 10000 + 2000),
        result: stage === 'in03-conflict' ? 'retry-later' : 'success', nativeAuditId: `audit-${index}`, scimCorrelationId: `scim-${index}`,
        scimMethod: stage.startsWith('joiner-') ? 'POST' : stage.startsWith('in03-') ? 'PATCH' : 'PUT',
        scimStatus: stage === 'in03-conflict' ? 503 : stage.startsWith('joiner-') ? 201 : 200,
        nativePaging: true, cadenceSeconds: 300 })),
    people: [1440, 375].map((width, index) => ({ width, height: index === 0 ? 900 : 812, sourceKey: `95000${index}`,
      identityOid: `22222222-2222-4222-8222-22222222222${index}`, documentId: `doc-${index}`,
      remoteSubject: `33333333-3333-4333-8333-33333333333${index}`,
      assertions: Object.fromEntries(assertionKeys.map(key => [key, true])),
      refusal: { observedAt: at(STAGES.indexOf(`immediate-refusal-${width}`) * 10000 + 1000), accessTokenExpiresAt: '2026-10-17T00:05:00.000Z',
        accessStatus: 403, detailStatus: 403, writeStatus: 403, browserListRefused: true, browserDetailRefused: true, beforeRemoteLogout: true },
      screenshots: [`screenshots/csrm-${width}-requestor.png`, `screenshots/csrm-${width}-refusal.png`] })),
    conflict: { scenario: 'IN-03', status: 503, retryAfterSeconds: 30, initialRetrySeconds: 300, subsequentRetrySeconds: 900,
      retryScheduledAt: at(582000), retryTriggeredAt: at(583000),
      nativeRetryObserved: true, correctionApplied: true, recovered: true, rollback: true, ownershipUnchanged: true, noInvitation: true },
    cleanup: { processesStopped: true, listenersClosed: true, privateFilesRemoved: true, schedulesRestored: true },
    regressions: { backendUnfiltered: true, csrm: true, contracts: true, catalogues: true, schemas: true, defaults: true } };
}

test('runner rejects an out-of-order stage graph before executing work', async () => {
  await assert.rejects(executeJourney({ stages: ['reset', 'preflight'] }), /JOURNEY_ORDER/);
});

test('runner calls every ordered stage exactly once then cleanup', async () => {
  const calls = [];
  const rows = await executeJourney({ stage: async stage => calls.push(stage), cleanup: async () => calls.push('cleanup') });
  assert.deepEqual(calls, [...STAGES, 'cleanup']);
  assert.deepEqual(rows.map(row => row.stage), STAGES);
  assert.ok(rows.every(row => row.outcome === 'passed'));
});

test('runner stops dependants and redacts raw adapter outputs and errors', async () => {
  const calls = [];
  await assert.rejects(executeJourney({ stage: async stage => {
    calls.push(stage); if (stage === 'reset') throw Error('token-value'); return { token: 'secret' };
  }, cleanup: async () => calls.push('cleanup') }), error => {
    assert.equal(error.stage, 'reset');
    assert.equal(error.cause, undefined);
    assert.ok(!JSON.stringify(error).includes('token'));
    return true;
  });
  assert.deepEqual(calls, ['preflight', 'reset', 'cleanup']);
});

test('cleanup-only failure prevents a passing run', async () => {
  await assert.rejects(executeJourney({ stage: async () => {}, cleanup: async () => { throw Error('mail'); } }),
    error => error.stage === 'cleanup' && error.code === 'JOURNEY_CLEANUP_FAILED');
});

test('noncooperative stage receives abort at deadline and cleanup has its own budget', async () => {
  const timers = new Map(); let nextTimer = 0; let activeSignal; let cleaned = false;
  const budgets = [];
  const clock = { now: () => 0, setTimeout: (fn, ms) => { budgets.push(ms); timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: key => timers.delete(key) };
  const pending = executeJourney({ stage: async (_, signal) => { activeSignal = signal; return new Promise(() => {}); },
    cleanup: async () => { cleaned = true; } }, clock);
  await Promise.resolve();
  [...timers.values()][0]();
  await assert.rejects(pending, error => error.code === 'JOURNEY_TIMEOUT' && error.stage === 'preflight');
  assert.equal(activeSignal.aborted, true);
  assert.equal(cleaned, true);
  assert.deepEqual(budgets, [BUDGETS.setup, BUDGETS.cleanup]);
});

test('per-width budget prevents expansion beyond ten minutes', async () => {
  let now = 0;
  await assert.rejects(executeJourney({ stage: async stage => { if (stage.endsWith('-1440')) now += 100000; }, cleanup: async () => {} },
    { now: () => now, setTimeout, clearTimeout }), error => error.code === 'JOURNEY_TIMEOUT' && error.stage === 'csv-mover-1440');
});

test('evidence stage has its own regression budget outside the live overall budget', async () => {
  let now = 0; const budgets = new Map();
  const clock = { now: () => now, setTimeout: (_, ms) => { budgets.set(now, ms); return 0; }, clearTimeout: () => {} };
  const rows = await executeJourney({ stage: async stage => { now += stage === 'evidence' ? BUDGETS.overall + 1 : 1000; },
    cleanup: async () => {} }, clock);
  assert.equal(rows.at(-1).stage, 'evidence');
  assert.equal(budgets.get(rows.at(-1).startedMs), BUDGETS.evidence);
  now = 0;
  await assert.rejects(executeJourney({ stage: async stage => { now += stage === 'evidence' ? BUDGETS.evidence + 1 : 1000; },
    cleanup: async () => {} }, clock), error => error.code === 'JOURNEY_TIMEOUT' && error.stage === 'evidence');
});

// Moves IN-03 with its task and retry instants, so only the overall budget can reject the result.
function moveConflict(value, startedMs) {
  const conflict = value.stages.at(-2); const delta = startedMs - conflict.startedMs;
  const shift = instant => new Date(Date.parse(instant) + delta).toISOString();
  conflict.startedMs = startedMs; value.stages.at(-1).startedMs = startedMs + conflict.durationMs;
  for (const task of value.tasks.filter(row => row.stage.startsWith('in03-'))) {
    task.triggeredAt = shift(task.triggeredAt); task.finishedAt = shift(task.finishedAt);
  }
  value.conflict.retryScheduledAt = shift(value.conflict.retryScheduledAt);
  value.conflict.retryTriggeredAt = shift(value.conflict.retryTriggeredAt);
}

test('evidence accepts full regressions running past the live overall budget', () => {
  const value = fixture(); value.stages.at(-1).durationMs = BUDGETS.overall;
  assert.equal(verifyJourneyEvidence(value), true);
  moveConflict(value, BUDGETS.overall - value.stages.at(-2).durationMs);
  assert.equal(verifyJourneyEvidence(value), true);
});

test('check and list ignore private inputs and publish no evidence', async () => {
  assert.equal(await main(['--check'], { IAM_JOURNEY_DISPOSABLE: 'false', DATABASE_FILENAME: '/foreign/database' }), true);
  assert.deepEqual(await main(['--list'], {}), STAGES);
});

for (const args of [[], ['--run', 'secret'], ['--check', '--contract'], ['--verify-evidence', '--contract', 'secret'], ['--contract']]) {
  test(`argument dispatch refuses ${JSON.stringify(args)}`, () => assert.throws(() => parseArguments(args), /JOURNEY_ARGUMENTS_INVALID/));
}
test('contract evidence selector is explicit', () => {
  assert.deepEqual(parseArguments(['--verify-evidence', '--contract']), { mode: '--verify-evidence', contract: true });
});

test('complete synthetic observations validate without claiming a live run', () => assert.equal(verifyJourneyEvidence(fixture()), true));
const mutations = {
  'missing mobile width': value => value.people.pop(),
  'duplicate person across widths': value => { value.people[1].documentId = value.people[0].documentId; },
  'expired access token': value => { value.people[0].refusal.accessTokenExpiresAt = value.people[0].refusal.observedAt; },
  'cleanup failure': value => { value.cleanup.privateFilesRemoved = false; },
  'missing conflict retry': value => { value.conflict.nativeRetryObserved = false; },
  'accelerated retry': value => { value.conflict.initialRetrySeconds = 1; },
  'missing correction': value => { value.conflict.correctionApplied = false; },
  'stale native completion': value => { value.tasks[0].finishedAt = value.tasks[0].triggeredAt; },
  'reused audit event': value => { value.tasks[1].nativeAuditId = value.tasks[0].nativeAuditId; },
  'missing native task': value => value.tasks.pop(),
  'disabled connector paging': value => { value.tasks[0].nativePaging = false; },
  'changed cadence': value => { value.tasks[0].cadenceSeconds = 1; },
  'foreign task oid': value => { value.tasks[0].taskOid = value.people[0].identityOid; },
  'wrong SCIM outcome': value => { value.tasks[0].scimStatus = 200; },
  'stale SCIM correlation': value => { value.tasks[1].scimCorrelationId = value.tasks[0].scimCorrelationId; },
  'task outside owning stage': value => { value.tasks[0].finishedAt = '2026-10-17T00:50:00.000Z'; },
  'hot-loop conflict retry': value => { value.conflict.retryTriggeredAt = value.tasks[6].finishedAt; },
  'POST conflict instead of connector PATCH': value => { value.tasks[6].scimMethod = 'POST'; },
  'POST recovery instead of connector PATCH': value => { value.tasks[7].scimMethod = 'POST'; value.tasks[7].scimStatus = 201; },
  'PUT conflict instead of connector PATCH': value => { value.tasks[6].scimMethod = 'PUT'; },
  'PUT recovery instead of connector PATCH': value => { value.tasks[7].scimMethod = 'PUT'; },
  'PATCH mover instead of lifecycle PUT': value => { value.tasks[1].scimMethod = 'PATCH'; },
  'refusal before its stage': value => { value.people[0].refusal.observedAt = value.date; },
  'refusal after its stage': value => { value.people[0].refusal.observedAt = '2026-10-17T00:04:59.000Z'; },
  'raw token': value => { value.token = 'private'; },
  'raw mail': value => { value.people[0].body = 'private'; },
  'action link': value => { value.people[0].url = 'http://localhost:8080/secret'; },
  'raw exception': value => { value.stages[0].exception = 'private'; },
  'partial stage outcomes': value => value.stages.pop(),
  'out of order outcomes': value => value.stages.reverse(),
  'failed outcome': value => { value.stages[0].outcome = 'failed'; },
  'overlapping stages': value => { value.stages[1].startedMs = 0; },
  'over-budget stage': value => { value.stages[0].durationMs = BUDGETS.setup + 1; },
  'over-budget evidence regressions': value => { value.stages.at(-1).durationMs = BUDGETS.evidence + 1; },
  'live stages past the overall budget': value => moveConflict(value, BUDGETS.overall - value.stages.at(-2).durationMs + 1),
  'unsafe screenshot path': value => { value.people[0].screenshots[0] = '../../secret.png'; },
  'password screenshot': value => { value.people[0].screenshots[0] = 'screenshots/keycloak-password.png'; },
  'missing full regressions': value => { value.regressions.backendUnfiltered = false; },
  'version mismatch': value => { value.versions.keycloak = 'unknown'; },
  'direct probe provenance': value => { value.provenance = 'direct-scim'; },
  'truthy browser refusal': value => { value.people[0].refusal.browserListRefused = 'true'; },
  'invalid calendar timestamp': value => { value.date = '2026-02-31T00:00:00.000Z'; },
};
for (const [name, mutate] of Object.entries(mutations)) test(`evidence rejects ${name}`, () => {
  const value = fixture(); mutate(value); assert.throws(() => verifyJourneyEvidence(value), /JOURNEY_EVIDENCE_INVALID/);
});

test('contract selector requires all four actual observations and cleanup', () => {
  const value = { format: 1, runId, date: '2026-10-17T00:00:00.000Z', provenance: 'live-keycloak-contract',
    keycloak: '26.6.1', observations: { A1: true, A2: true, A3: true, A4: true }, cleanup: true };
  assert.equal(verifyContractEvidence(value), true);
  value.observations.A4 = false;
  assert.throws(() => verifyContractEvidence(value), /JOURNEY_EVIDENCE_INVALID/);
});

test('private contract refuses non-disposable runs before reading paths', async () => {
  await assert.rejects(validatePrivateContract({ IAM_JOURNEY_DISPOSABLE: 'false' }), /JOURNEY_EVIDENCE_INVALID/);
});

test('private paths require containment, owner-only modes, no symlinks and a fresh database', async () => {
  const parent = path.join(ROOT, 'apps/backend/.tmp');
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(path.join(parent, 'journey-unit-'));
  const runDir = path.join(temporary, runId);
  await mkdir(runDir, { mode: 0o700 });
  const config = path.join(runDir, 'private.env');
  const compose = ['KC_BOOTSTRAP_ADMIN_USERNAME', 'KC_BOOTSTRAP_ADMIN_PASSWORD', 'MIDPOINT_ADMIN_PASSWORD',
    'MIDPOINT_DB_NAME', 'MIDPOINT_DB_USER', 'MIDPOINT_DB_PASSWORD', 'MIDPOINT_SCIM_TOKEN'].map(key => `${key}=synthetic`).join('\n');
  await writeFile(config, compose, { mode: 0o600 });
  const evidenceRoot = path.join(ROOT, '.planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/evidence');
  let createdRoot = false;
  const env = { IAM_JOURNEY_DISPOSABLE: 'true', IAM_JOURNEY_RUN_DIR: runDir,
    DATABASE_FILENAME: path.join(runDir, 'fresh.db'), ENV_PATH: config, IAM_JOURNEY_COMPOSE_ENV_FILE: config,
    IAM_JOURNEY_EVIDENCE_DIR: path.join(evidenceRoot, runId), KEYCLOAK_BASE_URL: 'http://localhost:8080',
    KEYCLOAK_ISSUER: 'http://localhost:8080/realms/idambox', AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/idambox',
    AUTH_URL: 'http://localhost:3000', CSRM_API_BASE_URL: 'http://127.0.0.1:1337', KEYCLOAK_REALM: 'idambox' };
  try {
    try { await mkdir(evidenceRoot); createdRoot = true; } catch (error) { if (error.code !== 'EEXIST') throw error; }
    await chmod(temporary, 0o700);
    assert.equal(await validatePrivateContract(env), true);
    await writeFile(config, compose.replace('MIDPOINT_SCIM_TOKEN=synthetic', 'MIDPOINT_SCIM_TOKEN='), { mode: 0o600 });
    assert.equal(await validatePrivateContract(env), true);
    await writeFile(config, compose.replace('MIDPOINT_DB_USER=synthetic', 'MIDPOINT_DB_USER='), { mode: 0o600 });
    await assert.rejects(validatePrivateContract(env), /JOURNEY_EVIDENCE_INVALID/);
    await writeFile(config, compose, { mode: 0o600 });
    await assert.rejects(validatePrivateContract({ ...env, CSRM_API_BASE_URL: 'https://remote.invalid' }), /JOURNEY_EVIDENCE_INVALID/);
    await assert.rejects(validatePrivateContract({ ...env, COMPOSE_PROJECT_NAME: 'foreign' }), /JOURNEY_EVIDENCE_INVALID/);
    await assert.rejects(validatePrivateContract({ ...env, DATABASE_FILENAME: path.join(temporary, 'foreign.db') }), /JOURNEY_EVIDENCE_INVALID/);
    await chmod(runDir, 0o755);
    await assert.rejects(validatePrivateContract(env), /JOURNEY_EVIDENCE_INVALID/);
    await chmod(runDir, 0o700);
    const linked = path.join(runDir, 'linked.env');
    await symlink(config, linked);
    await assert.rejects(validatePrivateContract({ ...env, ENV_PATH: linked }), /JOURNEY_EVIDENCE_INVALID/);
    await writeFile(env.DATABASE_FILENAME, '', { mode: 0o600 });
    await assert.rejects(validatePrivateContract(env), /JOURNEY_EVIDENCE_INVALID/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
    if (createdRoot) await rmdir(evidenceRoot);
  }
});

test('publication rejects secret-bearing input before creating directories', async () => {
  const value = fixture(); value.password = 'private';
  await assert.rejects(persistJourneyEvidence(value, '/never-create', new Map()), /JOURNEY_EVIDENCE_INVALID/);
});

test('atomic publication and directory verification require every width image', async () => {
  const value = fixture();
  const destination = path.join(EVIDENCE_ROOT, value.runId);
  let createdRoot = false;
  try {
    try { await mkdir(EVIDENCE_ROOT); createdRoot = true; } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const images = new Map();
    for (const person of value.people) for (const name of person.screenshots) {
      const header = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(header);
      header.writeUInt32BE(person.width, 16); header.writeUInt32BE(person.height, 20);
      images.set(name, header);
    }
    await persistJourneyEvidence(value, destination, images);
    assert.equal(await verifyEvidenceDirectory({ IAM_JOURNEY_EVIDENCE_DIR: destination }), true);
    await assert.rejects(persistJourneyEvidence(value, destination, images), /JOURNEY_EVIDENCE_INVALID/);
    await rm(path.join(destination, value.people[1].screenshots[0]));
    await assert.rejects(verifyEvidenceDirectory({ IAM_JOURNEY_EVIDENCE_DIR: destination }), /JOURNEY_EVIDENCE_INVALID/);
  } finally {
    await rm(destination, { recursive: true, force: true });
    if (createdRoot) await rmdir(EVIDENCE_ROOT);
  }
});

test('stage event stream contains only closed start and outcome metadata', async () => {
  const events = [];
  await executeJourney({ stage: async () => ({ token: 'private' }), cleanup: async () => {}, emit: event => events.push(event) });
  assert.equal(events.length, STAGES.length * 2 + 2);
  assert.deepEqual(events[0], { stage: 'preflight', outcome: 'started', startedMs: events[0].startedMs });
  assert.ok(!JSON.stringify(events).includes('private'));
  assert.equal(events.at(-1).stage, 'cleanup');
  assert.equal(events.at(-1).outcome, 'passed');
});

test('runner preserves the first failure when cleanup also fails', async () => {
  await assert.rejects(executeJourney({ stage: async () => { throw Error('private token'); },
    cleanup: async () => { throw Error('private mail'); } }), error => {
    assert.equal(error.code, 'JOURNEY_STAGE_FAILED');
    assert.equal(error.stage, 'preflight');
    assert.equal(error.cleanupCode, 'JOURNEY_CLEANUP_FAILED');
    assert.ok(!JSON.stringify(error).includes('private'));
    return true;
  });
});

const tokenLine = `idb_scim_v1.${'a'.repeat(24)}.${Buffer.alloc(32, 7).toString('base64url')}\n`;
const composeInput = ['KC_BOOTSTRAP_ADMIN_USERNAME=test-admin', 'KC_BOOTSTRAP_ADMIN_PASSWORD=test-password',
  'MIDPOINT_ADMIN_PASSWORD=test-midpoint', 'MIDPOINT_DB_NAME=test_db', 'MIDPOINT_DB_USER=test_user',
  'MIDPOINT_DB_PASSWORD=test_password', 'MIDPOINT_SCIM_TOKEN='].join('\n') + '\n';
const taskOid = suffix => `11000000-0000-4000-8000-000000000${suffix}`;

async function runtimeFixture(options = {}) {
  await mkdir(path.join(ROOT, 'apps/backend/.tmp'), { recursive: true });
  const parent = await mkdtemp(path.join(ROOT, 'apps/backend/.tmp/runtime-unit-'));
  const runDir = path.join(parent, runId);
  await mkdir(runDir, { mode: 0o700 });
  const env = { PATH: '/installed/bin', HOME: '/synthetic-home', IAM_JOURNEY_DISPOSABLE: 'true',
    IAM_JOURNEY_RUN_DIR: runDir, ENV_PATH: path.join(runDir, 'backend.env'),
    IAM_JOURNEY_COMPOSE_ENV_FILE: path.join(runDir, 'compose.env'), DATABASE_FILENAME: path.join(runDir, 'fresh.db'),
    AUTH_URL: 'http://localhost:3000', CSRM_API_BASE_URL: 'http://127.0.0.1:1337', KEYCLOAK_BASE_URL: 'http://localhost:8080',
    KEYCLOAK_ISSUER: 'http://localhost:8080/realms/idambox', AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/idambox',
    KEYCLOAK_REALM: 'idambox', KC_BOOTSTRAP_ADMIN_PASSWORD: 'ambient-ignored', MIDPOINT_SCIM_TOKEN: 'ambient-ignored' };
  await writeFile(env.ENV_PATH, 'APP_KEYS=synthetic-only\n', { mode: 0o600 });
  await writeFile(env.IAM_JOURNEY_COMPOSE_ENV_FILE, composeInput, { mode: 0o600 });
  await writeFile(path.join(runDir, '.journey-owner'), `${runId}\nidp\n`, { mode: 0o600 });
  const calls = []; const accesses = [];
  const io = new Proxy(runtimeFs, { get(target, key) {
    if (typeof target[key] !== 'function') return target[key];
    return (...args) => {
      if (typeof args[0] === 'string') {
        accesses.push(args[0]);
        assert.notEqual(args[0], path.join(ROOT, 'docker/.env'), 'developer environment is never accessed');
      }
      return target[key](...args);
    };
  } });
  let listenerAlive = false; let currentPerson; let held = false;
  const observed = employeeNumber => ({ sourceKey: employeeNumber, employeeNumber,
    sourceIdentityKey: 'digest', sourceDocumentId: 'source-doc', sourceName: 'midPoint (dev)', documentId: `doc-${employeeNumber}`,
    remoteSubject: options.canonicalIds ? `33333333-3333-4333-8333-33333333333${employeeNumber.at(-1)}` : `subject-${employeeNumber}`, roles: [], email: currentPerson?.email, department: currentPerson?.department,
    jobTitle: currentPerson?.jobTitle, accountStatus: currentPerson?.status === 'terminated' ? 'inactive' : 'active',
    outboxStatus: currentPerson?.status === 'terminated' ? held ? 'pending' : 'completed' : null });
  const start = (program, args, settings) => {
    const call = { program, args, settings }; calls.push(call);
    if (options.fail?.(call)) return { done: Promise.reject(Error('private-diagnostic')), close: async () => { calls.push({ event: 'closed-failure' }); }, alive: () => false };
    let output = ''; const isListener = settings.ipc === true;
    if (isListener) { listenerAlive = true; calls.push({ event: 'listener-start' }); }
    else if (program === process.execPath) { assert.equal(listenerAlive, false); calls.push({ event: 'administration' }); }
    else if (program === 'pnpm') { assert.equal(listenerAlive, false); calls.push({ event: 'token-cli' }); output = options.tokenOutput ?? tokenLine; }
    else if (program === 'ps') output = options.processes ?? '';
    else if (program === 'docker' && args[0] === 'ps') output = options.foreign ? 'foreign-container\n' : '';
    else if (program === 'docker' && args[0] === 'inspect') output = 'idambox/midpoint:4.8.14-scim2-1.2.9';
    else if (program === 'docker' && args.includes('--version')) output = PIN.midpoint;
    else if (program === 'docker' && args.includes('/opt/midpoint/connector-bundle/source-commit.txt')) output = PIN.sourceCommit;
    else if (program === 'docker' && args[0] === 'exec') {
      const method = args.at(-2); const endpoint = args.at(-1);
      let result = null;
      if (method === 'GET') {
        const target = endpoint.replace(/\?(options=raw|include=result)$/, '');
        if (/^\/(resources|objectTemplates|archetypes)\//.test(target)) assert.ok(endpoint.endsWith('?options=raw'), endpoint);
        const suffix = target.slice(-3);
        result = { oid: taskOid(suffix), executionState: 'runnable', schedulingState: 'ready', resultStatus: 'success', result: { status: 'success' },
          lastRunFinishTimestamp: options.now ? new Date(options.now() + 1).toISOString() : '2026-10-17T00:00:01.000Z' };
        if (suffix === '300') Object.assign(result, { schedule: { interval: 300 }, activity: { controlFlow: {
          errorHandling: { entry: { reaction: { retryLater: { initialInterval: 'PT5M', nextInterval: 'PT15M' } } } } } } });
        if (suffix === '110') Object.assign(result, { connectorConfiguration: { configurationProperties: {
          serviceUrl: PIN.endpoint, pagination: true, importBatchSize: 100 } } });
        // midPoint wraps each REST object under its type name.
        if (target.startsWith('/objectTemplates/')) result = { objectTemplate: result };
        if (target.startsWith('/archetypes/')) result = { archetype: result };
      } else if (endpoint === '/users/search') {
        const number = JSON.parse(settings.input).query.filter.text.match(/'([^']+)'/)[1];
        result = { object: { object: [{ oid: options.canonicalIds ? `22222222-2222-4222-8222-22222222222${number.at(-1)}` : `identity-${number}`, personalNumber: number }] } };
      } else if (endpoint.endsWith('/test')) result = { status: 'success' };
      output = `${result === null ? '' : JSON.stringify(result)}\n200`;
    }
    if (program === 'docker' && args.includes('{{.Names}}')) output = options.namedContainer ?? '';
    if (program === 'docker' && args.includes('{{.Name}}')) output = args[0] === 'volume' ? options.namedVolume ?? '' : options.namedNetwork ?? '';
    const done = options.databaseOnAdmin && program === process.execPath && !isListener
      ? runtimeFs.writeFile(env.DATABASE_FILENAME, 'synthetic-owned-sqlite', { mode: 0o600 }).then(() => output) : Promise.resolve(output);
    return { done, alive: () => isListener && listenerAlive,
      async close() { if (isListener) listenerAlive = false; calls.push({ event: 'closed', program, listener: isListener }); },
      async request(action, value) {
        calls.push({ event: action, value });
        if (options.listenerRequest) { const reply = await options.listenerRequest(action, value); if (reply !== undefined) return reply; }
        if (['access-prepare', 'access-mover', 'access-refuse'].includes(action)) return options.accessProof ?? { sessionKey: 'session', accessTokenExpiresAt: '2026-10-17T00:05:00.000Z', ...(action === 'access-refuse' ? { accessStatus: 403, detailStatus: 403, writeStatus: 403, beforeRemoteLogout: true } : {}) };
        if (action === 'hold') { held = true; return true; }
        if (action === 'release') { held = false; return true; }
        if (action === 'observe') return observed(value);
        return true;
      } };
  };
  const runtime = createJourneyRuntime({ env, io, start, portsFree: options.portsFree ?? (async () => {}),
    now: () => Date.parse('2026-10-17T00:00:00.000Z'),
    transport: async () => ({ ok: true, json: async () => ({ issuer: env.KEYCLOAK_ISSUER }) }),
    observeMail: async () => 1,
    observeRemote: async ({ kind, person, current }) => kind === 'remote-completion'
      ? { subject: current.remoteSubject, enabled: false, sessions: 0 }
      : { subject: current.remoteSubject, employeeNumber: person.employeeNumber, email: person.email,
        department: person.department, jobTitle: person.jobTitle, method: kind === 'joiner' ? 'POST' : 'PUT',
        nativeAuditId: `audit-${kind}-${person.width}`, scimCorrelationId: `scim-${kind}-${person.width}`,
        status: kind === 'joiner' ? 201 : 200, active: kind !== 'leaver', enabled: true },
    browser: options.browser, ...options.runtime });
  return { env, runtime, calls, accesses, io,
    async setup() { for (const stage of STAGES.slice(0, 8)) await runtime.stage(stage); },
    async person(kind, width) {
      const snapshot = createSnapshots(runId);
      const base = snapshot.people.find(row => row.width === width);
      currentPerson = { ...base, ...(kind !== 'joiner' ? { department: 'Risk', jobTitle: 'Risk Specialist', email: base.email.replace('@', '.moved@') } : {}),
        status: kind === 'leaver' ? 'terminated' : 'active' };
      await runtime.stage(`csv-${kind}-${width}`);
      return currentPerson;
    }, async close() { try { await runtime.cleanup(); } finally { await rm(parent, { recursive: true, force: true }); } } };
}

test('compose contract requires exact actual keys and empty initial token', () => {
  assert.equal(parseCompose(composeInput, { initial: true }).KC_BOOTSTRAP_ADMIN_USERNAME, 'test-admin');
  for (const text of [composeInput.replace('KC_BOOTSTRAP_ADMIN_USERNAME', 'KEYCLOAK_ADMIN'), composeInput.replace('MIDPOINT_DB_USER=test_user', 'MIDPOINT_DB_USER='),
    composeInput + 'MIDPOINT_DB_NAME=duplicate\n', composeInput.replace('MIDPOINT_SCIM_TOKEN=', 'MIDPOINT_SCIM_TOKEN=old'),
    composeInput.replace('MIDPOINT_DB_NAME=test_db', 'MIDPOINT_DB_NAME=${ambient}')]) {
    assert.throws(() => parseCompose(text, { initial: true }), /JOURNEY_COMPOSE_INVALID/);
  }
});

test('token pipe accepts exactly one canonical issued credential and rejects ambiguous diagnostics', () => {
  assert.equal(parseIssuedToken(`pnpm script header\n${tokenLine}`), tokenLine.trim());
  for (const text of ['', tokenLine + tokenLine, tokenLine.trim(), 'private-error\n', tokenLine.replace('v1.', 'v2.'), `prefix ${tokenLine}`]) {
    assert.throws(() => parseIssuedToken(text), /JOURNEY_TOKEN_INVALID/);
  }
});

test('administration and listener environments force seeds off, exact private SQLite and bridge off', () => {
  const env = { PATH: '/bin', DATABASE_FILENAME: path.join(ROOT, 'apps/backend/.tmp/private/fresh.db'), ENV_PATH: '/private/config', KEYCLOAK_TOKEN_CLIENT_ID: 'csrm-web',
    IDAMBOX_SEED_CSRM: 'true', IDAMBOX_SEED_IAM: 'true', CSRM_DEV_IDENTITY: 'true', DATABASE_URL: 'foreign' };
  for (const enabled of [false, true]) {
    const isolated = backendEnvironment(env, enabled);
    assert.equal(isolated.DATABASE_FILENAME, '.tmp/private/fresh.db');
    assert.equal(isolated.IDAMBOX_SEED_CSRM, 'false'); assert.equal(isolated.IDAMBOX_SEED_IAM, 'false');
    assert.equal(isolated.CSRM_DEV_IDENTITY, 'false'); assert.equal(isolated.IDAMBOX_KEYCLOAK_PROVISIONING, String(enabled));
    assert.equal(isolated.IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION, String(enabled)); assert.equal(isolated.DATABASE_URL, undefined);
    assert.equal(isolated.pnpm_config_verify_deps_before_run, 'false');
    assert.equal(isolated.KEYCLOAK_TOKEN_CLIENT_ID, 'csrm-web'); assert.equal(isolated.csrmAppIsEnabled, String(enabled));
  }
});

test('disposable startup completes administration and token child destruction before listener, then restores schedules', async () => {
  const fixture = await runtimeFixture();
  try {
    await fixture.setup();
    const cli = fixture.calls.find(call => call.program === 'pnpm');
    assert.deepEqual(cli.args, ['--dir', 'apps/backend', 'scim:token', 'midPoint (dev)', 'rotate']);
    assert.equal(cli.args.includes('--write-dev-env'), false);
    assert.equal(cli.settings.env.NODE_ENV, 'development');
    for (const call of fixture.calls.filter(call => call.program === process.execPath && call.args?.[0] === '-e')) {
      assert.doesNotThrow(() => new Script(call.args[1]));
    }
    const events = fixture.calls.filter(call => call.event).map(call => call.event === 'closed' ? `closed-${call.program}` : call.event);
    assert.ok(events.indexOf('administration') < events.indexOf('token-cli'));
    assert.ok(events.indexOf('closed-pnpm') < events.indexOf('listener-start'));
    assert.ok(events.indexOf(`closed-${process.execPath}`) < events.indexOf('token-cli'));
    assert.ok((await runtimeFs.readFile(fixture.env.IAM_JOURNEY_COMPOSE_ENV_FILE, 'utf8')).includes(tokenLine.trim()));
    for (const call of fixture.calls.filter(call => call.program === 'docker' && call.args?.[0] === 'compose')) {
      assert.deepEqual(call.args.slice(0, 10), ['compose', '--project-name', 'idp', '--env-file', fixture.env.IAM_JOURNEY_COMPOSE_ENV_FILE,
        '--project-directory', 'docker', '-f', 'docker/docker-compose.yaml', call.args[9]]);
      for (const key of ['KC_BOOTSTRAP_ADMIN_PASSWORD', 'MIDPOINT_SCIM_TOKEN', 'COMPOSE_PROJECT_NAME']) assert.equal(call.settings.env[key], undefined);
    }
    assert.ok(!JSON.stringify(fixture.calls.map(({ args }) => args)).includes(tokenLine.trim()));
    assert.equal(fixture.accesses.includes(path.join(ROOT, 'docker/.env')), false);
    const suspends = fixture.calls.filter(call => call.args?.at(-1)?.endsWith('/suspend'));
    assert.deepEqual(suspends.map(call => call.args.at(-1).slice(-11, -8)).length, 5);
    await fixture.runtime.cleanup();
    assert.equal(fixture.calls.filter(call => call.args?.at(-1)?.endsWith('/resume')).length, 5);
    await assert.rejects(runtimeFs.lstat(fixture.env.ENV_PATH), { code: 'ENOENT' });
    await assert.rejects(runtimeFs.lstat(fixture.env.IAM_JOURNEY_COMPOSE_ENV_FILE), { code: 'ENOENT' });
  } finally { await fixture.close(); }
});

test('compiler guard matches compiler commands, not kernel arguments', () => {
  for (const line of ['123 node tsc', '123 /repo/node_modules/.bin/tsc -p tests', '9 node strapi develop', '9 node -e compileStrapi'])
    assert.equal(foreignCompiler(line), true, line);
  for (const line of ['1758 com.docker.virtualization --cmdline console=hvc0 tsc=reliable virtio_net.disable_csum=1', '5 node tscheck.js', '6 vim notes-tsc.md'])
    assert.equal(foreignCompiler(line), false, line);
});

for (const scenario of ['foreign-listener', 'foreign-idp', 'foreign-compiler', 'wrong-origin', 'existing-db', 'missing-marker']) {
  test(`runtime refuses ${scenario} before destructive reset`, async () => {
    const fixture = await runtimeFixture({ foreign: scenario === 'foreign-idp', processes: scenario === 'foreign-compiler' ? '123 node tsc\n' : '',
      portsFree: async () => { if (scenario === 'foreign-listener') throw Error('JOURNEY_FOREIGN_LISTENER'); } });
    try {
      if (scenario === 'wrong-origin') fixture.env.AUTH_URL = 'http://localhost:3307';
      if (scenario === 'existing-db') await writeFile(fixture.env.DATABASE_FILENAME, 'foreign', { mode: 0o600 });
      if (scenario === 'missing-marker') await rm(path.join(fixture.env.IAM_JOURNEY_RUN_DIR, '.journey-owner'));
      await assert.rejects(fixture.runtime.stage('preflight'));
      assert.equal(fixture.calls.some(call => call.args?.includes('down')), false);
      assert.equal(fixture.calls.some(call => call.settings?.ipc), false);
    } finally { await fixture.close(); }
  });
}

for (const failureStage of ['administration', 'token', 'recreate', 'reload']) {
  test(`failure at ${failureStage} removes private handoffs and never starts listener`, async () => {
    const fixture = await runtimeFixture({ fail: ({ program, args }) => failureStage === 'administration' ? program === process.execPath
      : failureStage === 'token' ? program === 'pnpm' : failureStage === 'recreate' ? args.includes('--force-recreate')
        : program === 'bash' && args[0] === 'docker/midpoint/reload.sh' });
    try {
      await assert.rejects(fixture.setup());
      await fixture.runtime.cleanup();
      assert.equal(fixture.calls.some(call => call.settings?.ipc), false);
      await assert.rejects(runtimeFs.lstat(fixture.env.IAM_JOURNEY_COMPOSE_ENV_FILE), { code: 'ENOENT' });
      await assert.rejects(runtimeFs.lstat(fixture.env.ENV_PATH), { code: 'ENOENT' });
      assert.equal(fixture.accesses.includes(path.join(ROOT, 'docker/.env')), false);
    } finally { await fixture.close(); }
  });
}

test('handoff refuses symlinks, permissions, wrong owner and descriptor substitution', async () => {
  const fixture = await runtimeFixture();
  try {
    const file = fixture.env.IAM_JOURNEY_COMPOSE_ENV_FILE;
    const link = path.join(fixture.env.IAM_JOURNEY_RUN_DIR, 'link.env');
    await symlink(file, link);
    await assert.rejects(privateFile(link, fixture.env.IAM_JOURNEY_RUN_DIR), /JOURNEY_PRIVATE_PATH/);
    await chmod(file, 0o644);
    await assert.rejects(privateFile(file, fixture.env.IAM_JOURNEY_RUN_DIR), /JOURNEY_PRIVATE_PATH/);
    await chmod(file, 0o600);
    const wrongOwner = { ...runtimeFs, lstat: async name => {
      const st = await runtimeFs.lstat(name); return new Proxy(st, { get(target, key) { return key === 'uid' ? process.getuid() + 1 : Reflect.get(target, key); } });
    } };
    await assert.rejects(privateFile(file, fixture.env.IAM_JOURNEY_RUN_DIR, wrongOwner), /JOURNEY_PRIVATE_PATH/);
    const raced = { ...runtimeFs, open: async (...args) => {
      const handle = await runtimeFs.open(...args);
      await runtimeFs.rename(file, `${file}.old`); await writeFile(file, composeInput, { mode: 0o600 });
      return handle;
    } };
    await assert.rejects(privateFile(file, fixture.env.IAM_JOURNEY_RUN_DIR, raced), /JOURNEY_PRIVATE_RACE/);
  } finally { await fixture.close(); }
});

test('token handoff refuses a pathname replacement after initial validation', async () => {
  const fixture = await runtimeFixture();
  try {
    const file = fixture.env.IAM_JOURNEY_COMPOSE_ENV_FILE;
    const original = await privateFile(file, fixture.env.IAM_JOURNEY_RUN_DIR);
    await runtimeFs.rename(file, `${file}.old`); await writeFile(file, composeInput, { mode: 0o600 });
    await assert.rejects(replacePrivate(file, tokenLine, fixture.env.IAM_JOURNEY_RUN_DIR, original.stat), /JOURNEY_PRIVATE_RACE/);
    assert.equal(await runtimeFs.readFile(file, 'utf8'), composeInput);
  } finally { await fixture.close(); }
});

test('native polling rejects stale completion, running completion and unsuccessful results', async () => {
  let now = 1000; let polls = 0; const commands = [];
  const result = await awaitNativeTask({ suffix: '300', now: () => now, pause: async () => { now += 500; },
    mp: async (method, endpoint) => {
      commands.push([method, endpoint]);
      const row = { oid: taskOid('300'), executionState: 'runnable', lastRunFinishTimestamp: new Date(polls < 2 ? 1000 : 2000).toISOString(), resultStatus: 'success' };
      if (method === 'GET') { polls++; if (polls === 3) row.executionState = 'running'; }
      return row;
    } });
  assert.equal(result.finishedAt, '1970-01-01T00:00:02.000Z');
  assert.ok(polls >= 4);
  assert.deepEqual(commands[1], ['POST', `/tasks/${taskOid('300')}/run`]);
  await assert.rejects(awaitNativeTask({ suffix: '300', now: () => 1000, mp: async () => ({ oid: taskOid('300'), executionState: 'runnable',
    lastRunFinishTimestamp: new Date(2000).toISOString(), resultStatus: 'fatal_error' }) }), /JOURNEY_TASK_RESULT/);
});

test('native run resumes a held schedule only for the run and suspends it again, even on failure', async () => {
  for (const outcome of ['success', 'fatal_error']) {
    let now = 1000; const commands = [];
    const run = awaitNativeTask({ suffix: '310', now: () => now, pause: async () => { now += 500; },
      mp: async (method, endpoint) => { commands.push(`${method} ${endpoint.slice(endpoint.lastIndexOf('/'))}`);
        return { oid: taskOid('310'), executionState: 'runnable', schedulingState: commands.length === 1 ? 'suspended' : 'ready',
          lastRunFinishTimestamp: new Date(commands.length > 3 ? 2000 : 0).toISOString(), resultStatus: outcome }; } });
    if (outcome === 'success') await run; else await assert.rejects(run, /JOURNEY_TASK_RESULT/);
    assert.deepEqual(commands, [`GET /${taskOid('310')}`, 'POST /resume', 'POST /run', `GET /${taskOid('310')}`, 'POST /suspend']);
  }
});

test('native polling has an independent deadline and refuses busy/foreign tasks', async () => {
  let now = 0;
  await assert.rejects(awaitNativeTask({ suffix: '300', now: () => now, timeoutMs: 1000, pause: async () => { now += 500; },
    mp: async () => ({ oid: taskOid('300'), executionState: 'runnable', lastRunFinishTimestamp: new Date(0).toISOString() }) }), /JOURNEY_TASK_TIMEOUT/);
  await assert.rejects(awaitNativeTask({ suffix: '310', mp: async () => ({ oid: taskOid('310'), executionState: 'running' }) }), /JOURNEY_TASK_BUSY/);
  await assert.rejects(awaitNativeTask({ suffix: '999', mp: async () => { throw Error('must not call'); } }), /JOURNEY_TASK_INVALID/);
});

test('whole snapshots retain prior people and immutable source keys while mover updates attributes and leaver terminates', () => {
  const snapshots = createSnapshots(runId);
  assert.equal(new Set(snapshots.people.map(person => person.email)).size, 3);
  const joiner = snapshots.publish('joiner', 1440);
  const mover = snapshots.publish('mover', 1440);
  const leaver = snapshots.publish('leaver', 1440);
  assert.equal(mover.person.employeeNumber, joiner.person.employeeNumber);
  assert.equal(mover.person.username, joiner.person.username);
  assert.notEqual(mover.person.email, joiner.person.email);
  assert.equal(mover.person.department, 'Risk'); assert.equal(mover.person.jobTitle, 'Risk Specialist');
  assert.equal(leaver.person.status, 'terminated');
  const mobile = snapshots.publish('joiner', 375);
  assert.equal(parseCsv(mobile.text).length, 3);
  assert.equal(parseCsv(mobile.text)[1][8], 'terminated');
  assert.notEqual(snapshots.people[0].employeeNumber, snapshots.people[1].employeeNumber);
  assert.throws(() => snapshots.publish('joiner', 1440), /JOURNEY_SNAPSHOT_ORDER/);
});

test('stable-link validation refuses changed ownership, new subject and explicit role elevation', () => {
  const person = createSnapshots(runId).publish('joiner', 1440).person;
  const value = { sourceKey: person.employeeNumber, employeeNumber: person.employeeNumber, sourceIdentityKey: 'digest', sourceDocumentId: 'source',
    identityOid: 'identity', documentId: 'document', remoteSubject: 'subject', email: person.email,
    department: person.department, jobTitle: person.jobTitle, roles: [], accountStatus: 'active' };
  assert.equal(assertStableLink(value, value, person), true);
  for (const after of [{ ...value, documentId: 'foreign' }, { ...value, remoteSubject: 'new-subject' },
    { ...value, sourceDocumentId: 'foreign' }, { ...value, roles: ['Security Analyst'] }]) {
    assert.throws(() => assertStableLink(value, after, person), /JOURNEY_LINKAGE_CHANGED/);
  }
});

test('lifecycle publishes only through validated publisher/native tasks and releases hold after same-session refusal', async () => {
  const fixture = await runtimeFixture({ browser: { stage: async stage => ({ passed: true, sessionKey: 'same-session',
    accessTokenExpiresAt: '2026-10-17T00:05:00.000Z', ...(stage.startsWith('immediate-refusal') ? {
      accessStatus: 403, detailStatus: 403, writeStatus: 403, beforeRemoteLogout: true } : {}) }) } });
  try {
    await fixture.setup(); await fixture.person('joiner', 1440);
    await fixture.runtime.stage('requestor-access-1440');
    await fixture.person('mover', 1440); await fixture.person('leaver', 1440);
    await fixture.runtime.stage('immediate-refusal-1440');
    const publications = fixture.calls.filter(call => call.program === 'bash' && call.args?.[0] === 'docker/midpoint/hr-publish.sh');
    assert.equal(publications.length, 3);
    const rows = await runtimeFs.readFile(publications[2].args[1], 'utf8');
    assert.equal(parseCsv(rows)[1][8], 'terminated');
    const hold = fixture.calls.findIndex(call => call.event === 'hold');
    const lastPublish = fixture.calls.indexOf(publications[2]);
    const release = fixture.calls.findIndex(call => call.event === 'release');
    assert.ok(hold < lastPublish && release > lastPublish);
    assert.equal(fixture.calls.some(call => call.args?.some(arg => arg !== LISTENER && String(arg).includes('/scim/v2/Users'))), false);
  } finally { await fixture.close(); }
});

test('missing later browser stage remains closed and cannot report a complete journey', async () => {
  const fixture = await runtimeFixture();
  try {
    await fixture.setup();
    await assert.rejects(fixture.runtime.stage('password-setup-1440'), /JOURNEY_ADAPTER_UNAVAILABLE/);
    await assert.rejects(fixture.runtime.stage('in03-conflict'), /JOURNEY_CONFLICT_FAILED/);
    await assert.rejects(fixture.runtime.stage('evidence'), /JOURNEY_EVIDENCE_INVALID/);
  } finally { await fixture.close(); }
});

test('revocation window refuses near-expiry proof and releases after failure or time expiry', async () => {
  let now = 0; const calls = [];
  const window = createRevocationWindow({ now: () => now, hold: async ms => calls.push(['hold', ms]), release: async () => calls.push(['release']) });
  await assert.rejects(window.begin(new Date(10000).toISOString()), /JOURNEY_PROOF_WINDOW/);
  assert.deepEqual(calls, []);
  await window.begin(new Date(120000).toISOString());
  assert.deepEqual(calls[0], ['hold', 60000]);
  now = 60000;
  assert.throws(() => window.assertOpen(), /JOURNEY_PROOF_WINDOW/);
  await window.end(); await window.end();
  assert.equal(calls.filter(row => row[0] === 'release').length, 1);
});

test('loopback handshake requires bearer authentication, current named stage and closed payload', async () => {
  let handler; const server = new EventEmitter();
  server.listen = (_port, host, ready) => { assert.equal(host, '127.0.0.1'); ready(); };
  server.address = () => ({ port: 32123 }); server.closeAllConnections = () => {}; server.close = callback => callback();
  const control = await createLoopbackControl({ token: 'synthetic-control', serve: value => { handler = value; return server; } });
  const request = async (stage, payload, credential = 'Bearer synthetic-control') => {
    const req = Readable.from([JSON.stringify(payload)]);
    Object.assign(req, { method: 'POST', url: `/${stage}`, headers: { authorization: credential }, socket: { remoteAddress: '127.0.0.1' } });
    const response = { status: 0, writeHead(status) { this.status = status; return this; }, end() { return this; } };
    await handler(req, response); return response.status;
  };
  try {
    assert.equal(await request('requestor-access-1440', { passed: true }, 'Bearer wrong'), 403);
    assert.equal(await request('requestor-access-1440', { passed: true }), 409);
    const waiting = control.wait('requestor-access-1440');
    assert.equal(await request('requestor-access-1440', { passed: true, token: 'reject' }), 409);
    assert.equal(await request('requestor-access-1440', { passed: true, sessionKey: 'same' }), 200);
    assert.deepEqual(await waiting, { passed: true, sessionKey: 'same' });
    assert.throws(() => control.wait('requestor-access-1440'), /JOURNEY_CONTROL_ORDER/);
  } finally { await control.close(); }
});

for (const [key, name] of [['namedVolume', 'clamav-db'], ['namedContainer', 'scim_stub'], ['namedNetwork', 'idp_default']]) {
  test(`runtime refuses foreign fixed ${name} before reset`, async () => {
    const fixture = await runtimeFixture({ [key]: name });
    try {
      await assert.rejects(fixture.runtime.stage('preflight'), /JOURNEY_FOREIGN_IDP/);
      assert.equal(fixture.calls.some(call => call.args?.includes('down')), false);
    } finally { await fixture.close(); }
  });
}

test('failed token parsing cleans private configuration without listener or token delivery', async () => {
  const fixture = await runtimeFixture({ tokenOutput: tokenLine + tokenLine });
  try {
    await assert.rejects(fixture.setup(), /JOURNEY_TOKEN_INVALID/);
    assert.equal((await runtimeFs.readFile(fixture.env.IAM_JOURNEY_COMPOSE_ENV_FILE, 'utf8')).includes(tokenLine.trim()), false);
    assert.equal(fixture.calls.some(call => call.settings?.ipc), false);
    await fixture.runtime.cleanup();
    await assert.rejects(runtimeFs.lstat(fixture.env.IAM_JOURNEY_RUN_DIR), { code: 'ENOENT' });
  } finally { await fixture.close(); }
});

test('owned SQLite, late journal, handoffs and private directory are removed after listeners close', async () => {
  const fixture = await runtimeFixture({ databaseOnAdmin: true });
  try {
    await fixture.setup();
    await writeFile(`${fixture.env.DATABASE_FILENAME}-wal`, 'synthetic-owned-journal', { mode: 0o600 });
    await fixture.runtime.cleanup();
    await assert.rejects(runtimeFs.lstat(fixture.env.DATABASE_FILENAME), { code: 'ENOENT' });
    await assert.rejects(runtimeFs.lstat(`${fixture.env.DATABASE_FILENAME}-wal`), { code: 'ENOENT' });
    await assert.rejects(runtimeFs.lstat(fixture.env.IAM_JOURNEY_RUN_DIR), { code: 'ENOENT' });
  } finally { await fixture.close(); }
});

test('process browser starts with private control environment and waits on authenticated stage observations', async () => {
  const events = []; let requested;
  const fixture = await runtimeFixture({ runtime: {
    controlFactory: async () => ({ url: 'http://127.0.0.1:32123', token: 'synthetic-private',
      wait: async (stage, signal, input) => { requested = stage; assert.deepEqual(input, {sessionKey:'session',accessTokenExpiresAt:'2026-10-17T00:05:00.000Z'}); events.push('wait'); return browserObservation(stage, 'session'); },
      close: async () => events.push('close') }),
    browser: { start: async ({ env, origin }) => {
      events.push('start'); assert.equal(origin, 'http://localhost:3000');
      assert.deepEqual(env, { IAM_JOURNEY_CONTROL_URL: 'http://127.0.0.1:32123', IAM_JOURNEY_CONTROL_TOKEN: 'synthetic-private' });
    } } } });
  try {
    await fixture.setup(); const person = await fixture.person('joiner',1440); await fixture.runtime.stage('requestor-access-1440');
    assert.equal(fixture.calls.find(call => call.event === 'access-prepare').value,person.employeeNumber);
    assert.equal(requested, 'requestor-access-1440'); assert.deepEqual(events, ['wait', 'start']);
    await fixture.runtime.cleanup(); assert.deepEqual(events, ['wait', 'start', 'close']);
  } finally { await fixture.close(); }
});

test('failed same-session refusal always releases the revocation hold', async () => {
  const fixture = await runtimeFixture({ browser: { stage: async stage => ({ passed: true, sessionKey: stage.startsWith('immediate-refusal') ? 'changed-session' : 'original',
    accessTokenExpiresAt: '2026-10-17T00:05:00.000Z', accessStatus: 403, detailStatus: 403, writeStatus: 403, beforeRemoteLogout: true }) } });
  try {
    await fixture.setup(); await fixture.person('joiner', 1440); await fixture.runtime.stage('requestor-access-1440');
    await fixture.person('mover', 1440); await fixture.person('leaver', 1440);
    await assert.rejects(fixture.runtime.stage('immediate-refusal-1440'), /JOURNEY_BROWSER_INVALID/);
    assert.equal(fixture.calls.filter(call => call.event === 'release').length, 1);
  } finally { await fixture.close(); }
});

test('owned browser advertises every lifecycle stage at both widths', () => {
  const browser = createJourneyBrowser();
  for (const width of [1440, 375]) for (const kind of ['password-setup', 'requestor-sign-in', 'requestor-access', 'csv-mover', 'immediate-refusal', 'remote-completion']) {
    assert.equal(browser.supports(`${kind}-${width}`), true);
  }
  for (const stage of ['requestor-access-800', 'evidence', 'csv-leaver-375']) assert.equal(browser.supports(stage), false);
});

function browserObservation(stage, sessionKey = 'session') {
  const width = Number(stage.match(/-(1440|375)$/)?.[1]);
  const kind = stage.startsWith('requestor-access') ? 'requestor' : 'refusal';
  const bytes = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(width === 375 ? 812 : 900, 20);
  return { passed: true, ...(stage.startsWith('remote-completion') ? { freshSignInRefused: true } : { sessionKey, sameBrowserSession: true }),
    ...(stage.startsWith('requestor-access') ? { restrictedRoutesRefused: true, foreignRecordRefused: true } : {}),
    ...(stage.startsWith('immediate-refusal') ? { browserListRefused: true, browserDetailRefused: true } : {}),
    ...(/^(requestor-access|immediate-refusal)-/.test(stage) ? { screenshot: { name: `screenshots/csrm-${width}-${kind}.png`, png: bytes.toString('base64') } } : {}) };
}

test('lifecycle observations require actual UI assertions, retained session and exact safe viewport screenshot', () => {
  for (const width of [1440, 375]) for (const kind of ['requestor-access', 'csv-mover', 'immediate-refusal', 'remote-completion']) {
    const stage = `${kind}-${width}`; const value = browserObservation(stage); const input = { sessionKey: 'session' };
    assert.doesNotThrow(() => validateLifecycleObservation(stage, input, value));
    for (const patch of [{ passed: false }, { raw: actionUrl }, ...(kind === 'remote-completion' ? [{ freshSignInRefused: false }] : [{ sessionKey: 'different' }, { sameBrowserSession: false }])]) {
      assert.throws(() => validateLifecycleObservation(stage, input, { ...value, ...patch }), /JOURNEY_BROWSER_INVALID/);
    }
    if (value.screenshot) {
      for (const screenshot of [undefined, { ...value.screenshot, name: 'screenshots/password.png' },
        { ...value.screenshot, png: Buffer.alloc(24).toString('base64') }, { ...value.screenshot, png: `${value.screenshot.png}\n` }]) {
        assert.throws(() => validateLifecycleObservation(stage, input, { ...value, screenshot }), /JOURNEY_BROWSER_INVALID/);
      }
      const otherWidth = browserObservation(`${kind}-${width === 375 ? 1440 : 375}`).screenshot;
      assert.throws(() => validateLifecycleObservation(stage, input, { ...value, screenshot: { ...otherWidth, name: value.screenshot.name } }), /JOURNEY_BROWSER_INVALID/);
    }
  }
  assert.throws(() => validateLifecycleObservation('password-setup-375', {}, { passed: true }), /JOURNEY_BROWSER_INVALID/);
});

for (const width of [1440, 375]) test(`process lifecycle retains proof and releases hold after UI refusal at ${width}`, async () => {
  const fixture = await runtimeFixture({ runtime: {
    controlFactory: async () => ({ url: 'http://127.0.0.1:32123', token: 'private', close: async () => {},
      wait: async stage => browserObservation(stage) }), browser: { start: async () => {} } } });
  try {
    await fixture.setup(); await fixture.person('joiner', width);
    await fixture.runtime.stage(`requestor-access-${width}`);
    await fixture.person('mover', width); await fixture.person('leaver', width);
    await fixture.runtime.stage(`immediate-refusal-${width}`);
    await fixture.runtime.stage(`remote-completion-${width}`);
    assert.equal(fixture.calls.filter(call => call.event === 'access-refuse').length, 2);
    const lastProbe = fixture.calls.findLastIndex(call => call.event === 'access-refuse');
    assert.ok(fixture.calls.findIndex(call => call.event === 'release') > lastProbe);
    assert.equal(fixture.runtime.accessObservations().length, 4);
    assert.deepEqual([...fixture.runtime.screenshots().keys()], [`screenshots/csrm-${width}-requestor.png`, `screenshots/csrm-${width}-refusal.png`]);
  } finally { await fixture.close(); }
});

for (const patch of [{ browserListRefused: false }, { sessionKey: 'changed' }, { accessStatus: 401 }, { beforeRemoteLogout: false }]) {
  test(`invalid browser refusal ${Object.keys(patch)[0]} releases hold and retains no refusal proof`, async () => {
    const fixture = await runtimeFixture({ runtime: {
      controlFactory: async () => ({ url: 'http://127.0.0.1:32123', token: 'private', close: async () => {},
        wait: async stage => ({ ...browserObservation(stage), ...(stage.startsWith('immediate-refusal') ? patch : {}) }) }),
      browser: { start: async () => {} } } });
    try {
      await fixture.setup(); await fixture.person('joiner', 1440); await fixture.runtime.stage('requestor-access-1440');
      await fixture.person('mover', 1440); await fixture.person('leaver', 1440);
      await assert.rejects(fixture.runtime.stage('immediate-refusal-1440'), /JOURNEY_BROWSER_INVALID/);
      assert.equal(fixture.calls.filter(call => call.event === 'release').length, 1);
      assert.equal(fixture.runtime.accessObservations().some(([stage]) => stage.startsWith('immediate-refusal')), false);
    } finally { await fixture.close(); }
  });
}

test('expired handshake rejects its waiter and refuses late acknowledgements', async () => {
  let handler; const server = new EventEmitter();
  server.listen = (_port, _host, ready) => ready(); server.address = () => ({ port: 32123 });
  server.closeAllConnections = () => {}; server.close = callback => callback();
  const control = await createLoopbackControl({ token: 'private', serve: value => { handler = value; return server; } });
  const signal = new AbortController();
  try {
    const waiting = control.wait('immediate-refusal-375', signal.signal, { sessionKey: 'session' });
    signal.abort();
    await assert.rejects(waiting, /JOURNEY_ABORTED/);
    const req = Readable.from([JSON.stringify(browserObservation('immediate-refusal-375'))]);
    Object.assign(req, { method: 'POST', url: '/immediate-refusal-375', headers: { authorization: 'Bearer private' }, socket: { remoteAddress: '127.0.0.1' } });
    const response = { status: 0, writeHead(status) { this.status = status; return this; }, end() {} };
    await handler(req, response);
    assert.equal(response.status, 409);
  } finally { await control.close(); }
});

test('revocation hold failure releases independently and cannot leave an open proof window', async () => {
  let releases = 0;
  const window = createRevocationWindow({ now: () => 0, hold: async () => { throw Error('private'); }, release: async () => { releases++; } });
  await assert.rejects(window.begin(new Date(120000).toISOString()), /JOURNEY_PROOF_WINDOW/);
  assert.equal(window.active(), false); assert.equal(releases, 1);
  assert.throws(() => window.assertOpen(), /JOURNEY_PROOF_WINDOW/);
});

test('browser input and screenshot helpers close foreign routes and never capture authentication pages', async () => {
  const require = createRequire(path.join(ROOT, 'apps/csrm/package.json')); const ts = require('typescript');
  const source = await runtimeFs.readFile(path.join(ROOT, 'apps/csrm/e2e/iam-journey.spec.ts'), 'utf8');
  const exports = {};
  const test = Object.assign(() => {}, { describe: () => {} });
  new Script(ts.transpileModule(`${source}\nexport { validateAccessInput, safeScreenshot };`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)
    .runInNewContext({ exports, URL, require: name => name === '@playwright/test' ? { test } : require(name) });
  const input = { sessionKey: 'a'.repeat(64), list: '/app/requests', detail: `/app/requests/${'b'.repeat(24)}`,
    foreign: `/app/requests/${'c'.repeat(24)}`, restricted: '/app/review/requests', administration: '/app/admin/risk-types' };
  assert.doesNotThrow(() => exports.validateAccessInput(input));
  for (const patch of [{ list: 'https://foreign.invalid' }, { detail: '/app/requests/../../sign-in' }, { foreign: input.detail }, { sessionKey: 'raw-token' }, { administration: '/app' }]) {
    assert.throws(() => exports.validateAccessInput({ ...input, ...patch }), /JOURNEY_INPUT_INVALID/);
  }
  let shots = 0;
  const page = url => ({ url: () => url, screenshot: async options => { assert.equal(options.fullPage, false); assert.equal(options.path, undefined); shots++; return Buffer.from('private-image'); } });
  for (const url of [actionUrl, 'http://localhost:3000/sign-in', `http://localhost:3000${input.detail}?state=permission`, `http://localhost:3000${input.detail}#private`, 'http://foreign.invalid/app/requests/' + 'b'.repeat(24)]) {
    await assert.rejects(exports.safeScreenshot(page(url), 375, 'refusal'), /JOURNEY_SCREENSHOT_INVALID/);
  }
  assert.equal(shots, 0);
  const safe = await exports.safeScreenshot(page(`http://localhost:3000${input.detail}`), 375, 'refusal');
  assert.equal(safe.name, 'screenshots/csrm-375-refusal.png'); assert.equal(shots, 1);
});

test('failure of the post-UI API probe releases hold and cannot retain a passing screenshot', async () => {
  let probes = 0;
  const fixture = await runtimeFixture({
    listenerRequest: async action => {
      if (action === 'access-refuse' && ++probes === 2) throw Error('JOURNEY_PROOF_WINDOW');
    }, runtime: {
      controlFactory: async () => ({ url: 'http://127.0.0.1:32123', token: 'private', close: async () => {}, wait: async stage => browserObservation(stage) }),
      browser: { start: async () => {} } } });
  try {
    await fixture.setup(); await fixture.person('joiner', 1440); await fixture.runtime.stage('requestor-access-1440');
    await fixture.person('mover', 1440); await fixture.person('leaver', 1440);
    await assert.rejects(fixture.runtime.stage('immediate-refusal-1440'), /JOURNEY_PROOF_WINDOW/);
    assert.equal(probes, 2); assert.equal(fixture.calls.filter(call => call.event === 'release').length, 1);
    assert.equal(fixture.runtime.screenshots().has('screenshots/csrm-1440-refusal.png'), false);
    assert.equal(fixture.runtime.accessObservations().some(([stage]) => stage.startsWith('immediate-refusal')), false);
  } finally { await fixture.close(); }
});

function assemblyFixture() {
  const value = fixture();
  const accessObservations = new Map();
  for (const person of value.people) {
    const shared = { passed: true, sessionKey: `session-${person.width}`, requestorOnly: true, restrictedApisRefused: true,
      restrictedRoutesRefused: true, foreignRecordRefused: true, sameBrowserSession: true, secret: 'private-payload' };
    for (const kind of ['requestor-access', 'csv-mover']) accessObservations.set(`${kind}-${person.width}`, { ...shared });
    accessObservations.set(`immediate-refusal-${person.width}`, { ...shared, ...person.refusal });
    accessObservations.set(`remote-completion-${person.width}`, { passed: true, freshSignInRefused: true });
  }
  return { ...value, links: new Map(value.people.map(person => [person.width, person])), accessObservations };
}
test('default evidence assembly projects complete observations and discards private adapter payloads', () => {
  const input = assemblyFixture();
  input.tasks[0].private = 'private-task'; input.conflict.private = 'private-conflict';
  const bundle = assembleJourneyEvidence(input);
  assert.equal(verifyJourneyEvidence(bundle), true);
  assert.ok(!/private-(payload|task|conflict|control|action|token|secret)/.test(JSON.stringify(bundle)));
  assert.equal(bundle.tasks[7].invocation, 'native-retry-scanner');
});
for (const [name, mutate] of Object.entries({
  'partial stages': input => input.stages.pop(), 'failed stage': input => { input.stages[0].outcome = 'failed'; },
  'missing receipt': input => input.tasks.pop(), 'missing conflict': input => { input.conflict = undefined; },
  'failed regression': input => { input.regressions.backendUnfiltered = false; },
  'missing browser completion': input => input.accessObservations.delete('remote-completion-375'),
  'changed session': input => { input.accessObservations.get('csv-mover-1440').sessionKey = 'foreign'; },
})) test(`default evidence assembly refuses ${name}`, () => {
  const input = assemblyFixture(); mutate(input); assert.throws(() => assembleJourneyEvidence(input), /JOURNEY_EVIDENCE_INVALID/);
});

for (const scenario of ['complete', 'failed-regression', 'failed-cleanup']) test(`default evidence stage gates publication: ${scenario}`, async () => {
  const base = Date.parse('2026-10-17T00:00:00Z'); let time = base; let f; let regressions = 0;
  const proof = { sessionKey: 'session', accessTokenExpiresAt: new Date(base + 2000000).toISOString(),
    requestorOnly: true, restrictedApisRefused: true, foreignRecordRefused: true,
    accessStatus: 403, detailStatus: 403, writeStatus: 403, beforeRemoteLogout: true };
  f = await runtimeFixture({ canonicalIds: true, now: () => time,
    fail: call => scenario === 'failed-cleanup' && time - base > 200000 && call.program === 'docker' && call.args.includes('down'),
    listenerRequest: async action => action === 'access-refuse' ? { ...proof, observedAt: new Date(time).toISOString() } : undefined,
    accessProof: proof, runtime: { now: () => time,
      browser: { start: async () => ({}), close: async () => {} },
      controlFactory: async () => ({ url: 'http://127.0.0.1:12345', token: 'private-control', close: async () => {}, wait: async stage => browserObservation(stage) }),
      transport: async url => {
        if (url.includes('/messages?')) {
          const people = createSnapshots(runId).people.filter(person => person.width !== 'conflict');
          return { ok: true, json: async () => ({ total: 2, messages: people.map((person, index) =>
            ({ ID: `mail-${index}`, To: [{ Address: person.email }], Created: new Date(time).toISOString() })) }) };
        }
        if (url.includes('/message/')) {
          const person = createSnapshots(runId).people[Number(url.at(-1))];
          return { ok: true, json: async () => ({ ID: `mail-${url.at(-1)}`, To: [{ Address: person.email }], Date: new Date(time).toISOString().replace(/\.\d{3}Z$/, 'Z'), Text: actionUrl }) };
        }
        return { ok: true, json: async () => ({ issuer: f.env.KEYCLOAK_ISSUER }) };
      },
      conflict: async ({ onObservations }) => {
        const started = time;
        const tasks = [0, 1].map(index => ({ task: { oid: index ? '00000000-0000-4000-8000-000000000007' : taskOid('300'),
          startedAt: new Date(started + (index ? 301000 : 0)).toISOString(), finishedAt: new Date(started + (index ? 301100 : 100)).toISOString(),
          result: index ? 'success' : 'retry-later' }, nativeAuditId: `conflict-audit-${index}`, scimCorrelationId: `conflict-scim-${index}`,
          method: 'PATCH', status: index ? 200 : 503 }));
        onObservations(...tasks); time += 302000;
        return { ...fixture().conflict, retryScheduledAt: new Date(started + 300000).toISOString(), retryTriggeredAt: tasks[1].task.startedAt };
      },
      regressions: async () => {
        if (scenario === 'failed-regression') throw Error('private-regression-error');
        regressions++; assert.ok(f.calls.some(call => call.event === 'closed' && call.listener));
        await assert.rejects(runtimeFs.lstat(f.env.IAM_JOURNEY_RUN_DIR), { code: 'ENOENT' });
        return { backendUnfiltered: true, csrm: true, contracts: true };
      } } });
  f.env.IAM_JOURNEY_EVIDENCE_DIR = path.join(EVIDENCE_ROOT, runId);
  let createdRoot = false;
  try {
    try { await mkdir(EVIDENCE_ROOT); createdRoot = true; } catch (error) { if (error.code !== 'EEXIST') throw error; }
    f.runtime.begin(base);
    await assert.rejects(f.runtime.publish([], () => assert.fail('partial publication')), /JOURNEY_EVIDENCE_INVALID/);
    const rows = [];
    for (const stage of STAGES) {
      const start = time;
      if (stage === 'evidence' && scenario !== 'complete') {
        await assert.rejects(f.runtime.stage(stage));
        await assert.rejects(f.runtime.publish(rows, () => assert.fail('failed publication')), /JOURNEY_EVIDENCE_INVALID/);
        await assert.rejects(runtimeFs.lstat(f.env.IAM_JOURNEY_EVIDENCE_DIR), { code: 'ENOENT' });
        return;
      }
      const match = /^csv-(joiner|mover|leaver)-(1440|375)$/.exec(stage);
      if (match) await f.person(match[1], Number(match[2])); else await f.runtime.stage(stage);
      time += 1000;
      rows.push({ stage, outcome: 'passed', startedMs: start - base, durationMs: time - start });
    }
    assert.equal(regressions, 1);
    await f.runtime.publish(rows);
    assert.equal(await main(['--verify-evidence'], f.env), true);
    const bundle = JSON.parse(await runtimeFs.readFile(path.join(f.env.IAM_JOURNEY_EVIDENCE_DIR, 'journey.json'), 'utf8'));
    assert.equal(bundle.tasks.length, 8); assert.ok(!/private-(payload|task|conflict|control|action|token|secret)/.test(JSON.stringify(bundle)));
    const stat = await runtimeFs.stat(path.join(f.env.IAM_JOURNEY_EVIDENCE_DIR, 'screenshots/csrm-375-refusal.png'));
    assert.equal(stat.mode & 0o777, 0o600);
  } finally {
    await f.close(); await rm(f.env.IAM_JOURNEY_EVIDENCE_DIR, { recursive: true, force: true });
    if (createdRoot) await rmdir(EVIDENCE_ROOT);
  }
});
