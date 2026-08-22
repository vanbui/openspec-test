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
const REQUEST_STATUSES = [
  "draft", "submitted", "questionnaire-in-progress", "risk-assessment-drafted",
  "under-review", "approved", "closed",
] as const;
const ALLOWED_SORTS = new Set(["updatedAt:desc", "updatedAt:asc", "title:asc"]);
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type RequestRecord = Record<string, unknown>;
type MutableDraftField = (typeof MUTABLE_DRAFT_FIELDS)[number];
type RequestDocuments = {
  count(options: Record<string, unknown>): Promise<unknown>;
  create(options: Record<string, unknown>): Promise<unknown>;
  findMany(options: Record<string, unknown>): Promise<unknown>;
  findOne(options: Record<string, unknown>): Promise<unknown>;
  update(options: Record<string, unknown>): Promise<unknown>;
};
type QueryInput = Record<string, unknown>;
type ListOptions = { keyword?: string; page: number; pageSize: number; sort: string; status?: string };

export class RequestWorkflowError extends Error {
  constructor(readonly status: 400 | 403 | 404, message: string) {
    super(message);
    this.name = "RequestWorkflowError";
  }
}

export type RequestWorkflowService = {
  createForActor(actor: CsrmActor, input: unknown): Promise<RequestRecord>;
  dashboardForActor(actor: CsrmActor): Promise<Record<string, unknown>>;
  findOneForActor(actor: CsrmActor, documentId: string): Promise<RequestRecord | null>;
  listForActor(actor: CsrmActor, query: QueryInput): Promise<{ data: RequestRecord[]; meta: Record<string, unknown> }>;
  serialize(request: RequestRecord): Record<string, unknown>;
  submitForActor(actor: CsrmActor, documentId: string): Promise<RequestRecord>;
  updateForActor(actor: CsrmActor, documentId: string, input: unknown): Promise<RequestRecord>;
  withdrawForActor(actor: CsrmActor, documentId: string): Promise<RequestRecord>;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function requestDocuments(strapi: { documents: (uid: string) => unknown }): RequestDocuments {
  return strapi.documents(REQUEST_UID) as RequestDocuments;
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

function relationSummary(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const relation = record(entry);
    if (!relation || typeof relation.documentId !== "string") return [];
    const name = relation.name ?? relation.title;
    return [{ documentId: relation.documentId, ...(typeof name === "string" ? { name } : {}) }];
  });
}

function serializeRequest(request: RequestRecord): Record<string, unknown> {
  const requestor = record(request.requestor);
  return {
    documentId: request.documentId, requestNumber: request.requestNumber, title: request.title,
    description: request.description, assessmentType: request.assessmentType, division: request.division,
    businessUnit: request.businessUnit, businessPurpose: request.businessPurpose,
    businessCriticality: request.businessCriticality, thirdPartyInvolvement: request.thirdPartyInvolvement,
    thirdPartyDetails: request.thirdPartyDetails, regulatoryRequirements: request.regulatoryRequirements,
    dueDate: request.dueDate, requestStatus: request.requestStatus, submittedDate: request.submittedDate,
    createdAt: request.createdAt, updatedAt: request.updatedAt,
    requestor: requestor && typeof requestor.documentId === "string"
      ? { documentId: requestor.documentId, displayName: requestor.displayName }
      : undefined,
    informationSystems: relationSummary(request.informationSystems),
    informationAssets: relationSummary(request.informationAssets),
  };
}

function requestPopulate(): Record<string, unknown> {
  return { requestor: true, informationSystems: true, informationAssets: true };
}

function ownerFilter(actor: CsrmActor): Record<string, unknown> {
  return { requestor: { documentId: { $eq: actor.documentId } } };
}

function readableFilter(actor: CsrmActor): Record<string, unknown> {
  return actor.isAnalyst
    ? { $or: [ownerFilter(actor), { requestStatus: { $eq: "draft" } }] }
    : ownerFilter(actor);
}

function isOwner(actor: CsrmActor, request: RequestRecord): boolean {
  return record(request.requestor)?.documentId === actor.documentId;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePositiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new RequestWorkflowError(400, "Request query is invalid.");
  }
  const parsed = Number.parseInt(value, 10);
  if (parsed > maximum) throw new RequestWorkflowError(400, "Request query is invalid.");
  return parsed;
}

