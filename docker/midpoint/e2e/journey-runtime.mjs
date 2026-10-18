/** Disposable lifecycle runner. Importing this module performs no live operation. */
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as httpServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { ROOT, BUDGETS, STAGES, executeJourney } from './journey.mjs';
import { HEADER, validateSnapshot } from '../hr-validate.mjs';
import { assertResource, taskFinished, searchObjects, object } from './capture-lifecycle.mjs';
import { PIN } from './scim-evidence.mjs';
import { awaitPasswordMail } from './journey-mail.mjs';
import { createMailObservation, createRemoteObservation, runJourneyRegressions } from './journey-defaults.mjs';
import { assembleJourneyEvidence, persistJourneyEvidence, snapshotJourneyContracts } from './journey-evidence.mjs';

const APP = path.join(ROOT, 'apps/backend');
const TMP = path.join(APP, '.tmp');
const oid = suffix => `11000000-0000-4000-8000-000000000${suffix}`;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const composeKeys = Object.freeze(['KC_BOOTSTRAP_ADMIN_USERNAME', 'KC_BOOTSTRAP_ADMIN_PASSWORD',
  'MIDPOINT_ADMIN_PASSWORD', 'MIDPOINT_DB_NAME', 'MIDPOINT_DB_USER', 'MIDPOINT_DB_PASSWORD', 'MIDPOINT_SCIM_TOKEN']);
const within = (base, file) => path.isAbsolute(file ?? '') && path.resolve(file) === file
  && file.startsWith(`${base}${path.sep}`);
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.uid === b.uid && a.mode === b.mode;
const childKeys = ['APP_KEYS', 'API_TOKEN_SALT', 'ADMIN_JWT_SECRET', 'TRANSFER_TOKEN_SALT', 'JWT_SECRET',
  'ENCRYPTION_KEY', 'KEYCLOAK_BASE_URL', 'KEYCLOAK_REALM', 'KEYCLOAK_ISSUER',
  'KEYCLOAK_ADMIN_CLIENT_ID', 'KEYCLOAK_ADMIN_CLIENT_SECRET', 'KEYCLOAK_CLIENT_ID', 'KEYCLOAK_CLIENT_SECRET',
  'KEYCLOAK_PROVISIONING_CLIENT_ID', 'KEYCLOAK_PROVISIONING_CLIENT_SECRET', 'KEYCLOAK_REQUEST_TIMEOUT_MS', 'KEYCLOAK_TOKEN_CLIENT_ID'];

/** A tsc command word, not a substring such as a VM kernel's `tsc=reliable` argument. */
export const foreignCompiler = processes => processes.split('\n')
  .some(line => /(?:(?:^|[\s/])tsc(?:\s|$)|strapi\s+(?:build|develop|start)|compileStrapi)/.test(line));

/** Compose interpolation is exclusively from the explicit private file. */
export function composeEnvironment(env) {
  return Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL'].filter(key => typeof env[key] === 'string')
    .map(key => [key, env[key]]));
}

export function parseCompose(text, { initial = false } = {}) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=([A-Za-z0-9_.,:/@+-]*)$/.exec(line);
    if (!match || !composeKeys.includes(match[1]) || Object.hasOwn(values, match[1])) fail('JOURNEY_COMPOSE_INVALID');
    values[match[1]] = match[2];
  }
  if (composeKeys.some(key => !Object.hasOwn(values, key) || (key !== 'MIDPOINT_SCIM_TOKEN' && !values[key]))
    || (initial && values.MIDPOINT_SCIM_TOKEN !== '')) fail('JOURNEY_COMPOSE_INVALID');
  return values;
}

export function parseIssuedToken(stdout) {
  if (typeof stdout !== 'string' || stdout.length > 262144 || !stdout.endsWith('\n')) fail('JOURNEY_TOKEN_INVALID');
  const lines = stdout.split('\n').filter(line => line.includes('idb_scim'));
  const match = lines.length === 1 && /^idb_scim_v1\.[a-z0-9]{24}\.([A-Za-z0-9_-]{43})$/.exec(lines[0]);
  if (!match || Buffer.from(match[1], 'base64url').toString('base64url') !== match[1]) fail('JOURNEY_TOKEN_INVALID');
  return lines[0];
}

/** Bind the descriptor and pathname to the same owner-only inode; never follow a link. */
export async function privateFile(file, runDir, io = fs, { directory = false } = {}) {
  if (!within(TMP, runDir) || !within(runDir, file)) fail('JOURNEY_PRIVATE_PATH');
  if (await io.realpath(TMP) !== TMP) fail('JOURNEY_PRIVATE_PATH');
  const segments = path.relative(TMP, file).split(path.sep);
  let current = TMP;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const st = await io.lstat(current);
    if (st.isSymbolicLink() || st.uid !== process.getuid() || (st.mode & 0o077)
      || (index < segments.length - 1 || directory ? !st.isDirectory() : !st.isFile())) fail('JOURNEY_PRIVATE_PATH');
  }
  const before = await io.lstat(file);
  if (directory) return before;
  const handle = await io.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!same(before, opened) || !same(opened, await io.lstat(file))) fail('JOURNEY_PRIVATE_RACE');
    const text = await handle.readFile('utf8');
    if (!same(opened, await io.lstat(file))) fail('JOURNEY_PRIVATE_RACE');
    return { stat: opened, text };
  } finally { await handle.close(); }
}

