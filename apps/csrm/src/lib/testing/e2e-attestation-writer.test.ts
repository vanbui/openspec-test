import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('server-only', () => ({}));

import {
  E2E_ATTESTATION_REFRESH_MS,
  attestationPayload,
  keepAttestationFresh,
  refreshAttestation,
  writeAttestation,
} from './e2e-attestation-writer';
import { E2E_ATTESTATION_MAX_AGE_MS, isAttestedE2eRuntime } from './e2e-runtime-attestation';

const runtimeParent = join(tmpdir(), 'csrm-playwright-e2e');
const nonce = '0f8fad5b-d9cb-469f-a165-70867728950e';
const temporaryPaths: string[] = [];

function runtime(): { root: string; path: string; env: NodeJS.ProcessEnv } {
  mkdirSync(runtimeParent, { recursive: true });
  const root = mkdtempSync(join(runtimeParent, 'attestation-writer-'));
  temporaryPaths.push(root);
  const path = join(root, 'attestation.json');
  const variables: Record<string, string | undefined> = {
    CSRM_E2E_RUNTIME_ROOT: root,
    CSRM_E2E_RUNTIME_ATTESTATION_PATH: path,
    CSRM_E2E_RUNTIME_NONCE: nonce,
  };
  return { root, path, env: variables as NodeJS.ProcessEnv };
}

afterEach(() => {
  vi.useRealTimers();
  for (const path of temporaryPaths.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('the runner side of the run attestation', () => {
  it('refreshes well inside the freshness window', () => {
    expect(E2E_ATTESTATION_REFRESH_MS * 4).toBeLessThanOrEqual(E2E_ATTESTATION_MAX_AGE_MS);
  });

  it('writes a payload of one length for every instant, so a refresh never truncates the file', () => {
    const lengths = [new Date(0), new Date('2026-10-18T09:05:03.007Z'), new Date('2099-12-31T23:59:59.999Z')]
      .map((instant) => attestationPayload(nonce, instant).length);
    expect(new Set(lengths).size).toBe(1);
  });

  it('keeps a run older than the window attested while the runner refreshes it', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { path, env } = runtime();
    writeAttestation(path, nonce);
    const stop = keepAttestationFresh(path, nonce);

    vi.advanceTimersByTime(2 * E2E_ATTESTATION_MAX_AGE_MS);
    expect(isAttestedE2eRuntime(env)).toBe(true);
    stop();
  });

  it('lets the attestation expire once the runner stops refreshing it', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { path, env } = runtime();
    writeAttestation(path, nonce);
    keepAttestationFresh(path, nonce)();

    vi.advanceTimersByTime(E2E_ATTESTATION_MAX_AGE_MS + 1);
    expect(isAttestedE2eRuntime(env)).toBe(false);
  });

  it('rewrites only createdAt, keeping the nonce', () => {
    const { path } = runtime();
    writeAttestation(path, nonce, new Date('2026-10-18T09:00:00.000Z'));
    refreshAttestation(path, nonce, new Date('2026-10-18T10:00:00.000Z'));
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ nonce, createdAt: '2026-10-18T10:00:00.000Z' });
  });

  it('ignores a refresh after the run root is gone, so the check refuses', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { root, path, env } = runtime();
    writeAttestation(path, nonce);
    const stop = keepAttestationFresh(path, nonce);
    rmSync(root, { recursive: true, force: true });

    expect(() => vi.advanceTimersByTime(E2E_ATTESTATION_REFRESH_MS)).not.toThrow();
    expect(isAttestedE2eRuntime(env)).toBe(false);
    stop();
  });
});
