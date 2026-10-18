#!/usr/bin/env node
/** Opt-in tooling only: importing this file never opens a listener unless the preload switch is set. */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, chmod, rename, rm } from 'node:fs/promises';
import { Server } from 'node:http';
import { createServer, createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PIN, COMMAND, SCENARIOS, INVOCATIONS, LIFECYCLE_SCENARIOS, LIFECYCLE_INVOCATIONS, sanitizeEnvelope, substitute, verifyEvidence, executeStages } from './scim-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TEMP = path.join(ROOT, 'apps/backend/.tmp');
const OUTPUT = path.join(ROOT, '.planning/workstreams/iam/phases/03-strapi-scim-2-0-service/evidence/connector-capture');
const COMMON = 'http://midpoint.evolveum.com/xml/ns/public/common/common-3';
const RI = 'http://midpoint.evolveum.com/xml/ns/public/resource/instance-3';
const ICFS = 'http://midpoint.evolveum.com/xml/ns/public/connector/icf-1/resource-schema-3';
const CFG = 'http://midpoint.evolveum.com/xml/ns/public/connector/icf-1/bundle/connector-scim2/com.exclamationlabs.connid.base.scim2.Scim2Connector';
const LIMIT = 2 * 1024 * 1024;
const fail = () => { throw new Error('SCIM_CAPTURE_REFUSED'); };
const xml = (value) => String(value).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

/** No shell, credentials in stdin only, bounded output, and no remote errors forwarded. */
export function command(program, args, { input = '', signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], signal });
    const chunks = []; let bytes = 0;
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > LIMIT) { child.kill('SIGKILL'); return; }
      chunks.push(chunk);
    });
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => {});
    child.on('error', () => reject(new Error('SCIM_CAPTURE_COMMAND_FAILED')));
    child.on('close', (code) => code === 0 && bytes <= LIMIT
      ? resolve(Buffer.concat(chunks).toString('utf8')) : reject(new Error('SCIM_CAPTURE_COMMAND_FAILED')));
    child.stdin.end(input);
  });
}
export async function readToken(file, runCommand = command, filesystem = { lstat, readFile }) {
  // Deliberately use a dedicated handoff file; never open docker/.env.
  const expected = path.join(TEMP, '.env.scim-capture');
  if (path.resolve(file) !== expected) fail();
  const stat = await filesystem.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || (stat.mode & 0o077) || stat.size > 4096) fail();
  // Git takes repository paths with forward slashes, so its arguments and evidence are the same on every OS.
  const repositoryPath = path.relative(ROOT, file).split(path.sep).join('/');
  await runCommand('git', ['check-ignore', '--quiet', '--', repositoryPath], { signal: AbortSignal.timeout(5000) });
  if ((await runCommand('git', ['ls-files', '--', repositoryPath], { signal: AbortSignal.timeout(5000) })).trim()) fail();
  const text = await filesystem.readFile(file, 'utf8');
  const match = /^MIDPOINT_SCIM_TOKEN=(idb_scim_v1\.[a-z0-9]{24}\.[A-Za-z0-9_-]{43})\n?$/.exec(text);
  if (!match) fail();
  return match[1];
}

/** Capture bytes on the existing server without consuming its request stream or replacing its writer. */
export function observeRequest(req, res, receive) {
  const requestChunks = []; const responseChunks = [];
  let size = 0; let invalid = false;
  function collect(chunks, chunk, encoding) {
    if (chunk === null || chunk === undefined) return;
    try {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined);
      size += buffer.length;
      if (size > LIMIT) invalid = true;
      else chunks.push(buffer);
    } catch { invalid = true; }
  }
  const push = req.push; const write = res.write; const end = res.end;
  req.push = function (chunk, ...args) { collect(requestChunks, chunk); return push.call(this, chunk, ...args); };
  res.write = function (chunk, ...args) { collect(responseChunks, chunk, args[0]); return write.call(this, chunk, ...args); };
  res.end = function (chunk, ...args) { collect(responseChunks, chunk, args[0]); return end.call(this, chunk, ...args); };
  res.once('finish', () => {
    req.push = push; res.write = write; res.end = end;
    function body(chunks) {
      const text = Buffer.concat(chunks).toString('utf8');
      return text.length ? JSON.parse(text) : null;
    }
    try {
      if (invalid) fail();
      receive({ request: { method: req.method, path: req.url, headers: req.headers, body: body(requestChunks) },
        response: { status: res.statusCode, headers: res.getHeaders(), body: body(responseChunks) } });
    } catch { receive(null); }
  });
}