/** A fresh exclusive sibling plus inode checks prevents adoption of a substituted handoff. */
export async function replacePrivate(file, text, runDir, expected, io = fs) {
  const before = await privateFile(file, runDir, io);
  if (!same(before.stat, expected)) fail('JOURNEY_PRIVATE_RACE');
  const pending = `${file}.${randomBytes(12).toString('hex')}.pending`;
  let created = false;
  try {
    const handle = await io.open(pending, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    created = true;
    try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
    if (!same((await privateFile(file, runDir, io)).stat, expected)) fail('JOURNEY_PRIVATE_RACE');
    await io.rename(pending, file);
    const result = await privateFile(file, runDir, io);
    if (result.text !== text) fail('JOURNEY_PRIVATE_RACE');
    return result;
  } finally { if (created) await io.rm(pending, { force: true }); }
}

export function backendEnvironment(env, listener = false) {
  return { ...composeEnvironment(env), ...Object.fromEntries(childKeys.filter(key => env[key] !== undefined).map(key => [key, env[key]])),
    NODE_ENV: 'development', ENV_PATH: env.ENV_PATH, DATABASE_CLIENT: 'sqlite',
    DATABASE_FILENAME: path.relative(APP, env.DATABASE_FILENAME), HOST: '127.0.0.1', PORT: '1337',
    IDAMBOX_SEED_CORE: 'false', IDAMBOX_SEED_CSRM: 'false', IDAMBOX_SEED_IAM: 'false',
    IDAMBOX_KEYCLOAK_PROVISIONING: String(listener), IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: String(listener),
    // The owned listener serves the CSRM sign-in journey; administration children serve no routes.
    csrmAppIsEnabled: String(listener),
    CSRM_DEV_IDENTITY: 'false', STRAPI_TELEMETRY_DISABLED: 'true', pnpm_config_verify_deps_before_run: 'false' };
}

/** All child output is private and bounded; only an explicitly requested stdout pipe is retained. */
export function startOwned(program, args, { env, cwd = ROOT, input, signal, ipc = false, capture = false, maxBytes = 262144 } = {}) {
  signal?.throwIfAborted();
  const child = spawn(program, args, { cwd, env, detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe', ...(ipc ? ['ipc'] : [])] });
  let stdout = ''; let bytes = 0; let exited = false;
  const pending = new Map();
  const kill = kind => { try { process.platform !== 'win32' ? process.kill(-child.pid, kind) : child.kill(kind); } catch { /* Already closed. */ } };
  let readyResolve; let readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  void ready.catch(() => {});
  const done = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('JOURNEY_CHILD_FAILED')));
    child.once('exit', () => { exited = true; });
    child.once('close', code => { readyReject(new Error('JOURNEY_CHILD_CLOSED')); exited = true; code === 0 ? resolve(stdout) : reject(new Error('JOURNEY_CHILD_FAILED')); });
  });
  void done.catch(() => {});
  // Only retained output is bounded; long-running servers log freely and their output is discarded.
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    if (!capture) return;
    bytes += chunk.length;
    if (bytes > maxBytes) kill('SIGTERM');
    if (stream === child.stdout && bytes <= maxBytes) stdout += chunk.toString();
  });
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  child.on('message', reply => {
    if (reply?.ready === true) readyResolve();
    const request = pending.get(reply?.id);
    if (request) { pending.delete(reply.id); reply.ok === true ? request.resolve(reply.value) : request.reject(new Error('JOURNEY_CHILD_CONTROL')); }
  });
  const abort = () => { void close(); };
  signal?.addEventListener('abort', abort, { once: true });
  async function close() {
    signal?.removeEventListener('abort', abort);
    for (const request of pending.values()) request.reject(new Error('JOURNEY_CHILD_CLOSED'));
    pending.clear();
    if (exited) return;
    kill('SIGTERM');
    let timer;
    await Promise.race([done.catch(() => {}), new Promise(resolve => { timer = setTimeout(() => { kill('SIGKILL'); resolve(); }, 3000); })]);
    clearTimeout(timer);
    if (!exited) await done.catch(() => {});
  }
  return { done, ready, close, alive: () => !exited, async request(action, value, requestSignal = signal) {
    if (!ipc || exited) fail('JOURNEY_CHILD_CONTROL');
    const id = randomBytes(12).toString('hex');
    let timer; let abortRequest;
    try {
      return await Promise.race([new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        child.send({ id, action, value }, error => { if (error) reject(new Error('JOURNEY_CHILD_CONTROL')); });
      }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('JOURNEY_CHILD_CONTROL')), 15000); }),
      ...(requestSignal ? [new Promise((_, reject) => {
        if (requestSignal.aborted) reject(new Error('JOURNEY_ABORTED'));
        else { abortRequest = () => reject(new Error('JOURNEY_ABORTED')); requestSignal.addEventListener('abort', abortRequest, { once: true }); }
      })] : [])]);
    } finally { clearTimeout(timer); if (abortRequest) requestSignal.removeEventListener('abort', abortRequest); pending.delete(id); }
  } };
}

const ADMINISTRATION = String.raw`
const path = require('node:path');
process.umask(0o077);
process.stdout.write = process.stderr.write.bind(process.stderr);
(async () => {
  const runtime = require('@strapi/strapi');
  const compiled = await runtime.compileStrapi({ appDir: process.cwd() });
  const mod = name => require(path.join(compiled.distDir, 'src', name));
  mod('bootstrap/boot-mode.js').markAdministrationBoot();
  let app;
  try {
    app = runtime.createStrapi({ appDir: process.cwd(), distDir: compiled.distDir });
    await app.load();
    const saved = process.env.IDAMBOX_SEED_CORE;
    try { process.env.IDAMBOX_SEED_CORE = 'true'; await mod('bootstrap/seed-core-data.js').seedCoreData(app); }
    finally { if (saved === undefined) delete process.env.IDAMBOX_SEED_CORE; else process.env.IDAMBOX_SEED_CORE = saved; }
    await mod('bootstrap/seed-csrm-data.js').seedCapabilityCatalogue(app);
    const apps = await app.documents('api::application.application').findMany({ filters: { slug: 'idambox-iam' }, limit: 2 });
    const roles = await app.documents('api::role.role').findMany({ filters: { name: 'Identity Provisioning' },
      populate: { functions: { populate: { application: true, functionApis: true } } }, limit: 2 });
    const catalogue = require(path.resolve(process.cwd(), '../../docs/references/idambox-csrm-role-function-api-catalogue.json'));
    const expected = catalogue.functionApis.filter(row => row.functionId === 'function.identity_provisioning.api').map(row => row.url).sort();
    const fn = roles[0]?.functions?.[0];
    if (apps.length !== 1 || apps[0].applicationStatus !== 'active' || roles.length !== 1 || roles[0].functions.length !== 1
      || fn.name !== 'Identity Provisioning' || fn.menuPath || fn.application.documentId !== apps[0].documentId
      || expected.length !== 21 || JSON.stringify(fn.functionApis.map(row => row.url).sort()) !== JSON.stringify(expected)
      || (await app.documents('api::idambox-user.idambox-user').findMany({ limit: 1 })).length) throw Error('JOURNEY_PREREQUISITES');
    await mod('iam/identity/source-registration.js').registerIdentitySource(app, {
      name: 'midPoint (dev)', username: 'midpoint-dev-provisioning', email: 'midpoint-dev-provisioning@idambox.test', displayName: 'midPoint (dev) provisioning'
    });
    await mod('iam/scim/token-service.js').administerSourceToken(app, 'midPoint (dev)', 'issue');
  } finally { if (app) await app.destroy(); }
})().catch(() => { process.exitCode = 1; });`;

/** Process control stays inside this disposable listener; production authorization has no gate branch. */
export const LISTENER = String.raw`
const path = require('node:path');
process.umask(0o077);
process.stdout.write = process.stderr.write.bind(process.stderr);
(async () => {
  const runtime = require('@strapi/strapi');
  const distDir = path.join(process.cwd(), 'dist');
  const app = runtime.createStrapi({ appDir: process.cwd(), distDir });
  const mod = name => require(path.join(distDir,'src',name));
  const worker = require(path.join(distDir, 'src/iam/keycloak-sync/worker.js'));
  let held = false; let timer; let closed = false;
  const release = () => { clearTimeout(timer); if (held) { held = false; worker.startKeycloakSyncWorker(app); } };
  const close = async () => { if (closed) return; closed = true; clearTimeout(timer); await app.destroy(); process.exit(0); };
  process.on('SIGTERM', () => { void close(); });
  const {createScimObserver} = await import(require('node:url').pathToFileURL(path.resolve(process.cwd(),'../../docker/midpoint/e2e/journey-observations.mjs')).href);
  const scim = createScimObserver(process.env.MIDPOINT_SCIM_TOKEN);
  const originalLog = app.log.info.bind(app.log);
  app.log.info = (...args) => { scim.log(args[0]); return originalLog(...args); };
  await app.start();
  const {createAccessDriver} = await import(require('node:url').pathToFileURL(path.resolve(process.cwd(),'../../docker/midpoint/e2e/journey-access.mjs')).href);
  const {createLocalAdmin} = await import(require('node:url').pathToFileURL(path.resolve(process.cwd(),'../../docker/midpoint/e2e/journey-bindings.mjs')).href);
  const catalogue = require(path.resolve(process.cwd(),'../../docs/references/idambox-csrm-role-function-api-catalogue.json'));
  const access = createAccessDriver({app,mod,env:process.env,catalogue,admin:createLocalAdmin({env:process.env})});
  const webCredential = await access.initialize();
  app.server.app.middleware.unshift(async (ctx,next) => {
    await access.capture(ctx); await scim.run(ctx,next);
  });
  process.on('message', async message => {
    try {
      let value;
      if (message.action === 'ready') value = true;
      else if (message.action === 'web-credential') value = webCredential;
      else if (message.action === 'access-prepare') value = await access.prepare(message.value);
      else if (message.action === 'access-mover') value = await access.mover(message.value);
      else if (message.action === 'access-refuse') { if (!held) throw Error(); value = await access.refuse(message.value); }
      else if (message.action === 'scim') {
        const query = message.value;
        if (query.kind === 'localUnique') value = (await app.documents('api::idambox-user.idambox-user').findMany({filters:{email:{$eqi:query.email}},limit:2})).length === 0;
        else if (query.kind === 'remoteOnly') value = (await app.documents('api::idambox-user.idambox-user').findMany({filters:{externalSubject:query.subject},limit:2})).length === 0;
        else value = scim.find(query);
      }
      else if (message.action === 'hold') {
        const ms = message.value;
        if (held || !Number.isSafeInteger(ms) || ms < 1 || ms > 60000) throw Error();
        await worker.stopKeycloakSyncWorker(app); held = true; timer = setTimeout(release, ms); value = true;
      } else if (message.action === 'release') { release(); value = true; }
      else if (message.action === 'observe') {
        if (!/^\d{6,12}$/.test(message.value)) throw Error();
        const users = await app.documents('api::idambox-user.idambox-user').findMany({
          filters: { sourceExternalId: message.value }, populate: { identitySource: true, roles: true }, limit: 2 });
        if (users.length !== 1) throw Error();
        const user = users[0];
        const outbox = await app.documents('api::keycloak-sync-outbox.keycloak-sync-outbox').findFirst({ filters: { userDocumentId: user.documentId } });
        value = { sourceKey: user.sourceExternalId, sourceIdentityKey: user.sourceIdentityKey,
          sourceDocumentId: user.identitySource?.documentId, sourceName: user.identitySource?.name,
          localMatches: users.length, documentId: user.documentId, remoteSubject: user.externalSubject, accountStatus: user.accountStatus,
          employeeNumber: user.employeeNumber, email: user.email, department: user.department, jobTitle: user.jobTitle,
          roles: user.roles.map(role => role.name), outboxStatus: outbox?.syncStatus ?? null };
      } else throw Error();
      process.send({ id: message.id, ok: true, value });
    } catch { process.send({ id: message.id, ok: false }); }
  });
})().catch(() => { process.exit(1); });`;

