#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const BUDGETS = Object.freeze({ setup: 300000, ordinary: 180000, mail: 120000,
  viewport: 600000, conflict: 1500000, overall: 3600000, cleanup: 60000 });
const lifecycle = ['csv-joiner', 'linkage', 'mail', 'password-setup', 'requestor-sign-in',
  'requestor-access', 'csv-mover', 'csv-leaver', 'immediate-refusal', 'remote-completion'];
export const STAGES = Object.freeze(['preflight', 'reset', 'readiness', 'source-registration',
  'source-token', 'render', 'reload', 'connection',
  ...[1440, 375].flatMap(width => lifecycle.map(stage => `${stage}-${width}`)),
  'in03-conflict', 'evidence']);
const systemClock = { now: Date.now, setTimeout, clearTimeout };
const failure = (code, stage) => Object.assign(new Error(code), { code, ...(stage ? { stage } : {}) });

/** Only closed metadata leaves this seam; adapter errors and outputs remain private. */
export async function executeJourney(runtime, clock = systemClock) {
  if (runtime.stages && JSON.stringify(runtime.stages) !== JSON.stringify(STAGES)) throw failure('JOURNEY_ORDER');
  if (typeof runtime.stage !== 'function' || typeof runtime.cleanup !== 'function') throw failure('JOURNEY_RUNTIME_INVALID');
  const started = clock.now();
  runtime.begin?.(started);
  const rows = [];
  const emit = event => { try { runtime.emit?.(Object.freeze(event)); } catch { /* Diagnostics cannot change execution correctness. */ } };
  let firstFailure;
  let widthStart;
  async function bounded(stage, budget, work) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(() => work(controller.signal)),
        new Promise((_, reject) => { timer = clock.setTimeout(() => {
          controller.abort(); reject(failure('JOURNEY_TIMEOUT', stage));
        }, Math.max(0, budget)); })]);
    } finally { clock.clearTimeout(timer); }
  }
  for (const stage of STAGES) {
    const start = clock.now();
    const width = stage.match(/-(1440|375)$/)?.[1];
    if (stage.startsWith('csv-joiner-')) widthStart = start;
    let budget = stage === 'in03-conflict' ? BUDGETS.conflict : stage.startsWith('mail-') ? BUDGETS.mail
      : ['preflight', 'reset', 'readiness'].includes(stage) ? BUDGETS.setup : BUDGETS.ordinary;
    budget = Math.min(budget, BUDGETS.overall - (start - started),
      STAGES.indexOf(stage) < 8 ? BUDGETS.setup - (start - started) : Infinity,
      width ? BUDGETS.viewport - (start - widthStart) : Infinity);
    emit({ stage, outcome: 'started', startedMs: start - started });
    try {
      if (budget <= 0) throw failure('JOURNEY_TIMEOUT', stage);
      await bounded(stage, budget, signal => runtime.stage(stage, signal));
      if (clock.now() - start > budget) throw failure('JOURNEY_TIMEOUT', stage);
      rows.push({ stage, outcome: 'passed', startedMs: start - started, durationMs: clock.now() - start });
      emit({ ...rows.at(-1) });
    } catch (error) {
      firstFailure = failure(error?.code === 'JOURNEY_TIMEOUT' ? 'JOURNEY_TIMEOUT' : 'JOURNEY_STAGE_FAILED', stage);
      rows.push({ stage, outcome: 'failed', startedMs: start - started, durationMs: Math.max(0, clock.now() - start) });
      emit({ ...rows.at(-1) });
      break;
    }
  }
  emit({ stage: 'cleanup', outcome: 'started', startedMs: clock.now() - started });
  try {
    await bounded('cleanup', BUDGETS.cleanup, signal => runtime.cleanup(signal));
    emit({ stage: 'cleanup', outcome: 'passed', startedMs: clock.now() - started });
  } catch {
    emit({ stage: 'cleanup', outcome: 'failed', startedMs: clock.now() - started });
    if (firstFailure) firstFailure.cleanupCode = 'JOURNEY_CLEANUP_FAILED';
    else firstFailure = failure('JOURNEY_CLEANUP_FAILED', 'cleanup');
  }
  if (firstFailure) { firstFailure.outcomes = rows; throw firstFailure; }
  return rows;
}

