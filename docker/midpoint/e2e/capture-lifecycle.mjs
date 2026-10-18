#!/usr/bin/env node
/** Persistent Phase 4 capture. This runner owns only its control session and evidence staging directory. */
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { command, bridge, readToken, evidenceFiles, check as checkPhase3 } from './capture-scim.mjs';
import { PIN, LIFECYCLE_COMMAND, LIFECYCLE_SCENARIOS, LIFECYCLE_INVOCATIONS, substitute, verifyEvidence, executeStages } from './scim-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const OUTPUT = path.join(ROOT, '.planning/workstreams/iam/phases/04-midpoint-configuration/evidence/connector-capture');
const TEMP = path.join(ROOT, 'apps/backend/.tmp');
const oid = suffix => `11000000-0000-4000-8000-000000000${suffix}`;
const fail = () => { throw new Error('SCIM_LIFECYCLE_REFUSED'); };
const array = value => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
// REST GET wraps the object in a key named after its type ({"resource": {...}}); results use "object".
/** midPoint wraps a REST object under its type name ({task}, {user}, {shadow}, ...). */
export const object = value => value?.object ?? (value && typeof value === 'object' && !value.oid
  ? Object.values(value).find(item => item && typeof item === 'object' && item.oid) ?? value : value);
// A search answers {"object": {"@type": "...ObjectListType", "object": [...]}}; an empty one has no inner list.
export const searchObjects = value => array(value?.object && !value.object.oid ? value.object.object : value?.object);
const name = value => typeof value === 'string' ? value : value?.orig;
const xml = value => String(value).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const uuid = value => { if (!/^[a-f0-9-]{36}$/.test(value ?? '')) fail(); return value; };

/** midPoint JSON may qualify connector configuration property keys with a namespace prefix. */
export function assertResource(resource) {
  const properties = resource?.connectorConfiguration?.configurationProperties;
  if (!properties || typeof properties !== 'object') fail();
  const values = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key.split(':').at(-1), value]));
  if (values.serviceUrl !== PIN.endpoint || ![true, 'true'].includes(values.pagination)
    || Number(values.importBatchSize) !== 100) fail();
  return true;
}

export function taskFinished(task, triggerTime) {
  task = object(task);
  return task?.executionState !== 'running' && Date.parse(task?.lastRunFinishTimestamp) > triggerTime;
}

/** Match a single open case and the actual HR owner option on its target shadow. */
export function selectCase(cases, shadow, identity) {
  const candidates = searchObjects(cases).filter(c => name(c.name) === "Correlation of account 'maya.requestor' on IdamBox (SCIM)" && c.state === 'open');
  if (candidates.length !== 1) fail();
  const c = candidates[0]; shadow = object(shadow); identity = object(identity);
  if (name(identity?.name) !== '940002' || identity?.personalNumber !== '940002'
    || c.targetRef?.oid !== shadow?.oid || shadow?.resourceRef?.oid !== oid('110')) fail();
  const owner = uuid(identity.oid);
  const options = array(shadow.correlation?.ownerOptions?.option).filter(option => option.identifier === `existing-${owner}`);
  const items = array(c.workItem).filter(item => !item.closeTimestamp);
  // midPoint JSON carries container ids as "@id".
  const itemId = String(items[0]?.['@id'] ?? items[0]?.id);
  if (options.length !== 1 || items.length !== 1 || !/^\d+$/.test(itemId)) fail();
  return { caseOid: uuid(c.oid), ownerOid: owner, workItemId: itemId };
}

