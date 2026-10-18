/** Pure evidence boundary. Raw envelopes and credentials must never reach a writer. */
export const PIN = Object.freeze({ midpoint: '4.8.14', connector: '1.2.9',
  sourceCommit: '05c404bbecf9c28938e2183411c7b04b4f8f4226',
  endpoint: 'http://host.docker.internal:1337/scim/v2' });
export const COMMAND = 'node docker/midpoint/e2e/capture-scim.mjs --run';
export const SCENARIOS = Object.freeze(['connection', 'lookup', 'create', 'read', 'list', 'filter',
  'page', 'mover', 'multi-value', 'leaver', 'delete', 'schemas', 'config', 'groups']);
export const INVOCATIONS = Object.freeze({ connection: 'POST /resources/{resource}/test', lookup: 'POST /shadows/search',
  create: 'POST /shadows', read: 'GET /shadows/{shadow}', list: 'POST /shadows/search', filter: 'POST /shadows/search',
  page: 'POST /shadows/search', mover: 'PATCH /shadows/{shadow}', 'multi-value': 'PATCH /shadows/{shadow}',
  leaver: 'PATCH /shadows/{shadow}', delete: 'DELETE /shadows/{shadow}', schemas: 'GET /scim/v2/Schemas',
  config: 'GET /scim/v2/ServiceProviderConfig', groups: 'GET /scim/v2/Groups' });
export const LIFECYCLE_SCENARIOS = Object.freeze(['connection', 'initial-import', 'live-sync-baseline', 'mover', 'leaver', 'claim-conflict', 'claim-case', 'claim-confirm', 'reconciliation']);
export const LIFECYCLE_COMMAND = 'node docker/midpoint/e2e/capture-lifecycle.mjs --run';
export const LIFECYCLE_INVOCATIONS = Object.freeze(Object.fromEntries(LIFECYCLE_SCENARIOS.map(stage => [stage,
  stage === 'connection' ? 'POST /resources/11000000-0000-4000-8000-000000000110/test'
    : stage === 'claim-confirm' ? 'POST /rpc/executeScript'
    : `POST /tasks/11000000-0000-4000-8000-000000000${stage === 'initial-import' ? '310' : ['claim-case', 'reconciliation'].includes(stage) ? '320' : '300'}/run`])));
function profileOptions(profile) {
  if (profile === 'phase4') return { scenarios: LIFECYCLE_SCENARIOS, invocations: LIFECYCLE_INVOCATIONS, command: LIFECYCLE_COMMAND };
  if (profile !== undefined) fail();
  return { scenarios: SCENARIOS, invocations: INVOCATIONS, command: COMMAND };
}
const DIRECT = new Set(['schemas', 'config', 'groups']);
const SAFE_HEADERS = new Set(['accept', 'content-type', 'retry-after']);
const SENSITIVE = /authorization|cookie|credential|password|secret|token|api[-_]?key/i;
const TOKEN = /\bBearer\s+(?!token\b)\S+|idb_scim_v1\.[A-Za-z0-9_.-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i;
const MARKER = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const fail = () => { throw new Error('SCIM_EVIDENCE_INVALID'); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed) {
  if (!object(value) || Object.keys(value).some((key) => !allowed.includes(key))
    || allowed.some((key) => !Object.hasOwn(value, key))) fail();
}
function clean(value, secrets) {
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
  if (typeof value === 'string') {
    if (TOKEN.test(value) || secrets.some((secret) => secret && value.includes(secret))) fail();
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => clean(item, secrets));
  if (!object(value)) fail();
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => !SENSITIVE.test(key)
    || (key === 'changePassword' && object(item) && Object.keys(item).length === 1 && item.supported === false))
    .map(([key, item]) => [clean(key, secrets), clean(item, secrets)]));
}
function headers(value, secrets) {
  if (!object(value)) fail();
  return Object.fromEntries(Object.entries(value).filter(([key]) => SAFE_HEADERS.has(key.toLowerCase()))
    .map(([key, item]) => [key.toLowerCase(), clean(item, secrets)]));
}
export function sanitizeEnvelope(value, { secrets = [], profile } = {}) {
  const { scenarios, invocations } = profileOptions(profile);
  keys(value, ['sequence', 'scenario', 'origin', 'invocation', 'request', 'response']);
  keys(value.request, ['method', 'path', 'headers', 'body']);
  keys(value.response, ['status', 'headers', 'body']);
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 1 || !scenarios.includes(value.scenario)
    || value.origin !== (DIRECT.has(value.scenario) ? 'direct-probe' : 'connector')
    || value.invocation !== invocations[value.scenario]
    || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(value.request.method)
    || !Number.isInteger(value.response.status) || value.response.status < 100 || value.response.status > 599) fail();
  const url = new URL(value.request.path, 'http://capture.invalid');
  if (url.origin !== 'http://capture.invalid' || !url.pathname.startsWith('/scim/v2/')
    || url.hash || /[\r\n\\]/.test(value.request.path)) fail();
  for (const item of url.searchParams.values()) clean(item, secrets);
  clean(decodeURIComponent(url.pathname), secrets);
  for (const key of url.searchParams.keys()) {
    if (!['filter', 'startIndex', 'count', 'attributes', 'excludedAttributes'].includes(key)) fail();
  }
  return { sequence: value.sequence, scenario: value.scenario, origin: value.origin,
    invocation: clean(value.invocation, secrets), request: { method: value.request.method,
      path: clean(value.request.path, secrets), headers: headers(value.request.headers, secrets),
      body: clean(value.request.body, secrets) }, response: { status: value.response.status,
      headers: headers(value.response.headers, secrets), body: clean(value.response.body, secrets) } };
}

