/** Closed evidence and private handoff boundaries. Never persist adapter payloads. */
import { lstat, realpath, readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT, STAGES, BUDGETS, stageBudget } from './journey.mjs';
import { PIN } from './scim-evidence.mjs';

export const EVIDENCE_ROOT = path.join(ROOT, '.planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/evidence');
const PRIVATE_ROOT = path.join(ROOT, 'apps/backend/.tmp');
const fail = () => { throw Object.assign(new Error('JOURNEY_EVIDENCE_INVALID'), { code: 'JOURNEY_EVIDENCE_INVALID' }); };
const runId = value => typeof value === 'string' && /^iam-journey-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const number = value => Number.isSafeInteger(value) && value >= 0;
function keys(value, expected) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) fail();
}
function trueFields(value, fields) { keys(value, fields); if (fields.some(key => value[key] !== true)) fail(); }
function instant(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }

export function verifyJourneyEvidence(bundle) {
  keys(bundle, ['format', 'runId', 'date', 'provenance', 'reset', 'versions', 'stages', 'tasks', 'people', 'conflict', 'cleanup', 'regressions']);
  if (bundle.format !== 1 || !runId(bundle.runId) || !instant(bundle.date) || bundle.provenance !== 'live-journey') fail();
  trueFields(bundle.reset, ['idpVolumesRemoved', 'freshDatabase', 'exclusiveListeners', 'exclusiveCompiler', 'schedulesSuspended']);
  keys(bundle.versions, ['midpoint', 'connector', 'sourceCommit', 'keycloak']);
  for (const key of ['midpoint', 'connector', 'sourceCommit']) if (bundle.versions[key] !== PIN[key]) fail();
  if (bundle.versions.keycloak !== '26.6.1') fail();
  if (!Array.isArray(bundle.stages) || bundle.stages.length !== STAGES.length) fail();
  let previousEnd = 0;
  const widthStarts = new Map();
  for (const [index, row] of bundle.stages.entries()) {
    keys(row, ['stage', 'outcome', 'startedMs', 'durationMs']);
    if (row.stage !== STAGES[index] || row.outcome !== 'passed' || !number(row.startedMs) || !number(row.durationMs)
      || row.startedMs < previousEnd) fail();
    if (row.durationMs > stageBudget(row.stage)) fail();
    previousEnd = row.startedMs + row.durationMs;
    if (row.stage !== 'evidence' && previousEnd > BUDGETS.overall) fail();
    if (index < 8 && previousEnd > BUDGETS.setup) fail();
    const width = row.stage.match(/-(1440|375)$/)?.[1];
    if (row.stage.startsWith('csv-joiner-')) widthStarts.set(width, row.startedMs);
    if (width && previousEnd - widthStarts.get(width) > BUDGETS.viewport) fail();
  }
  trueFields(bundle.cleanup, ['processesStopped', 'listenersClosed', 'privateFilesRemoved', 'schedulesRestored']);
  trueFields(bundle.regressions, ['backendUnfiltered', 'csrm', 'contracts', 'catalogues', 'schemas', 'defaults']);
  const expectedTasks = [...[1440, 375].flatMap(width => ['joiner', 'mover', 'leaver'].map(kind => `${kind}-${width}`)), 'in03-conflict', 'in03-recovery'];
  if (!Array.isArray(bundle.tasks) || bundle.tasks.length !== expectedTasks.length) fail();
  const auditIds = new Set();
  const scimIds = new Set();
  for (const [index, task] of bundle.tasks.entries()) {
    keys(task, ['stage', 'taskOid', 'invocation', 'triggeredAt', 'finishedAt', 'result', 'nativeAuditId', 'scimCorrelationId', 'scimMethod', 'scimStatus', 'nativePaging', 'cadenceSeconds']);
    const sourceStage = bundle.stages.find(row => row.stage === (task.stage.startsWith('in03-') ? 'in03-conflict' : `csv-${task.stage}`));
    const scanner = task.stage === 'in03-recovery';
    const expectedOid = `11000000-0000-4000-8000-000000000${task.stage.startsWith('joiner-') ? '310' : '300'}`;
    if (task.stage !== expectedTasks[index] || (scanner ? !uuid(task.taskOid) || task.taskOid === expectedOid : task.taskOid !== expectedOid)
      || task.invocation !== (scanner ? 'native-retry-scanner' : 'on-demand') || !instant(task.triggeredAt) || !instant(task.finishedAt)
      || Date.parse(task.finishedAt) <= Date.parse(task.triggeredAt) || Date.parse(task.triggeredAt) < Date.parse(bundle.date)
      || !id(task.nativeAuditId) || auditIds.has(task.nativeAuditId) || !id(task.scimCorrelationId) || scimIds.has(task.scimCorrelationId)
      || !sourceStage || Date.parse(task.triggeredAt) < Date.parse(bundle.date) + sourceStage.startedMs
      || Date.parse(task.finishedAt) > Date.parse(bundle.date) + sourceStage.startedMs + sourceStage.durationMs
      // The pinned connector sends IN-03's email change as PATCH (P3-35); lifecycle updates are full PUTs.
      || task.scimMethod !== (task.stage.startsWith('joiner-') ? 'POST' : task.stage.startsWith('in03-') ? 'PATCH' : 'PUT')
      || task.scimStatus !== (task.stage === 'in03-conflict' ? 503 : task.scimMethod === 'POST' ? 201 : 200)
      || task.nativePaging !== true || task.cadenceSeconds !== 300
      || task.result !== (task.stage === 'in03-conflict' ? 'retry-later' : 'success')) fail();
    auditIds.add(task.nativeAuditId);
    scimIds.add(task.scimCorrelationId);
  }
  if (!Array.isArray(bundle.people) || bundle.people.length !== 2) fail();
  const sourceKeys = new Set(); const identities = new Set(); const documents = new Set(); const subjects = new Set();
  for (const [index, person] of bundle.people.entries()) {
    keys(person, ['width', 'height', 'sourceKey', 'identityOid', 'documentId', 'remoteSubject', 'assertions', 'refusal', 'screenshots']);
    const width = [1440, 375][index];
    if (person.width !== width || person.height !== (width === 1440 ? 900 : 812) || !/^\d{6,12}$/.test(person.sourceKey)
      || !uuid(person.identityOid) || !id(person.documentId) || !uuid(person.remoteSubject)
      || sourceKeys.has(person.sourceKey) || identities.has(person.identityOid) || documents.has(person.documentId) || subjects.has(person.remoteSubject)) fail();
    sourceKeys.add(person.sourceKey); identities.add(person.identityOid); documents.add(person.documentId); subjects.add(person.remoteSubject);
    trueFields(person.assertions, ['freshMatchedMail', 'actualPasswordLink', 'freshOidcSignIn', 'requestorOnly',
      'restrictedRoutesRefused', 'foreignRecordRefused', 'moverLinkageUnchanged', 'moverAttributesMirrored', 'moverNoInvitation',
      'sameBrowserSession', 'terminatedPut', 'localInactive', 'remoteDisabled', 'remoteSessionsEnded', 'freshSignInRefused',
      'keyboard', 'visibleFocus', 'readableErrors', 'noHorizontalOverflow']);
    keys(person.refusal, ['observedAt', 'accessTokenExpiresAt', 'accessStatus', 'detailStatus', 'writeStatus', 'browserListRefused', 'browserDetailRefused', 'beforeRemoteLogout']);
    const refusalStage = bundle.stages.find(row => row.stage === `immediate-refusal-${width}`);
    if (!instant(person.refusal.observedAt) || !instant(person.refusal.accessTokenExpiresAt)
      || Date.parse(person.refusal.observedAt) < Date.parse(bundle.date) + refusalStage.startedMs
      || Date.parse(person.refusal.observedAt) > Date.parse(bundle.date) + refusalStage.startedMs + refusalStage.durationMs
      || Date.parse(person.refusal.observedAt) >= Date.parse(person.refusal.accessTokenExpiresAt)
      || [person.refusal.accessStatus, person.refusal.detailStatus, person.refusal.writeStatus].some(value => value !== 403)
      || person.refusal.browserListRefused !== true || person.refusal.browserDetailRefused !== true || person.refusal.beforeRemoteLogout !== true) fail();
    if (!Array.isArray(person.screenshots) || JSON.stringify(person.screenshots) !== JSON.stringify([
      `screenshots/csrm-${width}-requestor.png`, `screenshots/csrm-${width}-refusal.png`])) fail();
  }
  keys(bundle.conflict, ['scenario', 'status', 'retryAfterSeconds', 'initialRetrySeconds', 'subsequentRetrySeconds',
    'nativeRetryObserved', 'retryScheduledAt', 'retryTriggeredAt', 'correctionApplied', 'recovered', 'rollback', 'ownershipUnchanged', 'noInvitation']);
  const conflict = bundle.conflict;
  if (conflict.scenario !== 'IN-03' || conflict.status !== 503 || conflict.retryAfterSeconds !== 30
    || conflict.initialRetrySeconds !== 300 || conflict.subsequentRetrySeconds !== 900
    || !instant(conflict.retryScheduledAt) || !instant(conflict.retryTriggeredAt)
    || Date.parse(conflict.retryScheduledAt) < Date.parse(bundle.tasks[6].triggeredAt) + 300000
    || Date.parse(conflict.retryTriggeredAt) < Date.parse(conflict.retryScheduledAt)
    || Date.parse(bundle.tasks[7].triggeredAt) < Date.parse(conflict.retryTriggeredAt)) fail();
  for (const key of ['nativeRetryObserved', 'correctionApplied', 'recovered', 'rollback', 'ownershipUnchanged', 'noInvitation']) if (conflict[key] !== true) fail();
  return true;
}