export function decisionScript({ caseOid, ownerOid, workItemId }) {
  uuid(caseOid); uuid(ownerOid);
  if (!/^\d+$/.test(workItemId)) fail();
  return `<s:executeScript xmlns:s="http://midpoint.evolveum.com/xml/ns/public/model/scripting-3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:c="http://midpoint.evolveum.com/xml/ns/public/common/common-3" xmlns:q="http://prism.evolveum.com/xml/ns/public/query-3">
  <s:pipeline><s:search><s:type>c:CaseType</s:type><s:query><q:filter><q:inOid><q:value>${caseOid}</q:value></q:inOid></q:filter></s:query></s:search>
  <s:action><s:type>execute-script</s:type><s:parameter><s:name>script</s:name><c:value xsi:type="c:ScriptExpressionEvaluatorType"><c:code>${xml(`import com.evolveum.midpoint.schema.util.WorkItemId
import com.evolveum.midpoint.xml.ns._public.common.common_3.AbstractWorkItemOutputType
midpoint.getWorkflowService().completeWorkItem(WorkItemId.of('${caseOid}', ${workItemId}L), new AbstractWorkItemOutputType().outcome('existing-${ownerOid}').comment('Phase 4 disposable gate confirmed HR ownership'), midpoint.getCurrentTask(), midpoint.getCurrentResult())`)}</c:code></c:value></s:parameter></s:action></s:pipeline></s:executeScript>`;
}

export function evidenceBundle(entries, runId, date = new Date().toISOString()) {
  const ids = new Set();
  for (const entry of entries) {
    const body = entry.response.body;
    for (const user of [body, ...(body?.Resources ?? [])]) if (user?.userName && user.id) ids.add(user.id);
  }
  const result = substitute(entries, [...ids].map((value, index) => ({ name: `USER_ID_${index + 1}`, kind: 'user-id', value })));
  const manifest = { format: 1, provenance: 'live-connector', versions: { midpoint: PIN.midpoint, connector: PIN.connector, sourceCommit: PIN.sourceCommit },
    command: LIFECYCLE_COMMAND, runId, date, endpoint: PIN.endpoint, scenarios: [...LIFECYCLE_SCENARIOS], substitutions: result.substitutions, cleanup: true };
  verifyEvidence(result.capture, manifest, { profile: 'phase4' });
  return { capture: result.capture, manifest };
}

