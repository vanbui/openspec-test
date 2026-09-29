/*
 * Startup fail-fast (OIDC-04, OIDC-07). Next calls `register()` once before the server
 * serves any request, so an invalid `CSRM_AUTH_OIDC_ENABLED` value, a missing or
 * malformed `AUTH_*` value, or the flag set in a production build all stop startup
 * with a clear error instead of a broken sign-in later. `resolveSessionRuntimeMode`
 * still fails closed at request time (development-runtime.ts) if a host somehow
 * ignores this error, so the request-time predicate is never the only guard.
 *
 * This file lives at the app root beside `instrumentation-client.ts`, because the app
 * uses a root `app/` directory rather than `src/app/`.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertSessionRuntimeConfiguration } = await import('@/lib/auth/oidc-configuration');
    try {
      assertSessionRuntimeConfiguration(process.env);
    } catch (error) {
      // Next only logs an error thrown from register() and keeps serving, so exit
      // explicitly. The messages name a variable, never its value.
      // eslint-disable-next-line no-console -- the startup failure must reach the operator.
      console.error(`[csrm-auth] ${error instanceof Error ? error.message : 'Invalid session configuration.'}`);
      process.exit(1);
    }
  }
}
