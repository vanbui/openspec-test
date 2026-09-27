import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('server-only', () => ({}));

import { resolveSessionRuntimeMode } from './development-runtime';

const runtimeParent = join(tmpdir(), 'csrm-playwright-e2e');
const runtimeDirectories: string[] = [];

/*
 * The compilation a module was built by. Next replaces a literal `process.env.NODE_ENV` when it
 * compiles: `next dev` with 'development', every `next build` with 'production', whatever NODE_ENV
 * the server is later started with. Each case states its compilation, and the environment object is
 * what the server process runs with.
 */
const nextDev = 'development';
const nextBuild = 'production';

/** A production build inside the attested E2E runtime carries these two variables beside the attestation. */
const productionGates = {
  NODE_ENV: 'production',
  CSRM_ENVIRONMENT: 'development',
  CSRM_DEV_IDENTITY: 'true',
};

/** Writes an attestation directly inside a fresh runtime root under the isolated parent. */
function attestRuntime(
  overrides: Partial<{ nonce: string; createdAt: string; parent: string }> = {},
): Record<string, string> {
  const parent = overrides.parent ?? runtimeParent;
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'runtime-'));
  runtimeDirectories.push(root);
  const nonce = overrides.nonce ?? 'test-nonce';
  const path = join(root, 'attestation.json');
  writeFileSync(path, JSON.stringify({ nonce, createdAt: overrides.createdAt ?? new Date().toISOString() }));
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
  for (const directory of runtimeDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('resolveSessionRuntimeMode', () => {
  it('keeps the development session available under next dev regardless of every other variable', () => {
    expect(resolveSessionRuntimeMode(environment({ NODE_ENV: 'development' }), nextDev)).toBe('development');
    expect(resolveSessionRuntimeMode(environment({
      NODE_ENV: 'development',
      CSRM_ENVIRONMENT: 'production',
      CSRM_DEV_IDENTITY: 'false',
    }), nextDev)).toBe('development');
  });

  it('makes the development session available under a production build only inside the attested runtime', () => {
    expect(resolveSessionRuntimeMode(environment({ ...productionGates, ...attestRuntime() }), nextBuild)).toBe('development');
  });

  /*
   * SR-01: `next start` keeps an explicitly set NODE_ENV=development, so a production build can run
   * with the next dev value at runtime. It must still take the attested path alone, and that path
   * requires a production runtime.
   */
  describe('a production build started with NODE_ENV=development', () => {
    it('leaves the session unavailable with both D-11 variables and no attestation', () => {
      expect(resolveSessionRuntimeMode(environment({
        NODE_ENV: 'development',
        CSRM_ENVIRONMENT: 'development',
        CSRM_DEV_IDENTITY: 'true',
      }), nextBuild)).toBe('unavailable');
    });

    it('leaves the session unavailable with NODE_ENV=development alone', () => {
      expect(resolveSessionRuntimeMode(environment({ NODE_ENV: 'development' }), nextBuild)).toBe('unavailable');
    });

    it('leaves the session unavailable even inside the attested runtime', () => {
      expect(resolveSessionRuntimeMode(environment({
        ...productionGates,
        ...attestRuntime(),
        NODE_ENV: 'development',
      }), nextBuild)).toBe('unavailable');
    });
  });

  it('leaves a next dev compilation unavailable when the server runs under another NODE_ENV', () => {
    expect(resolveSessionRuntimeMode(environment({ ...productionGates, ...attestRuntime() }), nextDev)).toBe('unavailable');
  });

  it('leaves a compilation that is neither next dev nor next build unavailable, whatever the server runs under', () => {
    expect(resolveSessionRuntimeMode(environment({ NODE_ENV: 'development' }), 'test')).toBe('unavailable');
    expect(resolveSessionRuntimeMode(environment({ ...productionGates, ...attestRuntime() }), 'test')).toBe('unavailable');
  });

  it.each([
    ['test', 'test'],
    ['undefined', undefined],
  ])('leaves the session unavailable when NODE_ENV is %s even with every other gate satisfied', (_label, nodeEnvironment) => {
    expect(resolveSessionRuntimeMode(environment({
      ...productionGates,
      ...attestRuntime(),
      NODE_ENV: nodeEnvironment,
    }), nextBuild)).toBe('unavailable');
  });

  it.each([
    ['CSRM_ENVIRONMENT is absent', { CSRM_ENVIRONMENT: undefined }],
    ['CSRM_ENVIRONMENT is production', { CSRM_ENVIRONMENT: 'production' }],
    ['CSRM_DEV_IDENTITY is absent', { CSRM_DEV_IDENTITY: undefined }],
    ['CSRM_DEV_IDENTITY is false', { CSRM_DEV_IDENTITY: 'false' }],
  ])('leaves a production build unavailable when %s', (_scenario, override) => {
    expect(resolveSessionRuntimeMode(environment({
      ...productionGates,
      ...attestRuntime(),
      ...override,
    }), nextBuild)).toBe('unavailable');
  });

  it('leaves a production build unavailable without an attestation', () => {
    expect(resolveSessionRuntimeMode(environment(productionGates), nextBuild)).toBe('unavailable');
  });

  it('leaves a production build unavailable with a stale attestation', () => {
    const stale = attestRuntime({ createdAt: new Date(Date.now() - 61 * 60 * 1000).toISOString() });

    expect(resolveSessionRuntimeMode(environment({ ...productionGates, ...stale }), nextBuild)).toBe('unavailable');
  });

  it('leaves a production build unavailable with a mismatched nonce', () => {
    const attested = attestRuntime({ nonce: 'attested' });

    expect(resolveSessionRuntimeMode(environment({
      ...productionGates,
      ...attested,
      CSRM_E2E_RUNTIME_NONCE: 'different',
    }), nextBuild)).toBe('unavailable');
  });

  it('leaves a production build unavailable when the runtime root is outside the isolated parent', () => {
    const siblingParent = mkdtempSync(join(tmpdir(), 'csrm-playwright-e2e-sibling-'));
    runtimeDirectories.push(siblingParent);

    expect(resolveSessionRuntimeMode(environment({
      ...productionGates,
      ...attestRuntime({ parent: siblingParent }),
    }), nextBuild)).toBe('unavailable');
  });

  it('is not influenced by the fixture-state harness flag in either direction', () => {
    expect(resolveSessionRuntimeMode(environment({
      ...productionGates,
      CSRM_E2E_UI_STATE_HARNESS: '1',
    }), nextBuild)).toBe('unavailable');

    expect(resolveSessionRuntimeMode(environment({
      ...productionGates,
      ...attestRuntime(),
      CSRM_E2E_UI_STATE_HARNESS: undefined,
    }), nextBuild)).toBe('development');

    expect(resolveSessionRuntimeMode(environment({
      ...productionGates,
      ...attestRuntime(),
      CSRM_E2E_UI_STATE_HARNESS: '1',
    }), nextBuild)).toBe('development');
  });

  it('reads the compilation from the literal process.env.NODE_ENV when no compilation is passed', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(resolveSessionRuntimeMode(environment({ NODE_ENV: 'development', CSRM_ENVIRONMENT: 'development', CSRM_DEV_IDENTITY: 'true' }))).toBe('unavailable');
      expect(resolveSessionRuntimeMode(environment({ ...productionGates, ...attestRuntime() }))).toBe('development');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
