/** Read-only local observations. Construction and imports perform no I/O. */
import { createLocalAdmin, createLocalMailbox, readNativeAudit, readKeycloakVersion } from './journey-bindings.mjs';
const fail = code => { throw Object.assign(new Error(code), { code }); };

export function createMailObservation(options = {}) {
  // Counting does not need the receipt/baseline cache used by contract probes.
  const mailbox = createLocalMailbox(options);
  return async ({ recipients }, signal) => {
    try {
      if (!Array.isArray(recipients) || (recipients.length < 1 || recipients.length > 2) || new Set(recipients).size !== recipients.length) fail('JOURNEY_MAIL_INVALID');
      let count = 0;
      for (const recipient of recipients) count += await mailbox.countInvitations(recipient, signal);
      return count;
    } catch { fail('JOURNEY_MAIL_INVALID'); }
  };
}

export function createRemoteObservation({ env, transport, now, scim, command } = {}) {
  // Delay configuration validation until invocation, keeping offline construction inert.
  let admin; let versionChecked = false;
  return async ({ kind, person, current, run, signal }) => {
    try {
      if (!/^[a-f0-9-]{36}$/.test(current?.remoteSubject ?? '')) fail('JOURNEY_REMOTE_INVALID');
      admin ??= createLocalAdmin({ env, transport, now });
      const active = AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]);
      if (!versionChecked) {
        if (await readKeycloakVersion(command, active) !== '26.6.1') fail('JOURNEY_REMOTE_INVALID');
        versionChecked = true;
      }
      const row = await admin.json(`/users/${current.remoteSubject}`, active);
      const sessions = await admin.json(`/users/${current.remoteSubject}/sessions`, active);
      if (row.id !== current.remoteSubject || typeof row.enabled !== 'boolean' || !Array.isArray(sessions)) fail('JOURNEY_REMOTE_INVALID');
      const state = { subject: row.id, enabled: row.enabled, sessions: sessions.length };
      if (kind === 'remote-completion') return state;
      if (!['joiner', 'mover', 'leaver'].includes(kind) || !run) fail('JOURNEY_REMOTE_INVALID');
      // HR attributes are mirrored into the local identity; the existing remote payload mirrors email only.
      if (row.enabled !== true || (kind !== 'leaver' && current.accountStatus !== 'active')
        || current.employeeNumber !== person.employeeNumber || current.department !== person.department
        || current.jobTitle !== person.jobTitle || row.email !== person.email) fail('JOURNEY_REMOTE_INVALID');
      const method = kind === 'joiner' ? 'POST' : 'PUT'; const status = kind === 'joiner' ? 201 : 200;
      const event = await scim({ documentId: current.documentId, since: run.triggeredAt, method, status }, active);
      const audit = await readNativeAudit(command, current, run.triggeredAt, false, active, run.taskOid);
      if (!event || event.origin !== 'connector' || event.method !== method || event.status !== status
        || event.documentId !== current.documentId || audit.taskOid !== run.taskOid || audit.outcome.toLowerCase() !== 'success'
        || Date.parse(event.at) < Date.parse(audit.startedAt) || Date.parse(event.at) > Date.parse(audit.at)
        || Date.parse(audit.at) > Date.parse(run.finishedAt)) fail('JOURNEY_REMOTE_INVALID');
      return { ...state, employeeNumber: current.employeeNumber, email: row.email,
        department: current.department, jobTitle: current.jobTitle, active: current.accountStatus === 'active',
        method, status, nativeAuditId: audit.id, scimCorrelationId: event.requestId };
    } catch { fail('JOURNEY_REMOTE_INVALID'); }
  };
}

/** Regression commands run only inside an explicitly requested full journey. */
export async function runJourneyRegressions(command, signal) {
  for (const args of [['--dir', 'apps/backend', 'test'], ['--dir', 'apps/csrm', 'typecheck'], ['--dir', 'apps/csrm', 'test']]) {
    await command('pnpm', args, { signal });
  }
  await command(process.execPath, ['--test', ...['journey.test.mjs', 'journey-access.test.mjs', 'journey-bindings.test.mjs',
    'journey-contract.test.mjs', 'journey-conflict.test.mjs', 'journey-observations.test.mjs', 'journey-seed.test.mjs', 'journey-defaults.test.mjs']
    .map(name => `docker/midpoint/e2e/${name}`)], { signal });
  await command(process.execPath, ['docker/midpoint/e2e/journey.mjs', '--check'], { signal });
  return { backendUnfiltered: true, csrm: true, contracts: true };
}
