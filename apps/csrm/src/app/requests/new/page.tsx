import { cookies } from "next/headers";

import { UnavailableState } from "@/components/states/unavailable-state";
import { RequestForm } from "@/features/requests/request-form";
import { saveDraft, submitRequest } from "@/features/requests/request-actions";
import { resolveCurrentActor } from "@/features/requests/resolve-request-actor";
import { listInformationAssets, listInformationSystems } from "@/lib/api/csrm-service";
import { developmentFixtureCookieName, resolveDevelopmentIdentity } from "@/lib/fixtures/resolve-identity";

function catalogueOptions(value: unknown): { documentId: string; name: string }[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { data?: unknown[] }).data)) return [];
  return (value as { data: unknown[] }).data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { documentId?: unknown; name?: unknown };
    return typeof record.documentId === "string" && typeof record.name === "string" ? [{ documentId: record.documentId, name: record.name }] : [];
  });
}

export default async function NewRequestPage() {
  const actor = await resolveCurrentActor();
  const cookieStore = await cookies();
  const identity = resolveDevelopmentIdentity({
    cookieValue: cookieStore.get(developmentFixtureCookieName)?.value,
  });
  const canCreateRequest = identity?.capabilities.includes("function.risk_assessment_requests.new_request") ?? false;
  if (!actor || !canCreateRequest) return <UnavailableState />;

  const [systems, assets] = await Promise.all([
    listInformationSystems(actor.email),
    listInformationAssets(actor.email),
  ]);

  return (
    <RequestForm
      initialCatalogue={{
        informationSystems: systems.ok ? catalogueOptions(systems.data) : [],
        informationAssets: assets.ok ? catalogueOptions(assets.data) : [],
      }}
      saveDraftAction={saveDraft}
      submitRequestAction={submitRequest}
    />
  );
}
