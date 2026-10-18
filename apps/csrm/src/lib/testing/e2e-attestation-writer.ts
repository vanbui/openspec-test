import { closeSync, openSync, writeFileSync, writeSync } from 'node:fs';

/*
 * The Playwright runner's side of the run attestation (`e2e-runtime-attestation.ts` holds the server's check). The
 * runner writes the attestation when its configuration loads and then rewrites `createdAt` every few minutes while it
 * is alive, so the attestation stays fresh for a run of any length while a process that outlives the runner loses the
 * harness within the check's window. A full run on Windows takes about 1.9 hours (2026-10-18), longer than that window.
 *
 * The payload always has the same length (a UUID nonce and a `toISOString()` instant), so a refresh overwrites the
 * file in place without truncating it: a server reading during a refresh sees the old payload or the new one, never
 * an empty file.
 */

/** How often the runner rewrites `createdAt`, well inside E2E_ATTESTATION_MAX_AGE_MS. */
export const E2E_ATTESTATION_REFRESH_MS = 5 * 60 * 1000;

export function attestationPayload(nonce: string, now: Date): string {
  return JSON.stringify({ nonce, createdAt: now.toISOString() });
}

/** Creates the attestation file, readable by its owner only. */
export function writeAttestation(path: string, nonce: string, now: Date = new Date()): void {
  writeFileSync(path, attestationPayload(nonce, now), { mode: 0o600 });
}

/** Rewrites the attestation in place, without truncating it first. */
export function refreshAttestation(path: string, nonce: string, now: Date = new Date()): void {
  const descriptor = openSync(path, 'r+');
  try {
    writeSync(descriptor, attestationPayload(nonce, now), 0, 'utf8');
  } finally {
    closeSync(descriptor);
  }
}

/**
 * Refreshes the attestation every `intervalMs` until the returned stop function runs or the process exits. The timer
 * never keeps the process alive, and a failed refresh (the run's root already removed at exit) is ignored: the
 * server's check then refuses, which is the safe outcome.
 */
export function keepAttestationFresh(path: string, nonce: string, intervalMs: number = E2E_ATTESTATION_REFRESH_MS): () => void {
  const timer = setInterval(() => {
    try {
      refreshAttestation(path, nonce);
    } catch {
      // The attestation is gone or unwritable; let it expire.
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
