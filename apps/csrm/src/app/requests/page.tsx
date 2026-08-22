import { cookies } from "next/headers";
import Link from "next/link";

import { AccessDeniedState } from "@/components/states/access-denied-state";
import { UnavailableState } from "@/components/states/unavailable-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { resolveRouteAccess } from "@/domain/route-access";
import { RequestList, type RequestListFilters, type RequestListRecord } from "@/features/requests/request-list";
import { resolveCurrentActor } from "@/features/requests/resolve-request-actor";
import { listOwnedRequests } from "@/lib/api/csrm-service";
import { developmentFixtureCookieName, resolveDevelopmentIdentity } from "@/lib/fixtures/resolve-identity";

type SearchParams = Record<string, string | string[] | undefined>;

const requestStatuses = [
  "draft",
  "submitted",
  "questionnaire-in-progress",
  "risk-assessment-drafted",
  "under-review",
  "approved",
  "closed",
] as const;
const requestSortValues = ["updated-desc", "updated-asc", "title-asc"] as const;

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function filtersFrom(searchParams: SearchParams): RequestListFilters {
  const q = one(searchParams.q)?.trim().slice(0, 120) ?? "";
  const status = one(searchParams.status);
  const sort = one(searchParams.sort);
  const page = Number.parseInt(one(searchParams.page) ?? "1", 10);
  return {
    q,
    status: status && requestStatuses.includes(status as (typeof requestStatuses)[number]) ? status : "",
    sort: requestSortValues.includes(sort as RequestListFilters["sort"]) ? sort as RequestListFilters["sort"] : "updated-desc",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

function listTotal(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const pagination = (value as { meta?: { pagination?: { total?: unknown } } }).meta?.pagination;
  return typeof pagination?.total === "number" && pagination.total >= 0 ? pagination.total : 0;
}

function records(value: unknown): RequestListRecord[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { data?: unknown[] }).data)) return [];
  return (value as { data: unknown[] }).data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const request = item as Partial<RequestListRecord>;
    return typeof request.documentId === "string" && typeof request.requestNumber === "string" && typeof request.requestStatus === "string"
      ? [{ documentId: request.documentId, requestNumber: request.requestNumber, requestStatus: request.requestStatus, title: typeof request.title === "string" ? request.title : null, assessmentType: typeof request.assessmentType === "string" ? request.assessmentType : null, updatedAt: typeof request.updatedAt === "string" ? request.updatedAt : null }]
      : [];
  });
}

export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [query, actor, cookieStore] = await Promise.all([searchParams, resolveCurrentActor(), cookies()]);
  const identity = resolveDevelopmentIdentity({ cookieValue: cookieStore.get(developmentFixtureCookieName)?.value });
  const routeAccess = await resolveRouteAccess("/requests", identity?.capabilities ?? []);
  if (routeAccess.kind === "unavailable" || !actor) return <UnavailableState />;
  if (routeAccess.kind === "forbidden") return <AccessDeniedState />;

  const filters = filtersFrom(query);
  const response = await listOwnedRequests(actor.email, { keyword: filters.q || undefined, status: filters.status || undefined, page: filters.page, sort: filters.sort });
  const canCreateRequest = identity?.capabilities.includes("function.risk_assessment_requests.new_request") ?? false;
  return <><PageHeader action={canCreateRequest ? <Button asChild><Link href="/requests/new">New request</Link></Button> : undefined} description="Find and review your cyber risk assessment requests." title="My Requests" /><RequestList canCreateRequest={canCreateRequest} failed={!response.ok} filters={filters} key={`${filters.q}:${filters.status}:${filters.sort}:${filters.page}`} requests={response.ok ? records(response.data) : []} total={response.ok ? listTotal(response.data) : 0} /></>;
}
