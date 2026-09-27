/*
 * The Content-Security-Policy of every page response (D-19, D-42; recorded in
 * docs/security/web-headers.md).
 *
 * A plain pure module: it holds no secret and reads no environment, so it is unit-tested without
 * mocks. proxy.ts is its only production caller and passes a fresh nonce for every request.
 *
 * - Scripts run only with the request's nonce. 'strict-dynamic' extends that trust to the scripts
 *   Next's own nonce-bearing scripts load, so page chunks load and nothing injected runs.
 * - Styles may be inline, the recorded residual: sonner injects a <style> element when its module
 *   loads and Radix renders style attributes during server rendering, and neither can carry the
 *   nonce. A nonce in style-src would also make CSP3 browsers ignore the inline allowance.
 * - `development` is true only under `next dev`: React's development build evaluates code to rebuild
 *   server error stacks, and the development runtime evaluates hot updates, so script-src gains
 *   'unsafe-eval' there and nowhere else.
 * - `https` appends upgrade-insecure-requests only when the request arrived over TLS, so the plain
 *   HTTP development and test origins keep loading their own resources.
 */

/**
 * A nonce Next can read back: base64 or base64url characters, with padding only at the end. This is
 * the pattern Next uses to extract the nonce from the request header (get-script-nonce-from-header),
 * so a nonce it would ignore is refused here instead of silently disabling every script.
 */
export const CSP_NONCE_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/;

export type ContentSecurityPolicyOptions = {
  /** The per-request nonce. */
  nonce: string;
  /** `next dev`: NODE_ENV is development. */
  development: boolean;
  /** The request arrived over HTTPS, directly or as reported by a TLS-terminating proxy. */
  https: boolean;
};

export function buildContentSecurityPolicy({ nonce, development, https }: ContentSecurityPolicyOptions): string {
  if (!CSP_NONCE_PATTERN.test(nonce)) {
    // The value is never echoed: it failed validation, so it is not safe to put in a message either.
    throw new Error('CSP_NONCE_INVALID: a Content-Security-Policy nonce may hold only base64 or base64url characters.');
  }

  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(development ? ["'unsafe-eval'"] : [])];

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}