/** midPoint objects such as tasks grow with every run; native REST reads get an explicit, larger bound. */
export const NATIVE_READ_BYTES = 16 * 1048576;
/** curl inside the container stops at 30 s; a hung docker exec is killed shortly after. */
export const nativeSignal = signal => AbortSignal.any([AbortSignal.timeout(45000), ...(signal ? [signal] : [])]);

/** One on-demand run. midPoint ignores run-now for a suspended task, so a schedule held by the
 * runner is resumed for the run and suspended again afterwards. Completion is read from the
 * always-present resultStatus; the default read also carries the run's item statistics. */
export async function runNativeTask({ mp, suffix, signal, now = Date.now, pause = delay, timeoutMs = BUDGETS.ordinary }) {
  if (!['300', '310', '320', '330', '340'].includes(suffix)) fail('JOURNEY_TASK_INVALID');
  const endpoint = `/tasks/${oid(suffix)}`;
  const prior = object(await mp('GET', endpoint, null, signal));
  if (prior?.oid !== oid(suffix) || prior.executionState === 'running') fail('JOURNEY_TASK_BUSY');
  const held = prior.schedulingState === 'suspended';
  const triggered = now();
  try {
    if (held) await mp('POST', `${endpoint}/resume`, null, signal);
    await mp('POST', `${endpoint}/run`, null, signal);
    const deadline = triggered + timeoutMs;
    for (;;) {
      signal?.throwIfAborted();
      if (now() >= deadline) fail('JOURNEY_TASK_TIMEOUT');
      const task = object(await mp('GET', endpoint, null, signal));
      if (task?.oid !== oid(suffix)) fail('JOURNEY_TASK_INVALID');
      if (taskFinished(task, triggered)) return { task, triggered };
      await pause(Math.min(500, deadline - now()), undefined, { signal });
    }
  } finally { if (held) await mp('POST', `${endpoint}/suspend`, null, signal); }
}

export async function awaitNativeTask(options) {
  const { task, triggered } = await runNativeTask(options);
  if (task.resultStatus !== 'success') fail('JOURNEY_TASK_RESULT');
  return { taskOid: task.oid, triggeredAt: new Date(triggered).toISOString(), finishedAt: task.lastRunFinishTimestamp, result: 'success' };
}

export function createSnapshots(runId) {
  if (!/^iam-journey-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(runId ?? '')) fail('JOURNEY_SNAPSHOT_INVALID');
  const digest = createHash('sha256').update(runId).digest('hex');
  const prefix = `9${String(parseInt(digest.slice(0, 8), 16)).padStart(10, '0')}`;
  const people = [1440, 375, 'conflict'].map((width, index) => ({ width, employeeNumber: `${prefix}${index}`,
    givenName: 'Journey', familyName: `Person${index}`, preferredName: '', email: `journey-${digest.slice(0, 12)}-${index}@hr.idambox.test`,
    username: `journey.${digest.slice(0, 12)}.${index}`, department: 'Engineering', jobTitle: 'Engineer', status: 'active', startDate: '', endDate: '' }));
  const present = new Map();
  const quote = value => /[,"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return { people, publish(kind, width) {
    const person = people.find(row => row.width === width);
    if (!person || !['joiner', 'mover', 'leaver'].includes(kind)) fail('JOURNEY_SNAPSHOT_INVALID');
    if ((kind === 'joiner') === present.has(width)) fail('JOURNEY_SNAPSHOT_ORDER');
    if (kind === 'joiner') present.set(width, { ...person });
    else if (kind === 'mover') Object.assign(present.get(width), { department: 'Risk', jobTitle: 'Risk Specialist',
      email: person.email.replace('@', '.moved@') });
    else present.get(width).status = 'terminated';
    const text = `${HEADER.join(',')}\n${[...present.values()].map(row => HEADER.map(key => quote(row[key])).join(',')).join('\n')}\n`;
    if (validateSnapshot(text).length) fail('JOURNEY_SNAPSHOT_INVALID');
    return { text, person: { ...present.get(width) } };
  } };
}

export function assertStableLink(before, after, person, { leaver = false } = {}) {
  for (const key of ['sourceKey', 'sourceIdentityKey', 'sourceDocumentId', 'identityOid', 'documentId', 'remoteSubject']) {
    if (typeof before?.[key] !== 'string' || !before[key] || before[key] !== after?.[key]) fail('JOURNEY_LINKAGE_CHANGED');
  }
  if (after.sourceKey !== person.employeeNumber || after.employeeNumber !== person.employeeNumber || after.email !== person.email
    || after.department !== person.department || after.jobTitle !== person.jobTitle
    || after.accountStatus !== (leaver ? 'inactive' : 'active') || !Array.isArray(after.roles) || after.roles.length !== 0) fail('JOURNEY_LINKAGE_CHANGED');
  return true;
}

/** A bounded hold is released independently of browser or task failure. */
export function createRevocationWindow({ hold, release, now = Date.now, maxMs = 60000 }) {
  let active = false; let deadline = 0; let timer;
  return { async begin(expiresAt, neededMs = 30000) {
    const expires = Date.parse(expiresAt);
    if (active || !Number.isFinite(expires) || neededMs < 1 || neededMs > maxMs || expires - now() <= neededMs + 2000) fail('JOURNEY_PROOF_WINDOW');
    deadline = Math.min(now() + maxMs, expires - 1000);
    active = true;
    try { await hold(deadline - now()); }
    catch { active = false; await release(); throw new Error('JOURNEY_PROOF_WINDOW'); }
    timer = setTimeout(() => { void this.end().catch(() => {}); }, deadline - now()); timer.unref?.();
  }, assertOpen() { if (!active || now() >= deadline) fail('JOURNEY_PROOF_WINDOW'); },
  async end() { clearTimeout(timer); if (active) { active = false; await release(); } }, active: () => active };
}

