"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { SAFE_API_MESSAGES, type SafeApiError, type SafeValidationError } from "@/domain/service-result";
import {
  createDraft,
  saveDraft as saveDraftRequest,
  submitRequest as submitRequestService,
  type SaveDraftInput,
  withdrawRequest as withdrawRequestService,
} from "@/lib/api/csrm-service";

import { resolveCurrentActor } from "./resolve-request-actor";

const editableFieldIds = [
  "title",
  "description",
  "assessmentType",
  "division",
  "businessUnit",
  "businessPurpose",
  "businessCriticality",
  "thirdPartyInvolvement",
  "thirdPartyDetails",
  "regulatoryRequirements",
  "dueDate",
  "informationSystems",
  "informationAssets",
] as const;

export type RequestFieldId = (typeof editableFieldIds)[number];

export type RequestFormValues = {
  title: string;
  description: string;
  assessmentType: "" | "BAU" | "Project" | "Other";
  division: string;
  businessUnit: string;
  businessPurpose: string;
  businessCriticality: "" | "Low" | "Moderate" | "High" | "Critical";
  thirdPartyInvolvement: "" | "true" | "false";
  thirdPartyDetails: string;
  regulatoryRequirements: string;
  dueDate: string;
  informationSystems: string[];
  informationAssets: string[];
};

export type RequestActionState = {
  status: "idle" | "error" | "success";
  values: RequestFormValues;
  fieldErrors: Partial<Record<RequestFieldId, string>>;
  formError?: string;
  focus?: RequestFieldId;
  announcement?: "Draft saved." | "Request submitted." | "Request returned to draft.";
  revalidate?: readonly string[];
  redirectTo?: string;
};

export const initialRequestActionState: RequestActionState = {
  status: "idle",
  values: {
    title: "",
    description: "",
    assessmentType: "",
    division: "",
    businessUnit: "",
    businessPurpose: "",
    businessCriticality: "",
    thirdPartyInvolvement: "",
    thirdPartyDetails: "",
    regulatoryRequirements: "",
    dueDate: "",
    informationSystems: [],
    informationAssets: [],
  },
  fieldErrors: {},
};

