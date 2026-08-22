"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { CatalogueMultiSelect, type CatalogueOption } from "./catalogue-multi-select";
import {
  initialRequestActionState,
  type RequestActionState,
  type RequestFieldId,
  type RequestFormValues,
} from "./request-form-state";
import { RequestConfirmationDialog, RequestFormField, RequestFormSection } from "@/components/ui/request-form-primitives";

type RequestFormProps = {
  requestId?: string;
  initialValues?: RequestFormValues;
  initialCatalogue: {
    informationSystems: readonly CatalogueOption[];
    informationAssets: readonly CatalogueOption[];
  };
  saveDraftAction: (requestId: string | undefined, previousState: RequestActionState, formData: FormData) => Promise<RequestActionState>;
  submitRequestAction: (requestId: string, previousState: RequestActionState, formData: FormData) => Promise<RequestActionState>;
};

const inputClassName = "min-h-11 w-full rounded-[var(--radius-card)] border border-border-subtle bg-surface px-md text-body text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

function formDataFor(values: RequestFormValues): FormData {
  const formData = new FormData();
  for (const [field, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => formData.append(field, item));
    else formData.set(field, value);
  }
  return formData;
}

function submitValidation(values: RequestFormValues): Partial<Record<RequestFieldId, string>> {
  const errors: Partial<Record<RequestFieldId, string>> = {};
  if (!values.title) errors.title = "Enter a request title.";
  if (!values.description) errors.description = "Enter a request description.";
  if (!values.assessmentType) errors.assessmentType = "Choose an assessment type.";
  if (!values.businessPurpose) errors.businessPurpose = "Enter the business purpose.";
  if (!values.businessCriticality) errors.businessCriticality = "Choose the business criticality.";
  if (!values.thirdPartyInvolvement) errors.thirdPartyInvolvement = "Select whether a third party is involved.";
  if (values.thirdPartyInvolvement === "true" && !values.thirdPartyDetails) errors.thirdPartyDetails = "Enter the third-party details.";
  return errors;
}