/** Browser acknowledgements cannot replace the listener's independent API observations. */
export function validateLifecycleObservation(stage, input, value) {
  const match = /^(requestor-access|csv-mover|immediate-refusal|remote-completion)-(1440|375)$/.exec(stage);
  if (!match || !value || value.passed !== true) fail('JOURNEY_BROWSER_INVALID');
  const flags = match[1] === 'requestor-access' ? ['restrictedRoutesRefused', 'foreignRecordRefused', 'sameBrowserSession']
    : match[1] === 'csv-mover' ? ['sameBrowserSession']
      : match[1] === 'immediate-refusal' ? ['sameBrowserSession', 'browserListRefused', 'browserDetailRefused'] : ['freshSignInRefused'];
  if (flags.some(key => value[key] !== true)
    || Object.keys(value).some(key => !['passed', 'sessionKey', 'screenshot', ...flags].includes(key))
    || match[1] !== 'remote-completion' && (!/^[a-zA-Z0-9_-]{1,80}$/.test(input?.sessionKey ?? '')
      || value.sessionKey !== input.sessionKey)) fail('JOURNEY_BROWSER_INVALID');
  const kind = match[1] === 'requestor-access' ? 'requestor' : match[1] === 'immediate-refusal' ? 'refusal' : undefined;
  if (!kind) { if (value.screenshot !== undefined) fail('JOURNEY_BROWSER_INVALID'); return; }
  const shot = value.screenshot;
  const width = Number(match[2]);
  if (!shot || Object.keys(shot).sort().join(',') !== 'name,png'
    || shot.name !== `screenshots/csrm-${width}-${kind}.png` || typeof shot.png !== 'string'
    || shot.png.length > 2_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(shot.png)) fail('JOURNEY_BROWSER_INVALID');
  const bytes = Buffer.from(shot.png, 'base64');
  if (bytes.toString('base64') !== shot.png || bytes.length < 24
    || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    || bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== (width === 375 ? 812 : 900)) fail('JOURNEY_BROWSER_INVALID');
  return { name: shot.name, bytes };
}

/** Authenticated loopback coordination carries no credentials on a command line. */
export async function createLoopbackControl({ token = randomBytes(32).toString('base64url'), signal, serve = httpServer } = {}) {
  const waiting = new Map(); const used = new Set(); let closed = false;
  const server = serve(async (req, res) => {
    const credential = req.headers.authorization ?? '';
    const expected = `Bearer ${token}`;
    if (!['POST', 'GET'].includes(req.method) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
      || req.headers.origin !== undefined || req.headers.host !== undefined && !/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(req.headers.host)
      || Buffer.byteLength(credential) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(credential), Buffer.from(expected))) { res.writeHead(403).end(); return; }
    try {
      const stage = req.method === 'GET' ? req.url?.replace(/^\/input\//, '') : req.url?.slice(1);
      const entry = waiting.get(stage);
      if (!entry || !STAGES.includes(stage)) throw Error();
      if (req.method === 'GET') {
        if (!req.url?.startsWith('/input/') || !entry.input || entry.delivered) throw Error();
        entry.delivered = true;
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(entry.input)); return;
      }
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 2_010_000) throw Error(); }
      const value = JSON.parse(body);
      if (Object.keys(value).some(key => !['passed', 'accessTokenExpiresAt', 'sessionKey', 'invitationCount', 'accessStatus', 'detailStatus', 'writeStatus', 'beforeRemoteLogout', 'restrictedRoutesRefused', 'foreignRecordRefused', 'sameBrowserSession', 'browserListRefused', 'browserDetailRefused', 'freshSignInRefused', 'screenshot'].includes(key))
        || value.passed !== true
        || value.sessionKey !== undefined && !/^[a-zA-Z0-9_-]{1,80}$/.test(value.sessionKey)
        || value.accessTokenExpiresAt !== undefined && !Number.isFinite(Date.parse(value.accessTokenExpiresAt))) throw Error();
      waiting.delete(stage); entry.resolve(value);
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"passed":true}');
    } catch { res.writeHead(409).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const close = async () => {
    if (closed) return; closed = true;
    for (const entry of waiting.values()) entry.reject(new Error('JOURNEY_CONTROL_CLOSED'));
    waiting.clear(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  };
  signal?.addEventListener('abort', () => { void close(); }, { once: true });
  return { url: `http://127.0.0.1:${server.address().port}`, token, close,
    wait(stage, stageSignal, input) {
      if (closed || !STAGES.includes(stage) || waiting.has(stage) || used.has(stage)) fail('JOURNEY_CONTROL_ORDER');
      used.add(stage);
      return new Promise((resolve, reject) => {
        const abort = () => { waiting.delete(stage); reject(new Error('JOURNEY_ABORTED')); };
        if (stageSignal?.aborted) { abort(); return; }
        stageSignal?.addEventListener('abort', abort, { once: true });
        waiting.set(stage, { input, resolve: value => { stageSignal?.removeEventListener('abort', abort); resolve(value); }, reject });
      });
    } };
}

export async function assertPortFree(port) {
  for (const host of ['127.0.0.1', '::1']) {
    const server = createServer();
    try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen({ port, host, exclusive: true }, resolve); }); }
    catch (error) { if (host === '::1' && error.code === 'EAFNOSUPPORT') continue; fail('JOURNEY_FOREIGN_LISTENER'); }
    finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
  }
}

