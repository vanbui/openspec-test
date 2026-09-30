import 'server-only';

import type { CapabilityAdapter } from '@/lib/capabilities/capability-adapter';

export const developmentRoles = ['Requestor', 'Secondary Requestor', 'Security Analyst'] as const;

export type DevelopmentRole = (typeof developmentRoles)[number];
export type SessionRuntimeMode = 'development' | 'oidc' | 'unavailable';

export interface Session {
  displayName: string;
  /**
   * Set by OIDC sessions only (ADR 0003): the user's own Keycloak email claim. It is used only
   * for display in the account menu and never for authorisation (Strapi resolves identity from
   * the access token, docs/adr/0004). The development adapter does not set it.
   */
  email?: string;
  /**
   * Only a development-bridge session carries a fixture role; an OIDC session
   * (ADR 0003) never does. The two runtime modes are mutually exclusive through the
   * single `resolveSessionRuntimeMode` predicate, so a session never needs both.
   */
  developmentRole?: DevelopmentRole;
}

export interface SessionAdapter {
  current(): Promise<Session | null>;
  setDevelopmentRole(role: DevelopmentRole): Promise<void>;
  capabilitiesFor(session: Session): CapabilityAdapter;
  /**
   * The caller's own Keycloak access token for Strapi (docs/adr/0004), read
   * server-side only. Null outside OIDC mode or when no usable token exists.
   */
  identityToken(): Promise<string | null>;
  signIn(returnTo: string): Promise<never>;
  signOut(): Promise<never>;
}

export function parseDevelopmentRole(value: unknown): DevelopmentRole | null {
  return typeof value === 'string' && developmentRoles.includes(value as DevelopmentRole)
    ? value as DevelopmentRole
    : null;
}

export function requireDevelopmentRole(value: FormDataEntryValue | null): DevelopmentRole {
  const role = parseDevelopmentRole(value);

  if (!role) {
    throw new Error('Invalid development role.');
  }

  return role;
}