export async function check() {
  if (STAGES.length !== new Set(STAGES).size || STAGES[0] !== 'preflight' || STAGES.at(-1) !== 'evidence') throw failure('JOURNEY_STATIC_INVALID');
  const realm = JSON.parse(await readFile(path.join(ROOT, 'docker/keycloak/import/idambox-realm.json'), 'utf8'));
  if (realm.realm !== 'idambox') throw failure('JOURNEY_STATIC_INVALID');
  for (const relative of ['docker/docker-compose.yaml', 'docker/midpoint/render.sh', 'docker/midpoint/reload.sh', 'docker/midpoint/hr-publish.sh', 'docker/midpoint/e2e/journey-runtime.mjs']) {
    if (!(await readFile(path.join(ROOT, relative), 'utf8')).trim()) throw failure('JOURNEY_STATIC_INVALID');
  }
  const compose = await readFile(path.join(ROOT, 'docker/docker-compose.yaml'), 'utf8');
  for (const text of ['name: idp', 'quay.io/keycloak/keycloak:26.6.1', 'idambox/midpoint:4.8.14-scim2-1.2.9']) {
    if (!compose.includes(text)) throw failure('JOURNEY_STATIC_INVALID');
  }
  for (const [relative, key] of [['apps/backend/.env.example', 'IDAMBOX_KEYCLOAK_PROVISIONING'],
    ['apps/backend/.env.example', 'IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION'], ['apps/csrm/.env.local.example', 'CSRM_AUTH_OIDC_ENABLED']]) {
    const text = await readFile(path.join(ROOT, relative), 'utf8');
    if (!new RegExp(`^${key}=false\\s*$`, 'm').test(text)) throw failure('JOURNEY_STATIC_INVALID');
  }
  return true;
}

export function parseArguments(args) {
  if (args.length === 1 && ['--check', '--run', '--probe-keycloak', '--in03-conflict', '--list'].includes(args[0])) return { mode: args[0] };
  if (args[0] === '--verify-evidence' && (args.length === 1 || (args.length === 2 && args[1] === '--contract'))) return { mode: args[0], contract: args.length === 2 };
  throw failure('JOURNEY_ARGUMENTS_INVALID');
}

export async function main(args, env = process.env, bindings = {}) {
  const { mode, contract } = parseArguments(args);
  if (mode === '--check') return check();
  if (mode === '--list') return [...STAGES];
  const evidence = await import('./journey-evidence.mjs');
  if (mode === '--verify-evidence') return evidence.verifyEvidenceDirectory(env, { contract });
  await evidence.validatePrivateContract(env);
  // Live commands load their adapters lazily; unavailable stages cannot produce a pass.
  if (mode === '--in03-conflict') {
    const { createJourneyRuntime } = await import('./journey-runtime.mjs');
    const runtime = createJourneyRuntime({env});
    let first; let proof;
    try {
      const setupSignal = AbortSignal.timeout(BUDGETS.setup);
      for (const stage of STAGES.slice(0,8)) await runtime.stage(stage,setupSignal);
      proof = await runtime.stage('in03-conflict',AbortSignal.timeout(BUDGETS.conflict));
    } catch (error) { first = error; }
    finally { try { await runtime.cleanup(AbortSignal.timeout(BUDGETS.cleanup)); } catch { if (first) first.cleanupCode = 'JOURNEY_CLEANUP_FAILED'; else first = failure('JOURNEY_CLEANUP_FAILED'); } }
    if (first) throw first; return proof;
  }
  let adapter;
  try { adapter = await import(mode === '--run' ? './journey-runtime.mjs' : './journey-contract.mjs'); }
  catch { throw failure('JOURNEY_ADAPTER_UNAVAILABLE'); }
  const entry = mode === '--run' ? adapter.runJourney : adapter.probeKeycloak;
  if (typeof entry !== 'function') throw failure('JOURNEY_ADAPTER_UNAVAILABLE');
  return entry({ env, executeJourney, ...(mode === '--probe-keycloak' ? { runtime: bindings.keycloakProbe } : {}) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(result => {
    process.stdout.write(process.argv[2] === '--list' ? `${result.join('\n')}\n` : 'Journey command passed; offline checks do not establish live acceptance.\n');
  }, error => {
    const stage = STAGES.includes(error?.stage) || error?.stage === 'cleanup' ? `:${error.stage}` : '';
    const code = /^JOURNEY_[A-Z_]+$/.test(error?.code ?? '') ? error.code : 'JOURNEY_FAILED';
    process.stderr.write(`${code}${stage}\n`); process.exitCode = 1;
  });
}