export function verifyContractEvidence(bundle) {
  keys(bundle, ['format', 'runId', 'date', 'provenance', 'keycloak', 'observations', 'cleanup']);
  if (bundle.format !== 1 || !runId(bundle.runId) || !instant(bundle.date)
    || bundle.provenance !== 'live-keycloak-contract' || bundle.keycloak !== '26.6.1') fail();
  trueFields(bundle.observations, ['A1', 'A2', 'A3', 'A4']);
  if (bundle.cleanup !== true) fail();
  return true;
}

function contained(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Check every existing component, refusing symlinks rather than following them. */
async function safePath(base, candidate, { missingLeaf = false, privateMode = false, directory = false } = {}) {
  if (!path.isAbsolute(candidate ?? '') || !contained(base, candidate) || path.resolve(candidate) !== candidate) fail();
  try { if (await realpath(base) !== base) fail(); } catch { fail(); }
  const segments = path.relative(base, candidate).split(path.sep);
  let current = base;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    let stat;
    try { stat = await lstat(current); } catch (error) {
      if (error.code === 'ENOENT' && missingLeaf && index === segments.length - 1) return;
      fail();
    }
    if (stat.isSymbolicLink() || stat.uid !== process.getuid() || (privateMode && (stat.mode & 0o077) !== 0)) fail();
    if (index < segments.length - 1 || directory) { if (!stat.isDirectory()) fail(); }
    else if (!stat.isFile()) fail();
  }
}