function substitutionAllowed(kind, key, value) {
  return kind === 'timestamp' ? ['created', 'lastModified'].includes(key)
    : key === 'id' || (['path', 'location'].includes(key) && /\/Users\//.test(value));
}

/** Replacements are literal, declared, one-to-one and applied without reserializing JSON strings. */
export function substitute(capture, declarations) {
  if (!Array.isArray(capture) || !Array.isArray(declarations)) fail();
  const names = new Set(); const values = new Set(); const map = {};
  for (const entry of declarations) {
    keys(entry, ['name', 'kind', 'value']);
    if (!/^[A-Z][A-Z0-9_]*$/.test(entry.name) || !['user-id', 'resource-id', 'timestamp'].includes(entry.kind)
      || typeof entry.value !== 'string' || !entry.value || entry.value.includes('{{')
      || names.has(entry.name) || values.has(entry.value) || TOKEN.test(entry.value)
      || (entry.kind === 'user-id' && !/^[A-Za-z0-9_-]{6,64}$/.test(entry.value))
      || (entry.kind === 'resource-id' && !/^[a-f0-9-]{36}$/.test(entry.value))
      || (entry.kind === 'timestamp' && !/^\d{4}-\d\d-\d\dT[^ ]+Z$/.test(entry.value))) fail();
    names.add(entry.name); values.add(entry.value); map[entry.name] = { kind: entry.kind };
  }
  const used = new Set();
  function visit(value, trail = []) {
    if (typeof value === 'string') {
      if (value.includes('{{') || value.includes('}}')) fail();
      if (declarations.length) {
        const choices = [...declarations].sort((a, b) => b.value.length - a.value.length);
        const pattern = new RegExp(choices.map((entry) => entry.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
        value = value.replace(pattern, (match) => {
          const entry = choices.find((candidate) => candidate.value === match);
          if (!substitutionAllowed(entry.kind, trail.at(-1), value)) fail();
          used.add(entry.name); return `{{${entry.name}}}`;
        });
      }
      return value;
    }
    if (Array.isArray(value)) return value.map((item, index) => visit(item, [...trail, index]));
    if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, [...trail, key])]));
    return value;
  }
  const result = visit(capture);
  if (used.size !== names.size) fail();
  return { capture: result, substitutions: map };
}
function matches(entry) {
  const { method, path, body } = entry.request;
  // Resolve placeholders only for URL parsing; wire content is left untouched.
  const url = new URL(path.replace(MARKER, 'dynamic'), 'http://capture.invalid');
  const users = url.pathname === '/scim/v2/Users';
  const user = /^\/scim\/v2\/Users\/[^/]+$/.test(url.pathname);
  const ok = entry.response.status >= 200 && entry.response.status < 300;
  if (!ok) return false;
  switch (entry.scenario) {
    case 'connection': return method === 'GET' && url.pathname === '/scim/v2/ResourceTypes';
    case 'lookup': return method === 'GET' && users && url.searchParams.has('filter') && entry.response.body?.totalResults === 0;
    case 'create': return method === 'POST' && users && entry.response.status === 201 && !!entry.response.body?.id;
    case 'read': return method === 'GET' && user && !!entry.response.body?.id;
    case 'list': return method === 'GET' && users && !url.searchParams.has('filter') && Array.isArray(entry.response.body?.Resources);
    case 'filter': return method === 'GET' && users && url.searchParams.has('filter') && entry.response.body?.totalResults > 0;
    // P3-36: midPoint 4.8.14 does not pass shadow-search paging to the pinned connector, which then lists unpaged.
    // Record whichever real shape the paged invocation produced: valid startIndex/count together, or neither.
    case 'page': return method === 'GET' && users && !url.searchParams.has('filter')
      && (url.searchParams.has('startIndex') || url.searchParams.has('count')
        ? /^\d+$/.test(url.searchParams.get('startIndex') ?? '') && /^[1-9]\d*$/.test(url.searchParams.get('count') ?? '')
        : true)
      && Array.isArray(entry.response.body?.Resources) && entry.response.body?.itemsPerPage > 0;
    case 'mover': return method === 'PUT' && user && body?.title === 'Gate Mover'
      && entry.response.body?.title === 'Gate Mover' && entry.response.body?.active === true;
    case 'multi-value': return method === 'PATCH' && user && Array.isArray(body?.Operations)
      && body.Operations.some((op) => op.op?.toLowerCase() === 'remove' && op.path?.startsWith('emails['))
      && body.Operations.findIndex((op) => op.op?.toLowerCase() === 'add' && op.path === 'emails')
        > body.Operations.findIndex((op) => op.op?.toLowerCase() === 'remove' && op.path?.startsWith('emails['))
      && entry.response.body?.emails?.[0]?.value === 'gate.mover@idambox.test';
    case 'leaver': return ['PUT', 'PATCH'].includes(method) && user && entry.response.body?.active === false
      && (body?.active === false || body?.Operations?.some((op) => op.path === 'active' && op.value === false));
    case 'delete': return method === 'DELETE' && user && entry.response.status === 204;
    case 'schemas': return method === 'GET' && url.pathname === '/scim/v2/Schemas' && entry.response.body?.totalResults === 3;
    case 'config': return method === 'GET' && url.pathname === '/scim/v2/ServiceProviderConfig'
      && entry.response.body?.patch?.supported === true && entry.response.body?.filter?.supported === true;
    case 'groups': return method === 'GET' && url.pathname === '/scim/v2/Groups'
      && entry.response.body?.totalResults === 0 && entry.response.body?.Resources?.length === 0;
    default: return false;
  }
}
export function verifyEvidence(capture, manifest, { profile } = {}) {
  const { scenarios, command } = profileOptions(profile);
  keys(manifest, ['format', 'provenance', 'versions', 'command', 'runId', 'date', 'endpoint', 'scenarios', 'substitutions', 'cleanup']);
  keys(manifest.versions, ['midpoint', 'connector', 'sourceCommit']);
  if (manifest.format !== 1 || manifest.provenance !== 'live-connector' || manifest.command !== command
    || manifest.endpoint !== PIN.endpoint || !/^iam-scim-gate-[a-f0-9-]{36}$/.test(manifest.runId)
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(manifest.date) || !Number.isFinite(Date.parse(manifest.date))
    || manifest.versions.midpoint !== PIN.midpoint || manifest.versions.connector !== PIN.connector
    || manifest.versions.sourceCommit !== PIN.sourceCommit || manifest.cleanup !== true
    || !Array.isArray(capture) || !capture.length || !object(manifest.substitutions)
    || JSON.stringify(manifest.scenarios) !== JSON.stringify(scenarios)) fail();
  // Closed metadata and secret rejection apply even to already-sanitized input.
  if (JSON.stringify(clean(manifest, [])) !== JSON.stringify(manifest)) fail();
  const used = new Set();
  for (const [name, value] of Object.entries(manifest.substitutions)) {
    keys(value, ['kind']);
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || !(profile === 'phase4' ? ['user-id'] : ['user-id', 'resource-id', 'timestamp']).includes(value.kind)) fail();
  }
  let previousScenario = -1;
  for (const [index, entry] of capture.entries()) {
    if (entry.sequence !== index + 1 || (entry.response.status >= 400 && !(profile === 'phase4' && expectedLifecycleConflict(entry)))
      || JSON.stringify(sanitizeEnvelope(entry, { profile })) !== JSON.stringify(entry)) fail();
    const position = scenarios.indexOf(entry.scenario);
    if (position < previousScenario) fail();
    previousScenario = position;
    const encoded = JSON.stringify(entry);
    function checkMarkers(value, trail = []) {
      if (typeof value === 'string') {
        if (/\{\{|\}\}/.test(value.replace(MARKER, 'dynamic'))) fail();
        for (const match of value.matchAll(MARKER)) {
          const declaration = manifest.substitutions[match[1]];
          if (!declaration || !substitutionAllowed(declaration.kind, trail.at(-1), value)) fail();
        }
      }
      if (Array.isArray(value)) value.forEach((item, index) => checkMarkers(item, [...trail, index]));
      else if (object(value)) for (const [key, item] of Object.entries(value)) {
        if (key.includes('{{') || key.includes('}}')) fail();
        checkMarkers(item, [...trail, key]);
      }
    }
    checkMarkers(entry);
    for (const match of encoded.matchAll(MARKER)) {
      if (!Object.hasOwn(manifest.substitutions, match[1])) fail();
      used.add(match[1]);
    }
  }
  if (used.size !== Object.keys(manifest.substitutions).length) fail();
  if (profile === 'phase4') return verifyLifecycleOperations(capture, manifest);
  for (const scenario of SCENARIOS) if (!capture.some((entry) => entry.scenario === scenario && matches(entry))) fail();
  const createdId = capture.find((entry) => entry.scenario === 'create' && matches(entry)).response.body.id;
  const marker = /^\{\{([A-Z][A-Z0-9_]*)\}\}$/.exec(createdId);
  if (!marker || manifest.substitutions[marker[1]]?.kind !== 'user-id') fail();
  for (const entry of capture) {
    if (entry.request.path.startsWith('/scim/v2/Users/')) {
      if (entry.request.path.split('?')[0] !== `/scim/v2/Users/${createdId}`) fail();
      if (entry.response.body?.id && entry.response.body.id !== createdId) fail();
    }
  }
  return true;
}

