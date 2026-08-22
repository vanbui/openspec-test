import { cookies } from "next/headers";

import { AccessDeniedState } from "@/components/states/access-denied-state";
import { UnavailableState } from "@/components/states/unavailable-state";
import { resolveRouteAccess } from "@/domain/route-access";
import { RequestDetails, type RequestDetailRecord } from "@/features/requests/request-details";
import { saveDraft, submitRequest, withdrawRequest } from "@/features/requests/request-actions";
import { resolveCurrentActor } from "@/features/requests/resolve-request-actor";
import { getAccessibleRequest, listInformationAssets, listInformationSystems } from "@/lib/api/csrm-service";
import { developmentFixtureCookieName, resolveDevelopmentIdentity } from "@/lib/fixtures/resolve-identity";

function catalogueOptions(value: unknown): { documentId: string; name: string }[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { data?: unknown[] }).data)) return [];
  return (value as { data: unknown[] }).data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { documentId?: unknown; name?: unknown };
    return typeof record.documentId === "string" && typeof record.name === "string" ? [{ documentId: record.documentId, name: record.name }] : [];
  });
}

export default async function RequestDetailsPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const cookieStore = await cookies();
  const identity = resolveDevelopmentIdentity({ cookieValue: cookieStore.get(developmentFixtureCookieName)?.value });
  const actor = await resolveCurrentActor();
  const routeAccess = await resolveRouteAccess(`/requests/${requestId}`, identity?.capabilities ?? []);

  if (routeAccess.kind === "unavailable" || !actor) return <UnavailableState />;
  if (routeAccess.kind === "forbidden") return <AccessDeniedState />;
  const detail = await getAccessibleRequest(actor.email, requestId);
  if (!detail || !detail.ok) {
    // Strapi deliberately makes unknown and non-owned records indistinguishable.
    return detail?.error.kind === "http" && detail.error.status === 404 ? <AccessDeniedState /> : <UnavailableState />;
  }

  const [systems, assets] = await Promise.all([listInformationSystems(actor.email), listInformationAssets(actor.email)]);
  const actorKind = identity?.capabilities.includes("function.risk_assessment_requests.requests") ? "analyst" : "owner";
  return <RequestDetails actorKind={actorKind} initialCatalogue={{ informationSystems: systems.ok ? catalogueOptions(systems.data) : [], informationAssets: assets.ok ? catalogueOptions(assets.data) : [] }} request={detail.data.data as RequestDetailRecord} saveDraftAction={saveDraft} submitRequestAction={submitRequest} withdrawRequestAction={withdrawRequest} />;
}
