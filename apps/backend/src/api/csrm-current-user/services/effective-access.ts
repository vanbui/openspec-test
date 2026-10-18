import { isEligiblePerson } from "../../../csrm/people/eligible-person";
import {
  HUMAN_ANALYST_ONLY_OPERATIONS,
  SERVICE_IDENTITY_REFUSED_OPERATIONS,
  hasHumanAnalystOperation,
  hasOperation,
  loadEffectiveGrants,
  type AuthorizationStrapi,
  type EffectiveGrants,
  type IdamBoxIdentity,
  type RoleGrant,
} from "../../../policies/csrm-authorization";

export type EffectiveMenuFunction = { name: string; menuPath: string };
export type EffectiveAccess = {
  displayName: string;
  functions: EffectiveMenuFunction[];
  operations: string[];
};

export class EffectiveAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EffectiveAccessError";
  }
}

function effectiveRoles(grants: EffectiveGrants): RoleGrant[] {
  return [...grants.requestorRoles, ...grants.explicitRoles];
}

/*
 * The grant-level decision csrm-authorization makes before any route-specific
 * scope check: the operation is held through the Requestor birthright or an
 * explicit Role, a SERVICE_IDENTITY_REFUSED_OPERATIONS member is held by an
 * eligible person (19-07, pilot ruling 2026-10-16: the policy's own
 * isEligiblePerson call, so the service identity is never offered an export
 * its birthright holds but the policy refuses), and a human-analyst-only
 * operation is held through the human Security Analyst Role. This is the
 * grant-level decision only: the route-level checks (ownership, the Risk
 * Register and Administration scopes, and the insight and export underlying
 * reads) are not applied here, so this list can name an operation the policy
 * then refuses on the call, never the reverse. The web anchors each export
 * capability to both the export and its list read (19-06), and the policy
 * enforces every route-level check on each call (BE2-04).
 */
export function isOperationGranted(grants: EffectiveGrants, operation: string): boolean {
  if (!hasOperation(effectiveRoles(grants), operation)) return false;
  // loadEffectiveGrants admits an active user only, so eligibility here turns on the roles held, as in the policy.
  if (SERVICE_IDENTITY_REFUSED_OPERATIONS.has(operation)
    && !isEligiblePerson({ accountStatus: "active", roles: grants.explicitRoles, registeredSourceService: grants.registeredSourceService })) {
    return false;
  }
  return !HUMAN_ANALYST_ONLY_OPERATIONS.has(operation) || hasHumanAnalystOperation(grants.explicitRoles, operation);
}

export function summariseEffectiveAccess(grants: EffectiveGrants): EffectiveAccess {
  const operations = new Set<string>();
  const functions = new Map<string, EffectiveMenuFunction>();

  for (const role of effectiveRoles(grants)) {
    for (const functionGrant of role.functions ?? []) {
      for (const functionApi of functionGrant.functionApis ?? []) {
        if (functionApi.url && isOperationGranted(grants, functionApi.url)) operations.add(functionApi.url);
      }
      if (functionGrant.name && functionGrant.menuPath) {
        functions.set(functionGrant.menuPath, { name: functionGrant.name, menuPath: functionGrant.menuPath });
      }
    }
  }

  return {
    displayName: grants.displayName,
    functions: [...functions.values()].sort((a, b) => a.menuPath.localeCompare(b.menuPath)),
    operations: [...operations].sort(),
  };
}

export async function readEffectiveAccess(strapi: AuthorizationStrapi, identity: IdamBoxIdentity): Promise<EffectiveAccess> {
  const grants = await loadEffectiveGrants(strapi, identity);
  if (!grants) throw new EffectiveAccessError("CSRM FunctionAPI access is denied.");
  return summariseEffectiveAccess(grants);
}
