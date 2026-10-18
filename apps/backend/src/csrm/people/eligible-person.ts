/**
 * The automation identity's analyst-shaped role (G-1: never assignable, never a human analyst). Defined here, the leaf, so
 * the authorisation policy can apply this predicate without a module cycle; csrm-authorization re-exports it.
 */
export const SECURITY_ANALYST_AGENT_ROLE_NAME = "Security Analyst Agent";

/*
 * The one shared "eligible person" predicate (Phase 19.1 CONTEXT D-07, built early in Phase 13): an active IdamBox
 * User who does not hold the Security Analyst Agent role. It is the part every people decision shares, whatever it
 * then adds: Phase 13's `isEligibleAssignee` adds the human Security Analyst role and its grants and "did not raise
 * the request"; Phase 19.1's notification recipients compose it the same way.
 *
 * It reads only the user's own account status and role names, never the auth mode, and fails closed: a user whose
 * status or roles are missing or malformed is not eligible.
 */

export type EligiblePersonUser = {
  /** Server-derived persisted IdentitySource binding, independent of protection and role names. */
  registeredSourceService?: boolean;
  accountStatus?: unknown;
  roles?: ReadonlyArray<{ name?: unknown }> | null;
};

export function isEligiblePerson(user: EligiblePersonUser | null | undefined): boolean {
  if (!user || user.registeredSourceService === true || user.accountStatus !== "active" || !Array.isArray(user.roles)) return false;
  return !user.roles.some((role) => role?.name === SECURITY_ANALYST_AGENT_ROLE_NAME);
}