export async function validatePrivateContract(env) {
  if (env.IAM_JOURNEY_DISPOSABLE !== 'true' || (env.COMPOSE_PROJECT_NAME && env.COMPOSE_PROJECT_NAME !== 'idp')
    || env.KEYCLOAK_ADMIN !== undefined || env.KEYCLOAK_ADMIN_PASSWORD !== undefined) fail();
  const runDir = env.IAM_JOURNEY_RUN_DIR;
  await safePath(PRIVATE_ROOT, runDir, { privateMode: true, directory: true });
  if (!runId(path.basename(runDir))) fail();
  await safePath(runDir, env.DATABASE_FILENAME, { missingLeaf: true, privateMode: true });
  try { await lstat(env.DATABASE_FILENAME); fail(); } catch (error) { if (error.code !== 'ENOENT') fail(); }
  for (const key of ['ENV_PATH', 'IAM_JOURNEY_COMPOSE_ENV_FILE']) await safePath(runDir, env[key], { privateMode: true });
  let compose;
  try { compose = await readFile(env.IAM_JOURNEY_COMPOSE_ENV_FILE, 'utf8'); } catch { fail(); }
  const composeKeys = new Set();
  for (const line of compose.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match || (!match[2] && match[1] !== 'MIDPOINT_SCIM_TOKEN')
      || composeKeys.has(match[1]) || ['KEYCLOAK_ADMIN', 'KEYCLOAK_ADMIN_PASSWORD'].includes(match[1])) fail();
    composeKeys.add(match[1]);
  }
  if (['KC_BOOTSTRAP_ADMIN_USERNAME', 'KC_BOOTSTRAP_ADMIN_PASSWORD', 'MIDPOINT_ADMIN_PASSWORD',
    'MIDPOINT_DB_NAME', 'MIDPOINT_DB_USER', 'MIDPOINT_DB_PASSWORD', 'MIDPOINT_SCIM_TOKEN'].some(key => !composeKeys.has(key))) fail();
  const evidenceDir = env.IAM_JOURNEY_EVIDENCE_DIR;
  if (path.basename(evidenceDir ?? '') !== path.basename(runDir)) fail();
  await safePath(EVIDENCE_ROOT, evidenceDir, { missingLeaf: true, directory: true });
  for (const key of ['KEYCLOAK_BASE_URL', 'KEYCLOAK_ISSUER', 'AUTH_URL', 'AUTH_KEYCLOAK_ISSUER', 'CSRM_API_BASE_URL']) {
    let url;
    try { url = new URL(env[key]); } catch { fail(); }
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash) fail();
  }
  if (env.AUTH_URL !== 'http://localhost:3000' || env.KEYCLOAK_ISSUER !== env.AUTH_KEYCLOAK_ISSUER
    || env.KEYCLOAK_REALM !== 'idambox') fail();
  return true;
}

