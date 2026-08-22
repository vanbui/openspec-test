"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { OptionalValue } from "@/components/states/optional-value";
import { Button } from "@/components/ui/button";
import { RequestConfirmationDialog } from "@/components/ui/request-form-primitives";

import type { CatalogueOption } from "./catalogue-multi-select";
import { RequestForm } from "./request-form";
import type { RequestActionState, RequestFormValues } from "./request-form-state";

export type RequestDetailRecord = {
  documentId: string;
  requestNumber?: string | null;
  title: string;
  description?: string | null;
  assessmentType?: string | null;
  division?: string | null;
  businessUnit?: string | null;
  businessPurpose?: string | null;
  businessCriticality?: string | null;
  thirdPartyInvolvement?: boolean | null;
  thirdPartyDetails?: string | null;
  regulatoryRequirements?: string | null;
  dueDate?: string | null;
  requestStatus: string;
  requestor?: { displayName?: string | null } | null;
  informationSystems?: readonly { documentId?: string; name?: string }[] | null;
  informationAssets?: readonly { documentId?: string; name?: string }[] | null;
};

type RequestDetailsProps = {
  request: RequestDetailRecord;
  actorKind: "owner" | "analyst";
  initialCatalogue: { informationSystems: readonly CatalogueOption[]; informationAssets: readonly CatalogueOption[] };
  saveDraftAction: (requestId: string | undefined, previousState: RequestActionState, formData: FormData) => Promise<RequestActionState>;
  submitRequestAction: (requestId: string, previousState: RequestActionState, formData: FormData) => Promise<RequestActionState>;
  withdrawRequestAction: (requestId: string) => Promise<RequestActionState>;
};

const workflowCopy: Readonly<Record<string, string>> = {
  submitted: "Submitted — awaiting Security Analyst review.",
  "questionnaire-in-progress": "Questionnaire in progress — a questionnaire is being prepared.",
  "risk-assessment-drafted": "Risk assessment drafted — a risk assessment draft is being prepared.",
  "under-review": "Under review — a Security Analyst is reviewing this request.",
  approved: "Approved — the request has been approved.",
  closed: "Closed — this request is closed.",
};

function valueForForm(request: RequestDetailRecord): RequestFormValues {
  return {
    title: request.title,
    description: request.description ?? "",
    assessmentType: request.assessmentType === "BAU" || request.assessmentType === "Project" || request.assessmentType === "Other" ? request.assessmentType : "",
    division: request.division ?? "",
    businessUnit: request.businessUnit ?? "",
    businessPurpose: request.businessPurpose ?? "",
    businessCriticality: request.businessCriticality === "Low" || request.businessCriticality === "Moderate" || request.businessCriticality === "High" || request.businessCriticality === "Critical" ? request.businessCriticality : "",
    thirdPartyInvolvement: request.thirdPartyInvolvement === true ? "true" : request.thirdPartyInvolvement === false ? "false" : "",
    thirdPartyDetails: request.thirdPartyDetails ?? "",
    regulatoryRequirements: request.regulatoryRequirements ?? "",
    dueDate: request.dueDate ?? "",
    informationSystems: request.informationSystems?.flatMap((item) => item.documentId ? [item.documentId] : []) ?? [],
    informationAssets: request.informationAssets?.flatMap((item) => item.documentId ? [item.documentId] : []) ?? [],
  };
}

function ReadOnlySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-t border-border-subtle pt-xl first:border-t-0 first:pt-0"><h2 className="text-heading font-semibold text-foreground">{title}</h2><dl className="mt-lg grid gap-lg sm:grid-cols-2">{children}</dl></section>;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return <div className="min-w-0"><dt className="text-label font-semibold text-foreground">{label}</dt><dd className="mt-xs break-words text-body text-foreground"><OptionalValue value={value} /></dd></div>;
}

function relationNames(values: readonly { name?: string }[] | null | undefined) {
  return values?.flatMap((value) => value.name ? [value.name] : []).join(", ") || undefined;
}

