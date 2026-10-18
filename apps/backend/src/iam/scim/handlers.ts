import type { Core } from "@strapi/strapi";
import type { ScimBoundaryContext } from "../../middlewares/scim-boundary";
import { createIdentityService } from "../identity/identity-service";
import type { SourceIdentityInput } from "../identity/identity-input";
import { getSourceContext, sourceAuthenticationFailure } from "./source-context";
import { scimFailure, fromIdentityFailure, type ScimFailure, type ScimOutcome } from "./errors";
import { parseCreateUser, parseReplaceUser, scimResponse, LIST_RESPONSE_URN } from "./wire";
import { toScimUser } from "./mapping";
import { parseScimQuery, projectScimUser, toScimListResponse } from "./query";
import { scimPatchRequest } from "./patch";
import { serviceProviderConfig, schemas, schemaById, resourceTypes, resourceTypeById,
  emptyGroupList, groupResource, groupWrite } from "./discovery";

export type ScimContext = ScimBoundaryContext;
function send(context: ScimContext, response: { status: number; headers: Record<string, string>; body?: unknown }): void {
  context.status = response.status;
  context.body = response.body ?? null;
  for (const [name, value] of Object.entries(response.headers)) context.set(name, value);
}
function failed(context: ScimContext, failure: ScimFailure): void { send(context, failure.error); }
function result<T>(context: ScimContext, outcome: ScimOutcome<T>): void {
  if (outcome.ok) send(context, scimResponse(200, outcome.value)); else failed(context, outcome);
}
function collection<T>(items: T[]) {
  return { schemas: [LIST_RESPONSE_URN], totalResults: items.length, startIndex: 1, itemsPerPage: items.length, Resources: items };
}

/** Transport adapters accept only the server-issued source context and the closed wire contracts. */
export function createScimHandlers(strapi: Core.Strapi) {
  const identities = createIdentityService(strapi);
  function user(operation: "list" | "read" | "create" | "replace" | "patch" | "delete") {
    return async (context: ScimContext): Promise<void> => {
      const principal = getSourceContext(strapi, context);
      if (!principal) { failed(context, sourceAuthenticationFailure()); return; }
      if (operation === "list" || operation === "read") {
        // Read raw entries so repeated keys cannot be collapsed by the framework's query parser.
        const query = parseScimQuery(new URLSearchParams(context.querystring));
        if (!query.ok) { failed(context, query); return; }
        if (operation === "list") {
          const outcome = await identities.listForSource(principal, query.value.list);
          if (!outcome.ok) { failed(context, fromIdentityFailure(outcome)); return; }
          send(context, scimResponse(200, toScimListResponse(outcome.value, query.value)));
        } else {
          const outcome = await identities.readForSource(principal, context.params.id);
          if (!outcome.ok) { failed(context, fromIdentityFailure(outcome)); return; }
          send(context, scimResponse(200, projectScimUser(outcome.value, query.value.projection)));
        }
        return;
      }
      if (operation === "delete") {
        const outcome = await identities.deactivateFromSource(principal, context.params.id, true);
        if (!outcome.ok) { failed(context, fromIdentityFailure(outcome)); return; }
        send(context, scimResponse(204)); return;
      }
      if (operation === "patch") {
        const outcome = await identities.patchFromSource(principal, context.params.id, scimPatchRequest(context.request.body));
        if (!outcome.ok) { failed(context, scimFailure(outcome.code)); return; }
        send(context, scimResponse(200, toScimUser(outcome.value))); return;
      }
      let outcome;
      if (operation === "create") {
        const input = parseCreateUser(context.request.body);
        if (!input.ok) { failed(context, input); return; }
        outcome = await identities.createFromSource(principal, input.value);
      } else {
        const input = parseReplaceUser(context.request.body, context.params.id);
        if (!input.ok) { failed(context, input); return; }
        const asserted = input.value;
        // P3-34: merge the asserted attributes with the current source fields under the identity lock.
        // A claim of a manual user has no current key, so the request must assert one.
        outcome = await identities.replaceFromSource(principal, context.params.id, { kind: "replacement", reduce: (current) => {
          const { documentId: _documentId, ...fields } = current;
          const merged = { ...fields, ...asserted };
          return merged.sourceExternalId === undefined ? { ok: false, code: "invalidInput" }
            : { ok: true, value: merged as SourceIdentityInput };
        } });
      }
      if (!outcome.ok) { failed(context, scimFailure(outcome.code)); return; }
      const mapped = toScimUser(outcome.value);
      if (operation === "create") context.set("Location", mapped.meta.location);
      send(context, scimResponse(operation === "create" ? 201 : 200, mapped));
    };
  }
  return {
    listUsers: user("list"), readUser: user("read"), createUser: user("create"), replaceUser: user("replace"),
    patchUser: user("patch"), deleteUser: user("delete"),
    serviceProviderConfig: (context: ScimContext) => send(context, scimResponse(200, serviceProviderConfig())),
    schemas: (context: ScimContext) => send(context, scimResponse(200, collection(schemas()))),
    schema: (context: ScimContext) => result(context, schemaById(context.params.id)),
    resourceTypes: (context: ScimContext) => send(context, scimResponse(200, collection(resourceTypes()))),
    resourceType: (context: ScimContext) => result(context, resourceTypeById(context.params.id)),
    listGroups: (context: ScimContext) => send(context, scimResponse(200, emptyGroupList())),
    readGroup: (context: ScimContext) => failed(context, groupResource()),
    writeGroup: (context: ScimContext) => failed(context, groupWrite()),
  };
}