export function RequestForm({ requestId, initialValues = initialRequestActionState.values, initialCatalogue, saveDraftAction, submitRequestAction }: RequestFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<RequestFormValues>(initialValues);
  const [savedValues, setSavedValues] = useState<RequestFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<RequestFieldId, string>>>({});
  const [announcement, setAnnouncement] = useState<string>();
  const [savePending, startSaveTransition] = useTransition();
  const [submitPending, startSubmitTransition] = useTransition();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string>();
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(savedValues), [savedValues, values]);

  useEffect(() => {
    if (Object.keys(errors).length) errorSummaryRef.current?.focus();
  }, [errors]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const interceptNavigation = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.href === window.location.href) return;
      event.preventDefault();
      setPendingHref(anchor.href);
      setDiscardOpen(true);
    };
    const interceptBack = () => setDiscardOpen(true);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", interceptNavigation, true);
    window.addEventListener("popstate", interceptBack);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", interceptNavigation, true);
      window.removeEventListener("popstate", interceptBack);
    };
  }, [dirty]);

  function update<Field extends keyof RequestFormValues>(field: Field, value: RequestFormValues[Field]) {
    setValues((current) => ({
      ...current,
      [field]: value,
      ...(field === "thirdPartyInvolvement" && value === "false" ? { thirdPartyDetails: "" } : {}),
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function acceptResult(result: RequestActionState, redirect = true) {
    setValues(result.values);
    if (result.status === "error") {
      setErrors(result.fieldErrors);
      setAnnouncement(result.formError);
      return;
    }
    setErrors({});
    setSavedValues(result.values);
    setAnnouncement(result.announcement);
    if (redirect && result.redirectTo) router.replace(result.redirectTo);
  }

  function onSaveDraft() {
    if (!values.title.trim()) {
      setErrors({ title: "Enter a request title to save a draft." });
      return;
    }
    startSaveTransition(async () => acceptResult(await saveDraftAction(requestId, initialRequestActionState, formDataFor(values))));
  }

  function onBeginSubmit() {
    const fieldErrors = submitValidation(values);
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitOpen(true);
  }

  function onConfirmSubmit() {
    startSubmitTransition(async () => {
      let effectiveRequestId = requestId;
      if (!effectiveRequestId) {
        const draft = await saveDraftAction(undefined, initialRequestActionState, formDataFor(values));
        if (draft.status === "error" || !draft.redirectTo) {
          acceptResult(draft, false);
          setSubmitOpen(false);
          return;
        }
        effectiveRequestId = draft.redirectTo.split("/").at(-1);
      }
      if (!effectiveRequestId) return;
      const submitted = await submitRequestAction(effectiveRequestId, initialRequestActionState, formDataFor(values));
      acceptResult(submitted, false);
      setSubmitOpen(false);
      if (submitted.status === "success" && !requestId) router.replace(`/requests/${effectiveRequestId}`);
    });
  }

  function discardChanges() {
    setSavedValues(values);
    setDiscardOpen(false);
    if (pendingHref) router.replace(pendingHref);
  }

  const fieldProps = (field: RequestFieldId) => ({
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
    "aria-invalid": Boolean(errors[field]),
    id: field,
  });

  return (
    <div className="max-w-[672px]">
      <PageHeader breadcrumbs={[{ href: "/requests", label: "Risk Assessment Requests" }, { label: "New request" }]} title="New risk assessment request" />
      <form className="mt-2xl space-y-xl" noValidate onSubmit={(event) => { event.preventDefault(); onBeginSubmit(); }}>
        {Object.keys(errors).length ? (
          <div aria-labelledby="request-error-summary-heading" className="rounded-[var(--radius-card)] border border-destructive bg-surface p-lg" ref={errorSummaryRef} role="alert" tabIndex={-1}>
            <h2 className="text-heading font-semibold text-foreground" id="request-error-summary-heading">Check the highlighted fields</h2>
            <ul className="mt-sm list-disc pl-lg text-body text-foreground">
              {Object.entries(errors).map(([field, error]) => error ? <li key={field}><a className="underline" href={`#${field}`}>{error}</a></li> : null)}
            </ul>
          </div>
        ) : null}
        {announcement ? <p aria-live="polite" className="text-body text-muted-foreground" role="status">{announcement}</p> : null}

        <RequestFormSection title="Request details">
          <RequestFormField error={errors.title} id="title" label="Request title">
            <input {...fieldProps("title")} className={inputClassName} name="title" onChange={(event) => update("title", event.target.value)} value={values.title} />
          </RequestFormField>
          <RequestFormField error={errors.description} id="description" label="Request description">
            <textarea {...fieldProps("description")} className={`${inputClassName} min-h-28 py-sm`} name="description" onChange={(event) => update("description", event.target.value)} value={values.description} />
          </RequestFormField>
          <RequestFormField error={errors.assessmentType} id="assessmentType" label="Assessment type">
            <select {...fieldProps("assessmentType")} className={inputClassName} name="assessmentType" onChange={(event) => update("assessmentType", event.target.value as RequestFormValues["assessmentType"])} value={values.assessmentType}>
              <option value="">Select assessment type</option><option value="BAU">BAU</option><option value="Project">Project</option><option value="Other">Other</option>
            </select>
          </RequestFormField>
        </RequestFormSection>

        <RequestFormSection title="Business context">
          <div className="grid gap-lg md:grid-cols-2">
            <RequestFormField id="division" label="Division"><input {...fieldProps("division")} className={inputClassName} name="division" onChange={(event) => update("division", event.target.value)} value={values.division} /></RequestFormField>
            <RequestFormField id="businessUnit" label="Business unit"><input {...fieldProps("businessUnit")} className={inputClassName} name="businessUnit" onChange={(event) => update("businessUnit", event.target.value)} value={values.businessUnit} /></RequestFormField>
            <RequestFormField error={errors.businessCriticality} id="businessCriticality" label="Business criticality"><select {...fieldProps("businessCriticality")} className={inputClassName} name="businessCriticality" onChange={(event) => update("businessCriticality", event.target.value as RequestFormValues["businessCriticality"])} value={values.businessCriticality}><option value="">Select business criticality</option><option value="Low">Low</option><option value="Moderate">Moderate</option><option value="High">High</option><option value="Critical">Critical</option></select></RequestFormField>
            <RequestFormField id="dueDate" label="Requested due date"><input {...fieldProps("dueDate")} className={inputClassName} name="dueDate" onChange={(event) => update("dueDate", event.target.value)} type="date" value={values.dueDate} /></RequestFormField>
          </div>
          <RequestFormField error={errors.businessPurpose} id="businessPurpose" label="Business purpose"><textarea {...fieldProps("businessPurpose")} className={`${inputClassName} min-h-28 py-sm`} name="businessPurpose" onChange={(event) => update("businessPurpose", event.target.value)} value={values.businessPurpose} /></RequestFormField>
        </RequestFormSection>

        <RequestFormSection title="Third-party and regulatory context">
          <fieldset aria-describedby={errors.thirdPartyInvolvement ? "thirdPartyInvolvement-error" : undefined} aria-invalid={Boolean(errors.thirdPartyInvolvement)}>
            <legend className="text-label font-semibold text-foreground">Is a third party involved?</legend>
            <div className="mt-sm flex gap-lg">
              {[["true", "Yes"], ["false", "No"]].map(([value, label]) => <label className="flex min-h-11 items-center gap-sm text-body text-foreground" key={value}><input checked={values.thirdPartyInvolvement === value} name="thirdPartyInvolvement" onChange={() => update("thirdPartyInvolvement", value as RequestFormValues["thirdPartyInvolvement"])} type="radio" value={value} />{label}</label>)}
            </div>
            {errors.thirdPartyInvolvement ? <p className="mt-xs text-label font-medium text-destructive" id="thirdPartyInvolvement-error">{errors.thirdPartyInvolvement} Required</p> : null}
          </fieldset>
          {values.thirdPartyInvolvement === "true" ? <RequestFormField error={errors.thirdPartyDetails} id="thirdPartyDetails" label="Third-party details"><textarea {...fieldProps("thirdPartyDetails")} className={`${inputClassName} min-h-28 py-sm`} name="thirdPartyDetails" onChange={(event) => update("thirdPartyDetails", event.target.value)} value={values.thirdPartyDetails} /></RequestFormField> : null}
          <RequestFormField id="regulatoryRequirements" label="Regulatory requirements"><textarea {...fieldProps("regulatoryRequirements")} className={`${inputClassName} min-h-28 py-sm`} name="regulatoryRequirements" onChange={(event) => update("regulatoryRequirements", event.target.value)} value={values.regulatoryRequirements} /></RequestFormField>
        </RequestFormSection>

        <RequestFormSection title="Related CSRM catalogue records">
          <CatalogueMultiSelect emptyMessage="No Information Systems found" label="Information systems" onChange={(selected) => update("informationSystems", selected)} options={initialCatalogue.informationSystems} selected={values.informationSystems} />
          <CatalogueMultiSelect emptyMessage="No Information Assets found" label="Information assets" onChange={(selected) => update("informationAssets", selected)} options={initialCatalogue.informationAssets} selected={values.informationAssets} />
          {values.informationSystems.map((id) => <input key={`system-${id}`} name="informationSystems" type="hidden" value={id} />)}
          {values.informationAssets.map((id) => <input key={`asset-${id}`} name="informationAssets" type="hidden" value={id} />)}
        </RequestFormSection>

        <div className="flex flex-col gap-sm sm:flex-row">
          <Button disabled={savePending} onClick={onSaveDraft} type="button">{savePending ? "Saving draft…" : "Save draft"}</Button>
          <Button disabled={submitPending} onClick={onBeginSubmit} type="button" variant="secondary">{submitPending ? "Submitting request…" : "Submit request"}</Button>
        </div>
      </form>
      <RequestConfirmationDialog cancelLabel="Keep editing" confirmLabel="Submit request" description="Once submitted, your request will be available for Security Analyst review. You can withdraw it only until processing begins." onConfirm={onConfirmSubmit} onOpenChange={setSubmitOpen} open={submitOpen} pending={submitPending} title="Submit risk assessment request?" />
      <RequestConfirmationDialog cancelLabel="Keep editing" confirmLabel="Discard changes" confirmVariant="destructive" description="Your changes have not been saved. Do you want to keep editing or discard them?" onConfirm={discardChanges} onOpenChange={setDiscardOpen} open={discardOpen} title="Discard unsaved changes?" />
    </div>
  );
}
