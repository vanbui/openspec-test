import type { SourceIdentity } from "../identity/identity-service";
import { CORE_USER_URN, ENTERPRISE_USER_URN } from "./wire";

export type ScimUser = {
  schemas: string[];
  id: string;
  userName: string;
  externalId?: string;
  emails: Array<{ value: string; primary: true }>;
  name?: { givenName?: string; familyName?: string };
  displayName: string;
  active: boolean;
  title?: string;
  [ENTERPRISE_USER_URN]?: { employeeNumber?: string; department?: string };
  meta: { resourceType: "User"; location: string };
};

/** Copy only the public source projection, even if a caller supplies a populated record. */
export function toScimUser(user: SourceIdentity): ScimUser {
  const name = { ...(user.firstName ? { givenName: user.firstName } : {}), ...(user.lastName ? { familyName: user.lastName } : {}) };
  const enterprise = { ...(user.employeeNumber ? { employeeNumber: user.employeeNumber } : {}), ...(user.department ? { department: user.department } : {}) };
  const hasEnterprise = Object.keys(enterprise).length > 0;
  return {
    schemas: [CORE_USER_URN, ...(hasEnterprise ? [ENTERPRISE_USER_URN] : [])],
    id: user.documentId,
    userName: user.username,
    ...(user.sourceExternalId ? { externalId: user.sourceExternalId } : {}),
    emails: [{ value: user.email, primary: true }],
    ...(Object.keys(name).length ? { name } : {}),
    displayName: user.displayName,
    active: user.accountStatus === "active",
    ...(user.jobTitle ? { title: user.jobTitle } : {}),
    ...(hasEnterprise ? { [ENTERPRISE_USER_URN]: enterprise } : {}),
    meta: { resourceType: "User", location: `/scim/v2/Users/${encodeURIComponent(user.documentId)}` },
  };
}