export function assertIsolation(strapi, runId) {
  const filename = strapi?.config.get('database.connection.connection.filename');
  const port = strapi?.config.get('server.port');
  // Only a disposable SQLite database named for this very run is accepted.
  if (!/^iam-scim-gate-[a-f0-9-]{36}$/.test(runId) || Number(port) !== 1337
    || strapi?.config.get('database.connection.client') !== 'sqlite'
    || typeof filename !== 'string' || path.resolve(filename) !== path.join(TEMP, `${runId}.sqlite`)) fail();
  return true;
}

/** Load with NODE_OPTIONS=--import=... only in the orchestrator's isolated gate process. */
export async function installCaptureHook(socketPath, getStrapi = () => globalThis.strapi) {
  if (path.dirname(path.resolve(socketPath)) !== TEMP || !path.basename(socketPath).endsWith('.sock')) fail();
  await mkdir(TEMP, { recursive: true });
  // Do not remove an existing socket: another process may own it.
  const original = Server.prototype.emit;
  let session;
  Server.prototype.emit = function (event, ...args) {
    if (event === 'request' && session) {
      const [req, res] = args;
      const current = session;
      if (req.url?.startsWith('/scim/v2/') && req.headers.authorization === `Bearer ${current.token}`) {
        current.pending++;
        const sequence = current.entries.push(null);
        const stage = current.stage;
        observeRequest(req, res, (wire) => {
          current.pending--;
          try {
            if (!wire || !stage || sequence > 1000) fail();
            current.entries[sequence - 1] = sanitizeEnvelope({ sequence, ...stage, ...wire }, { secrets: [current.token], profile: current.profile });
          } catch { current.failed = true; }
        });
      }
    }
    return original.call(this, event, ...args);
  };
  const server = createServer((socket) => {
    socket.setTimeout(5000, () => socket.destroy());
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk;
      if (buffer.length > LIMIT) { socket.destroy(); return; }
      if (!buffer.includes('\n')) return;
      try {
        const message = JSON.parse(buffer);
        let result = true;
        if (message.action === 'begin') {
          if (session) fail();
          assertIsolation(getStrapi(), message.runId);
          if (!/^idb_scim_v1\.[a-z0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(message.token)) fail();
          if (message.profile !== undefined && message.profile !== 'phase4') fail();
          session = { profile: message.profile, runId: message.runId, token: message.token, entries: [], pending: 0, failed: false };
        } else if (message.action === 'close') {
          if (session && session.runId !== message.runId) fail();
          session = undefined;
        }
        else {
          if (!session || session.runId !== message.runId || session.failed || session.pending) fail();
          if (message.action === 'stage') {
            if (!(session.profile === 'phase4' ? LIFECYCLE_SCENARIOS : SCENARIOS).includes(message.scenario)) fail();
            if (message.invocation !== (session.profile === 'phase4' ? LIFECYCLE_INVOCATIONS : INVOCATIONS)[message.scenario]) fail();
            session.stage = { scenario: message.scenario, origin: ['schemas', 'config', 'groups'].includes(message.scenario) ? 'direct-probe' : 'connector',
              invocation: message.invocation };
          } else if (message.action === 'drain') { result = session.entries; }
          else fail();
        }
        socket.end(JSON.stringify({ ok: true, result }) + '\n');
      } catch { socket.end('{"ok":false}\n'); }
    });
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
    await chmod(socketPath, 0o600);
  } catch (error) { Server.prototype.emit = original; server.close(); throw error; }
  return async () => {
    session = undefined; Server.prototype.emit = original;
    await new Promise((resolve) => server.close(resolve));
  };
}

