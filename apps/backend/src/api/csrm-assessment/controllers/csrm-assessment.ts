import { factories } from "@strapi/strapi";

import { AssessmentDraftRegistryError } from "../services/assessment-draft-registry";
import {
  AssessmentDraftWorkflowError,
  getAssessmentDraftJob,
  retryAssessmentDraftJob,
} from "../services/assessment-workflow";
import {
  loadAnalystAssessmentOwnerLabels,
  loadAnalystAssessmentRiskDetails,
  RiskWorkflowError,
} from "../../csrm-risk/services/risk-workflow";
import {
  ASSESSMENT_DETAIL_QUERY,
  assertAnalystAssessmentScope,
  assessmentOwnerCollectionDocumentId,
  assertClosedAssessmentQuery,
  assertRequestorAssessmentScope,
  AssessmentScopeError,
  buildAssessmentCollectionQuery,
  isReleasedAssessmentForOwner,
  projectAnalystAssessmentDetail,
  projectAssessmentDetail,
  projectReleasedAssessmentDetail,
  projectAssessmentRatingSummary,
  projectAssessmentStatusSummary,
  projectAssessmentSummary,
  projectControlImplementationSummary,
  projectRiskSummary,
  releasedAssessmentDetailQuery,
  releasedAssessmentQuery,
} from "../services/assessment-scope";
import {
  AssessmentWorkflowError,
  projectReleaseReadiness,
  releaseAssessment as releaseAssessmentWorkflow,
  updateAssessment as updateAssessmentWorkflow,
  validateReleaseReadiness,
} from "../services/assessment-workflow";

