import 'server-only';

import { isAttestedE2eRuntime } from '@/lib/testing/e2e-runtime-attestation';
import { parseOidcEnabledFlag } from './oidc-configuration';
import type { SessionRuntimeMode } from './session-adapter';

/**
 * The one server-only predicate that decides whether the development session, the
 * OIDC session (ADR 0003), or neither exists. It is keyed on how this module was
 * compiled, never on the NODE_ENV the server is later started with: `next start`
 * keeps an explicitly set NODE_ENV=development and only warns, so a runtime value
 * cannot tell a production build from `next dev` (SR-01).
 *
 * - With `CSRM_AUTH_OIDC_ENABLED=true`, the OIDC session replaces the development one
 *   and never runs beside it: under `next dev` (NODE_ENV=development) and in a
 *   production build started as production (NODE_ENV=production). Strapi verifies the
 *   forwarded Keycloak access token itself (docs/adr/0004), which lifted ADR 0003's
 *   production refusal. A mismatched compilation and runtime is `'unavailable'`.
 * - Otherwise, a `next dev` compilation has the development session while it runs as
 *   next dev (NODE_ENV=development).
 * - A production build has it only inside the attested E2E runtime: the server
 *   runs with NODE_ENV=production, CSRM_ENVIRONMENT is `development`,
 *   CSRM_DEV_IDENTITY is `true`, and the run attestation is valid.
 * - Any other compilation has none.
 *
 * Each gate fails closed on its own; nothing else has any influence. Because every
 * existing gate compares `=== 'development'`, the development adapter, the
 * development sign-in form and the `x-csrm-dev-identity` header in
 * `server-client.ts` all switch off with no change to those gates whenever this
 * predicate resolves `'oidc'` or `'unavailable'`.
 *
 * The default of `compiledFor` must stay the literal `process.env.NODE_ENV`:
 * Next replaces that expression when it compiles the module, with
 * 'development' under `next dev` and 'production' in every `next build`. A
 * property read through `env` is not replaced. Tests pass the compilation
 * explicitly.
 */
export function resolveSessionRuntimeMode(
  env: NodeJS.ProcessEnv,
  compiledFor: string | undefined = process.env.NODE_ENV,
): SessionRuntimeMode {
  if (parseOidcEnabledFlag(env.CSRM_AUTH_OIDC_ENABLED)) {
    if (compiledFor === 'development') return env.NODE_ENV === 'development' ? 'oidc' : 'unavailable';
    return compiledFor === 'production' && env.NODE_ENV === 'production' ? 'oidc' : 'unavailable';
  }
  if (compiledFor === 'development') return env.NODE_ENV === 'development' ? 'development' : 'unavailable';
  if (compiledFor !== 'production' || env.NODE_ENV !== 'production') return 'unavailable';
  if (env.CSRM_ENVIRONMENT !== 'development') return 'unavailable';
  if (env.CSRM_DEV_IDENTITY !== 'true') return 'unavailable';
  return isAttestedE2eRuntime(env) ? 'development' : 'unavailable';
}