export async function bridge(socketPath, message, signal) {
  const stat = await lstat(socketPath);
  if (!stat.isSocket() || (stat.mode & 0o077)) fail();
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath, signal });
    let text = '';
    socket.setTimeout(5000, () => socket.destroy(new Error('SCIM_CAPTURE_BRIDGE_TIMEOUT')));
    socket.on('connect', () => socket.end(JSON.stringify(message) + '\n'));
    socket.on('data', (chunk) => { text += chunk; if (text.length > LIMIT * 10) socket.destroy(); });
    socket.on('error', () => reject(new Error('SCIM_CAPTURE_BRIDGE_FAILED')));
    socket.on('end', () => {
      try { const response = JSON.parse(text); if (!response.ok) fail(); resolve(response.result); }
      catch { reject(new Error('SCIM_CAPTURE_BRIDGE_FAILED')); }
    });
  });
}

function resourceXml(oid, runId, token) {
  return `<resource xmlns="${COMMON}" xmlns:c="${COMMON}" xmlns:ri="${RI}" xmlns:q="http://prism.evolveum.com/xml/ns/public/query-3"
    xmlns:t="http://prism.evolveum.com/xml/ns/public/types-3" xmlns:icfc="http://midpoint.evolveum.com/xml/ns/public/connector/icf-1/connector-schema-3"
    xmlns:cfg="${CFG}" oid="${oid}"><name>${runId}</name><description>${runId}</description>
    <connectorRef type="c:ConnectorType"><filter><q:and><q:equal><q:path>c:connectorType</q:path>
    <q:value>com.exclamationlabs.connid.base.scim2.Scim2Connector</q:value></q:equal>
    <q:equal><q:path>c:connectorVersion</q:path><q:value>${PIN.connector}</q:value></q:equal></q:and></filter></connectorRef>
    <connectorConfiguration><icfc:legacySchema>false</icfc:legacySchema><icfc:configurationProperties><cfg:serviceUrl>${PIN.endpoint}</cfg:serviceUrl>
    <cfg:token><t:clearValue>${xml(token)}</t:clearValue></cfg:token>
    <cfg:usersEndpointUrl>/Users</cfg:usersEndpointUrl><cfg:groupsEndpointUrl>/Groups</cfg:groupsEndpointUrl>
    <cfg:enableStandardSchema>true</cfg:enableStandardSchema><cfg:enableEnterpriseUser>true</cfg:enableEnterpriseUser>
    <cfg:enableAWSSchema>false</cfg:enableAWSSchema><cfg:enableSlackSchema>false</cfg:enableSlackSchema>
    <cfg:enableDynamicSchema>false</cfg:enableDynamicSchema><cfg:deepGet>false</cfg:deepGet><cfg:deepImport>false</cfg:deepImport>
    </icfc:configurationProperties></connectorConfiguration>
    <schemaHandling><objectType><kind>account</kind><intent>default</intent><default>true</default>
    <objectClass>ri:Scim2User</objectClass></objectType></schemaHandling></resource>`;
}

