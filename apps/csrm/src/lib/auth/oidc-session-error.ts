import 'server-only';

/**
 * The only session error the browser may see (docs/adr/0004): a code, never a token
 * or reason. Kept apart from `oidc-auth-options.ts` so reading it never loads
 * next-auth, which only a dynamic import may do (ADR 0003).
 */
export const REFRESH_TOKEN_ERROR = 'RefreshTokenError';
