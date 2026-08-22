import "server-only";

import type { ServiceResult } from "@/domain/service-result";
import { createApiClient } from "@/lib/api/client";
import type { paths } from "@/lib/api/generated/openapi";

type JsonResponse<Path extends keyof paths, Method extends keyof paths[Path]> =
  paths[Path][Method] extends { responses: infer Responses }
    ? Responses extends Record<200, { content: { "application/json": infer Response } }>
      ? Response
      : never
    : never;
type JsonBody<Path extends keyof paths, Method extends keyof paths[Path]> =
  paths[Path][Method] extends { requestBody?: { content: { "application/json": infer Body } } }
    ? Body
    : never;

export type RequestCollectionResponse = JsonResponse<"/csrm-assessment-requests", "get">;
export type RequestResponse = JsonResponse<"/csrm-assessment-requests/{id}", "get">;
export type RequestDashboardResponse = JsonResponse<"/csrm-assessment-requests/dashboard", "get">;
export type InformationSystemCollectionResponse = JsonResponse<"/csrm-information-systems", "get">;
export type InformationAssetCollectionResponse = JsonResponse<"/csrm-information-assets", "get">;
type CreateRequestData = JsonBody<"/csrm-assessment-requests", "post">["data"];
type SaveRequestData = JsonBody<"/csrm-assessment-requests/{id}", "put">["data"];
export type CreateDraftInput = Pick<CreateRequestData, "title">;
export type SaveDraftInput = Pick<
  SaveRequestData,
  | "title"
  | "description"
  | "assessmentType"
  | "division"
  | "businessUnit"
  | "businessPurpose"
  | "businessCriticality"
  | "thirdPartyInvolvement"
  | "thirdPartyDetails"
  | "regulatoryRequirements"
  | "dueDate"
  | "informationAssets"
  | "informationSystems"
>;

export type RequestListInput = {
  keyword?: string;
  status?: string;
  page?: number;
};

const catalogueResultBound = 25;
const requestPageSize = 25;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDocument(value: unknown): value is Record<string, unknown> {
  return isObject(value) && typeof value.documentId === "string";
}

function isCollection(value: unknown): value is { data: unknown[] } {
  return isObject(value) && Array.isArray(value.data) && value.data.every(isDocument);
}

function isRequestResponse(value: unknown): value is RequestResponse {
  return isObject(value) && isDocument(value.data) && typeof value.data.requestStatus === "string";
}

function isDashboardResponse(value: unknown): value is RequestDashboardResponse {
  if (!isObject(value) || !isObject(value.data)) return false;
  const { statusCounts, needsAttention, recentSubmissions, notices } = value.data;
  return (
    isObject(statusCounts) &&
    Array.isArray(needsAttention) && needsAttention.every(isDocument) &&
    Array.isArray(recentSubmissions) && recentSubmissions.every(isDocument) &&
    Array.isArray(notices)
  );
}

function encodeQuery(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function actorClient(actorEmail: string) {
  return createApiClient({ actorEmail: actorEmail.trim().toLowerCase() });
}

/** The Phase 6 display tracer remains available for the application shell. */
export type ApplicationCollectionResponse = paths["/applications"]["get"]["responses"][200]["content"]["application/json"];
export async function listApplications(actorEmail: string): Promise<ServiceResult<ApplicationCollectionResponse>> {
  return actorClient(actorEmail).request({
    method: "GET",
    path: "/applications",
    isValid: isCollection as (value: unknown) => value is ApplicationCollectionResponse,
  });
}

export async function listOwnedRequests(
  actorEmail: string,
  input: RequestListInput = {},
): Promise<ServiceResult<RequestCollectionResponse>> {
  return actorClient(actorEmail).request({
    method: "GET",
    path: `/csrm-assessment-requests${encodeQuery({
      _q: input.keyword,
      "filters[requestStatus][$eq]": input.status,
      "pagination[page]": input.page ?? 1,
      "pagination[pageSize]": requestPageSize,
    })}`,
    isValid: isCollection as (value: unknown) => value is RequestCollectionResponse,
  });
}

export async function createDraft(actorEmail: string, data: CreateDraftInput): Promise<ServiceResult<RequestResponse>> {
  return actorClient(actorEmail).request({
    method: "POST",
    path: "/csrm-assessment-requests",
    body: { data },
    isValid: isRequestResponse,
    isWrite: true,
  });
}

export async function getAccessibleRequest(actorEmail: string, id: string): Promise<ServiceResult<RequestResponse>> {
  return actorClient(actorEmail).request({
    method: "GET",
    path: `/csrm-assessment-requests/${encodeURIComponent(id)}`,
    isValid: isRequestResponse,
  });
}

export async function saveDraft(actorEmail: string, id: string, data: SaveDraftInput): Promise<ServiceResult<RequestResponse>> {
  return actorClient(actorEmail).request({
    method: "PUT",
    path: `/csrm-assessment-requests/${encodeURIComponent(id)}`,
    body: { data },
    isValid: isRequestResponse,
    isWrite: true,
  });
}

export async function getRequestorDashboard(actorEmail: string): Promise<ServiceResult<RequestDashboardResponse>> {
  return actorClient(actorEmail).request({
    method: "GET",
    path: "/csrm-assessment-requests/dashboard",
    isValid: isDashboardResponse,
  });
}

export async function submitRequest(actorEmail: string, id: string): Promise<ServiceResult<RequestResponse>> {
  return actorClient(actorEmail).request({
    method: "POST",
    path: `/csrm-assessment-requests/${encodeURIComponent(id)}/submit`,
    body: { data: {} },
    isValid: isRequestResponse,
    isWrite: true,
  });
}

export async function withdrawRequest(actorEmail: string, id: string): Promise<ServiceResult<RequestResponse>> {
  return actorClient(actorEmail).request({
    method: "POST",
    path: `/csrm-assessment-requests/${encodeURIComponent(id)}/withdraw`,
    body: { data: {} },
    isValid: isRequestResponse,
    isWrite: true,
  });
}

function cataloguePath(path: string, search: string): string {
  return `${path}${encodeQuery({ _q: search, "pagination[pageSize]": catalogueResultBound })}`;
}

export async function listInformationSystems(actorEmail: string, search = ""): Promise<ServiceResult<InformationSystemCollectionResponse>> {
  return actorClient(actorEmail).request({
    method: "GET",
    path: cataloguePath("/csrm-information-systems", search),
    isValid: isCollection as (value: unknown) => value is InformationSystemCollectionResponse,
  });
}

export async function listInformationAssets(actorEmail: string, search = ""): Promise<ServiceResult<InformationAssetCollectionResponse>> {
  return actorClient(actorEmail).request({
    method: "GET",
    path: cataloguePath("/csrm-information-assets", search),
    isValid: isCollection as (value: unknown) => value is InformationAssetCollectionResponse,
  });
}