function textValue(formData: FormData, field: Exclude<RequestFieldId, "informationSystems" | "informationAssets">): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function selectedValues(formData: FormData, field: "informationSystems" | "informationAssets"): string[] {
  return formData
    .getAll(field)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function enumValue<T extends string>(value: string, choices: readonly T[]): T | "" {
  return choices.includes(value as T) ? (value as T) : "";
}

/** Parses only persisted, requestor-editable fields; all FormData system fields are ignored. */
export function requestValuesFromFormData(formData: FormData): RequestFormValues {
  return {
    title: textValue(formData, "title"),
    description: textValue(formData, "description"),
    assessmentType: enumValue(textValue(formData, "assessmentType"), ["BAU", "Project", "Other"]),
    division: textValue(formData, "division"),
    businessUnit: textValue(formData, "businessUnit"),
    businessPurpose: textValue(formData, "businessPurpose"),
    businessCriticality: enumValue(textValue(formData, "businessCriticality"), ["Low", "Moderate", "High", "Critical"]),
    thirdPartyInvolvement: enumValue(textValue(formData, "thirdPartyInvolvement"), ["true", "false"]),
    thirdPartyDetails: textValue(formData, "thirdPartyDetails"),
    regulatoryRequirements: textValue(formData, "regulatoryRequirements"),
    dueDate: textValue(formData, "dueDate"),
    informationSystems: selectedValues(formData, "informationSystems"),
    informationAssets: selectedValues(formData, "informationAssets"),
  };
}

function validationErrors(values: RequestFormValues, mode: "draft" | "submit"): Partial<Record<RequestFieldId, string>> {
  const errors: Partial<Record<RequestFieldId, string>> = {};
  if (!values.title) errors.title = "Enter a request title.";
  if (mode === "draft") return errors;

  if (!values.description) errors.description = "Enter a request description.";
  if (!values.assessmentType) errors.assessmentType = "Choose an assessment type.";
  if (!values.businessPurpose) errors.businessPurpose = "Enter the business purpose.";
  if (!values.businessCriticality) errors.businessCriticality = "Choose the business criticality.";
  if (!values.thirdPartyInvolvement) errors.thirdPartyInvolvement = "Select whether a third party is involved.";
  if (values.thirdPartyInvolvement === "true" && !values.thirdPartyDetails) {
    errors.thirdPartyDetails = "Enter the third-party details.";
  }
  return errors;
}

function actionError(
  values: RequestFormValues,
  fieldErrors: Partial<Record<RequestFieldId, string>> = {},
  formError?: string,
): RequestActionState {
  return {
    status: "error",
    values,
    fieldErrors,
    formError,
    focus: editableFieldIds.find((field) => fieldErrors[field]),
  };
}

function safeServiceError(values: RequestFormValues, error: SafeApiError | SafeValidationError): RequestActionState {
  const fieldErrors: Partial<Record<RequestFieldId, string>> = {};
  if (error.kind === "validation") {
    for (const field of editableFieldIds) {
      const message = error.fields[field];
      if (message) fieldErrors[field] = message;
    }
  }
  return actionError(values, fieldErrors, error.kind === "validation" ? error.message : SAFE_API_MESSAGES.write);
}

function saveInput(values: RequestFormValues): SaveDraftInput {
  return {
    title: values.title,
    description: values.description || undefined,
    assessmentType: values.assessmentType || undefined,
    division: values.division || undefined,
    businessUnit: values.businessUnit || undefined,
    businessPurpose: values.businessPurpose || undefined,
    businessCriticality: values.businessCriticality || undefined,
    thirdPartyInvolvement: values.thirdPartyInvolvement || undefined,
    thirdPartyDetails: values.thirdPartyInvolvement === "false" ? "" : values.thirdPartyDetails || undefined,
    regulatoryRequirements: values.regulatoryRequirements || undefined,
    dueDate: values.dueDate || undefined,
    informationSystems: values.informationSystems,
    informationAssets: values.informationAssets,
  };
}

async function trustedActor(values: RequestFormValues): Promise<{ email: string } | RequestActionState> {
  const actor = await resolveCurrentActor();
  return actor ?? actionError(values, {}, "You are not authorised to change this request.");
}

function revalidateRequest(id: string): readonly string[] {
  const paths = ["/", "/requests", `/requests/${id}`] as const;
  for (const path of paths) revalidatePath(path);
  return paths;
}

/** Creates or saves an editable draft after server-only actor resolution. */
export async function saveDraft(
  requestId: string | undefined,
  _previousState: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const values = requestValuesFromFormData(formData);
  const fieldErrors = validationErrors(values, "draft");
  if (Object.keys(fieldErrors).length > 0) return actionError(values, fieldErrors);

  const actor = await trustedActor(values);
  if ("status" in actor) return actor;

  if (!requestId) {
    const created = await createDraft(actor.email, { title: values.title });
    if (!created.ok) return safeServiceError(values, created.error);
    const id = created.data.data.documentId;
    return {
      status: "success",
      values,
      fieldErrors: {},
      announcement: "Draft saved.",
      redirectTo: `/requests/${id}`,
      revalidate: revalidateRequest(id),
    };
  }

  const saved = await saveDraftRequest(actor.email, requestId, saveInput(values));
  if (!saved.ok) return safeServiceError(values, saved.error);
  return {
    status: "success",
    values,
    fieldErrors: {},
    announcement: "Draft saved.",
    revalidate: revalidateRequest(requestId),
  };
}

/** Saves the complete validated request before performing its explicit submit transition. */
export async function submitRequest(
  requestId: string,
  _previousState: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const values = requestValuesFromFormData(formData);
  const fieldErrors = validationErrors(values, "submit");
  if (Object.keys(fieldErrors).length > 0) return actionError(values, fieldErrors);

  const actor = await trustedActor(values);
  if ("status" in actor) return actor;

  const saved = await saveDraftRequest(actor.email, requestId, saveInput(values));
  if (!saved.ok) return safeServiceError(values, saved.error);

  const submitted = await submitRequestService(actor.email, requestId);
  if (!submitted.ok) return safeServiceError(values, submitted.error);
  return {
    status: "success",
    values,
    fieldErrors: {},
    announcement: "Request submitted.",
    revalidate: revalidateRequest(requestId),
  };
}

/** Withdraws an owned submitted request; Strapi remains authoritative for the transition. */
export async function withdrawRequest(requestId: string): Promise<RequestActionState> {
  const values = initialRequestActionState.values;
  const actor = await trustedActor(values);
  if ("status" in actor) return actor;

  const withdrawn = await withdrawRequestService(actor.email, requestId);
  if (!withdrawn.ok) return safeServiceError(values, withdrawn.error);
  return {
    status: "success",
    values,
    fieldErrors: {},
    announcement: "Request returned to draft.",
    revalidate: revalidateRequest(requestId),
  };
}
