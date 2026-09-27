import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('server-only', () => ({}));

const originalHarness = process.env.CSRM_E2E_UI_STATE_HARNESS;
const runtimeVariables = ['CSRM_E2E_RUNTIME_ROOT', 'CSRM_E2E_RUNTIME_ATTESTATION_PATH', 'CSRM_E2E_RUNTIME_NONCE'] as const;
const originalRuntimeVariables = Object.fromEntries(runtimeVariables.map((key) => [key, process.env[key]]));
const runtimeDirectories: string[] = [];

function attestRuntime(overrides: Partial<{ nonce: string; createdAt: string; path: string }> = {}) {
  mkdirSync(join(tmpdir(), 'csrm-playwright-e2e'), { recursive: true });
  const root = mkdtempSync(join(tmpdir(), 'csrm-playwright-e2e', 'resolver-'));
  runtimeDirectories.push(root);
  const nonce = overrides.nonce ?? 'test-nonce';
  const path = overrides.path ?? join(root, 'attestation.json');
  writeFileSync(path, JSON.stringify({ nonce, createdAt: overrides.createdAt ?? new Date().toISOString() }));
  process.env.CSRM_E2E_RUNTIME_ROOT = root;
  process.env.CSRM_E2E_RUNTIME_ATTESTATION_PATH = path;
  process.env.CSRM_E2E_RUNTIME_NONCE = nonce;
}

afterEach(() => {
  if (originalHarness === undefined) {
    delete process.env.CSRM_E2E_UI_STATE_HARNESS;
  } else {
    process.env.CSRM_E2E_UI_STATE_HARNESS = originalHarness;
  }
  for (const key of runtimeVariables) {
    const original = originalRuntimeVariables[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  for (const directory of runtimeDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('resolveE2eUiState', () => {
  it('accepts only the closed fixture-state allowlist when the server harness has an isolated-runtime attestation', async () => {
    process.env.CSRM_E2E_UI_STATE_HARNESS = '1';
    attestRuntime();
    const { resolveE2eUiState } = await import('./e2e-ui-state');

    for (const state of ['populated', 'loading', 'empty', 'error', 'permission'] as const) {
      expect(resolveE2eUiState({ __e2eState: state })).toBe(state);
    }
  });

  it('does not let a browser query enable a fixture when the server harness is disabled', async () => {
    delete process.env.CSRM_E2E_UI_STATE_HARNESS;
    const { resolveE2eUiState } = await import('./e2e-ui-state');

    expect(resolveE2eUiState({ __e2eState: 'loading' })).toBeUndefined();
  });

  it('does not activate fixtures with the former harness switch alone', async () => {
    process.env.CSRM_E2E_UI_STATE_HARNESS = '1';
    const { resolveE2eUiState } = await import('./e2e-ui-state');
    expect(resolveE2eUiState({ __e2eState: 'loading' })).toBeUndefined();
  });

  it('rejects malformed, stale, non-local, and mismatched runtime attestations', async () => {
    process.env.CSRM_E2E_UI_STATE_HARNESS = '1';
    const { resolveE2eUiState } = await import('./e2e-ui-state');

    attestRuntime({ nonce: 'attested' });
    process.env.CSRM_E2E_RUNTIME_NONCE = 'different';
    expect(resolveE2eUiState({ __e2eState: 'loading' })).toBeUndefined();

    attestRuntime({ createdAt: new Date(Date.now() - 61 * 60 * 1000).toISOString() });
    expect(resolveE2eUiState({ __e2eState: 'loading' })).toBeUndefined();

    process.env.CSRM_E2E_RUNTIME_ROOT = tmpdir();
    expect(resolveE2eUiState({ __e2eState: 'loading' })).toBeUndefined();

    attestRuntime();
    writeFileSync(process.env.CSRM_E2E_RUNTIME_ATTESTATION_PATH!, '{not-json');
    expect(resolveE2eUiState({ __e2eState: 'loading' })).toBeUndefined();
  });

  it('rejects malformed, repeated, and unrecognised query values', async () => {
    process.env.CSRM_E2E_UI_STATE_HARNESS = '1';
    const { resolveE2eUiState } = await import('./e2e-ui-state');

    expect(resolveE2eUiState({ __e2eState: 'forbidden' })).toBeUndefined();
    expect(resolveE2eUiState({ __e2eState: ['loading'] })).toBeUndefined();
    expect(resolveE2eUiState({ __e2eState: ['loading', 'empty'] })).toBeUndefined();
  });

  it('keeps the partial dashboard proof closed behind the same server harness', async () => {
    const { resolveE2eDashboardPartial } = await import('./e2e-ui-state');
    process.env.CSRM_E2E_UI_STATE_HARNESS = '1';
    attestRuntime();
    expect(resolveE2eDashboardPartial({ __e2ePartial: 'draft-requests-error' })).toBe(true);
    expect(resolveE2eDashboardPartial({ __e2ePartial: 'anything-else' })).toBe(false);
    // Each dashboard owns its own selector: the analyst one never fails a Requestor widget.
    expect(resolveE2eDashboardPartial({ __e2ePartial: 'analyst-top-alerts-error' })).toBe(false);
    delete process.env.CSRM_E2E_UI_STATE_HARNESS;
    expect(resolveE2eDashboardPartial({ __e2ePartial: 'draft-requests-error' })).toBe(false);
  });
});

describe('resolveE2eAnalystDashboardPartial', () => {
  it('fails the Top alerts widget only for its closed value in the attested runtime', async () => {
    const { resolveE2eAnalystDashboardPartial } = await import('./e2e-ui-state');
    process.env.CSRM_E2E_UI_STATE_HARNESS = '1';
    attestRuntime();

    expect(resolveE2eAnalystDashboardPartial({ __e2ePartial: 'analyst-top-alerts-error' })).toBe(true);
    for (const value of ['draft-requests-error', 'analyst-top-alerts', 'ANALYST-TOP-ALERTS-ERROR', '', undefined]) {
      expect(resolveE2eAnalystDashboardPartial({ __e2ePartial: value }), String(value)).toBe(false);
    }
    expect(resolveE2eAnalystDashboardPartial({ __e2ePartial: ['analyst-top-alerts-error'] })).toBe(false);
    expect(resolveE2eAnalystDashboardPartial({})).toBe(false);
  });

  it('is never accepted without the attested runtime', async () => {
    const { resolveE2eAnalystDashboardPartial } = await import('./e2e-ui-state');

    delete process.env.CSRM_E2E_UI_STATE_HARNESS;
    expect(resolveE2eAnalystDashboardPartial({ __e2ePartial: 'analyst-top-alerts-error' })).toBe(false);

    // The harness switch alone is not an attestation.
    process.env.CSRM_E2E_UI_STATE_HARNESS = '1';
    expect(resolveE2eAnalystDashboardPartial({ __e2ePartial: 'analyst-top-alerts-error' })).toBe(false);

    attestRuntime({ createdAt: new Date(Date.now() - 61 * 60 * 1000).toISOString() });
    expect(resolveE2eAnalystDashboardPartial({ __e2ePartial: 'analyst-top-alerts-error' })).toBe(false);

    attestRuntime({ nonce: 'attested' });
    process.env.CSRM_E2E_RUNTIME_NONCE = 'different';
    expect(resolveE2eAnalystDashboardPartial({ __e2ePartial: 'analyst-top-alerts-error' })).toBe(false);
  });
});
