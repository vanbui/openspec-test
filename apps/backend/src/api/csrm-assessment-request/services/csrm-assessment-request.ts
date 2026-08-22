import { randomUUID } from "node:crypto";

import { factories } from "@strapi/strapi";

import type { CsrmActor } from "../policies/internal-csrm-caller";

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const MUTABLE_DRAFT_FIELDS = [
  "title", "description", "assessmentType", "division", "businessUnit",
  "businessPurpose", "businessCriticality", "thirdPartyInvolvement",
  "thirdPartyDetails", "regulatoryRequirements", "dueDate", "informationSystems",
  "informationAssets",
] as const;

type RequestRecord = Record<string, unknown>;
type MutableDraftField = (typeof MUTABLE_DRAFT_FIELDS)[number];
type RequestDocuments = {
  create(options: Record<string, unknown>): Promise<unknown>;
  findOne(options: Record<string, unknown>): Promise<unknown>;
};

export type RequestWorkflowService = {
  createForActor(actor: CsrmActor, input: unknown): Promise<RequestRecord>;
  findOneForActor(actor: CsrmActor, documentId: string): Promise<RequestRecord | null>;
  serialize(request: RequestRecord): Record<string, unknown>;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function mutableDraftInput(input: unknown): Partial<Record<MutableDraftField, unknown>> {
  const source = record(input) ?? {};
  return Object.fromEntries(
    MUTABLE_DRAFT_FIELDS.flatMap((field) =>
      Object.prototype.hasOwnProperty.call(source, field) ? [[field, source[field]]] : [],
    ),
  ) as Partial<Record<MutableDraftField, unknown>>;
}

function requestNumber(): string {
  return `CRA-${new Date().getUTCFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function requestDocuments(strapi: { documents: (uid: string) => unknown }): RequestDocuments {
  return strapi.documents(REQUEST_UID) as RequestDocuments;
}

function relationSummary(value: unknown): unknown {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const relation = record(entry);
    if (!relation || typeof relation.documentId !== "string") return [];
    const name = relation.name ?? relation.title ?? relation.systemName ?? relation.assetName;
    return [{ documentId: relation.documentId, ...(typeof name === "string" ? { name } : {}) }];
  });
}

function serializeRequest(request: RequestRecord): Record<string, unknown> {
  const requestor = record(request.requestor);
  return {
    documentId: request.documentId,
    requestNumber: request.requestNumber,
    title: request.title,
    description: request.description,
    assessmentType: request.assessmentType,
    division: request.division,
    businessUnit: request.businessUnit,
    businessPurpose: request.businessPurpose,
    businessCriticality: request.businessCriticality,
    thirdPartyInvolvement: request.thirdPartyInvolvement,
    thirdPartyDetails: request.thirdPartyDetails,
    regulatoryRequirements: request.regulatoryRequirements,
    dueDate: request.dueDate,
    requestStatus: request.requestStatus,
    submittedDate: request.submittedDate,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    requestor: requestor && typeof requestor.documentId === "string"
      ? { documentId: requestor.documentId, displayName: requestor.displayName }
      : undefined,
    informationSystems: relationSummary(request.informationSystems),
    informationAssets: relationSummary(request.informationAssets),
  };
}

export default factories.createCoreService(REQUEST_UID, ({ strapi }) => ({
  async createForActor(actor: CsrmActor, input: unknown): Promise<RequestRecord> {
    const data = mutableDraftInput(input);
    if (typeof data.title !== "string" || data.title.trim().length === 0) {
      throw new Error("A request title is required to save a draft.");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return (await requestDocuments(strapi).create({
          data: {
            ...data,
            title: data.title.trim(),
            requestNumber: requestNumber(),
            requestor: actor.documentId,
            requestStatus: "draft",
            submittedDate: null,
          },
          populate: {
            requestor: true,
            informationSystems: true,
            informationAssets: true,
          },
        })) as RequestRecord;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    throw new Error("Unable to allocate a unique request number.");
  },

  async findOneForActor(actor: CsrmActor, documentId: string): Promise<RequestRecord | null> {
    const request = await requestDocuments(strapi).findOne({
      documentId,
      filters: { requestor: { documentId: { $eq: actor.documentId } } },
      populate: {
        requestor: true,
        informationSystems: true,
        informationAssets: true,
      },
    });
    return (request as RequestRecord | null) ?? null;
  },

  serialize: serializeRequest,
}));
