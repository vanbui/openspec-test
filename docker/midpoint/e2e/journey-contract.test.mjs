import test from 'node:test';
import assert from 'node:assert/strict';
import { runKeycloakProbe, createKeycloakProbeRuntime, PROBE_CASES } from './journey-contract.mjs';
import { main } from './journey.mjs';

function fixture(overrides = {}) {
  const calls = []; let next = 0; let smtp = {}; const users = new Map(); const counts = new Map();
  const runtime = {
    version: async () => '26.6.1',
    queryContract: async () => ({ names: ['client_id', 'redirect_uri', 'lifespan'], unit: 'seconds', defaultSeconds: 43200,
      provenance: 'local-pinned-source', redirectRequiresClient: true, validClient: 'probe-client', validRedirect: 'http://localhost:3000/api/auth/callback/keycloak' }),
    snapshotSmtp: async () => ({ original: true }), setSmtp: async value => { smtp = value; },
    restoreSmtp: async value => { calls.push(['restore', value]); },
    createUser: async spec => { const id = `subject-${++next}`; users.set(id, { ...spec, id }); counts.set(id, 0); return { id, username: spec.username }; },
    deleteUser: async user => { calls.push(['delete', user.id]); users.delete(user.id); },
    setRequiredActions: async user => { users.get(user.id).requiredActions = ['UPDATE_PASSWORD']; },
    readUser: async user => users.get(user.id),
    mailCount: async user => counts.get(user.id),
    observeNoMail: async () => true,
    waitMail: async (user, after) => { assert.ok(counts.get(user.id) > after); return { received: true, fresh: true }; },
    consumeAction: async user => { users.get(user.id).requiredActions = []; return { consumed: true }; },
    prepareResendPerson: async owner => { counts.set('source-person', 0); return { id: 'source-person', documentId: 'source-doc', owner, sourceManaged: true }; },
    operatorResend: async person => { counts.set(person.id, counts.get(person.id) + 1); calls.push(['operator', person.documentId]); return { accepted: true }; },
    cleanupResendPerson: async () => { calls.push(['source-cleanup']); },
    executeActions: async (user, query) => {
      calls.push(['request', user.id, query]);
      if (!smtp.host) return { status: 500 };
      if (query.client_id === 'missing-client' || query.redirect_uri?.includes('invalid.test') || (query.redirect_uri && !query.client_id)) return { status: 400 };
      counts.set(user.id, counts.get(user.id) + 1); return { status: 204 };
    },
    ...overrides,
  };
  return { runtime, calls, users };
}

