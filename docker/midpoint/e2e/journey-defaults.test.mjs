import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailObservation, createRemoteObservation, runJourneyRegressions } from './journey-defaults.mjs';
import { createScimObserver } from './journey-observations.mjs';
const email = 'journey-abcdef123456-0@hr.idambox.test';
const recipients = [email, email.replace('@', '.moved@')];
const action = 'http://localhost:8080/realms/idambox/login-actions/action-token?key=private-action';
const env = { KEYCLOAK_BASE_URL: 'http://localhost:8080', KEYCLOAK_REALM: 'idambox',
  KEYCLOAK_ADMIN_CLIENT_ID: 'private-client', KEYCLOAK_ADMIN_CLIENT_SECRET: 'private-secret' };
const subject = '33333333-3333-4333-8333-333333333333';
const identityOid = '22222222-2222-4222-8222-222222222222';
const taskOid = '11000000-0000-4000-8000-000000000310';
const at = ms => new Date(Date.parse('2026-10-17T00:00:00Z') + ms).toISOString();
const current = { remoteSubject: subject, identityOid, documentId: 'a'.repeat(24), employeeNumber: '900001',
  email, department: 'Engineering', jobTitle: 'Engineer', accountStatus: 'active' };
const person = { ...current };
const run = { taskOid, triggeredAt: at(0), finishedAt: at(1000) };
const json = (value, status = 200) => ({ status, json: async () => value });

