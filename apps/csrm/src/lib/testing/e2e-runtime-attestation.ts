import 'server-only';

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

/*
 * The attestation is written when the Playwright configuration loads, and every
 * request re-checks its age. At ten minutes the guarded fixtures silently
 * stopped resolving partway through a run that then took about fourteen; an
 * hour later fell short too, because a full run on Windows takes about 1.9 hours
 * (2026-10-18), and every spec after the hour landed on "Sign-in unavailable".
 * So the window no longer has to outlast a run: the runner rewrites `createdAt`
 * every five minutes while it is alive (`e2e-attestation-writer.ts`). The hour
 * is now how long a process that outlives the runner keeps the harness, which is
 * what this freshness check exists to bound alongside the nonce and the
 * isolated runtime root.
 */
export const E2E_ATTESTATION_MAX_AGE_MS = 60 * 60 * 1000;

/** Every isolated E2E runtime root lives directly under this directory. */
export const E2E_RUNTIME_PARENT = resolve(tmpdir(), 'csrm-playwright-e2e');

type RuntimeAttestation = {
  nonce: string;
  createdAt: string;
};

/**
 * Whether this process runs inside an attested Playwright runtime: the runtime
 * root is strictly inside the isolated parent, the attestation file sits
 * directly inside that root, its nonce matches the one this process was given,
 * and it was written within the last hour. It reads nothing else: the
 * fixture-state harness flag is a separate concern of the UI-state boundary.
 */
export function isAttestedE2eRuntime(env: NodeJS.ProcessEnv): boolean {
  const runtimeRoot = env.CSRM_E2E_RUNTIME_ROOT;
  const attestationPath = env.CSRM_E2E_RUNTIME_ATTESTATION_PATH;
  const nonce = env.CSRM_E2E_RUNTIME_NONCE;
  if (!runtimeRoot || !attestationPath || !nonce) return false;

  const resolvedRuntimeRoot = resolve(runtimeRoot);
  const resolvedAttestationPath = resolve(attestationPath);
  const runtimeRelativePath = relative(E2E_RUNTIME_PARENT, resolvedRuntimeRoot);
  if (!runtimeRelativePath || runtimeRelativePath.startsWith('..') || isAbsolute(runtimeRelativePath)
    || resolve(dirname(resolvedAttestationPath)) !== resolvedRuntimeRoot) return false;

  try {
    const parsed = JSON.parse(readFileSync(resolvedAttestationPath, 'utf8')) as RuntimeAttestation;
    const createdAt = Date.parse(parsed.createdAt);
    return parsed.nonce === nonce && Number.isFinite(createdAt) && createdAt <= Date.now()
      && Date.now() - createdAt < E2E_ATTESTATION_MAX_AGE_MS;
  } catch {
    return false;
  }
}