test('all mandatory cases execute, clean fixtures and restore SMTP with closed outcomes', async () => {
  const { runtime, calls, users } = fixture();
  const result = await runKeycloakProbe(runtime, { runId: 'abcdef123456' });
  assert.deepEqual(result.cases.map(row => row.case), PROBE_CASES);
  assert.ok(result.cases.every(row => row.outcome === 'passed'));
  assert.equal(result.keycloak, '26.6.1'); assert.equal(result.liveAcceptance, false);
  assert.equal(users.size, 0); assert.deepEqual(calls.at(-1), ['restore', { original: true }]);
  assert.ok(!JSON.stringify(result).includes('subject-'));
});
test('wrong observed version blocks mutation', async () => {
  const { runtime, calls } = fixture({ version: async () => '26.6.0' });
  await assert.rejects(runKeycloakProbe(runtime), { code: 'JOURNEY_CONTRACT_VERSION' }); assert.equal(calls.length, 0);
});
test('CLI private/disposable gate runs before reading injected probe binding', async () => {
  let read = false;
  const binding = Object.defineProperty({}, 'keycloakProbe', { get() { read = true; throw new Error('must not load'); } });
  await assert.rejects(main(['--probe-keycloak'], { IAM_JOURNEY_DISPOSABLE: 'false' }, binding));
  assert.equal(read, false);
});
test('missing query semantics cannot pass A2', async () => {
  const { runtime } = fixture({ queryContract: async () => ({}) });
  await assert.rejects(runKeycloakProbe(runtime), { code: 'JOURNEY_CONTRACT_A2' });
});
test('query metadata without source or observed provenance cannot pass A2', async () => {
  const setup = fixture(); const original = setup.runtime.queryContract;
  setup.runtime.queryContract = async () => ({ ...await original(), provenance: 'unverified' });
  await assert.rejects(runKeycloakProbe(setup.runtime), { code: 'JOURNEY_CONTRACT_A2' });
});
test('A4 requires two guarded source-person resends', async () => {
  const { runtime, calls } = fixture(); await runKeycloakProbe(runtime);
  assert.deepEqual(calls.filter(row => row[0] === 'operator'), [['operator', 'source-doc'], ['operator', 'source-doc']]);
});
test('missing guarded resend cannot produce passing A4', async () => {
  const { runtime } = fixture({ operatorResend: undefined });
  await assert.rejects(runKeycloakProbe(runtime), { code: 'JOURNEY_CONTRACT_ADAPTER' });
});
test('bounded cleanup does not wait again after its deadline expires', async () => {
  const { runtime } = fixture({ executeActions: async () => ({ status: 200 }),
    deleteUser: async () => new Promise(resolve => setTimeout(resolve, 30)) });
  const started = Date.now();
  await assert.rejects(runKeycloakProbe(runtime, { cleanupMs: 5 }), error => error.code === 'JOURNEY_CONTRACT_STATUS'
    && error.cleanupCode === 'JOURNEY_CONTRACT_CLEANUP');
  assert.ok(Date.now() - started < 200);
});
test('incorrect endpoint status fails and cleanup still runs', async () => {
  const { runtime, calls, users } = fixture({ executeActions: async () => ({ status: 200 }) });
  await assert.rejects(runKeycloakProbe(runtime), { code: 'JOURNEY_CONTRACT_STATUS' });
  assert.equal(users.size, 0); assert.equal(calls.at(-1)[0], 'restore');
});
test('required actions alone sending mail fails A3', async () => {
  let reads = 0;
  const { runtime } = fixture({ mailCount: async () => ++reads });
  await assert.rejects(runKeycloakProbe(runtime), { code: 'JOURNEY_CONTRACT_A3' });
});
test('consuming actual action must clear observed password action', async () => {
  const { runtime } = fixture({ consumeAction: async () => ({ consumed: true }) });
  await assert.rejects(runKeycloakProbe(runtime), { code: 'JOURNEY_CONTRACT_A4' });
});
test('cleanup failure cannot replace original safe failure', async () => {
  const { runtime } = fixture({ executeActions: async () => { throw new Error('private token'); }, restoreSmtp: async () => { throw new Error('private mail'); } });
  await assert.rejects(runKeycloakProbe(runtime), error => error.code === 'JOURNEY_CONTRACT_FAILED'
    && error.cleanupCode === 'JOURNEY_CONTRACT_CLEANUP' && !JSON.stringify(error).includes('private'));
});
test('remote fixture identity substitution cannot authorize deletion', async () => {
  const { runtime, calls } = fixture({ createUser: async () => ({ id: 'unowned', username: 'someone-else' }) });
  await assert.rejects(runKeycloakProbe(runtime), { code: 'JOURNEY_CONTRACT_OWNERSHIP' });
  assert.equal(calls.filter(row => row[0] === 'delete').length, 0);
});
test('transport emits exact PUT array and omits optional queries by default', async () => {
  const requests = [];
  const runtime = createKeycloakProbeRuntime({ baseUrl: 'http://localhost:8080', realm: 'idambox', token: async () => 'private',
    transport: async (url, options) => { requests.push({ url, options }); return { status: 204 }; } });
  await runtime.executeActions({ id: 'controlled' }, {});
  assert.equal(requests[0].url, 'http://localhost:8080/admin/realms/idambox/users/controlled/execute-actions-email');
  assert.equal(requests[0].options.method, 'PUT'); assert.equal(requests[0].options.body, '["UPDATE_PASSWORD"]');
  assert.equal(requests[0].options.redirect, 'error');
});
test('transport refuses external origins and permits request-only callback validation', async () => {
  assert.throws(() => createKeycloakProbeRuntime({ baseUrl: 'https://example.com', realm: 'idambox' }));
  const runtime = createKeycloakProbeRuntime({ baseUrl: 'http://localhost:8080', realm: 'idambox', token: async () => 'private',
    transport: async () => ({ status: 400 }) });
  assert.equal((await runtime.executeActions({ id: 'controlled' }, { redirect_uri: 'http://localhost:3000/api/auth/callback/keycloak' })).status, 400);
});
