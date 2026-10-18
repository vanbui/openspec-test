import type { Core } from "@strapi/strapi";
import { createScimHandlers } from "./handlers";

type Handler = keyof ReturnType<typeof createScimHandlers>;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
function route(method: Method, path: string, handler: Handler) {
  return Object.freeze({ method, path, handler, config: Object.freeze({ auth: false as const,
    policies: [{ name: "global::scim-source-bearer", config: { operation: `${method}:/scim/v2${path.replace(":id", "{id}")}` } }],
  }) });
}

/** Public manifest for runtime inventory; grant URLs preserve the catalogue's literal {id} templates. */
export const SCIM_ROUTES = Object.freeze([
  route("GET", "/Users", "listUsers"), route("POST", "/Users", "createUser"),
  route("GET", "/Users/:id", "readUser"), route("PUT", "/Users/:id", "replaceUser"),
  route("PATCH", "/Users/:id", "patchUser"), route("DELETE", "/Users/:id", "deleteUser"),
  route("GET", "/ServiceProviderConfig", "serviceProviderConfig"),
  route("GET", "/Schemas", "schemas"), route("GET", "/Schemas/:id", "schema"),
  route("GET", "/ResourceTypes", "resourceTypes"), route("GET", "/ResourceTypes/:id", "resourceType"),
  route("GET", "/Groups", "listGroups"), route("GET", "/Groups/:id", "readGroup"),
  ...(["/Groups", "/Groups/:id"] as const).flatMap(path =>
    (["POST", "PUT", "PATCH", "DELETE"] as const).map(method => route(method, path, "writeGroup"))),
]);
const mounted = new WeakSet<Core.Strapi>();

/** Bootstrap registers on Strapi's root manager; a routing type would move this under /api. */
export function registerScimRoutes(strapi: Core.Strapi): void {
  if (mounted.has(strapi)) return;
  const handlers = createScimHandlers(strapi);
  const rootRoutes = { prefix: "/scim/v2", routes: SCIM_ROUTES.map(route => ({
    ...route, handler: handlers[route.handler],
    config: { auth: false, policies: route.config.policies.map(policy => ({ ...policy, config: { ...policy.config } })) },
  })) };
  // Installed declarations require a routing type, while the root runtime explicitly accepts its omission.
  strapi.server.routes(rootRoutes as unknown as Parameters<Core.Strapi["server"]["routes"]>[0]);
  mounted.add(strapi);
}
