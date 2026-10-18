import test from 'node:test';
import assert from 'node:assert/strict';
import { runConflictStage, assertConflictObservation, assertRecoveryObservation } from './journey-conflict.mjs';

const start = Date.parse('2026-10-17T00:00:00Z');
const before = { sourceKey: '900000', sourceDocumentId: 'source-owned', documentId: 'person-owned',
  sourceIdentityKey: 'source-identity', identityOid: 'native-person-owned',
  remoteSubject: 'subject-owned', email: 'original@hr.idambox.test', invitations: 1, localMatches: 1, remoteMatches: 1 };
function negative() {
  return { origin: 'connector', method: 'PATCH', status: 503, retryAfterSeconds: 30,
    nativeAuditId: 'audit-failure', scimCorrelationId: 'scim-failure',
    task: { oid: '11000000-0000-4000-8000-000000000300', startedAt: new Date(start).toISOString(), finishedAt: new Date(start + 1000).toISOString(), result: 'retry-later', error: 'communication-error' },
    retry: { kind: 'retryLater', initialSeconds: 300, subsequentSeconds: 900, scheduledAt: new Date(start + 301000).toISOString(), persistent: true },
    after: { ...before } };
}
function recovered() {
  return { origin: 'connector', method: 'PATCH', status: 200, nativeAuditId: 'audit-recovery', scimCorrelationId: 'scim-recovery',
    retryTriggeredAt: new Date(start + 302000).toISOString(), triggerOrigin: 'native-retry-scanner',
    task: { oid: '00000000-0000-0000-0000-000000000007', startedAt: new Date(start + 303000).toISOString(), finishedAt: new Date(start + 304000).toISOString(), result: 'success' },
    after: { ...before, email: 'moved@hr.idambox.test' }, remote: { subject: before.remoteSubject, email: 'moved@hr.idambox.test', matches: 1 } };
}
function fixture(overrides = {}) {
  const calls = []; let present = true;
  const collision = { id: 'collision-owned', owner: 'abcdef123456', email: 'moved@hr.idambox.test', remoteOnly: true };
  const runtime = {
    preparePerson: async () => ({ ...before }),
    proposedEmail: 'moved@hr.idambox.test',
    assertLocalUnique: async () => true,
    createCollision: async () => collision,
    observeCollision: async () => present ? collision : undefined,
    publishMover: async () => { calls.push('publish'); return { validated: true }; },
    driveNativeTask: async () => { calls.push('task'); return negative(); },
    removeCollision: async () => { calls.push('remove'); present = false; },
    awaitNativeRecovery: async () => { calls.push('retry'); return recovered(); },
    cleanupPerson: async () => { calls.push('cleanup'); },
    ...overrides,
  };
  return { runtime, calls };
}

test('IN-03 drives collision, rollback, owned correction and native retry in order', async () => {
  const { runtime, calls } = fixture();
  const result = await runConflictStage(runtime, { runId: 'abcdef123456', now: () => start });
  assert.deepEqual(calls, ['publish', 'task', 'remove', 'retry', 'cleanup']);
  assert.equal(result.scenario, 'IN-03'); assert.equal(result.retryAfterSeconds, 30); assert.equal(result.recovered, true);
  assert.ok(!JSON.stringify(result).includes(before.email));
});
for (const [label, mutate] of [
  ['wrong status', value => { value.status = 409; }],
  ['wrong Retry-After', value => { value.retryAfterSeconds = 60; }],
  ['direct probe', value => { value.origin = 'direct-scim'; }],
  ['missing rollback', value => { value.after.email = 'moved@hr.idambox.test'; }],
  ['changed ownership', value => { value.after.documentId = 'other'; }],
  ['changed source identity', value => { value.after.sourceIdentityKey = 'other'; }],
  ['changed native identity', value => { value.after.identityOid = 'other'; }],
  ['wrong native task', value => { value.task.oid = 'other'; }],
  ['adopted subject', value => { value.after.remoteSubject = 'collision-owned'; }],
  ['new invitation', value => { value.after.invitations++; }],
  ['duplicate', value => { value.after.localMatches = 2; }],
  ['missing persistent trigger', value => { value.retry.persistent = false; }],
  ['shortened schedule', value => { value.retry.initialSeconds = 1; }],
  ['early trigger', value => { value.retry.scheduledAt = new Date(start + 1000).toISOString(); }],
  ['missing task error', value => { delete value.task.error; }],
]) test(`IN-03 rejects ${label}`, () => {
  const value = negative(); mutate(value); assert.throws(() => assertConflictObservation(before, value));
});
for (const [label, mutate] of [
  ['manual retry', value => { value.triggerOrigin = 'manual'; }],
  ['early recovery', value => { value.retryTriggeredAt = new Date(start).toISOString(); }],
  ['same audit', value => { value.nativeAuditId = 'audit-failure'; }],
  ['same correlation', value => { value.scimCorrelationId = 'scim-failure'; }],
  ['unmirrored move', value => { value.remote.email = before.email; }],
  ['late recovery', value => { value.task.finishedAt = new Date(start + 1500001).toISOString(); }],
]) test(`IN-03 rejects ${label}`, () => {
  const value = recovered(); mutate(value);
  assert.throws(() => assertRecoveryObservation(before, negative(), value, 'moved@hr.idambox.test', start + 1500000));
});
test('unowned collision is never deleted', async () => {
  const { runtime, calls } = fixture({ createCollision: async () => ({ id: 'foreign', owner: 'someone-else', remoteOnly: true }) });
  await assert.rejects(runConflictStage(runtime, { runId: 'abcdef123456' }), { code: 'JOURNEY_CONFLICT_OWNERSHIP' });
  assert.deepEqual(calls, ['cleanup']);
});
test('cleanup failure preserves original safe failure', async () => {
  const { runtime } = fixture({ driveNativeTask: async () => { throw new Error('private bearer'); }, cleanupPerson: async () => { throw new Error('private email'); } });
  await assert.rejects(runConflictStage(runtime, { runId: 'abcdef123456' }), error => error.code === 'JOURNEY_CONFLICT_FAILED'
    && error.cleanupCode === 'JOURNEY_CONFLICT_CLEANUP' && !JSON.stringify(error).includes('private'));
});
test('stale native task evidence is rejected before correction', async () => {
  const { runtime, calls } = fixture();
  await assert.rejects(runConflictStage(runtime, { runId: 'abcdef123456', now: () => start + 2000 }), { code: 'JOURNEY_CONFLICT_STALE' });
  assert.deepEqual(calls, ['publish', 'task', 'remove', 'cleanup']);
});

test('retry delay is measured from failed processing, even when task completion takes longer',()=>{
 const value=negative();value.task.finishedAt=new Date(start+10000).toISOString();value.retry.scheduledAt=new Date(start+300000).toISOString();
 assert.equal(assertConflictObservation(before,value),true);
 value.retry.scheduledAt=new Date(start+299999).toISOString();assert.throws(()=>assertConflictObservation(before,value));
});
test('on-demand original task cannot substitute for native scanner recovery',()=>{
 const value=recovered();value.task.oid=negative().task.oid;
 assert.throws(()=>assertRecoveryObservation(before,negative(),value,'moved@hr.idambox.test',start+1500000));
});
test('partially prepared source person still gets independent cleanup',async()=>{
 const calls=[];const {runtime}=fixture({preparePerson:async()=>{throw Error('private failure');},cleanupPerson:async()=>calls.push('cleanup')});
 await assert.rejects(runConflictStage(runtime),{code:'JOURNEY_CONFLICT_FAILED'});assert.deepEqual(calls,['cleanup']);
});
