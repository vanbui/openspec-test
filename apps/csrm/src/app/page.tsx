import { cookies } from "next/headers";
import Link from "next/link";

import { AccessDeniedState } from "@/components/states/access-denied-state";
import { ErrorState } from "@/components/states/error-state";
import { UnavailableState } from "@/components/states/unavailable-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { resolveRouteAccess } from "@/domain/route-access";
import { RequestDashboard, type RequestDashboardModel } from "@/features/requests/request-dashboard";
import { resolveCurrentActor } from "@/features/requests/resolve-request-actor";
import { getRequestorDashboard } from "@/lib/api/csrm-service";
import { developmentFixtureCookieName, resolveDevelopmentIdentity } from "@/lib/fixtures/resolve-identity";

function dashboardModel(value: unknown): RequestDashboardModel {
  if (!value || typeof value !== "object" || !value || typeof (value as { data?: unknown }).data !== "object") {
    return { statusCounts: {}, needsAttention: [], recentSubmissions: [], notices: [] };
  }
  const data = (value as { data: Record<string, unknown> }).data;
  const requestRows = (candidate: unknown) => Array.isArray(candidate) ? candidate.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const request = item as Record<string, unknown>;
    return typeof request.documentId === "string" && typeof request.requestNumber === "string" && typeof request.requestStatus === "string"
      ? [{ documentId: request.documentId, requestNumber: request.requestNumber, requestStatus: request.requestStatus, title: typeof request.title === "string" ? request.title : null, submittedDate: typeof request.submittedDate === "string" ? request.submittedDate : null }]
      : [];
  }) : [];
  const statusCounts = data.statusCounts && typeof data.statusCounts === "object" && !Array.isArray(data.statusCounts)
    ? Object.fromEntries(Object.entries(data.statusCounts).flatMap(([status, count]) => typeof count === "number" && count >= 0 ? [[status, count]] : []))
    : {};
  const notices = Array.isArray(data.notices) ? data.notices.flatMap((notice) => notice && typeof notice === "object" && typeof (notice as { message?: unknown }).message === "string" ? [{ message: (notice as { message: string }).message }] : []) : [];
  return { statusCounts, needsAttention: requestRows(data.needsAttention), recentSubmissions: requestRows(data.recentSubmissions), notices };
}

export default async function HomePage() {
  const [actor, cookieStore] = await Promise.all([resolveCurrentActor(), cookies()]);
  const identity = resolveDevelopmentIdentity({ cookieValue: cookieStore.get(developmentFixtureCookieName)?.value });
  const routeAccess = await resolveRouteAccess("/", identity?.capabilities ?? []);
  if (routeAccess.kind === "unavailable" || !actor) return <UnavailableState />;
  if (routeAccess.kind === "forbidden") return <AccessDeniedState />;

  const response = await getRequestorDashboard(actor.email);
  const canCreateRequest = identity?.capabilities.includes("function.risk_assessment_requests.new_request") ?? false;
  return <><PageHeader action={canCreateRequest ? <Button asChild><Link href="/requests/new">New request</Link></Button> : undefined} description="Review your current cyber risk assessment request work." title="Dashboard" />{response.ok ? <RequestDashboard dashboard={dashboardModel(response.data)} /> : <div className="mt-2xl"><ErrorState /></div>}</>;
}