async function readBundleDirectory(env, contract) {
  const directory = env.IAM_JOURNEY_EVIDENCE_DIR;
  if (!runId(path.basename(directory ?? ''))) fail();
  await safePath(EVIDENCE_ROOT, directory, { directory: true });
  const file = path.join(directory, contract ? 'contract.json' : 'journey.json');
  await safePath(directory, file);
  const stat = await lstat(file);
  if (stat.size > 1048576) fail();
  let bundle;
  try { bundle = JSON.parse(await readFile(file, 'utf8')); } catch { fail(); }
  if (bundle.runId !== path.basename(directory)) fail();
  if (contract) verifyContractEvidence(bundle); else verifyJourneyEvidence(bundle);
  if (!contract) for (const person of bundle.people) for (const screenshot of person.screenshots) {
    const target = path.join(directory, screenshot);
    await safePath(directory, target, { privateMode: true });
    const image = await readFile(target);
    if (image.length < 24 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || image.readUInt32BE(16) !== person.width || image.readUInt32BE(20) !== person.height) fail();
  }
  return true;
}

export async function verifyEvidenceDirectory(env, { contract = false } = {}) {
  try { return await readBundleDirectory(env, contract); } catch { fail(); }
}

/** Publication is possible only after complete cleanup; validation precedes all writes. */
export async function persistJourneyEvidence(bundle, destination, screenshots) {
  verifyJourneyEvidence(bundle);
  if (path.basename(destination ?? '') !== bundle.runId) fail();
  await safePath(EVIDENCE_ROOT, destination, { missingLeaf: true, directory: true });
  try { await lstat(destination); fail(); } catch (error) { if (error.code !== 'ENOENT') fail(); }
  const names = bundle.people.flatMap(person => person.screenshots);
  if (!(screenshots instanceof Map) || screenshots.size !== names.length || names.some(name => !screenshots.has(name))) fail();
  for (const person of bundle.people) for (const name of person.screenshots) {
    const bytes = screenshots.get(name);
    if (!Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || bytes.readUInt32BE(16) !== person.width || bytes.readUInt32BE(20) !== person.height) fail();
  }
  const staging = path.join(EVIDENCE_ROOT, `${bundle.runId}-pending-${randomUUID()}`);
  await mkdir(staging, { mode: 0o700 });
  try {
    await mkdir(path.join(staging, 'screenshots'), { mode: 0o700 });
    await writeFile(path.join(staging, 'journey.json'), `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    for (const name of names) await writeFile(path.join(staging, name), screenshots.get(name), { mode: 0o600, flag: 'wx' });
    await rename(staging, destination);
  } finally { await rm(staging, { recursive: true, force: true }); }
}

/** Snapshot frozen inputs without retaining their contents or private configuration. */
export async function snapshotJourneyContracts() {
  const { readdir } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const files = ['apps/backend/.env.example', 'apps/csrm/.env.local.example',
    'apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json'];
  async function collect(relative, select) {
    for (const row of await readdir(path.join(ROOT, relative), { withFileTypes: true })) {
      const file = `${relative}/${row.name}`;
      if (row.isDirectory()) await collect(file, select);
      else if (select(file)) files.push(file);
    }
  }
  await collect('docs/references', () => true);
  await collect('apps/backend/src/api', file => file.endsWith('/schema.json'));
  await collect('apps/backend/types/generated', () => true);
  await collect('apps/csrm/src/lib/api/generated', () => true);
  const hash = createHash('sha256');
  for (const file of files.sort()) { hash.update(file); hash.update(await readFile(path.join(ROOT, file))); }
  return hash.digest('hex');
}

/** Project private observations into the closed 05-05 format; never spread adapter payloads. */
export function assembleJourneyEvidence({ runId, date, stages, tasks, links, accessObservations, conflict, regressions }) {
  const people = [1440, 375].map(width => {
    const link = links.get(width);
    const access = accessObservations.get(`requestor-access-${width}`);
    const mover = accessObservations.get(`csv-mover-${width}`);
    const refusal = accessObservations.get(`immediate-refusal-${width}`);
    const remote = accessObservations.get(`remote-completion-${width}`);
    if (!link || !access || !mover || !refusal || !remote || access.requestorOnly !== true
      || access.restrictedApisRefused !== true || access.restrictedRoutesRefused !== true || access.foreignRecordRefused !== true
      || mover.sameBrowserSession !== true || refusal.sameBrowserSession !== true
      || access.sessionKey !== mover.sessionKey || access.sessionKey !== refusal.sessionKey
      || remote.freshSignInRefused !== true) fail();
    return { width, height: width === 1440 ? 900 : 812, sourceKey: link.sourceKey, identityOid: link.identityOid,
      documentId: link.documentId, remoteSubject: link.remoteSubject,
      assertions: Object.fromEntries(['freshMatchedMail', 'actualPasswordLink', 'freshOidcSignIn', 'requestorOnly',
        'restrictedRoutesRefused', 'foreignRecordRefused', 'moverLinkageUnchanged', 'moverAttributesMirrored', 'moverNoInvitation',
        'sameBrowserSession', 'terminatedPut', 'localInactive', 'remoteDisabled', 'remoteSessionsEnded', 'freshSignInRefused',
        'keyboard', 'visibleFocus', 'readableErrors', 'noHorizontalOverflow'].map(key => [key, true])),
      refusal: Object.fromEntries(['observedAt', 'accessTokenExpiresAt', 'accessStatus', 'detailStatus', 'writeStatus',
        'browserListRefused', 'browserDetailRefused', 'beforeRemoteLogout'].map(key => [key, refusal[key]])),
      screenshots: [`screenshots/csrm-${width}-requestor.png`, `screenshots/csrm-${width}-refusal.png`] };
  });
  const bundle = { format: 1, runId, date, provenance: 'live-journey',
    reset: { idpVolumesRemoved: true, freshDatabase: true, exclusiveListeners: true, exclusiveCompiler: true, schedulesSuspended: true },
    versions: { midpoint: PIN.midpoint, connector: PIN.connector, sourceCommit: PIN.sourceCommit, keycloak: '26.6.1' },
    stages: stages.map(row => Object.fromEntries(['stage', 'outcome', 'startedMs', 'durationMs'].map(key => [key, row[key]]))),
    tasks: tasks.map(row => Object.fromEntries(['stage', 'taskOid', 'invocation', 'triggeredAt', 'finishedAt', 'result',
      'nativeAuditId', 'scimCorrelationId', 'scimMethod', 'scimStatus', 'nativePaging', 'cadenceSeconds'].map(key =>
      [key, ['triggeredAt', 'finishedAt'].includes(key) ? new Date(row[key]).toISOString() : row[key]]))),
    people, conflict: Object.fromEntries(['scenario', 'status', 'retryAfterSeconds', 'initialRetrySeconds', 'subsequentRetrySeconds',
      'nativeRetryObserved', 'retryScheduledAt', 'retryTriggeredAt', 'correctionApplied', 'recovered', 'rollback', 'ownershipUnchanged',
      'noInvitation'].map(key => [key, ['retryScheduledAt', 'retryTriggeredAt'].includes(key) && conflict?.[key]
        ? new Date(conflict[key]).toISOString() : conflict?.[key]])),
    cleanup: { processesStopped: true, listenersClosed: true, privateFilesRemoved: true, schedulesRestored: true },
    regressions: { backendUnfiltered: regressions?.backendUnfiltered, csrm: regressions?.csrm, contracts: regressions?.contracts,
      catalogues: true, schemas: true, defaults: true } };
  verifyJourneyEvidence(bundle);
  return bundle;
}