function parseListOptions(query: QueryInput): ListOptions {
  const permitted = new Set(["keyword", "status", "sort", "page", "pageSize"]);
  if (Object.keys(query).some((key) => !permitted.has(key))) {
    throw new RequestWorkflowError(400, "Request query is invalid.");
  }
  const keyword = query.keyword;
  const status = query.status;
  const sort = query.sort ?? "updatedAt:desc";
  if ((keyword !== undefined && !nonBlank(keyword)) || (status !== undefined && (typeof status !== "string" || !REQUEST_STATUSES.includes(status as (typeof REQUEST_STATUSES)[number]))) || typeof sort !== "string" || !ALLOWED_SORTS.has(sort)) {
    throw new RequestWorkflowError(400, "Request query is invalid.");
  }
  return {
    ...(typeof keyword === "string" ? { keyword: keyword.trim() } : {}),
    ...(typeof status === "string" ? { status } : {}),
    sort,
    page: parsePositiveInteger(query.page, 1, 10_000),
    pageSize: parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

async function validateRelationIds(
  strapi: { documents: (uid: string) => unknown },
  input: Partial<Record<MutableDraftField, unknown>>,
): Promise<void> {
  const relations: Array<["informationAssets" | "informationSystems", string]> = [
    ["informationSystems", "api::csrm-information-system.csrm-information-system"],
    ["informationAssets", "api::csrm-information-asset.csrm-information-asset"],
  ];
  for (const [field, uid] of relations) {
    const value = input[field];
    if (value === undefined) continue;
    if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || id.length === 0)) {
      throw new RequestWorkflowError(400, "Related catalogue records are invalid.");
    }
    const ids = [...new Set(value as string[])];
    const catalogueDocuments = strapi.documents(uid) as { findMany(options: Record<string, unknown>): Promise<unknown> };
    const found = await catalogueDocuments.findMany({ filters: { documentId: { $in: ids } }, limit: ids.length });
    if (!Array.isArray(found) || found.length !== ids.length) {
      throw new RequestWorkflowError(400, "Related catalogue records are invalid.");
    }
    input[field] = ids;
  }
}

function normalizeDraftInput(input: unknown): Partial<Record<MutableDraftField, unknown>> {
  const data = mutableDraftInput(input);
  if (data.thirdPartyInvolvement === false) data.thirdPartyDetails = null;
  return data;
}

function assertSubmittable(request: RequestRecord): void {
  const requiredFields = ["title", "description", "assessmentType", "businessPurpose", "businessCriticality"];
  if (requiredFields.some((field) => !nonBlank(request[field])) || typeof request.thirdPartyInvolvement !== "boolean" || (request.thirdPartyInvolvement === true && !nonBlank(request.thirdPartyDetails))) {
    throw new RequestWorkflowError(400, "Request is incomplete and cannot be submitted.");
  }
}

function dashboardNotice(request: RequestRecord): { documentId: string; message: string } | null {
  if (typeof request.documentId !== "string") return null;
  const title = nonBlank(request.title) ? request.title.trim() : "Untitled request";
  if (request.requestStatus === "draft") {
    return { documentId: request.documentId, message: `Complete "${title}" before submitting.` };
  }
  if (request.requestStatus === "submitted") {
    return { documentId: request.documentId, message: `"${title}" was submitted and is awaiting Security Analyst review.` };
  }
  return null;
}