export function createRuntime({ runId, token, runCommand = command, control = bridge, now = Date.now, pause = delay, transport = fetch }) {
  const socket = path.join(TEMP, 'scim-capture.sock');
  let begun = false; let closed = false; let entries; let decision; let completed = false;
  const ctl = (message, signal) => control(socket, { ...message, runId }, signal);
  async function mp(method, endpoint, body, signal) {
    if (!/^\/(resources|tasks|connectors|users|cases|shadows|rpc|objectTemplates|archetypes)(\/[a-zA-Z0-9-]+)*$/.test(endpoint)) fail();
    const result = await runCommand('docker', ['exec', '-i', 'midpoint', 'sh', '-c',
      'curl --silent --max-time 150 --request "$0" --user "administrator:${MP_SET_midpoint_administrator_initialPassword}" --header "Content-Type: $2" --header "Accept: application/json" --data-binary @- --write-out "\\n%{http_code}" "http://localhost:8080/midpoint/ws/rest$1"',
      method, endpoint, typeof body === 'object' && body !== null ? 'application/json' : 'application/xml'],
    { input: typeof body === 'object' && body !== null ? JSON.stringify(body) : body ?? '', signal });
    const boundary = result.lastIndexOf('\n');
    if (![200, 201, 204].includes(Number(result.slice(boundary + 1)))) fail();
    return result.slice(0, boundary) ? JSON.parse(result.slice(0, boundary)) : null;
  }
  async function task(suffix, signal) {
    const endpoint = `/tasks/${oid(suffix)}`;
    if (object(await mp('GET', endpoint, null, signal))?.executionState === 'running') fail();
    const triggered = now();
    await mp('POST', `${endpoint}/run`, null, signal);
    for (;;) {
      signal.throwIfAborted();
      const status = await mp('GET', endpoint, null, signal);
      if (taskFinished(status, triggered)) return;
      await pause(500, undefined, { signal });
    }
  }
  const search = (collection, text, signal) => mp('POST', `/${collection}/search`, { query: { filter: { text } } }, signal);
  return {
    async prepare(signal) {
      if (!/^iam-scim-gate-[a-f0-9-]{36}$/.test(runId ?? '')) fail();
      const image = (await runCommand('docker', ['inspect', '-f', '{{.Config.Image}}', 'midpoint'], { signal })).trim();
      if (image !== 'idambox/midpoint:4.8.14-scim2-1.2.9') fail();
      if (!/\b4\.8\.14\b/.test(await runCommand('docker', ['exec', 'midpoint', '/opt/midpoint/bin/ninja.sh', '--version'], { signal }))) fail();
      if ((await runCommand('docker', ['exec', 'midpoint', 'cat', '/opt/midpoint/connector-bundle/source-commit.txt'], { signal })).trim() !== PIN.sourceCommit) fail();
      const connectors = searchObjects(await search('connectors', "connectorType = 'com.exclamationlabs.connid.base.scim2.Scim2Connector' and connectorVersion = '1.2.9'", signal));
      if (connectors.length !== 1 || connectors[0].connectorVersion !== PIN.connector) fail();
      // All committed objects must already exist. The runner never creates or reconfigures them.
      for (const [collection, suffixes] of [['resources', ['100', '110']], ['objectTemplates', ['140']], ['archetypes', ['150']], ['tasks', ['300', '310', '320', '330', '340']]]) {
        for (const suffix of suffixes) {
          const record = object(await mp('GET', `/${collection}/${oid(suffix)}`, null, signal));
          if (record?.oid !== oid(suffix) || record.executionState === 'running') fail();
          if (suffix === '110') assertResource(record);
        }
      }
      if (searchObjects(await search('users', "archetypeRef matches (oid = '11000000-0000-4000-8000-000000000150')", signal)).length) fail();
      if (searchObjects(await search('cases', "state = 'open'", signal)).length) fail();
      const candidateResponse = await transport('http://127.0.0.1:1337/scim/v2/Users?filter=' + encodeURIComponent('userName eq "maya.requestor"'), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, redirect: 'error', signal });
      if (candidateResponse.status !== 200) fail();
      const candidates = await candidateResponse.json();
      const candidate = candidates?.Resources?.[0];
      if (candidates?.totalResults !== 1 || !candidate?.id || candidate?.externalId || candidate?.active !== true
        || candidate?.emails?.[0]?.value !== 'maya.requestor@idambox.com') fail();
      await ctl({ action: 'begin', token, profile: 'phase4' }, signal);
      begun = true;
    },
    async stage(stage, signal) {
      if (!LIFECYCLE_SCENARIOS.includes(stage)) fail();
      await ctl({ action: 'stage', scenario: stage, invocation: LIFECYCLE_INVOCATIONS[stage] }, signal);
      if (stage === 'connection') {
        if (object(await mp('POST', `/resources/${oid('110')}/test`, null, signal))?.status !== 'success') fail();
        return;
      }
      const fixture = { 'initial-import': 'hr-1-initial.csv', mover: 'hr-2-mover.csv', leaver: 'hr-3-leaver.csv', 'claim-conflict': 'hr-4-claim.csv' }[stage];
      if (fixture) await runCommand('bash', ['docker/midpoint/hr-publish.sh', `docker/midpoint/e2e/fixtures/phase4/${fixture}`], { signal });
      if (stage === 'claim-confirm') {
        if (!decision) fail();
        await mp('POST', '/rpc/executeScript', decisionScript(decision), signal);
        const c = object(await mp('GET', `/cases/${decision.caseOid}`, null, signal));
        if (c?.state !== 'closed' || !array(c.workItem).every(item => item.closeTimestamp)) fail();
        return;
      }
      await task(stage === 'initial-import' ? '310' : ['claim-case', 'reconciliation'].includes(stage) ? '320' : '300', signal);
      if (stage === 'reconciliation') completed = true;
      if (stage === 'claim-case') {
        const cases = await search('cases', "state = 'open'", signal);
        const matches = searchObjects(cases).filter(c => name(c.name) === "Correlation of account 'maya.requestor' on IdamBox (SCIM)");
        if (matches.length !== 1) fail();
        const shadow = await mp('GET', `/shadows/${uuid(matches[0].targetRef?.oid)}`, null, signal);
        const identities = searchObjects(await search('users', "name = '940002'", signal));
        if (identities.length !== 1) fail();
        decision = selectCase(cases, shadow, identities[0]);
      }
    },
    async cleanup(signal) {
      if (!begun) return;
      try { entries = await ctl({ action: 'drain' }, signal); }
      finally { await ctl({ action: 'close' }, signal); }
      closed = true;
    },
    evidence() { if (!completed || !closed || !entries) fail(); return evidenceBundle(entries, runId); },
    drained() { return entries; },
  };
}

