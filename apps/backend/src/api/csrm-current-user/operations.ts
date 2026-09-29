/*
 * The signed-in IdamBox User's own effective access (docs/adr/0004). Every role
 * holds it through the API-only Current User Access API Function, so the
 * Requestor birthright alone is enough to read it.
 */
export const CSRM_CURRENT_USER_OPERATIONS = Object.freeze({
  getAccess: "GET:/api/v1/me/access",
} as const);
