import 'server-only';

import NextAuth from 'next-auth';
import { oidcAuthOptions } from './oidc-auth-options';
import { readOidcConfiguration } from './oidc-configuration';

/*
 * The lazily configured NextAuth instance. Config is built only when Auth.js is
 * actually invoked, so importing this module reads no environment variable by
 * itself; `oidc-session-adapter.ts` is the only caller, and only through a dynamic
 * `import('./oidc-auth')`, which keeps next-auth and every AUTH_* read out of the
 * development path entirely (OIDC-02).
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() =>
  oidcAuthOptions(readOidcConfiguration(process.env)),
);