test('default invitation count uses loopback only and transient matched invitation bodies', async () => {
  const rows = recipients.map((address, i) => ({ ID: `invite-${i}`, To: [{ Address: address }] }));
  rows.push({ ID: 'foreign', To: [{ Address: 'private-other@example.test' }] }, { ID: 'ordinary', To: [{ Address: email }] });
  const calls = [];
  const observe = createMailObservation({ transport: async (url, init) => {
    assert.equal(new URL(url).origin, 'http://127.0.0.1:8025'); assert.equal(init.redirect, 'error');
    calls.push(url);
    if (url.includes('/messages?')) return json({ total: rows.length, messages: rows });
    const row = rows.find(row => url.endsWith(`/${row.ID}`)); assert.notEqual(row.ID, 'foreign');
    return json({ ...row, Text: row.ID === 'ordinary' ? 'ordinary notification' : action });
  } });
  assert.equal(await observe({ recipients }), 2);
  assert.ok(!JSON.stringify(calls).includes(email)); assert.ok(!JSON.stringify(calls).includes('private-action'));
});
for (const scenario of ['wrong-status', 'truncated', 'foreign-recipient', 'redirect', 'timeout']) test(`default mail refuses ${scenario} without diagnostics`, async () => {
  const observe = createMailObservation({ transport: async (url, init) => {
    if (scenario === 'timeout') { init.signal.throwIfAborted(); throw new DOMException('private-body', 'TimeoutError'); }
    if (scenario === 'redirect') throw Error(action);
    return json({ total: scenario === 'truncated' ? 101 : 0, messages: [] }, scenario === 'wrong-status' ? 503 : 200);
  } });
  await assert.rejects(observe({ recipients: scenario === 'foreign-recipient' ? ['foreign@example.test', recipients[1]] : recipients }),
    error => error.message === 'JOURNEY_MAIL_INVALID' && !JSON.stringify(error).includes('private'));
});
function remoteFixture(patch = {}) {
  const calls = [];
  const observe = createRemoteObservation({ env, command: async (program, args, options) => {
    assert.equal(program, 'docker');
    if (args[0] === 'inspect') return `quay.io/keycloak/keycloak:${patch.image ?? '26.6.1'} idp 127.0.0.1:8080 `;
    if (args.at(-1) === '/opt/keycloak/version.txt') return `Keycloak - Version ${patch.version ?? '26.6.1'}\n`;
    assert.ok(options.input.includes(identityOid));
    return JSON.stringify([{ id: 'audit-1', taskOid, taskName: 'HR import', outcome: 'success', startedAt: at(100), at: at(900), ...patch.audit }]);
  }, scim: async query => ({ ...query, origin: 'connector', at: at(500), requestId: 'scim-1', ...patch.scim }),
  transport: async (url, init) => {
    calls.push(url); assert.equal(init.redirect, 'error'); init.signal.throwIfAborted();
    if (patch.error) throw Error('private-secret private-token private-body');
    if (url.endsWith('/token')) {
      assert.equal(init.body.get('client_secret'), env.KEYCLOAK_ADMIN_CLIENT_SECRET);
      return json({ access_token: 'private-token', expires_in: 600 }, patch.tokenStatus ?? 200);
    }
    assert.equal(init.headers.Authorization, 'Bearer private-token');
    if (url.endsWith('/sessions')) return json(patch.sessions ?? [{ id: 'private-session' }], patch.status ?? 200);
    assert.ok(url.endsWith(`/users/${subject}`));
    return json({ id: subject, email, enabled: true, ...patch.user }, patch.status ?? 200);
  } });
  return { observe, calls };
}
test('default remote binds stored subject, session count, native audit and connector receipt', async () => {
  const { observe, calls } = remoteFixture();
  const proof = await observe({ kind: 'joiner', person, current, run });
  assert.equal(proof.subject, subject); assert.equal(proof.sessions, 1); assert.equal(proof.nativeAuditId, 'audit-1');
  assert.equal(proof.scimCorrelationId, 'scim-1'); assert.equal(proof.status, 201);
  assert.ok(!JSON.stringify(proof).includes('private')); assert.ok(calls.every(url => !url.includes('private')));
  const completed = remoteFixture({ user: { enabled: false }, sessions: [] });
  assert.deepEqual(await completed.observe({ kind: 'remote-completion', current }), { subject, enabled: false, sessions: 0 });
});
for (const [name, patch] of Object.entries({ 'wrong-version': { version: '0.0.0' }, 'wrong-image': { image: '26.6.0' }, 'wrong-status': { status: 404 }, 'token-status': { tokenStatus: 401 },
  'wrong-subject': { user: { id: identityOid } }, 'invalid-enabled': { user: { enabled: 'false' } }, 'invalid-sessions': { sessions: {} },
  'wrong-email': { user: { email: 'foreign@example.test' } }, 'wrong-scim-status': { scim: { status: 503 } },
  'stale-audit': { audit: { startedAt: at(-100) } }, 'foreign-task': { audit: { taskOid: identityOid } }, 'secret-error': { error: true } })) {
  test(`default remote refuses ${name} without leaking transport data`, async () => {
    await assert.rejects(remoteFixture(patch).observe({ kind: 'joiner', person, current, run }),
      error => error.code === 'JOURNEY_REMOTE_INVALID' && !error.message.includes('private'));
  });
}
test('default remote respects a timed-out caller signal', async () => {
  const controller = new AbortController(); controller.abort(new DOMException('private-timeout', 'TimeoutError'));
  await assert.rejects(remoteFixture().observe({ kind: 'remote-completion', current, signal: controller.signal }), { code: 'JOURNEY_REMOTE_INVALID' });
});
test('joiner observer correlates the returned document ID without retaining the SCIM body', async () => {
  const observer = createScimObserver('private-token', () => Date.parse(at(500)));
  const ctx = { path: '/scim/v2/Users', method: 'POST', status: 201, body: { id: current.documentId, emails: [email] },
    get: () => 'Bearer private-token', response: { get: () => '' } };
  await observer.run(ctx, async () => observer.log(JSON.stringify({ event: 'scim.request', source: 'source', target: null,
    operation: 'POST:/scim/v2/Users', status: 201, requestId: 'create-receipt' })));
  const receipt = observer.find({ documentId: current.documentId, method: 'POST', status: 201, since: at(0) });
  assert.equal(receipt.requestId, 'create-receipt'); assert.ok(!JSON.stringify(receipt).includes(email));
});
test('regression default runs full suites and stops on failure', async () => {
  const calls = [];
  const proof = await runJourneyRegressions(async (program, args) => { calls.push([program, args]); });
  assert.equal(proof.backendUnfiltered, true); assert.deepEqual(calls[0], ['pnpm', ['--dir', 'apps/backend', 'test']]);
  assert.deepEqual(calls[2], ['pnpm', ['--dir', 'apps/csrm', 'test']]);
  let count = 0;
  await assert.rejects(runJourneyRegressions(async () => { count++; throw Error('failure'); })); assert.equal(count, 1);
});

test('default factories and imports are inert with no valid private configuration', () => {
  let calls = 0; const transport = () => { calls++; throw Error('unexpected transport'); };
  createMailObservation({ transport }); createRemoteObservation({ env: {}, transport });
  assert.equal(calls, 0);
});
test('runJourney never invokes persistence after timeout or a partial executor return', async () => {
  const { runJourney } = await import('./journey-runtime.mjs');
  const runEnv = { IAM_JOURNEY_RUN_DIR: '/unused/iam-journey-00000000-0000-4000-8000-000000000000' };
  let publications = 0;
  for (const executeJourney of [async () => { throw Object.assign(Error('JOURNEY_TIMEOUT'), { code: 'JOURNEY_TIMEOUT' }); }, async () => []]) {
    await assert.rejects(runJourney({ env: runEnv, executeJourney, persistEvidence: () => { publications++; } }));
  }
  assert.equal(publications, 0);
});