/** Abort before cleanup; cleanup has an independent budget and always runs. */
export async function executeStages(runtime, { stageMs = 180_000, overallMs = 1_200_000, cleanupMs = 30_000, scenarios = SCENARIOS } = {}) {
  const overall = AbortSignal.timeout(overallMs);
  let failure;
  async function bounded(work, milliseconds, parent) {
    const controller = new AbortController();
    const signal = parent ? AbortSignal.any([parent, controller.signal]) : controller.signal;
    signal.throwIfAborted();
    let timer;
    const aborted = new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('SCIM_CAPTURE_TIMEOUT')), { once: true });
      timer = setTimeout(() => controller.abort(), milliseconds);
    });
    try { return await Promise.race([Promise.resolve().then(() => work(signal)), aborted]); }
    finally { clearTimeout(timer); controller.abort(); }
  }
  let stage = 'prepare';
  try {
    await bounded((signal) => runtime.prepare(signal), stageMs, overall);
    for (const scenario of scenarios) {
      stage = scenario; await bounded((signal) => runtime.stage(scenario, signal), stageMs, overall);
    }
  } catch { failure = new Error(`SCIM_CAPTURE_STAGE_FAILED:${stage}`); }
  finally {
    try { await bounded((signal) => runtime.cleanup(signal), cleanupMs); }
    catch { failure = new Error('SCIM_CAPTURE_CLEANUP_FAILED'); }
  }
  if (failure) throw failure;
}

