import {
  HUMAN_ANALYST_ONLY_OPERATIONS,
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
 * explicit Role, and a human-analyst-only operation is held through the human
 * Security Analyst Role. Route scope checks (ownership, the Risk Register and
 * Administration scopes, insight underlying reads) still apply on each call, so
 * this list can only ever be as wide as the policy, never wider.
 */
export function isOperationGranted(grants: EffectiveGrants, operation: string): boolean {
  if (!hasOperation(effectiveRoles(grants), operation)) return false;
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
