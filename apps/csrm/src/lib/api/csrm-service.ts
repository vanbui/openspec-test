import "server-only";

import type { paths } from "@/lib/api/generated/openapi";
import { createApiClient } from "@/lib/api/client";
import type { ServiceResult } from "@/domain/service-result";

export type ApplicationCollectionResponse = paths["/applications"]["get"]["responses"][200]["content"]["application/json"];

function isApplicationCollectionResponse(value: unknown): value is ApplicationCollectionResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray(value.data)
  );
}

/**
 * The Phase 6 foundation transport tracer. It is a display/data boundary only;
 * Strapi remains authoritative for authorization and record-level access.
 */
export async function listApplications(): Promise<ServiceResult<ApplicationCollectionResponse>> {
  return createApiClient().get<ApplicationCollectionResponse>(
    "/applications",
    isApplicationCollectionResponse,
  );
}