const UID = "api::csrm-assessment.csrm-assessment" as const;
type RecordValue = Record<string, unknown>;
type AssessmentDocuments = {
  count: (query: RecordValue) => Promise<number>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : status === 404 ? ctx.notFound : ctx.conflict;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

function requestContext(ctx: RecordValue): { jobId: string; analystDocumentId: string } | null {
  const params = isRecord(ctx.params) ? ctx.params : null;
  const state = isRecord(ctx.state) ? ctx.state : null;
  const identity = state && isRecord(state.idamboxUser) ? state.idamboxUser : null;
  return params && typeof params.jobId === "string" && params.jobId.length > 0
    && identity && typeof identity.documentId === "string"
    ? { jobId: params.jobId, analystDocumentId: identity.documentId }
    : null;
}

export function assessmentControllerExtension({ strapi }: { strapi: unknown }) {
  const documents = () => (strapi as { documents: (uid: string) => AssessmentDocuments }).documents(UID);

  function assessmentId(ctx: RecordValue): string | null {
    const params = isRecord(ctx.params) ? ctx.params : null;
    return params && typeof params.assessmentId === "string" && params.assessmentId.length > 0
      ? params.assessmentId
      : null;
  }

  function routeId(ctx: RecordValue, name: "assessmentId" | "riskId"): string | null {
    const params = isRecord(ctx.params) ? ctx.params : null;
    return params && typeof params[name] === "string" && params[name].length > 0 ? params[name] as string : null;
  }

  function identityDocumentId(ctx: RecordValue): string | null {
    const state = isRecord(ctx.state) ? ctx.state : null;
    const identity = state && isRecord(state.idamboxUser) ? state.idamboxUser : null;
    return identity && typeof identity.documentId === "string" ? identity.documentId : null;
  }

  function actor(ctx: RecordValue): "analyst" | "requestor" | null {
    const state = isRecord(ctx.state) ? ctx.state : null;
    const authorization = state && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
    return authorization?.assessmentRequestActor === "analyst" || authorization?.assessmentRequestActor === "requestor"
      ? authorization.assessmentRequestActor
      : null;
  }

  async function releasedForOwner(ctx: RecordValue, documentId: string): Promise<RecordValue | null> {
    assertRequestorAssessmentScope(ctx.state);
    const ownerDocumentId = identityDocumentId(ctx);
    if (!ownerDocumentId) throw new AssessmentScopeError(403);
    const document = await documents().findOne(releasedAssessmentDetailQuery(ownerDocumentId, documentId));
    return isReleasedAssessmentForOwner(document, ownerDocumentId) ? document : null;
  }

  async function listDocuments(ctx: RecordValue, scope: "owner" | "analyst"): Promise<{ data: RecordValue[]; meta: RecordValue } | unknown> {
    try {
      const { dataQuery, countQuery, pagination } = buildAssessmentCollectionQuery(ctx.query, ctx.state, scope);
      const [data, total] = await Promise.all([documents().findMany(dataQuery), documents().count(countQuery)]);
      return {
        data,
        meta: { pagination: { ...pagination, pageCount: Math.ceil(total / pagination.pageSize), total } },
      };
    } catch (error) {
      if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
      throw error;
    }
  }

  function handle(ctx: RecordValue, retry: boolean) {
    try {
      const input = requestContext(ctx);
      if (!input) return safeError(ctx, 400, "CSRM assessment draft job identifier is invalid.");
      const data = retry
        ? retryAssessmentDraftJob({ strapi: strapi as never, ...input })
        : getAssessmentDraftJob({ strapi: strapi as never, ...input });
      if (retry) ctx.status = 202;
      return { data };
    } catch (error) {
      if (error instanceof AssessmentDraftWorkflowError || error instanceof AssessmentDraftRegistryError) {
        return safeError(ctx, error.status, error.message);
      }
      throw error;
    }
  }
  return {
    async listAssessments(ctx: RecordValue) {
      const output = await listDocuments(ctx, "analyst");
      return isRecord(output) && Array.isArray(output.data)
        ? { ...output, data: output.data.map(projectAssessmentSummary) }
        : output;
    },
    async statusSummary(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const output: RecordValue[] = [];
        const pageSize = 1_000;
        for (let start = 0;; start += pageSize) {
          const page = await documents().findMany({ populate: { generatedBy: true }, start, limit: pageSize });
          output.push(...page);
          if (page.length < pageSize) break;
        }
        return { data: projectAssessmentStatusSummary(output) };
      } catch (error) {
        if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
        throw error;
      }
    },
    async getAssessment(ctx: RecordValue) {
      try {
        assertClosedAssessmentQuery(ctx.query);
        const documentId = assessmentId(ctx);
        if (!documentId) return safeError(ctx, 400, "CSRM assessment identifier is invalid.");
        if (actor(ctx) === "requestor") {
          const released = await releasedForOwner(ctx, documentId);
          return released ? { data: projectReleasedAssessmentDetail(released) } : safeError(ctx, 404, "CSRM assessment was not found.");
        }
        assertAnalystAssessmentScope(ctx.state);
        const document = await documents().findOne({ documentId, ...ASSESSMENT_DETAIL_QUERY });
        if (!document) return safeError(ctx, 404, "CSRM assessment was not found.");
        const risks = await loadAnalystAssessmentRiskDetails(strapi as never, documentId);
        const ownerLabels = await loadAnalystAssessmentOwnerLabels(strapi as never, risks);
        return { data: projectAnalystAssessmentDetail({
          assessment: document,
          risks,
          ownerLabels,
          releaseReadiness: projectReleaseReadiness({ ...document, risks }),
        }) };
      } catch (error) {
        if (error instanceof AssessmentScopeError || error instanceof AssessmentWorkflowError || error instanceof RiskWorkflowError) return safeError(ctx, error.status, error.message);
        throw error;
      }
    },
    async updateAssessment(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const documentId = assessmentId(ctx);
        const state = isRecord(ctx.state) ? ctx.state : null;
        const identity = state && isRecord(state.idamboxUser) ? state.idamboxUser : null;
        const request = isRecord(ctx.request) ? ctx.request : null;
        if (!documentId || !identity || typeof identity.documentId !== "string" || !request) {
          return safeError(ctx, 400, "CSRM assessment mutation data is invalid.");
        }
        const document = await updateAssessmentWorkflow({
          strapi: strapi as never,
          assessmentDocumentId: documentId,
          analystDocumentId: identity.documentId,
          body: request.body,
        });
        return { data: projectAssessmentDetail(document) };
      } catch (error) {
        if (error instanceof AssessmentScopeError || error instanceof AssessmentWorkflowError) {
          return safeError(ctx, error.status, error.message);
        }
        throw error;
      }
    },
    async releaseAssessment(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const documentId = assessmentId(ctx);
        const analystDocumentId = identityDocumentId(ctx);
        if (!documentId || !analystDocumentId) return safeError(ctx, 400, "CSRM assessment release data is invalid.");
        const released = await releaseAssessmentWorkflow({
          strapi: strapi as never,
          assessmentDocumentId: documentId,
          analystDocumentId,
        });
        return { data: projectAssessmentDetail(released) };
      } catch (error) {
        if (error instanceof AssessmentScopeError || error instanceof AssessmentWorkflowError) {
          return safeError(ctx, error.status, error.message);
        }
        throw error;
      }
    },
    async listMyReleasedAssessments(ctx: RecordValue) {
      try {
        const output = await listDocuments(ctx, "owner");
        return isRecord(output) && Array.isArray(output.data)
          ? { ...output, data: output.data.map(projectAssessmentSummary) }
          : output;
      } catch (error) {
        if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
        throw error;
      }
    },
    async myRatingSummary(ctx: RecordValue) {
      try {
        const ownerDocumentId = assessmentOwnerCollectionDocumentId(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const found = await documents().findMany({ ...releasedAssessmentQuery(ownerDocumentId), limit: 1_000 });
        return { data: projectAssessmentRatingSummary(found.filter((document) => isReleasedAssessmentForOwner(document, ownerDocumentId))) };
      } catch (error) {
        if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
        throw error;
      }
    },
    async listAssessmentRisks(ctx: RecordValue) {
      try {
        assertClosedAssessmentQuery(ctx.query);
        const documentId = routeId(ctx, "assessmentId");
        if (!documentId) return safeError(ctx, 400, "CSRM assessment identifier is invalid.");
        if (actor(ctx) === "requestor" && !await releasedForOwner(ctx, documentId)) {
          return safeError(ctx, 404, "CSRM assessment was not found.");
        }
        if (actor(ctx) !== "requestor") assertAnalystAssessmentScope(ctx.state);
        const risks = await (strapi as { documents: (uid: string) => AssessmentDocuments })
          .documents("api::csrm-risk.csrm-risk")
          .findMany({ filters: { assessment: { documentId: { $eq: documentId } } }, sort: ["riskNumber:asc"], limit: 1_000 });
        return { data: risks.map(projectRiskSummary) };
      } catch (error) {
        if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
        throw error;
      }
    },
    async listRiskControlImplementations(ctx: RecordValue) {
      try {
        assertClosedAssessmentQuery(ctx.query);
        const riskId = routeId(ctx, "riskId");
        if (!riskId) return safeError(ctx, 400, "CSRM Risk identifier is invalid.");
        const riskDocuments = (strapi as { documents: (uid: string) => AssessmentDocuments }).documents("api::csrm-risk.csrm-risk");
        const risk = await riskDocuments.findOne({ documentId: riskId, populate: { assessment: true } });
        const parentId = risk && isRecord(risk.assessment) && typeof risk.assessment.documentId === "string"
          ? risk.assessment.documentId
          : null;
        if (!risk || !parentId) return safeError(ctx, 404, "CSRM Risk was not found.");
        if (actor(ctx) === "requestor" && !await releasedForOwner(ctx, parentId)) {
          return safeError(ctx, 404, "CSRM Risk was not found.");
        }
        if (actor(ctx) !== "requestor") assertAnalystAssessmentScope(ctx.state);
        const implementations = await (strapi as { documents: (uid: string) => AssessmentDocuments })
          .documents("api::csrm-control-implementation.csrm-control-implementation")
          .findMany({ filters: { risk: { documentId: { $eq: riskId } } }, populate: { control: true, controlOwner: true }, limit: 1_000 });
        return { data: implementations.map(projectControlImplementationSummary) };
      } catch (error) {
        if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
        throw error;
      }
    },
    getDraftJob: (ctx: RecordValue) => handle(ctx, false),
    retryDraftJob: (ctx: RecordValue) => handle(ctx, true),
  };
}

export default factories.createCoreController(UID, assessmentControllerExtension as never);
