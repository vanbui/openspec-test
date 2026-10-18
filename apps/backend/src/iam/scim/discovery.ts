import { scimFailure, type ScimOutcome } from "./errors";
import { CORE_USER_URN, ENTERPRISE_USER_URN, GROUP_URN, LIST_RESPONSE_URN } from "./wire";

export function serviceProviderConfig() {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 500 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [{ name: "Bearer Token", description: "Identity Source bearer token",
      type: "oauthbearertoken", primary: true }],
    meta: { resourceType: "ServiceProviderConfig", location: "/scim/v2/ServiceProviderConfig" },
  };
}
export type SchemaAttribute = {
  name: string;
  type: "string" | "boolean" | "complex" | "reference";
  multiValued: boolean;
  description: string;
  required: boolean;
  mutability: "readOnly" | "readWrite" | "immutable";
  returned: "always" | "default";
  caseExact?: boolean;
  uniqueness?: "none" | "server" | "global";
  subAttributes?: SchemaAttribute[];
  referenceTypes?: string[];
  canonicalValues?: string[];
};
export type SchemaDescriptor = {
  schemas: string[]; id: string; name: string; description: string; attributes: SchemaAttribute[];
  meta: { resourceType: "Schema"; location: string };
};
export type ResourceTypeDescriptor = {
  schemas: string[]; id: string; name: string; endpoint: string; schema: string;
  schemaExtensions?: Array<{ schema: string; required: boolean }>;
  meta: { resourceType: "ResourceType"; location: string };
};

function attribute(name: string, description: string, options: Partial<Omit<SchemaAttribute, "name" | "description">> = {}): SchemaAttribute {
  const type = options.type ?? "string";
  return { name, type, multiValued: false, description, required: false,
    mutability: "readWrite", returned: "default",
    ...(type === "string" || type === "reference" ? { caseExact: false } : {}),
    ...(type === "string" ? { uniqueness: "none" as const } : {}), ...options };
}

function schema(id: string, name: string, description: string, attributes: SchemaAttribute[]): SchemaDescriptor {
  return { schemas: ["urn:ietf:params:scim:schemas:core:2.0:Schema"], id, name, description, attributes,
    meta: { resourceType: "Schema", location: `/scim/v2/Schemas/${id}` } };
}

/** Fresh public descriptors; no persistence or source authority is accepted here. */
export function schemas(): SchemaDescriptor[] {
  return [
    schema(CORE_USER_URN, "User", "Supported Core User projection.", [
      attribute("id", "Stable server-issued document identifier.", {
        mutability: "readOnly", returned: "always", caseExact: true, uniqueness: "global",
      }),
      attribute("externalId", "Exact source identifier, required on create/replacement and immutable after ownership is established.", {
        required: true, mutability: "immutable", caseExact: true,
      }),
      attribute("userName", "User name.", { required: true, uniqueness: "server" }),
      attribute("name", "Supported name parts.", { type: "complex", subAttributes: [
        attribute("givenName", "Given name."), attribute("familyName", "Family name."),
      ] }),
      attribute("displayName", "Display name; omitted or blank input derives from name parts, then userName."),
      attribute("active", "Account status; omitted create/replacement input defaults to true.", { type: "boolean" }),
      attribute("emails", "Only the selected primary email is stored and returned; ambiguous selections are rejected.", {
        type: "complex", multiValued: true, required: true, subAttributes: [
          attribute("value", "Selected email address.", { required: true, uniqueness: "server" }),
          attribute("primary", "Returned true for the selected address.", { type: "boolean" }),
        ],
      }),
      attribute("title", "Job title."),
      attribute("meta", "Available server metadata.", { type: "complex", mutability: "readOnly", subAttributes: [
        attribute("resourceType", "User resource type.", { mutability: "readOnly", caseExact: true }),
        attribute("location", "Rooted resource location.", { type: "reference", mutability: "readOnly", caseExact: true,
          referenceTypes: ["uri"] }),
      ] }),
    ]),
    schema(ENTERPRISE_USER_URN, "EnterpriseUser", "Optional supported Enterprise User fields.", [
      attribute("employeeNumber", "Employee number; matching data, not an ownership key."),
      attribute("department", "Department."),
    ]),
    schema(GROUP_URN, "Group", "Standard Group schema; this service returns no Groups and does not support Group writes.", [
      attribute("displayName", "Human-readable Group name.", { required: true }),
      attribute("members", "Group members.", { type: "complex", multiValued: true, subAttributes: [
        attribute("value", "Member identifier.", { mutability: "immutable" }),
        attribute("$ref", "Member resource URI.", { type: "reference", mutability: "immutable", referenceTypes: ["User", "Group"] }),
        attribute("type", "Member resource type.", { mutability: "immutable", canonicalValues: ["User", "Group"] }),
        attribute("display", "Human-readable member name.", { mutability: "readOnly" }),
      ] }),
    ]),
  ];
}

export function schemaById(id: string): ScimOutcome<SchemaDescriptor> {
  const value = schemas().find((item) => item.id === id);
  return value ? { ok: true, value } : scimFailure("notFound");
}

export function resourceTypes(): ResourceTypeDescriptor[] {
  return [
    { schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"], id: "User", name: "User", endpoint: "/Users",
      schema: CORE_USER_URN, schemaExtensions: [{ schema: ENTERPRISE_USER_URN, required: false }],
      meta: { resourceType: "ResourceType", location: "/scim/v2/ResourceTypes/User" } },
    { schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"], id: "Group", name: "Group", endpoint: "/Groups",
      schema: GROUP_URN, meta: { resourceType: "ResourceType", location: "/scim/v2/ResourceTypes/Group" } },
  ];
}

export function resourceTypeById(id: string): ScimOutcome<ResourceTypeDescriptor> {
  const value = resourceTypes().find((item) => item.id === id);
  return value ? { ok: true, value } : scimFailure("notFound");
}

export function emptyGroupList() {
  return { schemas: [LIST_RESPONSE_URN], totalResults: 0, startIndex: 1, itemsPerPage: 0, Resources: [] };
}

export function groupResource() { return scimFailure("notFound"); }

/** Shared by all eight collection/resource POST/PUT/PATCH/DELETE handlers after source policy and throttling. */
export function groupWrite() { return scimFailure("groupWrite"); }
