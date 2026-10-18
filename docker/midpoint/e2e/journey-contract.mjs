/** Controlled endpoint observations. Importing this module performs no requests. */
import { randomBytes } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

export const PROBE_CASES = Object.freeze(['A1', 'A2', 'A3', 'A4']);
const error = code => Object.assign(new Error(code), { code });
const requireFact = (value, code) => { if (!value) throw error(code); };
const smtp = Object.freeze({ host: 'mailpit', port: '1025', from: 'identity@idambox.test', ssl: 'false', starttls: 'false', auth: 'false' });
async function bounded(signal, work, code) {
  signal.throwIfAborted(); let abort;
  try {
    return await Promise.race([Promise.resolve().then(work), new Promise((_, reject) => {
      abort = () => reject(error(code)); signal.addEventListener('abort', abort, { once: true });
    })]);
  } finally { if (abort) signal.removeEventListener('abort', abort); }
}

/** Only local source references leave this reader; no source text or checkout paths are published. */
export async function readLocalContractReferences(directory) {
  if (!directory) return [];
  try {
    const root = await realpath(directory);
    const { stdout } = await promisify(execFile)('git', ['-C', root, 'rev-parse', 'HEAD'], { timeout: 3000 });
    const commit = stdout.trim(); requireFact(/^[0-9a-f]{40}$/.test(commit), 'JOURNEY_CONTRACT_SOURCES');
    const pom = await readFile(path.join(root, 'pom.xml'), 'utf8');
    requireFact(/<version>26\.6\.1<\/version>/.test(pom), 'JOURNEY_CONTRACT_SOURCES');
    const file = 'services/src/main/java/org/keycloak/services/resources/admin/UserResource.java';
    const target = await realpath(path.join(root, file));
    requireFact(target.startsWith(`${root}${path.sep}`), 'JOURNEY_CONTRACT_SOURCES');
    const lines = (await readFile(target, 'utf8')).split('\n');
    const needles = ['execute-actions-email', 'client_id', 'redirect_uri', 'lifespan'];
    return needles.map(term => {
      const line = lines.findIndex(value => value.includes(term)) + 1;
      requireFact(line > 0, 'JOURNEY_CONTRACT_SOURCES');
      return { version: '26.6.1', commit, file, line };
    });
  } catch { throw error('JOURNEY_CONTRACT_SOURCES'); }
}

