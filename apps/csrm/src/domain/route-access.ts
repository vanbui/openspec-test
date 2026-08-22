import type { CapabilityId } from "@/config/capabilities";
import { routeDefinitions, type RouteDefinition } from "@/config/routes";

/**
 * A UI-only preflight result. It intentionally contains no protected service
 * response or record metadata; Strapi remains the authorization authority.
 */
export type RouteAccess =
  | { kind: "allowed"; route: RouteDefinition }
  | { kind: "forbidden"; route: RouteDefinition }
  | { kind: "unavailable" };

function routeForPathname(pathname: string): RouteDefinition | undefined {
  const pathSegments = pathname.split("/").filter(Boolean);

  return routeDefinitions.find((route) => {
    const routeSegments = route.href.split("/").filter(Boolean);
    if (routeSegments.length !== pathSegments.length) return false;

    return routeSegments.every((segment, index) => {
      const isDynamicSegment = segment.startsWith("[") && segment.endsWith("]");
      return isDynamicSegment ? pathSegments[index].length > 0 : segment === pathSegments[index];
    });
  });
}

function classifyRouteAccess(
  pathname: string,
  capabilities: readonly CapabilityId[],
): RouteAccess {
  const route = routeForPathname(pathname);

  if (!route || route.status === "planned") {
    return { kind: "unavailable" };
  }

  if (!capabilities.includes(route.capability)) {
    return { kind: "forbidden", route };
  }

  return { kind: "allowed", route };
}

/**
 * Classifies a direct route before invoking protected work. This is a display
 * guard only; backend FunctionApi and record-level enforcement remains owned by
 * Phase 13 and must still protect every service operation.
 */
export async function resolveRouteAccess(
  pathname: string,
  capabilities: readonly CapabilityId[],
  beforeProtectedLoad?: () => void | Promise<void>,
): Promise<RouteAccess> {
  const routeAccess = classifyRouteAccess(pathname, capabilities);

  if (routeAccess.kind === "allowed") {
    await beforeProtectedLoad?.();
  }

  return routeAccess;
}