export default factories.createCoreService(REQUEST_UID, ({ strapi }) => ({
  async createForActor(actor: CsrmActor, input: unknown): Promise<RequestRecord> {
    const data = normalizeDraftInput(input);
    if (!nonBlank(data.title)) throw new RequestWorkflowError(400, "A request title is required to save a draft.");
    await validateRelationIds(strapi, data);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return (await requestDocuments(strapi).create({
          data: { ...data, title: data.title.trim(), requestNumber: requestNumber(), requestor: actor.documentId, requestStatus: "draft", submittedDate: null },
          populate: requestPopulate(),
        })) as RequestRecord;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    throw new Error("Unable to allocate a unique request number.");
  },

  async findOneForActor(actor: CsrmActor, documentId: string): Promise<RequestRecord | null> {
    const request = await requestDocuments(strapi).findOne({ documentId, filters: readableFilter(actor), populate: requestPopulate() });
    return (request as RequestRecord | null) ?? null;
  },

  async updateForActor(actor: CsrmActor, documentId: string, input: unknown): Promise<RequestRecord> {
    const existing = await requestDocuments(strapi).findOne({ documentId, filters: readableFilter(actor), populate: requestPopulate() }) as RequestRecord | null;
    if (!existing) throw new RequestWorkflowError(404, "Request is not available.");
    if (existing.requestStatus !== "draft" || (!isOwner(actor, existing) && !actor.isAnalyst)) {
      throw new RequestWorkflowError(403, "Request operation is not permitted.");
    }
    const data = normalizeDraftInput(input);
    await validateRelationIds(strapi, data);
    return (await requestDocuments(strapi).update({ documentId, data, populate: requestPopulate() })) as RequestRecord;
  },

  async submitForActor(actor: CsrmActor, documentId: string): Promise<RequestRecord> {
    const existing = await requestDocuments(strapi).findOne({ documentId, filters: ownerFilter(actor), populate: requestPopulate() }) as RequestRecord | null;
    if (!existing) throw new RequestWorkflowError(404, "Request is not available.");
    if (existing.requestStatus !== "draft") throw new RequestWorkflowError(403, "Request operation is not permitted.");
    assertSubmittable(existing);
    return (await requestDocuments(strapi).update({ documentId, data: { requestStatus: "submitted", submittedDate: new Date().toISOString() }, populate: requestPopulate() })) as RequestRecord;
  },

  async withdrawForActor(actor: CsrmActor, documentId: string): Promise<RequestRecord> {
    const existing = await requestDocuments(strapi).findOne({ documentId, filters: ownerFilter(actor), populate: requestPopulate() }) as RequestRecord | null;
    if (!existing) throw new RequestWorkflowError(404, "Request is not available.");
    if (existing.requestStatus !== "submitted") throw new RequestWorkflowError(403, "Request operation is not permitted.");
    return (await requestDocuments(strapi).update({ documentId, data: { requestStatus: "draft", submittedDate: null }, populate: requestPopulate() })) as RequestRecord;
  },

  async listForActor(actor: CsrmActor, query: QueryInput) {
    const options = parseListOptions(query);
    const filters: Record<string, unknown> = ownerFilter(actor);
    const extraFilters: Record<string, unknown>[] = [];
    if (options.status) extraFilters.push({ requestStatus: { $eq: options.status } });
    if (options.keyword) extraFilters.push({ $or: [{ title: { $containsi: options.keyword } }, { requestNumber: { $containsi: options.keyword } }] });
    const appliedFilters = extraFilters.length > 0 ? { $and: [filters, ...extraFilters] } : filters;
    const [data, count] = await Promise.all([
      requestDocuments(strapi).findMany({ filters: appliedFilters, sort: [options.sort], start: (options.page - 1) * options.pageSize, limit: options.pageSize, populate: requestPopulate() }),
      requestDocuments(strapi).count({ filters: appliedFilters }),
    ]);
    return {
      data: (Array.isArray(data) ? data : []) as RequestRecord[],
      meta: { pagination: { page: options.page, pageSize: options.pageSize, pageCount: Math.ceil(Number(count) / options.pageSize), total: Number(count) } },
    };
  },

  async dashboardForActor(actor: CsrmActor): Promise<Record<string, unknown>> {
    const owner = ownerFilter(actor);
    const countByStatus = await Promise.all(
      REQUEST_STATUSES.map(async (status) => [
        status,
        Number(
          await requestDocuments(strapi).count({
            filters: { $and: [owner, { requestStatus: { $eq: status } }] },
          }),
        ),
      ] as const),
    );
    const [needsAttention, recentSubmissions] = await Promise.all([
      requestDocuments(strapi).findMany({ filters: { $and: [owner, { requestStatus: { $eq: "draft" } }] }, sort: ["updatedAt:desc"], limit: 5, populate: requestPopulate() }),
      requestDocuments(strapi).findMany({ filters: { $and: [owner, { requestStatus: { $eq: "submitted" } }] }, sort: ["submittedDate:desc"], limit: 5, populate: requestPopulate() }),
    ]);
    const attentionRequests = Array.isArray(needsAttention) ? needsAttention as RequestRecord[] : [];
    const submittedRequests = Array.isArray(recentSubmissions) ? recentSubmissions as RequestRecord[] : [];
    return {
      statusCounts: Object.fromEntries(countByStatus),
      needsAttention: attentionRequests.map(serializeRequest),
      recentSubmissions: submittedRequests.map(serializeRequest),
      notices: [...attentionRequests, ...submittedRequests].flatMap((request) => {
        const notice = dashboardNotice(request);
        return notice ? [notice] : [];
      }),
    };
  },

  serialize: serializeRequest,
}));