/** Private HTTP seam. Receipt polling and actual action consumption stay in controlled adapters. */
export function createKeycloakProbeRuntime({ baseUrl, realm, token, transport = fetch, mail, browser, queryContract, operator }) {
  let base;
  try { base = new URL(baseUrl); } catch { throw error('JOURNEY_CONTRACT_INPUT'); }
  requireFact(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
    && base.pathname === '/' && !base.search && !base.hash && !base.username && !base.password && realm === 'idambox', 'JOURNEY_CONTRACT_INPUT');
  const prefix = `/admin/realms/${realm}`;
  const owned = new Map();
  async function request(method, route, body, signal) {
    signal?.throwIfAborted();
    try {
      const response = await transport(`${base.origin}${route}`, { method, signal,
        headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), redirect: 'error' });
      return response;
    } catch { throw error('JOURNEY_CONTRACT_TRANSPORT'); }
  }
  const json = async (method, route, body, signal) => {
    const response = await request(method, route, body, signal);
    requireFact(response.status === 200, 'JOURNEY_CONTRACT_STATUS');
    try { return await response.json(); } catch { throw error('JOURNEY_CONTRACT_TRANSPORT'); }
  };
  const userPath = user => {
    requireFact(/^[A-Za-z0-9_-]{1,128}$/.test(user?.id ?? ''), 'JOURNEY_CONTRACT_INPUT');
    return `${prefix}/users/${user.id}`;
  };
  return {
    version: async signal => (await json('GET', '/admin/serverinfo', undefined, signal)).systemInfo?.version,
    queryContract: async signal => { requireFact(typeof queryContract === 'function', 'JOURNEY_CONTRACT_A2'); return queryContract(signal); },
    snapshotSmtp: async signal => (await json('GET', prefix, undefined, signal)).smtpServer ?? {},
    setSmtp: async (value, signal) => { requireFact((await request('PUT', prefix, { smtpServer: value }, signal)).status === 204, 'JOURNEY_CONTRACT_STATUS'); },
    restoreSmtp: async (value, signal) => { requireFact((await request('PUT', prefix, { smtpServer: value }, signal)).status === 204, 'JOURNEY_CONTRACT_STATUS'); },
    createUser: async (spec, signal) => {
      requireFact(/^journey-contract-[0-9a-f]{12}-\d+$/.test(spec.username) && spec.email === `${spec.username}@hr.idambox.test`, 'JOURNEY_CONTRACT_INPUT');
      // Keycloak's user profile drops unmanaged attributes; the run-scoped username and created id mark ownership.
      // Names satisfy the default user profile, so consuming the action does not stop at a profile form.
      const response = await request('POST', `${prefix}/users`, { ...spec, firstName: 'Journey', lastName: 'Probe',
        enabled: true, emailVerified: true }, signal);
      requireFact(response.status === 201, 'JOURNEY_CONTRACT_STATUS');
      const location = response.headers.get('location');
      let url; try { url = new URL(location); } catch { throw error('JOURNEY_CONTRACT_OWNERSHIP'); }
      requireFact(url.origin === base.origin && url.pathname.startsWith(`${prefix}/users/`) && !url.search && !url.hash, 'JOURNEY_CONTRACT_OWNERSHIP');
      const user = { id: url.pathname.slice(`${prefix}/users/`.length), username: spec.username, email: spec.email };
      userPath(user); owned.set(user.id, spec.username); return user;
    },
    deleteUser: async (user, signal) => {
      const current = await json('GET', userPath(user), undefined, signal);
      requireFact(owned.get(user.id) === user.username && current.id === user.id && current.username === user.username
        && current.email === user.email, 'JOURNEY_CONTRACT_OWNERSHIP');
      requireFact((await request('DELETE', userPath(user), undefined, signal)).status === 204, 'JOURNEY_CONTRACT_STATUS');
      owned.delete(user.id);
    },
    readUser: (user, signal) => json('GET', userPath(user), undefined, signal),
    setRequiredActions: async (user, signal) => {
      requireFact((await request('PUT', userPath(user), { requiredActions: ['UPDATE_PASSWORD'] }, signal)).status === 204, 'JOURNEY_CONTRACT_STATUS');
    },
    executeActions: async (user, query = {}, signal) => {
      requireFact(Object.keys(query).every(key => ['client_id', 'redirect_uri', 'lifespan'].includes(key)), 'JOURNEY_CONTRACT_INPUT');
      const search = new URLSearchParams(query).toString();
      return { status: (await request('PUT', `${userPath(user)}/execute-actions-email${search ? `?${search}` : ''}`,
        ['UPDATE_PASSWORD'], signal)).status };
    },
    mailCount: (user, signal) => { requireFact(typeof mail?.count === 'function', 'JOURNEY_CONTRACT_MAIL'); return mail.count(user.email, signal); },
    observeNoMail: (user, count, durationMs, signal) => { requireFact(typeof mail?.quiet === 'function', 'JOURNEY_CONTRACT_MAIL'); return mail.quiet(user.email, count, durationMs, signal); },
    waitMail: (user, after, signal) => { requireFact(typeof mail?.wait === 'function', 'JOURNEY_CONTRACT_MAIL'); return mail.wait(user.email, after, signal); },
    consumeAction: (user, receipt, signal) => { requireFact(typeof browser?.consume === 'function', 'JOURNEY_CONTRACT_BROWSER'); return browser.consume({ user, receipt, signal }); },
    prepareResendPerson: (runId, signal) => { requireFact(typeof operator?.prepare === 'function', 'JOURNEY_CONTRACT_OPERATOR'); return operator.prepare(runId, signal); },
    operatorResend: (person, signal) => { requireFact(typeof operator?.resend === 'function', 'JOURNEY_CONTRACT_OPERATOR'); return operator.resend(person, signal); },
    cleanupResendPerson: (person, signal) => { requireFact(typeof operator?.cleanup === 'function', 'JOURNEY_CONTRACT_OPERATOR'); return operator.cleanup(person, signal); },
  };
}