/** Uses the same container-local REST/auth discipline as spike-test.sh and reload.sh. */
export function createRuntime({ runId, token, socketPath, runCommand = command, control = bridge, transport = fetch }) {
  const resource = randomUUID(); const person = randomUUID(); const shadow = randomUUID();
  let resourceAttempted = false; let personAttempted = false; let shadowAttempted = false; let deleted = false;
  let entries; let cleanupPassed = false; let beginAttempted = false;
  const ownedControl = (message, signal) => control(socketPath, { ...message, runId }, signal);
  const name = `iam-scim-gate-${runId.slice(-12)}`;
  const email = (value) => JSON.stringify({ value, type: 'work', primary: true });
  const oldEmail = email('gate.joiner@idambox.test'); const newEmail = email('gate.mover@idambox.test');
  async function mp(method, endpoint, body, signal, expected = [200, 201, 204], media = 'application/xml') {
    if (!/^\/(resources|users|shadows|connectors)(\/[a-zA-Z0-9-]+)*(\?options=forceRefresh)?$/.test(endpoint)) fail();
    const result = await runCommand('docker', ['exec', '-i', 'midpoint', 'sh', '-c',
      'curl --silent --max-time 150 --request "$0" --user "administrator:${MP_SET_midpoint_administrator_initialPassword}" --header "Content-Type: $2" --header "Accept: application/json" --data-binary @- --write-out "\\n%{http_code}" "http://localhost:8080/midpoint/ws/rest$1"',
      method, endpoint, media], { input: body ?? '', signal });
    const boundary = result.lastIndexOf('\n');
    if (!expected.includes(Number(result.slice(boundary + 1)))) fail();
    const text = result.slice(0, boundary);
    return text ? JSON.parse(text) : null;
  }
  async function mark(scenario, invocation, signal) { await ownedControl({ action: 'stage', scenario, invocation }, signal); }
  async function search(filter, signal, page = false) {
    const query = `<query xmlns="http://prism.evolveum.com/xml/ns/public/query-3" xmlns:q="http://prism.evolveum.com/xml/ns/public/query-3" xmlns:ri="${RI}" xmlns:c="${COMMON}" xmlns:icfs="${ICFS}">
      <q:filter><q:and><q:ref><q:path>c:resourceRef</q:path><q:value oid="${resource}"/></q:ref>
      <q:equal><q:path>c:objectClass</q:path><q:value>ri:Scim2User</q:value></q:equal>${filter}</q:and></q:filter>
      ${page ? '<q:paging><q:offset>0</q:offset><q:maxSize>1</q:maxSize></q:paging>' : ''}</query>`;
    return mp('POST', '/shadows/search', query, signal);
  }
  async function modify(deltas, signal) {
    const body = `<objectModification xmlns="http://midpoint.evolveum.com/xml/ns/public/common/api-types-3"
      xmlns:c="${COMMON}" xmlns:t="http://prism.evolveum.com/xml/ns/public/types-3" xmlns:ri="${RI}" xmlns:icfs="${ICFS}">
      ${deltas.map(([type, item, value]) => `<itemDelta><t:modificationType>${type}</t:modificationType><t:path>${item}</t:path><t:value>${xml(value)}</t:value></itemDelta>`).join('')}</objectModification>`;
    return mp('PATCH', `/shadows/${shadow}`, body, signal);
  }
  async function remove(collection, oid, signal) {
    // The UUID was allocated before creation, so cleanup also covers a response timeout after commit.
    await mp('DELETE', `/${collection}/${oid}`, undefined, signal, [200, 204, 404]);
  }
  return {
    async prepare(signal) {
      const image = (await runCommand('docker', ['inspect', '-f', '{{.Config.Image}}', 'midpoint'], { signal })).trim();
      if (image !== 'idambox/midpoint:4.8.14-scim2-1.2.9') fail();
      const version = await runCommand('docker', ['exec', 'midpoint', '/opt/midpoint/bin/ninja.sh', '--version'], { signal });
      if (!/\b4\.8\.14\b/.test(version)) fail();
      const commit = (await runCommand('docker', ['exec', 'midpoint', 'cat', '/opt/midpoint/connector-bundle/source-commit.txt'], { signal })).trim();
      if (commit !== PIN.sourceCommit) fail();
      const connectors = await mp('POST', '/connectors/search', JSON.stringify({ query: { filter: {
        text: "connectorType = 'com.exclamationlabs.connid.base.scim2.Scim2Connector' and connectorVersion = '1.2.9'" } } }), signal, [200], 'application/json');
      const objects = connectors?.object?.object ?? connectors?.object ?? [];
      const matches = (Array.isArray(objects) ? objects : [objects]).filter((item) => item.connectorVersion === PIN.connector);
      if (matches.length !== 1) fail();
      beginAttempted = true;
      await ownedControl({ action: 'begin', token }, signal);
      await mark('connection', 'POST /resources/{resource}/test', signal);
      resourceAttempted = true;
      await mp('POST', '/resources', resourceXml(resource, runId, token), signal);
      personAttempted = true;
      await mp('POST', '/users', `<user xmlns="${COMMON}" oid="${person}"><name>${name}</name><description>${runId}</description><fullName>Gate Person</fullName></user>`, signal);
    },
    async stage(scenario, signal) {
      if (scenario === 'connection') {
        await mark(scenario, 'POST /resources/{resource}/test', signal);
        const result = await mp('POST', `/resources/${resource}/test`, undefined, signal);
        if ((result?.object ?? result)?.status !== 'success') fail();
      } else if (['lookup', 'list', 'filter', 'page'].includes(scenario)) {
        await mark(scenario, 'POST /shadows/search', signal);
        await search(['lookup', 'filter'].includes(scenario)
          ? `<q:equal><q:path>c:attributes/ri:userName</q:path><q:value>${name}</q:value></q:equal>` : '', signal, scenario === 'page');
      } else if (scenario === 'create') {
        await mark(scenario, 'POST /shadows', signal);
        shadowAttempted = true;
        await mp('POST', '/shadows', `<shadow xmlns="${COMMON}" xmlns:ri="${RI}" xmlns:icfs="${ICFS}" oid="${shadow}">
          <name>${name}</name><description>${runId}</description><resourceRef oid="${resource}"/>
          <objectClass>ri:Scim2User</objectClass><kind>account</kind><intent>default</intent>
          <attributes><ri:userName>${name}</ri:userName><ri:employeeNumber>${name}</ri:employeeNumber>
          <ri:displayName>Gate Person</ri:displayName><ri:name_givenName>Gate</ri:name_givenName><ri:name_familyName>Person</ri:name_familyName>
          <ri:emails>${xml(oldEmail)}</ri:emails><ri:title>Gate Joiner</ri:title></attributes>
          <activation><administrativeStatus>enabled</administrativeStatus></activation></shadow>`, signal);
      } else if (scenario === 'read') {
        await mark(scenario, 'GET /shadows/{shadow}', signal);
        await mp('GET', `/shadows/${shadow}?options=forceRefresh`, undefined, signal);
      } else if (scenario === 'mover') {
        await mark(scenario, 'PATCH /shadows/{shadow}', signal);
        await modify([['replace', 'c:attributes/ri:title', 'Gate Mover']], signal);
      } else if (scenario === 'multi-value') {
        await mark(scenario, 'PATCH /shadows/{shadow}', signal);
        // Explicit supported model delta: force the installed connector's remove-then-add path.
        await modify([['delete', 'c:attributes/ri:emails', oldEmail], ['add', 'c:attributes/ri:emails', newEmail]], signal);
      } else if (scenario === 'leaver') {
        await mark(scenario, 'PATCH /shadows/{shadow}', signal);
        await modify([['replace', 'c:activation/c:administrativeStatus', 'disabled']], signal);
      } else if (scenario === 'delete') {
        await mark(scenario, 'DELETE /shadows/{shadow}', signal);
        await remove('shadows', shadow, signal); deleted = true;
      } else {
        const endpoint = { schemas: 'Schemas', config: 'ServiceProviderConfig', groups: 'Groups' }[scenario];
        if (!endpoint) fail();
        await mark(scenario, `GET /scim/v2/${endpoint}`, signal);
        const response = await transport(`http://127.0.0.1:1337/scim/v2/${endpoint}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/scim+json' }, signal, redirect: 'error' });
        if (response.status !== 200) fail();
        await response.arrayBuffer();
      }
    },
    async cleanup(signal) {
      if (!beginAttempted) return;
      let failed = false;
      // Independent attempts: a shadow cleanup failure must not strand the person or resource.
      for (const [needed, collection, oid] of [[shadowAttempted && !deleted, 'shadows', shadow],
        [personAttempted, 'users', person], [resourceAttempted, 'resources', resource]]) {
        if (needed) {
          try { await remove(collection, oid, AbortSignal.any([signal, AbortSignal.timeout(5000)])); } catch { failed = true; }
        }
      }
      try { entries = await ownedControl({ action: 'drain' }, signal); } catch { failed = true; }
      try { await ownedControl({ action: 'close' }, signal); } catch { failed = true; }
      cleanupPassed = !failed;
      if (failed) fail();
    },
    evidence() {
      if (!cleanupPassed || !entries) fail();
      const declarations = []; const seen = new Set();
      function declare(value, kind) {
        if (typeof value === 'string' && !seen.has(value)) {
          seen.add(value); declarations.push({ name: `${kind.replace('-', '_').toUpperCase()}_${declarations.length + 1}`, kind, value });
        }
      }
      for (const entry of entries) {
        const body = entry.response.body;
        if (body?.id && /\/Users/.test(entry.request.path)) declare(body.id, 'user-id');
        for (const user of body?.Resources ?? []) if (user?.userName) declare(user.id, 'user-id');
        for (const user of [body, ...(body?.Resources ?? [])]) {
          for (const key of ['created', 'lastModified']) if (user?.meta?.[key]) declare(user.meta[key], 'timestamp');
        }
      }
      const result = substitute(entries, declarations);
      const manifest = { format: 1, provenance: 'live-connector', versions: { midpoint: PIN.midpoint,
        connector: PIN.connector, sourceCommit: PIN.sourceCommit }, command: COMMAND, runId,
        date: new Date().toISOString(), endpoint: PIN.endpoint, scenarios: [...SCENARIOS], substitutions: result.substitutions, cleanup: true };
      verifyEvidence(result.capture, manifest);
      return { capture: result.capture, manifest };
    },
  };
}

export async function persistEvidence(bundle, destination = OUTPUT) {
  // Validate everything before the first mkdir/write. Never write the raw source.
  verifyEvidence(bundle.capture, bundle.manifest);
  const staging = `${destination}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(staging, { mode: 0o700 });
  try {
    await writeFile(path.join(staging, 'capture.json'), JSON.stringify(bundle.capture, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    // Atomic directory publish; refuse to overwrite an earlier gate result.
    await rename(staging, destination);
  } finally { await rm(staging, { recursive: true, force: true }); }
}

export async function check() {
  for (const file of ['capture-scim.mjs', 'scim-evidence.mjs']) {
    await command(process.execPath, ['--check', path.join(path.dirname(fileURLToPath(import.meta.url)), file)], { signal: AbortSignal.timeout(5000) });
  }
  const dockerfile = await readFile(path.join(ROOT, 'docker/midpoint/Dockerfile'), 'utf8');
  const spike = await readFile(path.join(ROOT, 'docker/midpoint/spike-test.sh'), 'utf8');
  if (!dockerfile.includes(`FROM evolveum/midpoint:${PIN.midpoint}-alpine`)
    || !dockerfile.includes(`ARG SCIM2_CONNECTOR_COMMIT=${PIN.sourceCommit}`)
    || !dockerfile.includes('ARG SCIM2_CONNECTOR_TAG=V1.2.9') || !spike.includes('CONNECTOR_VERSION=1.2.9')
    || SCENARIOS.length !== 14) fail();
  return true;
}
// `--verify-evidence` reads the published gate output by default; a checked-in copy elsewhere
// (the backend replay fixtures) passes its capture and manifest paths explicitly.
export function evidenceFiles(paths, directory) {
  if (paths.length === 0) return { capture: path.join(directory, 'capture.json'), manifest: path.join(directory, 'manifest.json') };
  if (paths.length !== 2 || paths.some(value => !value.endsWith('.json'))) fail();
  return { capture: path.resolve(paths[0]), manifest: path.resolve(paths[1]) };
}
export async function main(args) {
  if (args[0] === '--verify-evidence') {
    const files = evidenceFiles(args.slice(1), OUTPUT);
    verifyEvidence(JSON.parse(await readFile(files.capture, 'utf8')), JSON.parse(await readFile(files.manifest, 'utf8')));
    return;
  }
  if (args.length !== 1 || !['--check', '--run'].includes(args[0])) fail();
  if (args[0] === '--check') { await check(); return; }
  const runId = process.env.IAM_SCIM_CAPTURE_RUN_ID;
  const socketPath = path.join(TEMP, 'scim-capture.sock');
  if (!/^iam-scim-gate-[a-f0-9-]{36}$/.test(runId ?? '')) fail();
  const token = await readToken(path.join(TEMP, '.env.scim-capture'));
  const runtime = createRuntime({ runId, token, socketPath });
  await executeStages(runtime);
  await persistEvidence(runtime.evidence());
}
const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (!isMain && process.env.IAM_SCIM_CAPTURE_PRELOAD === '1') {
  await installCaptureHook(path.join(TEMP, 'scim-capture.sock'));
} else if (isMain) {
  main(process.argv.slice(2)).then(() => process.stdout.write('SCIM capture command passed.\n'),
    (error) => {
      const stage = /^SCIM_CAPTURE_(?:STAGE_FAILED:[a-z-]+|CLEANUP_FAILED)$/.test(error?.message) ? ` (${error.message})` : '';
      process.stderr.write(`SCIM capture failed${stage}; evidence gate remains pending.\n`); process.exitCode = 1;
    });
}
