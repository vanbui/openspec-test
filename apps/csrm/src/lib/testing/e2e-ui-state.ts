import 'server-only';

import { createElement, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';

export type E2eUiState = 'populated' | 'loading' | 'empty' | 'error' | 'permission';

type RouteSearchParams = Record<string, string | string[] | undefined>;

const allowedStates = new Set<E2eUiState>(['populated', 'loading', 'empty', 'error', 'permission']);

/*
 * The attestation is written once, when the Playwright configuration loads, and
 * every request re-checks its age. The window must therefore outlast a whole
 * suite run. At ten minutes the guarded fixtures silently stopped resolving
 * partway through a run that now takes about fourteen: the state boundary
 * vanished from every later spec, which then failed with no sign of why, and
 * the cause was recorded as a load-sensitive flake. An hour covers the suite
 * with room to grow while keeping the harness unreachable from any
 * longer-lived process, which is what this freshness check exists to guarantee
 * alongside the nonce and the isolated runtime root.
 */
const E2E_ATTESTATION_MAX_AGE_MS = 60 * 60 * 1000;
const runtimeParent = resolve(tmpdir(), 'csrm-playwright-e2e');

type RuntimeAttestation = {
  nonce: string;
  createdAt: string;
};

function isAttestedE2eRuntime(): boolean {
  if (process.env.CSRM_E2E_UI_STATE_HARNESS !== '1') return false;

  const runtimeRoot = process.env.CSRM_E2E_RUNTIME_ROOT;
  const attestationPath = process.env.CSRM_E2E_RUNTIME_ATTESTATION_PATH;
  const nonce = process.env.CSRM_E2E_RUNTIME_NONCE;
  if (!runtimeRoot || !attestationPath || !nonce) return false;

  const resolvedRuntimeRoot = resolve(runtimeRoot);
  const resolvedAttestationPath = resolve(attestationPath);
  const runtimeRelativePath = relative(runtimeParent, resolvedRuntimeRoot);
  if (!runtimeRelativePath || runtimeRelativePath.startsWith('..') || !runtimeRelativePath ||
    resolve(dirname(resolvedAttestationPath)) !== resolvedRuntimeRoot) return false;

  try {
    const parsed = JSON.parse(readFileSync(resolvedAttestationPath, 'utf8')) as RuntimeAttestation;
    const createdAt = Date.parse(parsed.createdAt);
    return parsed.nonce === nonce && Number.isFinite(createdAt) && createdAt <= Date.now()
      && Date.now() - createdAt < E2E_ATTESTATION_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function resolveE2eUiState(searchParams: RouteSearchParams): E2eUiState | undefined {
  if (!isAttestedE2eRuntime()) return undefined;

  const requestedState = searchParams.__e2eState;
  return typeof requestedState === 'string' && allowedStates.has(requestedState as E2eUiState)
    ? requestedState as E2eUiState
    : undefined;
}

/** A second closed harness selector exercises an independently failed safe dashboard widget. */
export function resolveE2eDashboardPartial(searchParams: RouteSearchParams): boolean {
  return isAttestedE2eRuntime() && searchParams.__e2ePartial === 'draft-requests-error';
}

export function E2eUiStateBoundary({ children, state }: { children: ReactNode; state: E2eUiState }) {
  // The shared state primitives own their alert semantics; giving this boundary role="alert" as
  // well nested two assertive live regions around every error and permission fixture.
  const semanticProps = state === 'loading'
    ? { 'aria-busy': true, 'aria-label': 'Loading content', role: 'status' }
    : {};

  return createElement('section', { 'data-ui-state': state, ...semanticProps }, children);
}