export async function persistEvidence(bundle, destination = OUTPUT) {
  verifyEvidence(bundle.capture, bundle.manifest, { profile: 'phase4' });
  const staging = `${destination}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(staging, { mode: 0o700 });
  try {
    for (const [file, value] of Object.entries(bundle)) await writeFile(path.join(staging, `${file}.json`), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(staging, destination);
  } finally { await rm(staging, { recursive: true, force: true }); }
}

export async function check() {
  await checkPhase3();
  await command(process.execPath, ['--check', fileURLToPath(import.meta.url)], { signal: AbortSignal.timeout(5000) });
  const header = (await readFile(path.join(ROOT, 'docker/midpoint/hr/reference.csv'), 'utf8')).split('\n')[0];
  for (const file of ['hr-1-initial.csv', 'hr-2-mover.csv', 'hr-3-leaver.csv', 'hr-4-claim.csv']) {
    const csv = await readFile(path.join(ROOT, 'docker/midpoint/e2e/fixtures/phase4', file), 'utf8');
    if (csv.split('\n')[0] !== header || !csv.endsWith('\n') || !csv.includes('940001,')) fail();
  }
  return true;
}
export async function main(args) {
  if (args[0] === '--verify-evidence') {
    const files = evidenceFiles(args.slice(1), OUTPUT);
    return verifyEvidence(JSON.parse(await readFile(files.capture, 'utf8')), JSON.parse(await readFile(files.manifest, 'utf8')), { profile: 'phase4' });
  }
  if (args.length !== 1 || !['--check', '--run'].includes(args[0])) fail();
  if (args[0] === '--check') return check();
  const runId = process.env.IAM_SCIM_CAPTURE_RUN_ID;
  if (!/^iam-scim-gate-[a-f0-9-]{36}$/.test(runId ?? '')) fail();
  const token = await readToken(path.join(TEMP, '.env.scim-capture'));
  const runtime = createRuntime({ runId, token });
  try {
    await executeStages(runtime, { scenarios: LIFECYCLE_SCENARIOS });
    await persistEvidence(runtime.evidence());
  } catch (error) {
    // Opt-in diagnosis for the orchestrator: where the closed refusal came from (file and
    // line only), and the drained entries, which the hook already sanitized. Never set in CI.
    if (process.env.IAM_SCIM_CAPTURE_DEBUG === '1') {
      process.stderr.write(String(error?.stack ?? '').split('\n').filter(line => /e2e\/(capture|scim)-/.test(line)).join('\n') + '\n');
      const dump = process.env.IAM_SCIM_CAPTURE_DEBUG_DUMP;
      if (dump && !dump.startsWith(ROOT) && runtime.drained()) await writeFile(dump, JSON.stringify(runtime.drained(), null, 2), { mode: 0o600 });
    }
    throw error;
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).then(() => process.stdout.write('SCIM lifecycle command passed.\n'), () => {
    process.stderr.write('SCIM lifecycle failed; evidence gate remains pending.\n'); process.exitCode = 1;
  });
}
