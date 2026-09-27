import 'server-only';

import { isAttestedE2eRuntime } from '@/lib/testing/e2e-runtime-attestation';
import type { SessionRuntimeMode } from './session-adapter';

/**
 * The one server-only predicate that decides whether the development session
 * exists. It is keyed on how this module was compiled, never on the NODE_ENV
 * the server is later started with: `next start` keeps an explicitly set
 * NODE_ENV=development and only warns, so a runtime value cannot tell a
 * production build from `next dev` (SR-01).
 *
 * - A `next dev` compilation has the session while it runs as next dev
 *   (NODE_ENV=development).
 * - A production build has it only inside the attested E2E runtime: the server
 *   runs with NODE_ENV=production, CSRM_ENVIRONMENT is `development`,
 *   CSRM_DEV_IDENTITY is `true`, and the run attestation is valid.
 * - Any other compilation has none.
 *
 * Each gate fails closed on its own; nothing else has any influence.
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
  if (compiledFor === 'development') return env.NODE_ENV === 'development' ? 'development' : 'unavailable';
  if (compiledFor !== 'production' || env.NODE_ENV !== 'production') return 'unavailable';
  if (env.CSRM_ENVIRONMENT !== 'development') return 'unavailable';
  if (env.CSRM_DEV_IDENTITY !== 'true') return 'unavailable';
  return isAttestedE2eRuntime(env) ? 'development' : 'unavailable';
}
