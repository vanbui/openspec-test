/** Local disposable bindings. Importing this module performs no I/O. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { ROOT } from './journey.mjs';
import { startOwned, backendEnvironment, composeEnvironment, assertPortFree, foreignCompiler, privateFile, parseCompose, runNativeTask, NATIVE_READ_BYTES, nativeSignal } from './journey-runtime.mjs';
import { createKeycloakProbeRuntime } from './journey-contract.mjs';
import { extractActionUrl } from './journey-mail.mjs';
import { HEADER, parseCsv, validateSnapshot } from '../hr-validate.mjs';
import { runConflictStage } from './journey-conflict.mjs';
import { object } from './capture-lifecycle.mjs';
const fail = code => { throw Object.assign(new Error(code), { code }); };
const need = (value, code = 'JOURNEY_BINDING_INVALID') => { if (!value) fail(code); };
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const oid = suffix => `11000000-0000-4000-8000-000000000${suffix}`;
const synthetic = email => /^(journey-contract-[0-9a-f]{12}-\d+|journey-[0-9a-f]{12}-[0-2](?:\.moved)?)@hr\.idambox\.test$/.test(email ?? '');

/** Same client-credentials exchange as the existing administration client; no imported fixture secret. */
export function createLocalAdmin({ env, transport = fetch, now = Date.now }) {
  need(env.KEYCLOAK_BASE_URL === 'http://localhost:8080' && env.KEYCLOAK_REALM === 'idambox');
  let cached; let expiry = 0;
  async function token(signal) {
    if (cached && now() < expiry) return cached;
    need(env.KEYCLOAK_ADMIN_CLIENT_ID && env.KEYCLOAK_ADMIN_CLIENT_SECRET, 'JOURNEY_BINDING_CREDENTIALS');
    try {
      const response = await transport(`${env.KEYCLOAK_BASE_URL}/realms/idambox/protocol/openid-connect/token`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]),
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.KEYCLOAK_ADMIN_CLIENT_ID, client_secret: env.KEYCLOAK_ADMIN_CLIENT_SECRET }) });
      need(response.status === 200); const value = await response.json();
      need(typeof value.access_token === 'string' && value.access_token && Number.isFinite(value.expires_in) && value.expires_in > 30);
      cached = value.access_token; expiry = now() + (value.expires_in - 30) * 1000; return cached;
    } catch { fail('JOURNEY_BINDING_AUTH'); }
  }
  async function request(method, route, body, signal) {
    need(/^\/(?:users(?:\/[A-Za-z0-9_-]+(?:\/sessions)?)?(?:\?[^#]*)?)?$/.test(route) || route === '/serverinfo' || route === '/realm');
    const url = route === '/serverinfo' ? '/admin/serverinfo' : route === '/realm' ? '/admin/realms/idambox' : `/admin/realms/idambox${route}`;
    try { return await transport(`${env.KEYCLOAK_BASE_URL}${url}`, { method, redirect: 'error', signal,
      headers: { Authorization: `Bearer ${await token(signal)}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { fail('JOURNEY_BINDING_HTTP'); }
  }
  async function json(route, signal) { const response = await request('GET', route, undefined, signal); need(response.status === 200); return response.json(); }
  return { token, request, json };
}

/** Mailpit's bounded complete listing is shared by count, quiet and fresh receipt observations. */
export function createLocalMailbox({ transport = fetch, now = Date.now, pause = delay } = {}) {
  const receipts = new WeakMap(); const baselines = new Map();
  async function get(endpoint, signal) {
    try { const response = await transport(`http://127.0.0.1:8025/api/v1/${endpoint}`, { redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]) });
      need(response.status === 200); return await response.json(); } catch { fail('JOURNEY_BINDING_MAIL'); }
  }
  async function messages(email, signal) {
    need(synthetic(email)); const value = await get('messages?limit=100&start=0', signal);
    need(Number.isInteger(value.total) && value.total <= 100 && value.total === value.messages?.length);
    return value.messages.filter(row => row.To?.length === 1 && row.To[0].Address === email && !row.Cc?.length && !row.Bcc?.length);
  }
  const count = async (email, signal) => {
    const rows = await messages(email, signal);
    baselines.set(email, { count: rows.length, ids: new Set(rows.map(row => row.ID)), at: now() });
    return rows.length;
  };
  return { count, countInvitations: async (email, signal) => {
    let count = 0;
    for (const row of await messages(email, signal)) {
      need(/^[A-Za-z0-9_-]{1,100}$/.test(row.ID ?? ''));
      const full = await get(`message/${row.ID}`, signal);
      need(full.ID === row.ID && full.To?.length === 1 && full.To[0].Address === email && !full.Cc?.length && !full.Bcc?.length);
      // Read transiently to identify an action invitation; retain neither body nor link.
      try { extractActionUrl(full); count++; } catch (error) {
        if (error.message !== 'JOURNEY_MAIL_LINK_INVALID') throw error;
        if (`${full.Text ?? ''}\n${full.HTML ?? ''}`.includes('/login-actions/action-token')) throw error;
      }
    }
    return count;
  }, async quiet(email, previous, duration, signal) {
    const end = now() + duration;
    do { if (await count(email, signal) !== previous) return false; await pause(Math.min(100, Math.max(1, end - now())), undefined, { signal }); } while (now() < end);
    return true;
  }, async wait(email, previous, signal) {
    const baseline = baselines.get(email);
    need(baseline?.count === previous, 'JOURNEY_MAIL_BASELINE'); const end = now() + 120000;
    for (;;) {
      signal?.throwIfAborted(); const rows = await messages(email, signal);
      need(rows.length <= previous + 1, 'JOURNEY_MAIL_AMBIGUOUS');
      if (rows.length === previous + 1) {
        const fresh = rows.filter(row => !baseline.ids.has(row.ID));
        need(fresh.length === 1 && rows.filter(row => baseline.ids.has(row.ID)).length === previous, 'JOURNEY_MAIL_AMBIGUOUS');
        const row = fresh[0]; need(/^[A-Za-z0-9_-]{1,100}$/.test(row.ID) && Number.isFinite(Date.parse(row.Created)));
        // The count is sampled before the command. Mailpit delivery may precede the first polling request.
        need(Date.parse(row.Created) >= baseline.at && Date.parse(row.Created) <= now(), 'JOURNEY_MAIL_STALE');
        const full = await get(`message/${row.ID}`, signal);
        need(full.ID === row.ID && full.To?.length === 1 && full.To[0].Address === email && !full.Cc?.length && !full.Bcc?.length);
        // Message details carry the header Date, not Mailpit's receipt time; freshness comes from the listing row.
        const receipt = { received: true, fresh: true }; receipts.set(receipt, extractActionUrl(full)); return receipt;
      }
      need(now() < end, 'JOURNEY_MAIL_TIMEOUT'); await pause(250, undefined, { signal });
    }
  }, action(receipt) { const value = receipts.get(receipt); need(value); return value; } };
}

/** Reuse the installed browser package, with diagnostics and automatic artifacts disabled. */
export function createActionConsumer(mail, load = () => createRequire(path.join(ROOT, 'apps/csrm/package.json'))('@playwright/test')) {
  return { async consume({ receipt, signal }) {
    let browser;
    try {
      signal?.throwIfAborted(); const { chromium } = load(); browser = await chromium.launch({timeout:30000});
      signal?.throwIfAborted();
      const context = await browser.newContext({ acceptDownloads: false });
      const page = await context.newPage(); page.setDefaultTimeout(30000);
      const abort = () => { void browser.close().catch(()=>{}); }; signal?.addEventListener('abort', abort, { once: true });
      try {
        signal?.throwIfAborted();
        await page.goto(mail.action(receipt));
        // Keycloak first shows the pending actions with a single proceed link.
        const proceed = page.getByRole('link', { name: /click here to proceed/i });
        if (await proceed.count() === 1) await proceed.click();
        const password = `Jr!${randomBytes(24).toString('base64url')}7a`;
        await page.getByLabel('New Password', { exact: true }).fill(password);
        await page.getByLabel('Confirm password', { exact: true }).fill(password);
        await page.getByRole('button', { name: /submit/i }).click();
        await page.locator('#kc-info-message').waitFor();
        need(await page.getByLabel('New Password', { exact: true }).count() === 0); return { consumed: true };
      } finally { signal?.removeEventListener('abort', abort); }
    } catch { fail('JOURNEY_CONTRACT_BROWSER'); } finally { await browser?.close(); }
  } };
}

/** Private administrative process uses the registered source and the existing identity/resend services. */
export const PROBE_OPERATOR = String.raw`
const path = require('node:path');
process.umask(0o077); process.stdout.write = process.stderr.write.bind(process.stderr);
(async () => {
 const runtime = require('@strapi/strapi');
 const compiled = await runtime.compileStrapi({appDir: process.cwd()});
 const mod = name => require(path.join(compiled.distDir, 'src', name));
 mod('bootstrap/boot-mode.js').markAdministrationBoot();
 const app = runtime.createStrapi({appDir: process.cwd(), distDir: compiled.distDir});
 await app.load(); let owned; let source;
 const close = async () => { await app.destroy(); process.exit(0); };
 process.on('SIGTERM', () => { void close(); });
 process.on('message', async message => { try {
  let value;
  if (message.action === 'prepare') {
   if (owned || !/^[0-9a-f]{12}$/.test(message.value)) throw Error();
   const saved = process.env.IDAMBOX_SEED_CORE; process.env.IDAMBOX_SEED_CORE = 'true';
   try { await mod('bootstrap/seed-core-data.js').seedCoreData(app); } finally { if (saved === undefined) delete process.env.IDAMBOX_SEED_CORE; else process.env.IDAMBOX_SEED_CORE = saved; }
   await mod('bootstrap/seed-csrm-data.js').seedCapabilityCatalogue(app);
   source = await mod('iam/identity/source-registration.js').registerIdentitySource(app, {name:'midPoint (dev)',username:'midpoint-dev-provisioning',email:'midpoint-dev-provisioning@idambox.test',displayName:'midPoint (dev) provisioning'});
   const principal = await mod('iam/identity/source-principal.js').resolveSourcePrincipal(app, source.documentId);
   const username = 'journey-contract-' + message.value + '-99';
   const result = await mod('iam/identity/identity-service.js').createFromSource(app, principal, {username,email:username+'@hr.idambox.test',firstName:'Journey',lastName:'Probe',displayName:'Journey Probe',accountStatus:'active',sourceExternalId:username});
   if (!result.ok) throw Error(); owned = {owner:message.value,documentId:result.value.documentId,sourceManaged:true,username,email:username+'@hr.idambox.test'};
   const row = await app.documents('api::idambox-user.idambox-user').findOne({documentId:owned.documentId});
   if (!row.externalSubject) throw Error(); owned.id = row.externalSubject; value = owned;
  } else if (message.action === 'resend') {
   if (!owned || message.value.documentId !== owned.documentId) throw Error();
   const result = await mod('iam/password-setup/service.js').resendPasswordSetupEmail(app, owned.documentId, {log:()=>{}});
   value = {accepted:result.outcome === 'sent' && result.reason === 'accepted'};
  } else if (message.action === 'cleanup') {
   if (!owned) { process.send({id:message.id,ok:true,value:true}); return; }
   if (message.value && message.value.documentId !== owned.documentId) throw Error();
   const principal = await mod('iam/identity/source-principal.js').resolveSourcePrincipal(app, source.documentId);
   const result = await mod('iam/identity/identity-service.js').createIdentityService(app).deactivateFromSource(principal, owned.documentId, true);
   if (!result.ok) throw Error();
   const config = mod('keycloak/config.js').readKeycloakProvisioningConfig();
   const remote = new (mod('keycloak/admin-client.js').KeycloakAdminClient)(config);
   await remote.disableUser(owned.id); await remote.endUserSessions(owned.id);
   value = {id:owned.id,username:owned.username}; owned = undefined;
  } else throw Error();
  process.send({id:message.id,ok:true,value});
 } catch { process.send({id:message.id,ok:false}); } });
 process.send({ready:true});
})().catch(()=>process.exit(1));`;

export function createProbeOperator({ env, start = startOwned }) {
  let child;
  const admin = createLocalAdmin({env});
  async function cleanup(person, signal) {
    const removed = await child.request('cleanup',person,signal);
    if (removed === true) return;
    const row = await admin.json(`/users/${removed.id}`,signal);
    need(row.id === removed.id && row.username === removed.username && synthetic(row.email), 'JOURNEY_CONTRACT_OWNERSHIP');
    need((await admin.request('DELETE',`/users/${removed.id}`,undefined,signal)).status === 204);
  }
  return { async prepare(runId, signal) {
    child = start(process.execPath, ['-e', PROBE_OPERATOR], { cwd: path.join(ROOT, 'apps/backend'),
      env: { ...backendEnvironment(env), IDAMBOX_KEYCLOAK_PROVISIONING: 'true' }, ipc: true });
    // Readiness is private IPC; no server listener is started by this administration process.
    await Promise.race([child.ready, new Promise((_,reject)=> { const timer = setTimeout(()=>reject(new Error('JOURNEY_CONTRACT_OPERATOR')),120000); timer.unref?.(); child.ready.finally(()=>clearTimeout(timer)).catch(()=>{}); })]);
    return child.request('prepare', runId, signal);
  }, resend: (person, signal) => child.request('resend', person, signal), cleanup,
  async close() {
    if (!child) return;
    try { await cleanup(undefined, AbortSignal.timeout(15000)); } finally { await child.close(); child = undefined; }
  } };
}

/** Probe-only realm SMTP control. The Strapi administration client deliberately lacks realm management, so the
 * disposable stack's bootstrap administrator snapshots, changes and restores SMTP; no other probe call uses it. */
export function createRealmSmtpAdmin({ env, transport = fetch,
  read = () => privateFile(env.IAM_JOURNEY_COMPOSE_ENV_FILE, env.IAM_JOURNEY_RUN_DIR) } = {}) {
  need(env.KEYCLOAK_BASE_URL === 'http://localhost:8080' && env.KEYCLOAK_REALM === 'idambox');
  async function token(signal) {
    let values; try { values = parseCompose((await read()).text); } catch { fail('JOURNEY_BINDING_CREDENTIALS'); }
    try {
      const response = await transport(`${env.KEYCLOAK_BASE_URL}/realms/master/protocol/openid-connect/token`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]),
        body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli',
          username: values.KC_BOOTSTRAP_ADMIN_USERNAME, password: values.KC_BOOTSTRAP_ADMIN_PASSWORD }) });
      need(response.status === 200); const value = await response.json();
      need(typeof value.access_token === 'string' && value.access_token); return value.access_token;
    } catch { fail('JOURNEY_BINDING_AUTH'); }
  }
  async function realm(method, body, signal) {
    const authorization = `Bearer ${await token(signal)}`;
    try { return await transport(`${env.KEYCLOAK_BASE_URL}/admin/realms/idambox`, { method, redirect: 'error', signal,
      headers: { Authorization: authorization, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { fail('JOURNEY_BINDING_HTTP'); }
  }
  return {
    async snapshot(signal) {
      const response = await realm('GET', undefined, signal); need(response.status === 200, 'JOURNEY_CONTRACT_STATUS');
      const value = (await response.json()).smtpServer;
      need(value && typeof value === 'object' && !Array.isArray(value), 'JOURNEY_CONTRACT_STATUS'); return value;
    },
    async set(value, signal) { need((await realm('PUT', { smtpServer: value }, signal)).status === 204, 'JOURNEY_CONTRACT_STATUS'); },
  };
}

/** Realm-scoped admin clients get no systemInfo from 26.x serverinfo; read the owned container instead. */
export async function readKeycloakVersion(command, signal) {
  const owner = await command('docker', ['inspect', '--format',
    '{{.Config.Image}} {{index .Config.Labels "com.docker.compose.project"}} {{range (index .NetworkSettings.Ports "8080/tcp")}}{{.HostIp}}:{{.HostPort}} {{end}}',
    'keycloak'], { signal, capture: true });
  need(owner.trim() === 'quay.io/keycloak/keycloak:26.6.1 idp 127.0.0.1:8080', 'JOURNEY_CONTRACT_VERSION');
  const match = /^Keycloak - Version (\d+\.\d+\.\d+)\n?$/.exec(await command('docker', ['exec', 'keycloak', 'cat', '/opt/keycloak/version.txt'], { signal, capture: true }));
  need(match, 'JOURNEY_CONTRACT_VERSION'); return match[1];
}

const ownedCommand = env => async (program, args, options) => {
  const child = startOwned(program, args, { cwd: ROOT, env: composeEnvironment(env), capture: true, ...options });
  try { return await child.done; } finally { await child.close(); }
};

export function createDefaultProbe({ env, transport = fetch, operator = createProbeOperator({ env }), browser,
  now = Date.now, pause = delay, command = ownedCommand(env), smtp = createRealmSmtpAdmin({ env, transport }) } = {}) {
  const admin = createLocalAdmin({ env, transport, now }); const mail = createLocalMailbox({ transport, now, pause });
  let first;
  const runtime = createKeycloakProbeRuntime({ baseUrl: env.KEYCLOAK_BASE_URL, realm: env.KEYCLOAK_REALM,
    token: () => admin.token(), transport, mail, browser: browser ?? createActionConsumer(mail), operator,
    queryContract: async signal => {
      need(first, 'JOURNEY_CONTRACT_A2'); const receipt = await mail.wait(first.email, first.count, signal);
      let claims; try { claims = JSON.parse(Buffer.from(new URL(mail.action(receipt)).searchParams.get('key').split('.')[1], 'base64url')); } catch { fail('JOURNEY_CONTRACT_A2'); }
      need(Number.isSafeInteger(claims.exp) && Number.isSafeInteger(claims.iat) && claims.exp > claims.iat && claims.sub === first.id, 'JOURNEY_CONTRACT_A2');
      return { names: ['client_id', 'redirect_uri', 'lifespan'], unit: 'seconds', defaultSeconds: claims.exp - claims.iat,
        redirectRequiresClient: true, validClient: 'idambox-csrm', validRedirect: 'http://localhost:3000/api/auth/callback/keycloak', provenance: 'observed-action-token' };
    } });
  runtime.version = signal => readKeycloakVersion(command, signal);
  runtime.snapshotSmtp = signal => smtp.snapshot(signal);
  runtime.setSmtp = (value, signal) => smtp.set(value, signal);
  runtime.restoreSmtp = (value, signal) => smtp.set(value, signal);
  const create = runtime.createUser;
  runtime.createUser = async (...args) => { const user = await create(...args); if (!first) first = { ...user, count: await mail.count(user.email, args[1]) }; return user; };
  const execute = runtime.executeActions;
  runtime.executeActions = async (person, query = {}, signal) => {
    const count = query.lifespan ? await mail.count(person.email, signal) : undefined;
    const result = await execute(person, query, signal);
    if (result.status === 204 && query.lifespan) {
      const receipt = await mail.wait(person.email, count, signal);
      let claims;
      try { claims = JSON.parse(Buffer.from(new URL(mail.action(receipt)).searchParams.get('key').split('.')[1], 'base64url')); }
      catch { fail('JOURNEY_CONTRACT_A2'); }
      need(claims.sub === person.id && claims.exp - claims.iat === Number(query.lifespan), 'JOURNEY_CONTRACT_A2');
    }
    return result;
  };
  return { runtime, async prepare() {
    await assertPortFree(3000); await assertPortFree(1337);
    const child = startOwned('ps',['-axo','pid=,command='],{env:composeEnvironment(env),capture:true});
    try {
      const processes = await child.done;
      need(!foreignCompiler(processes), 'JOURNEY_CONTRACT_OWNERSHIP');
    } finally { await child.close(); }
  }, close: () => operator.close?.() };
}

/** Container-local REST: credentials expand only inside the running container, following reload.sh. */
export function createNativeRest({ env, start = startOwned } = {}) {
  async function command(program, args, options) {
    const child = start(program, args, { cwd: ROOT, env: composeEnvironment(env), capture: true, ...options });
    try { return await child.done; } finally { await child.close(); }
  }
  async function mp(method, endpoint, body, signal) {
    need(/^\/(resources|tasks|users|shadows)(\/[A-Za-z0-9-]+)*$/.test(endpoint) && ['GET','POST'].includes(method));
    const output = await command('docker', ['exec','-i','midpoint','sh','-c',
      'curl --silent --max-time 30 --request "$0" --user "administrator:${MP_SET_midpoint_administrator_initialPassword}" --header "Content-Type: application/json" --header "Accept: application/json" --data-binary @- --write-out "\\n%{http_code}" "http://localhost:8080/midpoint/ws/rest$1"',method,endpoint], {signal:nativeSignal(signal),input:body ? JSON.stringify(body) : '',maxBytes:NATIVE_READ_BYTES});
    const boundary = output.lastIndexOf('\n'); need([200,201,202,204].includes(Number(output.slice(boundary+1))));
    return output.slice(0,boundary) ? JSON.parse(output.slice(0,boundary)) : null;
  }
  return { mp, command };
}

/** A handled connector error (retryLater) leaves the run's result successful; the run's own item statistics
 * still record the failed item. Only entries started within this run count; no diagnostic text is parsed. */
export function hasNativeItemFailure(task, since) {
  const processed = task?.activityState?.activity?.statistics?.itemProcessing?.processed;
  return array(processed).some(row => row?.outcome?.outcome === 'failure' && Number(row.count) > 0
    && Date.parse(row.lastItem?.startTimestamp) >= since);
}

/** Persistent retry timestamps come from linked shadows; intervals come from the task. */
export async function readNativeRetry(mp, person, signal) {
  const task = object(await mp('GET', `/tasks/${oid('300')}`, null, signal));
  const entries = array(task.activity?.controlFlow?.errorHandling?.entry);
  need(entries.some(row => row.reaction?.retryLater?.initialInterval === 'PT5M' && row.reaction.retryLater.nextInterval === 'PT15M'));
  need(/^[0-9a-f-]{36}$/.test(person.identityOid), 'JOURNEY_CONFLICT_NATIVE_SHAPE');
  const focus = object(await mp('GET',`/users/${person.identityOid}`,null,signal));
  need(focus.oid === person.identityOid && focus.personalNumber === person.sourceKey, 'JOURNEY_CONFLICT_NATIVE_SHAPE');
  const shadows = [];
  for (const ref of array(focus.linkRef)) {
    need(/^[0-9a-f-]{36}$/.test(ref.oid), 'JOURNEY_CONFLICT_NATIVE_SHAPE');
    const shadow = object(await mp('GET',`/shadows/${ref.oid}`,null,signal));
    need(shadow.oid === ref.oid, 'JOURNEY_CONFLICT_NATIVE_SHAPE');
    if ([oid('100'),oid('110')].includes(shadow.resourceRef?.oid)) shadows.push(shadow);
  }
  const matching = shadows.filter(row => array(row.trigger).some(trigger => trigger.handlerUri === 'http://midpoint.evolveum.com/xml/ns/public/model/trigger/shadow-reconcile/handler-3'));
  need(matching.length === 1, 'JOURNEY_CONFLICT_NATIVE_SHAPE');
  const triggers = array(matching[0].trigger).filter(row => row.handlerUri === 'http://midpoint.evolveum.com/xml/ns/public/model/trigger/shadow-reconcile/handler-3');
  need(triggers.length === 1 && Number.isFinite(Date.parse(triggers[0].timestamp)), 'JOURNEY_CONFLICT_NATIVE_SHAPE');
  return { kind:'retryLater', persistent:true, initialSeconds:300, subsequentSeconds:900, scheduledAt:triggers[0].timestamp, shadowOid:matching[0].oid };
}

/** Native audit SQL returns closed identifiers/timestamps only; unknown pinned SQL shapes fail closed. */
export async function readNativeAudit(command, person, since, scanner, signal, taskOid = oid('300')) {
  need(/^[0-9a-f-]{36}$/.test(taskOid));
  need(/^[0-9a-f-]{36}$/.test(person.identityOid) && Number.isFinite(Date.parse(since)));
  const sql = `SELECT coalesce(json_agg(x),'[]'::json)::text FROM (
    SELECT e.id::text AS id, e.timestamp AS at, e.taskoid::text AS "taskOid", t.nameorig AS "taskName",
      e.outcome::text AS outcome, r.timestamp AS "startedAt"
    FROM ma_audit_event e JOIN m_object t ON t.oid = e.taskoid
    LEFT JOIN ma_audit_event r ON r.requestidentifier = e.requestidentifier AND r.taskoid = e.taskoid
      AND r.targetoid = e.targetoid AND r.eventstage = 'REQUEST' AND r.timestamp <= e.timestamp
    WHERE e.targetoid = '${person.identityOid}' AND e.eventstage = 'EXECUTION'
      AND coalesce(r.timestamp, e.timestamp) >= '${new Date(since).toISOString()}'
    ORDER BY e.timestamp DESC LIMIT 20) x;`;
  const output = await command('docker',['exec','-i','midpoint_data','sh','-c','psql --no-psqlrc -v ON_ERROR_STOP=1 -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],{input:sql,signal,capture:true});
  let rows; try { rows = JSON.parse(output.trim()); } catch { fail('JOURNEY_CONFLICT_NATIVE_SHAPE'); }
  need(Array.isArray(rows), 'JOURNEY_CONFLICT_NATIVE_SHAPE');
  // midPoint writes no REQUEST event for a request that fails at the resource; only such a failure of the
  // expected task falls back to the trigger time as the start of its window.
  const matches = rows.map(row => ({ ...row, startedAt: row.startedAt
    ?? (!scanner && /error/i.test(row.outcome ?? '') ? new Date(since).toISOString() : undefined) }))
    .filter(row => (scanner ? row.taskName === 'Trigger Scanner' : row.taskOid === taskOid)
    && Number.isFinite(Date.parse(row.at)) && Date.parse(row.startedAt) >= Date.parse(since)
    && Date.parse(row.at) >= Date.parse(row.startedAt));
  need(matches.length > 0, 'JOURNEY_CONFLICT_AUDIT_PENDING'); return matches[0];
}

/** CSV is read from the live file, validated as a whole and restored through hr-publish.sh. */
export function createConflictBinding({ env, mp, command, observe, scim, now = Date.now, pause = delay,
  transport = fetch, io = fs, publishFile, onObservations } = {}) {
  const runId = path.basename(env.IAM_JOURNEY_RUN_DIR).replaceAll('-', '').slice(-12);
  const admin = createLocalAdmin({ env, transport, now }); const mail = createLocalMailbox({transport,now,pause});
  const proposedEmail = `journey-${runId}-2.moved@hr.idambox.test`;
  let original; let currentText; let person; let started;
  const publish = async (text, signal) => {
    need(validateSnapshot(text).length === 0, 'JOURNEY_CONFLICT_CSV');
    if (publishFile) return publishFile(text, signal);
    const file = path.join(env.IAM_JOURNEY_RUN_DIR, `conflict-${randomBytes(6).toString('hex')}.csv`);
    const handle = await io.open(file, 'wx', 0o600);
    try { await handle.writeFile(text); } finally { await handle.close(); }
    try { await command('bash',['docker/midpoint/hr-publish.sh',file],{signal}); } finally { await io.unlink(file); }
  };
  const serialize = rows => `${HEADER.join(',')}\n${rows.map(row => row.map(value => /[,"\n\r]/.test(value) ? `"${value.replaceAll('"','""')}"` : value).join(',')).join('\n')}\n`;
  async function snapshot(signal) {
    const local = await observe(person,signal);
    const remotes = await admin.json(`/users?exact=true&username=${encodeURIComponent(person.username)}`,signal);
    need(remotes.length === 1 && remotes[0].id === local.remoteSubject && remotes[0].email === local.email, 'JOURNEY_CONFLICT_STATE_PENDING');
    return {...local,localMatches:local.localMatches,remoteMatches:remotes.length,invitations:await mail.count(person.email,signal) + await mail.count(proposedEmail,signal)};
  }
  async function observation(scanner, since, signal) {
    const local = await snapshot(signal);
    // The pinned connector sends an email change as PATCH (P3-35), so the collision and its retry are PATCH receipts.
    const event = await scim({documentId:local.documentId, since, status:scanner ? 200 : 503, method:'PATCH'},signal);
    need(event && event.origin === 'connector' && event.documentId === local.documentId && Date.parse(event.at) >= Date.parse(since), 'JOURNEY_CONFLICT_SCIM_PENDING');
    const audit = await readNativeAudit(command,local,since,scanner,signal);
    need(Date.parse(event.at) >= Date.parse(audit.startedAt) && Date.parse(event.at) <= Date.parse(audit.at), 'JOURNEY_CONFLICT_NATIVE_SHAPE');
    need(scanner ? audit.outcome.toLowerCase() === 'success' : ['partial_error','fatal_error'].includes(audit.outcome.toLowerCase()), 'JOURNEY_CONFLICT_NATIVE_SHAPE');
    const native = object(await mp('GET',`/tasks/${oid('300')}`,null,signal));
    const remote = await admin.json(`/users/${local.remoteSubject}`,signal);
    return {origin:'connector',method:event.method,status:event.status,retryAfterSeconds:event.retryAfterSeconds,
      nativeAuditId:audit.id,scimCorrelationId:event.requestId,after:local,
      task:{oid:scanner ? audit.taskOid : native.oid,startedAt:scanner ? audit.startedAt : native.lastRunStartTimestamp,
        finishedAt:scanner ? audit.at : native.lastRunFinishTimestamp,result:scanner ? 'success' : 'retry-later',
        ...(scanner ? {} : {error:'communication-error'})},
      ...(scanner ? {triggerOrigin:'native-retry-scanner',retryTriggeredAt:audit.startedAt,remote:{subject:remote.id,email:remote.email,matches:local.remoteMatches}}
        : {retry:await readNativeRetry(mp,local,signal)})};
  }
  const runtime = { proposedEmail,
    async preparePerson(owner,signal) {
      need(owner === runId); original = await command('docker',['exec','midpoint','cat','/opt/midpoint/var/hr/hr.csv'],{signal,capture:true});
      need(validateSnapshot(original).length === 0);
      person = {employeeNumber:`9${String(parseInt(runId.slice(0,8),16)).padStart(10,'0')}2`,username:`journey.${runId}.2`,email:`journey-${runId}-2@hr.idambox.test`};
      const rows = parseCsv(original); rows.push([person.employeeNumber,'Journey','Conflict','',person.email,person.username,'Engineering','Engineer','active','','']);
      currentText = serialize(rows.slice(1)); await publish(currentText,signal);
      const { task, triggered: trigger } = await runNativeTask({mp,suffix:'310',signal,now,pause}); need(task.resultStatus === 'success');
      await observe(person,signal);
      for (;;) { if (await mail.count(person.email,signal) === 1) break; need(now()-trigger < 180000); await pause(250,undefined,{signal}); }
      return snapshot(signal);
    },
    assertLocalUnique: (email,before,signal) => scim({kind:'localUnique',email,except:before.documentId},signal),
    async createCollision(spec,signal) {
      const response = await admin.request('POST','/users',{username:`journey-contract-${runId}-98`,email:spec.email,enabled:true},signal);
      need(response.status === 201); const location = new URL(response.headers.get('location'));
      need(location.origin === env.KEYCLOAK_BASE_URL && /^\/admin\/realms\/idambox\/users\/[A-Za-z0-9_-]+$/.test(location.pathname));
      return runtime.observeCollision(location.pathname.split('/').at(-1),signal);
    },
    async observeCollision(id,signal) {
      need(/^[A-Za-z0-9_-]+$/.test(id)); const response = await admin.request('GET',`/users/${id}`,undefined,signal);
      if (response.status === 404) return undefined; need(response.status === 200); const row = await response.json();
      need(row.id === id && row.username === `journey-contract-${runId}-98`);
      // Keycloak's user profile drops unmanaged attributes; the run-scoped username and created id mark ownership.
      need(await scim({kind:'remoteOnly',subject:id},signal) === true);
      return {id:row.id,owner:runId,email:row.email,remoteOnly:true};
    },
    async removeCollision(row,signal) { const current = await runtime.observeCollision(row.id,signal); need(current && current.id === row.id && current.owner === row.owner && current.email === row.email && current.remoteOnly, 'JOURNEY_CONFLICT_OWNERSHIP'); need((await admin.request('DELETE',`/users/${row.id}`,undefined,signal)).status === 204); },
    async publishMover(_,signal) { const rows = parseCsv(currentText); const row = rows.find(row=>row[0] === person.employeeNumber); need(row); row[4]=proposedEmail; await publish(serialize(rows.slice(1)),signal); return {validated:true}; },
    async driveNativeTask(_,signal) {
      const run = await runNativeTask({mp,suffix:'300',signal,now,pause}); started = run.triggered;
      need(run.task.oid === oid('300') && hasNativeItemFailure(run.task, started), 'JOURNEY_CONFLICT_NATIVE_SHAPE');
      return observation(false,new Date(started).toISOString(),signal);
    },
    async awaitNativeRecovery({notBefore,deadline},signal) {
      for (;;) { signal?.throwIfAborted(); need(now()<deadline,'JOURNEY_CONFLICT_TIMEOUT');
        if (now() >= Date.parse(notBefore)) { try { return await observation(true,notBefore,signal); } catch(error) {
          if (!['JOURNEY_CONFLICT_AUDIT_PENDING','JOURNEY_CONFLICT_SCIM_PENDING','JOURNEY_CONFLICT_STATE_PENDING'].includes(error.code)) throw error;
        } }
        await pause(1000,undefined,{signal});
      }
    },
    async cleanupPerson(_,signal) {
      if (!original) return;
      try {
        if (!currentText) return;
        const rows = parseCsv(currentText); const row = rows.find(row => row[0] === person.employeeNumber);
        need(row); row[8] = 'terminated'; await publish(serialize(rows.slice(1)),signal);
        need((await runNativeTask({mp,suffix:'300',signal,now,pause})).task.resultStatus === 'success');
        for (;;) {
          signal?.throwIfAborted(); const local = await observe(person,signal);
          const remote = await admin.json(`/users/${local.remoteSubject}`,signal);
          const sessions = await admin.json(`/users/${local.remoteSubject}/sessions`,signal);
          if (local.accountStatus === 'inactive' && remote.enabled === false && sessions.length === 0) break;
          await pause(500,undefined,{signal});
        }
      } finally { await publish(original,signal); }
    },
  };
  return { runtime, run: signal => runConflictStage(runtime,{runId,signal,now,onObservations}) };
}