/** Mandatory A1–A4 orchestration; injected transports establish expectations, never server acceptance. */
export async function runKeycloakProbe(runtime, { runId = randomBytes(6).toString('hex'), signal,
  timeoutMs = 600000, cleanupMs = 60000 } = {}) {
  requireFact(/^[0-9a-f]{12}$/.test(runId) && Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 600000
    && Number.isSafeInteger(cleanupMs) && cleanupMs > 0 && cleanupMs <= 60000, 'JOURNEY_CONTRACT_INPUT');
  const deadline = AbortSignal.timeout(timeoutMs);
  const active = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const fixtures = []; const cases = []; const ids = new Set(); let original; let snapshot = false; let first; let sourced;
  async function call(name, ...args) {
    requireFact(typeof runtime?.[name] === 'function', 'JOURNEY_CONTRACT_ADAPTER');
    return bounded(active, () => runtime[name](...args, active), 'JOURNEY_CONTRACT_TIMEOUT');
  }
  async function person() {
    const username = `journey-contract-${runId}-${fixtures.length}`;
    const user = await call('createUser', { username, email: `${username}@hr.idambox.test`, requiredActions: [] });
    requireFact(user?.username === username && /^[A-Za-z0-9_-]{1,128}$/.test(user.id ?? '') && !ids.has(user.id), 'JOURNEY_CONTRACT_OWNERSHIP');
    ids.add(user.id); fixtures.push(user); return user;
  }
  const status = async (user, query = {}, expected = 204) => {
    const response = await call('executeActions', user, query);
    requireFact(response?.status === expected, 'JOURNEY_CONTRACT_STATUS'); return response.status;
  };
  async function fresh(user) {
    const count = await call('mailCount', user);
    requireFact(Number.isSafeInteger(count) && count >= 0, 'JOURNEY_CONTRACT_MAIL');
    await status(user);
    const receipt = await call('waitMail', user, count);
    requireFact(receipt?.received === true && receipt.fresh === true, 'JOURNEY_CONTRACT_MAIL'); return receipt;
  }
  try {
    requireFact(await call('version') === '26.6.1', 'JOURNEY_CONTRACT_VERSION');
    original = await call('snapshotSmtp'); snapshot = true;
    await call('setSmtp', smtp);
    await status(await person()); cases.push({ case: 'A1', outcome: 'passed', status: 204 });
    const query = await call('queryContract');
    requireFact(JSON.stringify(query?.names) === JSON.stringify(['client_id', 'redirect_uri', 'lifespan'])
      && query.unit === 'seconds' && Number.isSafeInteger(query.defaultSeconds) && query.defaultSeconds > 0
      && query.redirectRequiresClient === true && /^[A-Za-z0-9_-]{1,128}$/.test(query.validClient ?? '')
      && ['local-pinned-source', 'observed-action-token'].includes(query.provenance), 'JOURNEY_CONTRACT_A2');
    let redirect; try { redirect = new URL(query.validRedirect); } catch { throw error('JOURNEY_CONTRACT_A2'); }
    requireFact(redirect.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(redirect.hostname)
      && !redirect.username && !redirect.password && !redirect.search && !redirect.hash, 'JOURNEY_CONTRACT_A2');
    for (const [parameters, expected] of [
      [{}, 204], [{ client_id: query.validClient }, 204], [{ lifespan: '60' }, 204],
      [{ client_id: query.validClient, redirect_uri: query.validRedirect, lifespan: '60' }, 204],
      [{ client_id: 'missing-client' }, 400], [{ redirect_uri: query.validRedirect }, 400],
      [{ client_id: query.validClient, redirect_uri: 'http://invalid.test/rejected' }, 400],
    ]) await status(await person(), parameters, expected);
    cases.push({ case: 'A2', outcome: 'passed', defaultSeconds: query.defaultSeconds, lifespanUnit: 'seconds', combinations: 7 });
    const silent = await person(); const before = await call('mailCount', silent);
    await call('setRequiredActions', silent);
    requireFact(await call('observeNoMail', silent, before, 1000) === true
      && await call('mailCount', silent) === before, 'JOURNEY_CONTRACT_A3');
    await call('setSmtp', {}); await status(silent, {}, 500);
    requireFact(await call('mailCount', silent) === before, 'JOURNEY_CONTRACT_A3');
    await call('setSmtp', smtp); await fresh(silent);
    cases.push({ case: 'A3', outcome: 'passed', noSmtpStatus: 500 });
    const existing = await person(); await call('setRequiredActions', existing);
    const receipt = await fresh(existing);
    requireFact((await call('consumeAction', existing, receipt))?.consumed === true, 'JOURNEY_CONTRACT_A4');
    const after = await call('readUser', existing);
    requireFact(Array.isArray(after?.requiredActions) && !after.requiredActions.includes('UPDATE_PASSWORD'), 'JOURNEY_CONTRACT_A4');
    const prepared = await call('prepareResendPerson', runId);
    requireFact(prepared?.owner === runId && prepared.sourceManaged === true && prepared.documentId
      && prepared.id && !ids.has(prepared.id), 'JOURNEY_CONTRACT_OWNERSHIP');
    sourced = prepared;
    for (let attempt = 0; attempt < 2; attempt++) {
      const count = await call('mailCount', sourced);
      requireFact((await call('operatorResend', sourced))?.accepted === true, 'JOURNEY_CONTRACT_OPERATOR');
      const receipt = await call('waitMail', sourced, count);
      requireFact(receipt?.received === true && receipt.fresh === true, 'JOURNEY_CONTRACT_MAIL');
    }
    cases.push({ case: 'A4', outcome: 'passed', remainingPasswordAction: false, freshResend: true });
  } catch (caught) {
    first = error(/^JOURNEY_CONTRACT_[A-Z0-9_]+$/.test(caught?.code ?? '') ? caught.code : 'JOURNEY_CONTRACT_FAILED');
  } finally {
    const cleanupSignal = AbortSignal.timeout(cleanupMs); let cleanupFailed = false;
    const clean = async work => {
      try { await bounded(cleanupSignal, work, 'JOURNEY_CONTRACT_CLEANUP'); }
      catch { cleanupFailed = true; }
    };
    for (const user of fixtures.toReversed()) await clean(() => runtime.deleteUser(user, cleanupSignal));
    if (sourced) await clean(() => runtime.cleanupResendPerson(sourced, cleanupSignal));
    if (snapshot) await clean(() => runtime.restoreSmtp(original, cleanupSignal));
    if (cleanupFailed) { if (first) first.cleanupCode = 'JOURNEY_CONTRACT_CLEANUP'; else first = error('JOURNEY_CONTRACT_CLEANUP'); }
  }
  if (first) throw first;
  return { keycloak: '26.6.1', cases, cleanup: true, liveAcceptance: false };
}

export async function probeKeycloak({ env, runtime, ...options }) {
  const { validatePrivateContract } = await import('./journey-evidence.mjs');
  await validatePrivateContract(env);
  const sources = await readLocalContractReferences(env.IAM_KEYCLOAK_VENDOR_DIR);
  const binding = runtime ? undefined : (await import('./journey-bindings.mjs')).createDefaultProbe({env});
  let first; let result;
  try { await binding?.prepare(); result = { ...await runKeycloakProbe(runtime ?? binding.runtime, options), sources }; }
  catch (error) { first = error; }
  finally { try { await binding?.close(); } catch { if (first) first.cleanupCode = 'JOURNEY_CONTRACT_CLEANUP'; else first = error('JOURNEY_CONTRACT_CLEANUP'); } }
  if (first) throw first; return result;
}