export function createJourneyRuntime({ env, io = fs, start = startOwned, portsFree = async () => {
  await assertPortFree(3000); await assertPortFree(1337);
}, now = Date.now, pause = delay, browser, observeRemote, observeMail, conflict, emit, transport = fetch,
  regressions = runJourneyRegressions, controlFactory = createLoopbackControl } = {}) {
  const runDir = env.IAM_JOURNEY_RUN_DIR; const runId = path.basename(runDir ?? '');
  const snapshots = createSnapshots(runId);
  const resources = []; const files = new Map(); const schedules = new Map(); const links = new Map(); const sessions = new Map();
  let composeRecord; let composeValues; let listener; let lock; let resetOwned = false; let setup = false; let cleaned = false; let ownsDir = false;
  let ownedInventory; let cleanupPassed = false;
  let control; let browserStarted = false; let browserProcess;
  const auditIds = new Set(); const correlationIds = new Set();
  const joinerTriggers = new Map(); const passwordMail = new Map(); const seenMail = new Set();
  const accessObservations = new Map(); const screenshots = new Map();
  const tasks = []; let conflictProof; let regressionProof; let contractSnapshot;
  const completed = new Set(); let began;
  const lockFile = path.join(TMP, 'iam-journey-runtime.lock');
  const child = (program, args, options = {}) => {
    const result = start(program, args, { cwd: ROOT, env: composeEnvironment(env), ...options }); resources.push(result); return result;
  };
  const command = async (program, args, options = {}) => {
    const result = child(program, args, options);
    try { return await result.done; } finally { await result.close(); }
  };
  const checkCompose = async () => {
    const next = await privateFile(env.IAM_JOURNEY_COMPOSE_ENV_FILE, runDir, io);
    if (!composeRecord || !same(next.stat, composeRecord.stat) || next.text !== composeRecord.text) fail('JOURNEY_PRIVATE_RACE');
  };
  const compose = async (args, signal, options = {}) => {
    await checkCompose();
    if (ownedInventory !== undefined && await inventory(signal) !== ownedInventory) fail('JOURNEY_FOREIGN_IDP');
    const result = await command('docker', ['compose', '--project-name', 'idp', '--env-file', env.IAM_JOURNEY_COMPOSE_ENV_FILE,
      '--project-directory', 'docker', '-f', 'docker/docker-compose.yaml', ...args], { ...options, signal });
    ownedInventory = await inventory(signal);
    return result;
  };
  const docker = (args, signal, options = {}) => command('docker', args, { ...options, signal });
  async function inventory(signal) {
    const rows = [];
    for (const args of [
      ['ps', '-aq', '--filter', 'label=com.docker.compose.project=idp'],
      ['volume', 'ls', '-q', '--filter', 'label=com.docker.compose.project=idp'],
      ['network', 'ls', '-q', '--filter', 'label=com.docker.compose.project=idp'],
    ]) rows.push((await docker(args, signal, { capture: true })).trim().split('\n').sort().join('\n'));
    return JSON.stringify(rows);
  }
  const mp = async (method, endpoint, body, signal) => {
    if (!/^\/(resources|tasks|users|shadows|objectTemplates|archetypes)(\/[a-zA-Z0-9-]+)*(\?options=raw)?$/.test(endpoint)
      || !['GET', 'POST'].includes(method)) fail('JOURNEY_TASK_INVALID');
    const output = await docker(['exec', '-i', 'midpoint', 'sh', '-c',
      'curl --silent --max-time 30 --request "$0" --user "administrator:${MP_SET_midpoint_administrator_initialPassword}" --header "Content-Type: application/json" --header "Accept: application/json" --data-binary @- --write-out "\\n%{http_code}" "http://localhost:8080/midpoint/ws/rest$1"', method, endpoint],
    nativeSignal(signal), { input: body ? JSON.stringify(body) : '', capture: true, maxBytes: NATIVE_READ_BYTES });
    const boundary = output.lastIndexOf('\n');
    if (![200, 201, 202, 204].includes(Number(output.slice(boundary + 1)))) fail('JOURNEY_NATIVE_FAILED');
    return boundary ? JSON.parse(output.slice(0, boundary)) : null;
  };
  observeMail ??= createMailObservation({ transport, now, pause });
  observeRemote ??= createRemoteObservation({ env, transport, now, scim: (query, signal) => listener.request('scim', query, signal),
    command: (program, args, options) => command(program, args, { ...options, capture: true }) });
  const task = (suffix, signal) => awaitNativeTask({ suffix, mp, signal, now, pause });
  const proofWindow = createRevocationWindow({ now, hold: ms => listener.request('hold', ms), release: async () => {
    if (listener?.alive()) await listener.request('release');
  } });
  async function observe(person, signal) {
    const local = await listener.request('observe', person.employeeNumber, signal);
    const identities = searchObjects(await mp('POST', '/users/search', { query: { filter: { text: `personalNumber = '${person.employeeNumber}'` } } }, signal));
    if (identities.length !== 1 || identities[0].personalNumber !== person.employeeNumber || !identities[0].oid
      || local.sourceKey !== person.employeeNumber || !local.documentId || !local.remoteSubject || !local.sourceDocumentId
      || local.sourceName !== 'midPoint (dev)' || !Array.isArray(local.roles) || local.roles.length !== 0) fail('JOURNEY_LINKAGE_INVALID');
    return { ...local, identityOid: identities[0].oid };
  }
  async function writeFresh(name, contents) {
    const file = path.join(runDir, name);
    const handle = await io.open(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(contents); } finally { await handle.close(); }
    files.set(file, (await privateFile(file, runDir, io)).stat); return file;
  }
  async function prepare(signal) {
    if (env.IAM_JOURNEY_DISPOSABLE !== 'true' || env.AUTH_URL !== 'http://localhost:3000'
      || env.CSRM_API_BASE_URL !== 'http://127.0.0.1:1337' || env.KEYCLOAK_BASE_URL !== 'http://localhost:8080'
      || env.KEYCLOAK_ISSUER !== 'http://localhost:8080/realms/idambox' || env.AUTH_KEYCLOAK_ISSUER !== env.KEYCLOAK_ISSUER
      || env.KEYCLOAK_REALM !== 'idambox' || env.KEYCLOAK_ADMIN !== undefined || env.KEYCLOAK_ADMIN_PASSWORD !== undefined
      || env.COMPOSE_PROJECT_NAME && env.COMPOSE_PROJECT_NAME !== 'idp') fail('JOURNEY_OWNERSHIP');
    const marker = await privateFile(path.join(runDir, '.journey-owner'), runDir, io);
    if (marker.text !== `${runId}\nidp\n`) fail('JOURNEY_OWNERSHIP');
    if (!within(runDir, env.DATABASE_FILENAME)) fail('JOURNEY_OWNERSHIP');
    try { await io.lstat(env.DATABASE_FILENAME); fail('JOURNEY_DATABASE_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const config = await privateFile(env.ENV_PATH, runDir, io);
    if (env.ENV_PATH === env.IAM_JOURNEY_COMPOSE_ENV_FILE) fail('JOURNEY_PRIVATE_PATH');
    composeRecord = await privateFile(env.IAM_JOURNEY_COMPOSE_ENV_FILE, runDir, io);
    composeValues = parseCompose(composeRecord.text, { initial: true });
    for (const [file, record] of [[env.ENV_PATH, config], [env.IAM_JOURNEY_COMPOSE_ENV_FILE, composeRecord], [path.join(runDir, '.journey-owner'), marker]]) files.set(file, record.stat);
    ownsDir = true;
    await portsFree();
    const processes = await command('ps', ['-axo', 'pid=,command='], { signal, capture: true });
    if (foreignCompiler(processes)) fail('JOURNEY_FOREIGN_COMPILER');
    lock = await io.open(lockFile, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    await lock.writeFile(runId);
    ownedInventory = await inventory(signal);
    if (ownedInventory !== '["","",""]') fail('JOURNEY_FOREIGN_IDP');
    const containers = (await docker(['ps', '-a', '--format', '{{.Names}}'], signal, { capture: true })).trim().split('\n');
    const volumes = (await docker(['volume', 'ls', '--format', '{{.Name}}'], signal, { capture: true })).trim().split('\n');
    const networks = (await docker(['network', 'ls', '--format', '{{.Name}}'], signal, { capture: true })).trim().split('\n');
    if (containers.some(name => ['keycloak', 'midpoint', 'midpoint_init', 'midpoint_data', 'mailpit', 'clamav', 'scim_stub'].includes(name))
      || volumes.some(name => ['idp_keycloak_data', 'idp_midpoint_data', 'idp_midpoint_home', 'clamav-db'].includes(name))
      || networks.includes('idp_default')) fail('JOURNEY_FOREIGN_IDP');
    contractSnapshot = await snapshotJourneyContracts();
    setup = true;
  }
  async function nativeReady(signal) {
    const end = now() + BUDGETS.setup;
    for (;;) {
      signal?.throwIfAborted();
      try { const result = await mp('GET', `/tasks/${oid('300')}`, null, signal); if (object(result)?.oid === oid('300')) return; } catch { /* Bounded readiness only. */ }
      if (now() >= end) fail('JOURNEY_READINESS');
      await pause(500, undefined, { signal });
    }
  }
  async function nativeObjects(signal) {
    for (const [collection, suffixes] of [['resources', ['100', '110']], ['objectTemplates', ['140']], ['archetypes', ['150']], ['tasks', ['300', '310', '320', '330', '340']]]) {
      for (const suffix of suffixes) {
        // Raw reads check stored configuration without contacting the resource (Strapi may not be listening yet).
        const row = object(await mp('GET', `/${collection}/${oid(suffix)}?options=raw`, null, signal));
        if (row?.oid !== oid(suffix) || row.executionState === 'running') fail('JOURNEY_NATIVE_INVALID');
        if (suffix === '110') assertResource(row);
        if (suffix === '300') {
          const retry = row.activity?.controlFlow?.errorHandling?.entry;
          const entries = Array.isArray(retry) ? retry : [retry];
          if (Number(row.schedule?.interval) !== 300 || !entries.some(entry => entry?.reaction?.retryLater?.initialInterval === 'PT5M'
            && entry.reaction.retryLater.nextInterval === 'PT15M')) fail('JOURNEY_NATIVE_INVALID');
        }
        if (collection === 'tasks' && !schedules.has(suffix)) {
          schedules.set(suffix, row.schedulingState);
          await mp('POST', `/tasks/${oid(suffix)}/suspend`, null, signal);
        }
      }
    }
  }
  async function lifecycle(kind, width, signal) {
    const planned = snapshots.people.find(row => row.width === width);
    const recipients = { ...planned, recipients: [planned.email, planned.email.replace('@', '.moved@')] };
    let invitationCount;
    if (kind !== 'joiner') {
      if (!observeMail) fail('JOURNEY_ADAPTER_UNAVAILABLE');
      invitationCount = await observeMail(recipients, signal);
      if (!Number.isSafeInteger(invitationCount) || invitationCount < 1) fail('JOURNEY_MAIL_INVALID');
    }
    if (kind === 'leaver') {
      const session = sessions.get(width);
      if (!session?.accessTokenExpiresAt || !session.sessionKey) fail('JOURNEY_PROOF_WINDOW');
      await proofWindow.begin(session.accessTokenExpiresAt);
    }
    try {
      const { text, person } = snapshots.publish(kind, width);
      const file = await writeFresh(`${kind}-${width}.csv`, text);
      if (kind === 'joiner') joinerTriggers.set(width, new Date(now()).toISOString());
      await command('bash', ['docker/midpoint/hr-publish.sh', file], { signal });
      const run = await task(kind === 'joiner' ? '310' : '300', signal);
      const current = await observe(person, signal);
      if (kind === 'joiner') {
        assertStableLink(current, current, person); links.set(width, current);
      } else {
        assertStableLink(links.get(width), current, person, { leaver: kind === 'leaver' });
        if (await observeMail(recipients, signal) !== invitationCount) fail('JOURNEY_MOVER_INVITATION');
      }
      if (!observeRemote) fail('JOURNEY_ADAPTER_UNAVAILABLE');
      const remote = await observeRemote({ kind, person, current, before: links.get(width), run, signal });
      if (!remote || remote.subject !== current.remoteSubject || remote.employeeNumber !== person.employeeNumber
        || remote.email !== person.email || remote.department !== person.department || remote.jobTitle !== person.jobTitle
        || remote.method !== (kind === 'joiner' ? 'POST' : 'PUT') || remote.status !== (kind === 'joiner' ? 201 : 200)
        || !/^[a-zA-Z0-9_-]{1,80}$/.test(remote.nativeAuditId ?? '') || auditIds.has(remote.nativeAuditId)
        || !/^[a-zA-Z0-9_-]{1,80}$/.test(remote.scimCorrelationId ?? '') || correlationIds.has(remote.scimCorrelationId)
        || (kind === 'leaver' && (remote.active !== false || remote.enabled !== true || current.outboxStatus !== 'pending'))) fail('JOURNEY_REMOTE_INVALID');
      tasks.push({ stage: `${kind}-${width}`, ...run, invocation: 'on-demand', nativeAuditId: remote.nativeAuditId,
        scimCorrelationId: remote.scimCorrelationId, scimMethod: remote.method, scimStatus: remote.status, nativePaging: true, cadenceSeconds: 300 });
      auditIds.add(remote.nativeAuditId); correlationIds.add(remote.scimCorrelationId);
      if (kind === 'leaver') proofWindow.assertOpen();
      if (kind === 'mover' && browser?.start) await browserStage(`csv-mover-${width}`, width, signal);
    } catch (error) { if (kind === 'leaver') await proofWindow.end(); throw error; }
  }
  async function browserStage(stage, width, signal) {
    if (!browser?.stage && !browser?.start) fail('JOURNEY_ADAPTER_UNAVAILABLE');
    if (stage.startsWith('immediate-refusal')) proofWindow.assertOpen();
    try {
      let observed;
      if (browser.start) {
        if (browser.supports && browser.supports(stage) !== true) fail('JOURNEY_ADAPTER_UNAVAILABLE');
        if (!control) control = await controlFactory();
        const person = snapshots.people.find(row => row.width === width);
        let input = stage.startsWith('password-setup') ? { username: person.username, actionUrl: passwordMail.get(width)?.actionUrl }
          : stage.startsWith('requestor-sign-in') ? { username: person.username } : undefined;
        if (stage.startsWith('requestor-access')) input = await listener.request('access-prepare',person.employeeNumber,signal);
        if (stage.startsWith('csv-mover')) input = await listener.request('access-mover',person.employeeNumber,signal);
        if (stage.startsWith('immediate-refusal')) input = await listener.request('access-refuse',person.employeeNumber,signal);
        if (stage.startsWith('remote-completion')) input = {username:person.username};
        if (stage.startsWith('password-setup') && !input.actionUrl) fail('JOURNEY_MAIL_INVALID');
        const waiting = control.wait(stage, signal, input);
        void waiting.catch(() => {});
        if (!browserStarted) {
          browserProcess = await browser.start({ origin: env.AUTH_URL, env: { IAM_JOURNEY_CONTROL_URL: control.url,
            IAM_JOURNEY_CONTROL_TOKEN: control.token }, signal }); browserStarted = true;
        }
        if (browser.advance) await browser.advance(stage, { width, signal });
        observed = browserProcess?.done ? await Promise.race([waiting, browserProcess.done.then(() => { fail('JOURNEY_BROWSER_EXITED'); })]) : await waiting;
        if (stage.startsWith('requestor-access') || stage.startsWith('csv-mover') || stage.startsWith('immediate-refusal')) {
          const screenshot = validateLifecycleObservation(stage, input, observed);
          if (stage.startsWith('immediate-refusal')) {
            // UI refusal must finish within the same valid-token, pending-outbox window.
            input = await listener.request('access-refuse', person.employeeNumber, signal);
            proofWindow.assertOpen();
            if (input.sessionKey !== sessions.get(width)?.sessionKey
              || [input.accessStatus, input.detailStatus, input.writeStatus].some(status => status !== 403)
              || input.beforeRemoteLogout !== true) fail('JOURNEY_BROWSER_INVALID');
          }
          const { screenshot: _privateImage, ...browserProof } = observed;
          observed = { ...browserProof, ...input, passed: true };
          if (screenshot) screenshots.set(screenshot.name, screenshot.bytes);
          accessObservations.set(stage, observed);
        } else if (stage.startsWith('remote-completion')) {
          validateLifecycleObservation(stage, input, observed);
          accessObservations.set(stage, observed);
        }
      } else observed = await browser.stage(stage, { width, person: snapshots.people.find(row => row.width === width),
        link: links.get(width), signal });
      if (!observed || observed.passed !== true) fail('JOURNEY_BROWSER_INVALID');
      if (stage.startsWith('password-setup')) passwordMail.delete(width);
      if (stage.startsWith('requestor-access')) {
        if (!observed.sessionKey || !Number.isFinite(Date.parse(observed.accessTokenExpiresAt))) fail('JOURNEY_BROWSER_INVALID');
        sessions.set(width, { sessionKey: observed.sessionKey, accessTokenExpiresAt: observed.accessTokenExpiresAt });
      }
      if (stage.startsWith('immediate-refusal')) {
        proofWindow.assertOpen();
        if (observed.sessionKey !== sessions.get(width)?.sessionKey || [observed.accessStatus, observed.detailStatus, observed.writeStatus].some(status => status !== 403)
          || observed.beforeRemoteLogout !== true) fail('JOURNEY_BROWSER_INVALID');
      }
    } finally { if (stage.startsWith('immediate-refusal')) await proofWindow.end(); }
  }
  async function stageWork(stage, signal) {
    if (stage === 'preflight') return prepare(signal);
    if (!setup) fail('JOURNEY_ORDER');
    if (stage === 'reset') {
      resetOwned = true;
      await compose(['down', '-v', '--remove-orphans'], signal);
      return compose(['up', '-d', 'keycloak', 'mailpit', 'midpoint_data'], signal);
    }
    if (stage === 'readiness') {
      const end = now() + BUDGETS.setup;
      for (;;) {
        signal?.throwIfAborted();
        try {
          const response = await transport(`${env.KEYCLOAK_ISSUER}/.well-known/openid-configuration`,
            { signal: AbortSignal.any([AbortSignal.timeout(3000), ...(signal ? [signal] : [])]), redirect: 'error' });
          if (response.ok && (await response.json()).issuer === env.KEYCLOAK_ISSUER) return;
        } catch { /* Bounded readiness. */ }
        if (now() >= end) fail('JOURNEY_READINESS');
        await pause(500, undefined, { signal });
      }
    }
    if (stage === 'source-registration') {
      if (listener?.alive()) fail('JOURNEY_COMPILER_OVERLAP');
      try { return await command(process.execPath, ['-e', ADMINISTRATION], { cwd: APP, env: backendEnvironment(env), signal }); }
      finally {
        for (const name of ['', '-wal', '-shm', '-journal']) {
          const file = `${env.DATABASE_FILENAME}${name}`;
          try { files.set(file, (await privateFile(file, runDir, io)).stat); }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
      }
    }
    if (stage === 'source-token') {
      if (listener?.alive()) fail('JOURNEY_COMPILER_OVERLAP');
      const token = parseIssuedToken(await command('pnpm', ['--dir', 'apps/backend', 'scim:token', 'midPoint (dev)', 'rotate'],
        { env: backendEnvironment(env), signal, capture: true }));
      composeValues.MIDPOINT_SCIM_TOKEN = token;
      composeRecord = await replacePrivate(env.IAM_JOURNEY_COMPOSE_ENV_FILE,
        `${composeKeys.map(key => `${key}=${composeValues[key]}`).join('\n')}\n`, runDir, composeRecord.stat, io);
      files.set(env.IAM_JOURNEY_COMPOSE_ENV_FILE, composeRecord.stat);
      return;
    }
    if (stage === 'render') return compose(['up', '-d', '--force-recreate', 'midpoint_init', 'midpoint_server'], signal);
    if (stage === 'reload') {
      await nativeReady(signal);
      await command('bash', ['docker/midpoint/reload.sh'], { signal });
      await nativeObjects(signal);
      listener = child(process.execPath, ['-e', LISTENER], { cwd: APP, env: { ...backendEnvironment(env, true), MIDPOINT_SCIM_TOKEN: composeValues.MIDPOINT_SCIM_TOKEN }, signal: undefined, ipc: true });
      const end = now() + BUDGETS.ordinary;
      for (;;) {
        signal?.throwIfAborted(); if (!listener.alive() || now() >= end) fail('JOURNEY_READINESS');
        try { if (await listener.request('ready', undefined, signal) === true) break; } catch { /* Bounded startup. */ }
        await pause(500, undefined, { signal });
      }
      env.CSRM_API_TOKEN = await listener.request('web-credential', undefined, signal);
      return;
    }
    if (stage === 'connection') {
      if ((await docker(['inspect', '-f', '{{.Config.Image}}', 'midpoint'], signal, { capture: true })).trim() !== 'idambox/midpoint:4.8.14-scim2-1.2.9'
        || !(await docker(['exec', 'midpoint', '/opt/midpoint/bin/ninja.sh', '--version'], signal, { capture: true })).includes(PIN.midpoint)
        || (await docker(['exec', 'midpoint', 'cat', '/opt/midpoint/connector-bundle/source-commit.txt'], signal, { capture: true })).trim() !== PIN.sourceCommit) fail('JOURNEY_VERSION_INVALID');
      await nativeObjects(signal);
      if (object(await mp('POST', `/resources/${oid('110')}/test`, null, signal))?.status !== 'success') fail('JOURNEY_NATIVE_FAILED');
      return;
    }
    const match = /^csv-(joiner|mover|leaver)-(1440|375)$/.exec(stage);
    if (match) return lifecycle(match[1], Number(match[2]), signal);
    const width = Number(stage.match(/-(1440|375)$/)?.[1]);
    if (width) {
      if (stage.startsWith('mail-')) {
        const person = snapshots.people.find(row => row.width === width);
        const received = await awaitPasswordMail({ recipient: person.email, after: joinerTriggers.get(width), seen: seenMail, transport, now, pause, signal });
        passwordMail.set(width, received); return;
      }
      if (stage.startsWith('linkage')) { if (!links.has(width)) fail('JOURNEY_LINKAGE_INVALID'); return; }
      if (stage.startsWith('remote-completion')) {
        await proofWindow.end();
        if (!observeRemote) fail('JOURNEY_ADAPTER_UNAVAILABLE');
        const person = snapshots.people.find(row => row.width === width);
        const end = now() + BUDGETS.ordinary;
        for (;;) {
          signal?.throwIfAborted();
          const current = await observe(person, signal);
          const remote = await observeRemote({ kind: 'remote-completion', person, current, signal });
          if (current.outboxStatus === 'completed' && remote?.subject === current.remoteSubject && remote.enabled === false && remote.sessions === 0) return browserStage(stage,width,signal);
          if (now() >= end) fail('JOURNEY_REMOTE_INVALID');
          await pause(500, undefined, { signal });
        }
      }
      return browserStage(stage, width, signal);
    }
    if (stage === 'in03-conflict') {
      if (conflict) { conflictProof = await conflict({ env, task, mp, signal, now, onObservations: recordConflict }); return conflictProof; }
      const { createConflictBinding } = await import('./journey-bindings.mjs');
      conflictProof = await createConflictBinding({ onObservations: recordConflict, env, mp, command: (program,args,options) => command(program,args,{...options,capture:true}), observe, scim: (query, active) => listener.request('scim',query,active), transport, now, pause, io }).run(signal); return conflictProof;
    }
    if (stage === 'evidence') {
      if (completed.size !== STAGES.length - 1) fail('JOURNEY_EVIDENCE_INVALID');
      const cleanupSignal = AbortSignal.any([AbortSignal.timeout(BUDGETS.cleanup), ...(signal ? [signal] : [])]);
      let abortCleanup;
      try {
        cleanupSignal.throwIfAborted();
        await Promise.race([runtime.cleanup(cleanupSignal), new Promise((_, reject) => {
          abortCleanup = () => reject(new Error('JOURNEY_CLEANUP_FAILED'));
          cleanupSignal.addEventListener('abort', abortCleanup, { once: true });
        })]);
      } finally { if (abortCleanup) cleanupSignal.removeEventListener('abort', abortCleanup); }
      regressionProof = await regressions((program, args, options) => command(program, args, { ...options,
        env: { ...composeEnvironment(env), pnpm_config_verify_deps_before_run: 'false', STRAPI_TELEMETRY_DISABLED: 'true', NEXT_TELEMETRY_DISABLED: '1' } }), signal);
      if (contractSnapshot !== await snapshotJourneyContracts()) fail('JOURNEY_EVIDENCE_INVALID');
      return;
    }
    fail('JOURNEY_ADAPTER_UNAVAILABLE');
  }
  function recordConflict(conflict, recovery) {
    for (const [index, value] of [conflict, recovery].entries()) tasks.push({ stage: index ? 'in03-recovery' : 'in03-conflict',
      taskOid: value.task.oid, invocation: index ? 'native-retry-scanner' : 'on-demand', triggeredAt: value.task.startedAt,
      finishedAt: value.task.finishedAt, result: value.task.result, nativeAuditId: value.nativeAuditId,
      scimCorrelationId: value.scimCorrelationId, scimMethod: value.method, scimStatus: value.status, nativePaging: true, cadenceSeconds: 300 });
  }
  const runtime = { emit, begin: value => { began = value; }, async stage(stage, signal) {
    const result = await stageWork(stage, signal); completed.add(stage); return result;
  }, async publish(rows, persist = persistJourneyEvidence) {
    if (!cleaned || !cleanupPassed || completed.size !== STAGES.length) fail('JOURNEY_EVIDENCE_INVALID');
    const bundle = assembleJourneyEvidence({ runId, date: new Date(began).toISOString(), stages: rows, tasks, links,
      accessObservations, conflict: conflictProof, regressions: regressionProof });
    await persist(bundle, env.IAM_JOURNEY_EVIDENCE_DIR, screenshots);
  }, async cleanup(signal) {
    if (cleaned) return;
    cleaned = true;
    passwordMail.clear(); seenMail.clear(); sessions.clear();
    let failed = false;
    const attempt = async work => { try { await work(); } catch { failed = true; } };
    await attempt(() => proofWindow.end());
    if (control) await attempt(() => control.close());
    if (browser?.close) await attempt(() => browser.close());
    for (const [suffix, state] of schedules) if (state === 'ready') await attempt(() => mp('POST', `/tasks/${oid(suffix)}/resume`, null, signal));
    for (const resource of resources.toReversed()) await attempt(() => resource.close());
    if (resetOwned) await attempt(() => compose(['down', '-v', '--remove-orphans'], signal));
    if (setup) for (const name of ['', '-wal', '-shm', '-journal']) await attempt(async () => {
      const file = `${env.DATABASE_FILENAME}${name}`;
      try {
        const st = (await privateFile(file, runDir, io)).stat;
        if (files.has(file) && !same(st, files.get(file))) fail('JOURNEY_PRIVATE_RACE');
        files.set(file, st);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    });
    for (const [file, expected] of files) await attempt(async () => {
      let current;
      try { current = await io.lstat(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
      if (!same(current, expected) || current.isSymbolicLink()) fail('JOURNEY_PRIVATE_RACE');
      await io.unlink(file);
    });
    if (lock) await attempt(async () => {
      const expected = await lock.stat();
      const current = await io.lstat(lockFile);
      await lock.close(); lock = undefined;
      if (!same(current, expected) || current.isSymbolicLink()) fail('JOURNEY_PRIVATE_RACE');
      await io.unlink(lockFile);
    });
    if (ownsDir) await attempt(() => io.rmdir(runDir));
    if (failed) fail('JOURNEY_CLEANUP_FAILED');
    cleanupPassed = true;
  }, task, mp, accessObservations: () => structuredClone([...accessObservations]),
    screenshots: () => new Map([...screenshots].map(([name, bytes]) => [name, Buffer.from(bytes)])) };
  return runtime;
}

export async function runJourney({ env, executeJourney: run = executeJourney, persistEvidence = persistJourneyEvidence, ...injected }) {
  const runtime = createJourneyRuntime({ env, browser: createJourneyBrowser({ env }), ...injected });
  const rows = await run(runtime);
  await runtime.publish(rows, persistEvidence);
  return rows;
}

/** The runner owns both child processes and keeps their output private. */
export function createJourneyBrowser({ env, start = startOwned, transport = fetch, now = Date.now, pause = delay } = {}) {
  const children = []; let buildDirectory;
  return {
    supports: stage => /^(password-setup|requestor-sign-in|requestor-access|csv-mover|immediate-refusal|remote-completion)-(1440|375)$/.test(stage),
    async start({ origin, env: controlEnv, signal }) {
      if (origin !== 'http://localhost:3000' || env.AUTH_KEYCLOAK_ISSUER !== 'http://localhost:8080/realms/idambox'
        || !env.AUTH_KEYCLOAK_ID || !env.AUTH_KEYCLOAK_SECRET || !env.CSRM_API_TOKEN
        || !/^iam-journey-[a-f0-9-]{36}$/.test(path.basename(env.IAM_JOURNEY_RUN_DIR ?? ''))) fail('JOURNEY_BROWSER_INVALID');
      const app = path.join(ROOT, 'apps/csrm');
      await fs.mkdir(path.join(app, '.tmp'), { recursive: true });
      buildDirectory = await fs.mkdtemp(path.join(app, '.tmp/iam-journey-web-'));
      await fs.chmod(buildDirectory, 0o700);
      const webEnv = { ...composeEnvironment(env), NODE_ENV: 'development', AUTH_URL: origin,
        AUTH_SECRET: randomBytes(32).toString('base64url'), AUTH_KEYCLOAK_ID: env.AUTH_KEYCLOAK_ID,
        AUTH_KEYCLOAK_SECRET: env.AUTH_KEYCLOAK_SECRET, AUTH_KEYCLOAK_ISSUER: env.AUTH_KEYCLOAK_ISSUER,
        CSRM_AUTH_OIDC_ENABLED: 'true', CSRM_DEV_IDENTITY: 'false', CSRM_ENVIRONMENT: 'development',
        CSRM_API_BASE_URL: 'http://127.0.0.1:1337/api', CSRM_API_TOKEN: env.CSRM_API_TOKEN,
        CSRM_NEXT_DIST_DIR: path.relative(app, path.join(buildDirectory, 'next')), NEXT_TELEMETRY_DISABLED: '1', pnpm_config_verify_deps_before_run: 'false' };
      const web = start('pnpm', ['exec', 'next', 'dev', '--hostname', 'localhost', '--port', '3000'], { cwd: app, env: webEnv }); children.push(web);
      const end = now() + BUDGETS.ordinary;
      for (;;) {
        signal?.throwIfAborted();
        if (!web.alive() || now() >= end) fail('JOURNEY_READINESS');
        try { if ((await transport(`${origin}/sign-in`, { redirect: 'error', signal: AbortSignal.timeout(3000) })).ok) break; } catch { /* Bounded readiness. */ }
        await pause(500, undefined, { signal });
      }
      const browser = start('pnpm', ['exec', 'playwright', 'test', '--config', 'playwright.iam-journey.config.ts'], {
        cwd: app, env: { ...composeEnvironment(env), ...controlEnv, IAM_JOURNEY_LIVE: 'true', PLAYWRIGHT_NO_COPY_PROMPT: '1', pnpm_config_verify_deps_before_run: 'false' } }); children.push(browser);
      return browser;
    },
    async close() {
      let failed = false;
      for (const child of children.toReversed()) { try { await child.close(); } catch { failed = true; } }
      if (buildDirectory) { try { await fs.rm(buildDirectory, { recursive: true, force: true }); } catch { failed = true; } }
      if (failed) fail('JOURNEY_CLEANUP_FAILED');
    },
  };
}
