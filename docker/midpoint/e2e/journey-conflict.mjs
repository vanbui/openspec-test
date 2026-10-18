/** IN-03 is the sole stage where the connector's expected 503 is an asserted outcome. */
import { randomBytes } from 'node:crypto';

const failure = code => Object.assign(new Error(code), { code });
const requireFact = (value, code = 'JOURNEY_CONFLICT_INVALID') => { if (!value) throw failure(code); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const stable = (before, after) => ['sourceKey', 'sourceDocumentId', 'sourceIdentityKey', 'identityOid', 'documentId', 'remoteSubject'].every(key => id(before?.[key]) && after?.[key] === before[key]);
const counts = value => value?.localMatches === 1 && value.remoteMatches === 1 && Number.isSafeInteger(value.invitations) && value.invitations >= 0;
function task(value, result) {
  return id(value?.oid) && instant(value.startedAt) && instant(value.finishedAt)
    && Date.parse(value.finishedAt) >= Date.parse(value.startedAt) && value.result === result;
}

export function assertConflictObservation(before, value) {
  requireFact(value?.origin === 'connector' && value.method === 'PATCH' && value.status === 503 && value.retryAfterSeconds === 30
    && id(value.nativeAuditId) && id(value.scimCorrelationId)
    && task(value.task, 'retry-later') && value.task.oid === '11000000-0000-4000-8000-000000000300' && value.task.error === 'communication-error'
    && value.retry?.kind === 'retryLater' && value.retry.persistent === true
    && value.retry.initialSeconds === 300 && value.retry.subsequentSeconds === 900
    && instant(value.retry.scheduledAt) && Date.parse(value.retry.scheduledAt) >= Date.parse(value.task.startedAt) + 300000
    && stable(before, value.after) && counts(before) && counts(value.after)
    && value.after.email === before.email && value.after.invitations === before.invitations);
  return true;
}

export function assertRecoveryObservation(before, conflict, value, email, deadline) {
  assertConflictObservation(before, conflict);
  requireFact(value?.origin === 'connector' && value.method === 'PATCH' && value.status === 200
    && value.triggerOrigin === 'native-retry-scanner' && instant(value.retryTriggeredAt)
    && Date.parse(value.retryTriggeredAt) >= Date.parse(conflict.retry.scheduledAt)
    && id(value.nativeAuditId) && value.nativeAuditId !== conflict.nativeAuditId
    && id(value.scimCorrelationId) && value.scimCorrelationId !== conflict.scimCorrelationId
    && task(value.task, 'success') && value.task.oid !== conflict.task.oid
    && Date.parse(value.task.startedAt) >= Date.parse(value.retryTriggeredAt)
    && Date.parse(value.task.finishedAt) <= deadline
    && stable(before, value.after) && counts(value.after) && value.after.email === email
    && value.after.invitations === before.invitations && value.remote?.subject === before.remoteSubject
    && value.remote.email === email && value.remote.matches === 1);
  return true;
}

async function bounded(signal, work, code) {
  signal.throwIfAborted(); let abort;
  try {
    return await Promise.race([Promise.resolve().then(work), new Promise((_, reject) => {
      abort = () => reject(failure(code)); signal.addEventListener('abort', abort, { once: true });
    })]);
  } finally { if (abort) signal.removeEventListener('abort', abort); }
}

/** Native task, CSV publication and retry-scanner adapters retain their existing write authority. */
export async function runConflictStage(runtime, { runId = randomBytes(6).toString('hex'), signal,
  now = Date.now, onObservations, timeoutMs = 1500000, cleanupMs = 60000 } = {}) {
  requireFact(/^[0-9a-f]{12}$/.test(runId) && Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 1500000
    && Number.isSafeInteger(cleanupMs) && cleanupMs > 0 && cleanupMs <= 60000, 'JOURNEY_CONFLICT_INPUT');
  const started = now(); const deadline = started + timeoutMs;
  const timeout = AbortSignal.timeout(timeoutMs); const active = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let before; let collision; let removed = false; let first; let proof; let personPrepared = false;
  const email = runtime?.proposedEmail;
  requireFact(typeof email === 'string' && /^[a-z0-9.+-]+@hr\.idambox\.test$/.test(email), 'JOURNEY_CONFLICT_INPUT');
  async function invoke(name, ...args) {
    requireFact(typeof runtime?.[name] === 'function', 'JOURNEY_CONFLICT_ADAPTER');
    return bounded(active, () => runtime[name](...args, active), 'JOURNEY_CONFLICT_TIMEOUT');
  }
  function own(value) {
    requireFact(id(value?.id) && value.owner === runId && value.email === email && value.remoteOnly === true
      && value.id !== before?.remoteSubject, 'JOURNEY_CONFLICT_OWNERSHIP');
  }
  async function remove(cleanSignal = active) {
    const current = await bounded(cleanSignal, () => runtime.observeCollision(collision.id, cleanSignal), 'JOURNEY_CONFLICT_CLEANUP');
    own(current); requireFact(current.id === collision.id, 'JOURNEY_CONFLICT_OWNERSHIP');
    await bounded(cleanSignal, () => runtime.removeCollision(collision, cleanSignal), 'JOURNEY_CONFLICT_CLEANUP');
    requireFact(await bounded(cleanSignal, () => runtime.observeCollision(collision.id, cleanSignal), 'JOURNEY_CONFLICT_CLEANUP') === undefined, 'JOURNEY_CONFLICT_OWNERSHIP');
    removed = true;
  }
  try {
    personPrepared = true; before = await invoke('preparePerson', runId);
    requireFact(stable(before, before) && counts(before) && before.email !== email, 'JOURNEY_CONFLICT_INPUT');
    requireFact(await invoke('assertLocalUnique', email, before) === true, 'JOURNEY_CONFLICT_LOCAL_DUPLICATE');
    const created = await invoke('createCollision', { owner: runId, email }); own(created); collision = created;
    const observed = await invoke('observeCollision', collision.id); own(observed);
    requireFact(observed.id === collision.id, 'JOURNEY_CONFLICT_OWNERSHIP');
    requireFact((await invoke('publishMover', { person: before, email }))?.validated === true, 'JOURNEY_CONFLICT_CSV');
    const conflict = await invoke('driveNativeTask', { person: before, email });
    assertConflictObservation(before, conflict);
    requireFact(Date.parse(conflict.task.startedAt) >= started && Date.parse(conflict.task.finishedAt) <= deadline, 'JOURNEY_CONFLICT_STALE');
    requireFact(now() <= deadline, 'JOURNEY_CONFLICT_TIMEOUT');
    await remove();
    // The adapter observes the existing retry scanner. It must not trigger or shorten a schedule.
    const recovery = await invoke('awaitNativeRecovery', { person: before, email,
      notBefore: conflict.retry.scheduledAt, deadline, initialSeconds: 300, subsequentSeconds: 900 });
    assertRecoveryObservation(before, conflict, recovery, email, deadline);
    requireFact(now() <= deadline, 'JOURNEY_CONFLICT_TIMEOUT');
    onObservations?.(conflict, recovery);
    proof = { scenario: 'IN-03', status: 503, retryAfterSeconds: 30, initialRetrySeconds: 300, subsequentRetrySeconds: 900,
      nativeRetryObserved: true, retryScheduledAt: conflict.retry.scheduledAt, retryTriggeredAt: recovery.retryTriggeredAt,
      correctionApplied: true, recovered: true, rollback: true, ownershipUnchanged: true, noInvitation: true };
  } catch (caught) {
    first = failure(/^JOURNEY_CONFLICT_[A-Z_]+$/.test(caught?.code ?? '') ? caught.code : 'JOURNEY_CONFLICT_FAILED');
  } finally {
    const cleanupSignal = AbortSignal.timeout(cleanupMs); let cleanupFailed = false;
    const clean = async work => { try { await bounded(cleanupSignal, work, 'JOURNEY_CONFLICT_CLEANUP'); } catch { cleanupFailed = true; } };
    if (collision && !removed) await clean(() => remove(cleanupSignal));
    if (personPrepared) await clean(() => runtime.cleanupPerson(before, cleanupSignal));
    if (cleanupFailed) { if (first) first.cleanupCode = 'JOURNEY_CONFLICT_CLEANUP'; else first = failure('JOURNEY_CONFLICT_CLEANUP'); }
  }
  if (first) throw first;
  return proof;
}
