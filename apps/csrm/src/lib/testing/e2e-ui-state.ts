import 'server-only';

import { createElement, type ReactNode } from 'react';
import { isAttestedE2eRuntime } from './e2e-runtime-attestation';

export type E2eUiState = 'populated' | 'loading' | 'empty' | 'error' | 'permission';

type RouteSearchParams = Record<string, string | string[] | undefined>;

const allowedStates = new Set<E2eUiState>(['populated', 'loading', 'empty', 'error', 'permission']);

/**
 * Fixture states exist only when the server harness is switched on and this
 * process runs inside an attested Playwright runtime. The attestation itself is
 * checked by the shared runtime predicate; the harness flag is this boundary's
 * own gate and never influences the session.
 */
function isAttestedUiStateHarness(): boolean {
  return process.env.CSRM_E2E_UI_STATE_HARNESS === '1' && isAttestedE2eRuntime(process.env);
}

export function resolveE2eUiState(searchParams: RouteSearchParams): E2eUiState | undefined {
  if (!isAttestedUiStateHarness()) return undefined;

  const requestedState = searchParams.__e2eState;
  return typeof requestedState === 'string' && allowedStates.has(requestedState as E2eUiState)
    ? requestedState as E2eUiState
    : undefined;
}

/**
 * The Requestor Home's own closed partial selector (UI-SPEC §5.4, D-23): it fails With the Security Analyst alone
 * while Needs your action and Released assessments render. The Home resolves it only after its real, owner-scoped
 * reads succeeded.
 */
export function resolveE2eRequestorHomePartial(searchParams: RouteSearchParams): boolean {
  return isAttestedUiStateHarness() && searchParams.__e2ePartial === 'requestor-home-with-analyst-error';
}

/**
 * The analyst dashboard's own closed partial selector (UI-SPEC §6.4): it fails the Top alerts widget
 * while its siblings render. The route resolves it only after its real, authorised reads succeeded.
 */
export function resolveE2eAnalystDashboardPartial(searchParams: RouteSearchParams): boolean {
  return isAttestedUiStateHarness() && searchParams.__e2ePartial === 'analyst-top-alerts-error';
}

export function E2eUiStateBoundary({ children, state }: { children: ReactNode; state: E2eUiState }) {
  // The shared state primitives own their alert semantics; giving this boundary role="alert" as
  // well nested two assertive live regions around every error and permission fixture.
  const semanticProps = state === 'loading'
    ? { 'aria-busy': true, 'aria-label': 'Loading content', role: 'status' }
    : {};

  return createElement('section', { 'data-ui-state': state, ...semanticProps }, children);
}