function expectedLifecycleConflict(entry) {
  return ['claim-conflict', 'claim-case'].includes(entry.scenario) && entry.request.method === 'POST'
    && entry.request.path === '/scim/v2/Users' && entry.response.status === 409
    && entry.request.body?.userName === 'lifecycle.maya'
    && entry.request.body?.emails?.some(email => email.value === 'maya.requestor@idambox.com');
}

/** Require the persistent mappings' actual wire operations, including the deliberate conflict. */
function verifyLifecycleOperations(capture, manifest) {
  const enterprise = 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';
  const at = (stage, predicate) => capture.filter(e => e.scenario === stage && predicate(e));
  const pathOf = e => e.request.path.split('?')[0];
  const write = (e, method) => e.request.method === method && /^\/scim\/v2\/Users\/[^/]+$/.test(pathOf(e)) && e.response.status === 200;
  const create = e => e.request.method === 'POST' && pathOf(e) === '/scim/v2/Users' && e.response.status === 201;
  const has = (stage, predicate) => { const result = at(stage, predicate); if (!result.length) fail(); return result; };
  has('connection', e => e.request.method === 'GET' && pathOf(e) === '/scim/v2/ResourceTypes' && e.response.status === 200);
  const created = has('initial-import', create);
  const mover = has('mover', e => write(e, 'PUT') && e.request.body?.title === 'Lifecycle Lead'
    && e.request.body?.[enterprise]?.department === 'Lifecycle Operations' && e.response.body?.title === 'Lifecycle Lead'
    && e.response.body?.[enterprise]?.department === 'Lifecycle Operations')[0];
  has('mover', e => {
    if (!write(e, 'PATCH') || pathOf(e) !== pathOf(mover)) return false;
    const ops = e.request.body?.Operations;
    const remove = ops?.findIndex(op => op.op?.toLowerCase() === 'remove' && op.path?.startsWith('emails['));
    return remove >= 0 && ops.findIndex(op => op.op?.toLowerCase() === 'add' && op.path === 'emails') > remove
      && e.response.body?.emails?.[0]?.value === 'lifecycle.mover@idambox.test';
  });
  has('leaver', e => write(e, 'PUT') && pathOf(e) === pathOf(mover) && e.request.body?.active === false && e.response.body?.active === false);
  has('claim-conflict', expectedLifecycleConflict);
  const claim = has('claim-confirm', e => write(e, 'PUT') && (e.request.body?.externalId === '940002'
    || e.request.body?.[enterprise]?.employeeNumber === '940002') && e.response.body?.externalId === '940002')[0];
  has('reconciliation', e => {
    const url = new URL(e.request.path.replace(/\{\{[^}]+\}\}/g, 'dynamic'), 'http://capture.invalid');
    return e.request.method === 'GET' && url.pathname === '/scim/v2/Users' && !url.searchParams.has('filter')
      && url.searchParams.get('count') === '100' && /^[1-9]\d*$/.test(url.searchParams.get('startIndex') ?? '')
      && e.response.status === 200 && Array.isArray(e.response.body?.Resources) && e.response.body.Resources.length > 0;
  });
  has('reconciliation', e => e.request.method === 'GET' && pathOf(e) === pathOf(claim) && e.response.status === 200);
  // A live sync with no HR change may still rewrite displayName: the pinned connector reads it back
  // as the userName, so the strong mapping re-asserts it (ADR 0006). Only that core-attribute PUT is allowed.
  const displayNameRewrite = e => write(e, 'PUT') && Object.keys(e.request.body ?? {}).every(key =>
    ['displayName', 'groups', 'id', 'name', 'schemas', 'userName'].includes(key));
  if (capture.some(e => e.request.method === 'DELETE'
    || (e.scenario === 'live-sync-baseline' && e.request.method !== 'GET' && !displayNameRewrite(e)))) fail();
  const ids = new Set();
  for (const e of capture) {
    const body = e.response.body;
    for (const user of [body, ...(body?.Resources ?? [])]) {
      if (user?.userName && user.id) {
        const marker = /^\{\{([A-Z][A-Z0-9_]*)\}\}$/.exec(user.id);
        if (!marker || manifest.substitutions[marker[1]]?.kind !== 'user-id') fail();
        ids.add(user.id);
      }
    }
  }
  if (!created.some(e => pathOf(mover) === `/scim/v2/Users/${e.response.body?.id}`)) fail();
  const claimedId = claim.response.body?.id;
  if (!ids.has(claimedId) || pathOf(claim) !== `/scim/v2/Users/${claimedId}`
    || !at('claim-case', e => e.response.body?.id === claimedId && e.response.body?.userName === 'maya.requestor' && !e.response.body?.externalId).length) fail();
  for (const e of capture) {
    if (/^\/scim\/v2\/Users\//.test(pathOf(e))) {
      const id = pathOf(e).slice('/scim/v2/Users/'.length);
      if (!ids.has(id) || (e.response.body?.id && e.response.body.id !== id)) fail();
    }
  }
  return true;
}