export function RequestDetails({ request, actorKind, initialCatalogue, saveDraftAction, submitRequestAction, withdrawRequestAction }: RequestDetailsProps) {
  const [status, setStatus] = useState(request.requestStatus);
  const [announcement, setAnnouncement] = useState<string>();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawPending, startWithdrawTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const workflowRef = useRef<HTMLHeadingElement>(null);
  const values = useMemo(() => valueForForm(request), [request]);
  const canEditDraft = status === "draft";
  const ownerDraft = canEditDraft && actorKind === "owner";
  const analystDraft = canEditDraft && actorKind === "analyst";

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (announcement) workflowRef.current?.focus();
  }, [announcement, status]);

  function withdraw() {
    startWithdrawTransition(async () => {
      const result = await withdrawRequestAction(request.documentId);
      if (result.status !== "success") {
        setAnnouncement(result.formError ?? "We couldn’t save your request. Check your connection and try again.");
        return;
      }
      setStatus("draft");
      setAnnouncement("Request returned to draft.");
      setWithdrawOpen(false);
    });
  }

  return (
    <div className="min-w-0 max-w-[672px]">
      <div ref={(node) => { headingRef.current = node?.querySelector("h1") ?? null; }}><PageHeader breadcrumbs={[{ href: "/requests", label: "Risk Assessment Requests" }, { label: "Request details" }]} title={request.title} titleTabIndex={-1} /></div>
      <p className="mt-sm text-body text-muted-foreground">{request.requestNumber ?? "Request number pending"}</p>
      {analystDraft ? <p className="mt-xl rounded-[var(--radius-card)] border border-border-subtle bg-surface-muted p-md text-body text-foreground" role="alert">You are editing a Requestor draft. The Requestor must review and submit it.</p> : null}
      <section className="mt-xl border-t border-border-subtle pt-xl" aria-labelledby="request-workflow-heading">
        <h2 className="text-heading font-semibold text-foreground" id="request-workflow-heading" ref={workflowRef} tabIndex={-1}>Workflow</h2>
        <p aria-live="polite" className="mt-sm text-body text-muted-foreground" role="status">{announcement ?? (status === "draft" ? "Draft — continue editing or submit when ready." : workflowCopy[status])}</p>
        {status === "submitted" && actorKind === "owner" ? <Button className="mt-lg" onClick={() => setWithdrawOpen(true)} type="button" variant="secondary">Withdraw submission</Button> : null}
      </section>
      {ownerDraft || analystDraft ? <div className="mt-xl"><RequestForm allowSubmit={ownerDraft} initialCatalogue={initialCatalogue} initialValues={values} onSaveSuccess={() => headingRef.current?.focus()} onSubmitSuccess={() => { setStatus("submitted"); setAnnouncement("Request submitted."); }} requestId={request.documentId} saveDraftAction={saveDraftAction} saveLabel={analystDraft ? "Save draft changes" : "Save draft"} showHeader={false} submitRequestAction={submitRequestAction} /></div> : null}
      {!ownerDraft && !analystDraft ? <div className="mt-xl space-y-xl"><ReadOnlySection title="Request details"><Detail label="Request title" value={request.title} /><Detail label="Request description" value={request.description} /><Detail label="Assessment type" value={request.assessmentType} /></ReadOnlySection><ReadOnlySection title="Business context"><Detail label="Division" value={request.division} /><Detail label="Business unit" value={request.businessUnit} /><Detail label="Business purpose" value={request.businessPurpose} /><Detail label="Business criticality" value={request.businessCriticality} /><Detail label="Requested due date" value={request.dueDate} /></ReadOnlySection><ReadOnlySection title="Third-party and regulatory context"><Detail label="Is a third party involved?" value={request.thirdPartyInvolvement} /><Detail label="Third-party details" value={request.thirdPartyDetails} /><Detail label="Regulatory requirements" value={request.regulatoryRequirements} /></ReadOnlySection><ReadOnlySection title="Related CSRM catalogue records"><Detail label="Information systems" value={relationNames(request.informationSystems)} /><Detail label="Information assets" value={relationNames(request.informationAssets)} /></ReadOnlySection></div> : null}
      <RequestConfirmationDialog cancelLabel="Keep submission" confirmLabel="Withdraw submission" confirmVariant="destructive" description="This request will return to draft and will no longer be available for analyst processing." onConfirm={withdraw} onOpenChange={setWithdrawOpen} open={withdrawOpen} pending={withdrawPending} title="Withdraw this submission?" />
    </div>
  );
}
