import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('server-only', () => ({}));

import { isAttestedE2eRuntime } from './e2e-runtime-attestation';

const runtimeParent = join(tmpdir(), 'csrm-playwright-e2e');
const temporaryPaths: string[] = [];

type AttestationVariables = {
  CSRM_E2E_RUNTIME_ROOT: string;
  CSRM_E2E_RUNTIME_ATTESTATION_PATH: string;
  CSRM_E2E_RUNTIME_NONCE: string;
};

function freshAttestation(overrides: Partial<{ nonce: string; createdAt: string }> = {}): string {
  return JSON.stringify({
    nonce: overrides.nonce ?? 'test-nonce',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  });
}

/** Writes an attestation directly inside a fresh runtime root under the isolated parent. */
function attestRuntime(
  overrides: Partial<{ nonce: string; createdAt: string; body: string; parent: string }> = {},
): AttestationVariables {
  const parent = overrides.parent ?? runtimeParent;
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'attestation-'));
  temporaryPaths.push(root);
  const nonce = overrides.nonce ?? 'test-nonce';
  const path = join(root, 'attestation.json');
  writeFileSync(path, overrides.body ?? freshAttestation({ nonce, createdAt: overrides.createdAt }));
  return {
    CSRM_E2E_RUNTIME_ROOT: root,
    CSRM_E2E_RUNTIME_ATTESTATION_PATH: path,
    CSRM_E2E_RUNTIME_NONCE: nonce,
  };
}

function environment(variables: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return variables as NodeJS.ProcessEnv;
}

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('isAttestedE2eRuntime', () => {
  it('accepts a fresh attestation whose nonce matches', () => {
    expect(isAttestedE2eRuntime(environment(attestRuntime()))).toBe(true);
  });

  it('accepts an attestation that is still inside the one-hour window', () => {
    const attested = attestRuntime({ createdAt: new Date(Date.now() - 59 * 60 * 1000).toISOString() });

    expect(isAttestedE2eRuntime(environment(attested))).toBe(true);
  });

  it('never consults the fixture-state harness flag', () => {
    expect(isAttestedE2eRuntime(environment({ ...attestRuntime(), CSRM_E2E_UI_STATE_HARNESS: '1' }))).toBe(true);
    expect(isAttestedE2eRuntime(environment({ CSRM_E2E_UI_STATE_HARNESS: '1' }))).toBe(false);
  });

  it.each([
    'CSRM_E2E_RUNTIME_ROOT',
    'CSRM_E2E_RUNTIME_ATTESTATION_PATH',
    'CSRM_E2E_RUNTIME_NONCE',
  ] as const)('rejects a runtime that lacks %s', (variable) => {
    const attested = attestRuntime();

    expect(isAttestedE2eRuntime(environment({ ...attested, [variable]: undefined }))).toBe(false);
    expect(isAttestedE2eRuntime(environment({ ...attested, [variable]: '' }))).toBe(false);
  });

  it('rejects a runtime root that is the isolated parent itself or outside it', () => {
    const attested = attestRuntime();

    const parentLevelPath = join(runtimeParent, `attestation-${process.pid}-${Date.now()}.json`);
    temporaryPaths.push(parentLevelPath);
    writeFileSync(parentLevelPath, freshAttestation());
    expect(isAttestedE2eRuntime(environment({
      ...attested,
      CSRM_E2E_RUNTIME_ROOT: runtimeParent,
      CSRM_E2E_RUNTIME_ATTESTATION_PATH: parentLevelPath,
    }))).toBe(false);

    const temporaryDirectoryPath = join(tmpdir(), `csrm-attestation-${process.pid}-${Date.now()}.json`);
    temporaryPaths.push(temporaryDirectoryPath);
    writeFileSync(temporaryDirectoryPath, freshAttestation());
    expect(isAttestedE2eRuntime(environment({
      ...attested,
      CSRM_E2E_RUNTIME_ROOT: tmpdir(),
      CSRM_E2E_RUNTIME_ATTESTATION_PATH: temporaryDirectoryPath,
    }))).toBe(false);

    const siblingParent = mkdtempSync(join(tmpdir(), 'csrm-playwright-e2e-sibling-'));
    temporaryPaths.push(siblingParent);
    expect(isAttestedE2eRuntime(environment(attestRuntime({ parent: siblingParent })))).toBe(false);
  });

  it('rejects an attestation file that is not directly inside the runtime root', () => {
    const attested = attestRuntime();

    const nestedDirectory = join(attested.CSRM_E2E_RUNTIME_ROOT, 'nested');
    mkdirSync(nestedDirectory);
    const nestedPath = join(nestedDirectory, 'attestation.json');
    writeFileSync(nestedPath, freshAttestation());
    expect(isAttestedE2eRuntime(environment({ ...attested, CSRM_E2E_RUNTIME_ATTESTATION_PATH: nestedPath }))).toBe(false);

    const otherRuntime = attestRuntime();
    expect(isAttestedE2eRuntime(environment({
      ...attested,
      CSRM_E2E_RUNTIME_ATTESTATION_PATH: otherRuntime.CSRM_E2E_RUNTIME_ATTESTATION_PATH,
    }))).toBe(false);
  });

  it('rejects a missing or malformed attestation file', () => {
    const attested = attestRuntime();
    expect(isAttestedE2eRuntime(environment({
      ...attested,
      CSRM_E2E_RUNTIME_ATTESTATION_PATH: join(attested.CSRM_E2E_RUNTIME_ROOT, 'missing.json'),
    }))).toBe(false);

    expect(isAttestedE2eRuntime(environment(attestRuntime({ body: '{not-json' })))).toBe(false);
    expect(isAttestedE2eRuntime(environment(attestRuntime({ body: JSON.stringify({ nonce: 'test-nonce' }) })))).toBe(false);
    expect(isAttestedE2eRuntime(environment(attestRuntime({ createdAt: 'not-a-timestamp' })))).toBe(false);
  });

  it('rejects a nonce that differs from the attested one', () => {
    const attested = attestRuntime({ nonce: 'attested' });

    expect(isAttestedE2eRuntime(environment({ ...attested, CSRM_E2E_RUNTIME_NONCE: 'different' }))).toBe(false);
  });

  it('rejects an attestation created in the future', () => {
    const attested = attestRuntime({ createdAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() });

    expect(isAttestedE2eRuntime(environment(attested))).toBe(false);
  });

  it('rejects an attestation older than one hour', () => {
    const attested = attestRuntime({ createdAt: new Date(Date.now() - 61 * 60 * 1000).toISOString() });

    expect(isAttestedE2eRuntime(environment(attested))).toBe(false);
  });
});
