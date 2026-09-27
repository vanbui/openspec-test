import { factories } from "@strapi/strapi";

import {
  assertAnalystAssessmentScope,
  assertClosedAssessmentQuery,
  AssessmentScopeError,
  parseActiveUserSearchQuery,
  projectActiveUserSummary,
  projectControlSummary,
  projectRiskSummary,
  projectRiskTypeSummary,
} from "../../csrm-assessment/services/assessment-scope";
import { AssessmentWorkflowError } from "../../csrm-assessment/services/assessment-workflow";
import {
  createAssessmentRisk,
  listAssessmentRiskDocuments,
  listControlDocuments,
  listRiskTypeDocuments,
  RiskWorkflowError,
  searchActiveUserDocuments,
  updateRisk,
} from "../services/risk-workflow";
import { RiskRegisterQueryError } from "../services/risk-register-query";
import { AdministrationValidationError } from "../../csrm-administration/services/administration-query";
import { AdministrationWorkflowError } from "../../csrm-administration/services/administration-workflow";
import {
  createStrapiRiskRegisterRepository,
  getRiskRegisterDetail,
  listRiskRegister,
  RiskRegisterError,
} from "../services/risk-register";
import { utcToday } from "../../../csrm/insights/utc-date";

const UID = "api::csrm-risk.csrm-risk" as const;
type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : status === 404 ? ctx.notFound : ctx.conflict;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

function routeId(ctx: RecordValue, name: "assessmentId" | "riskId"): string | null {
  const params = isRecord(ctx.params) ? ctx.params : null;
  return params && typeof params[name] === "string" && params[name].length > 0 ? params[name] as string : null;
}

function analystDocumentId(ctx: RecordValue): string | null {
  const state = isRecord(ctx.state) ? ctx.state : null;
  const identity = state && isRecord(state.idamboxUser) ? state.idamboxUser : null;
  return identity && typeof identity.documentId === "string" ? identity.documentId : null;
}

function mutationBody(ctx: RecordValue): unknown {
  return isRecord(ctx.request) ? ctx.request.body : undefined;
}

function isEmptyQuery(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

function assertCanonicalAdministrationQuery(value: unknown, kind: "risk-types" | "controls"): void {
  if (!isRecord(value)) throw new RiskRegisterQueryError();
  const keys = Object.keys(value);
  const required = ["page", "pageSize", "q", "sort"];
  const allowed = new Set(kind === "controls" ? [...required, "framework", "controlType"] : required);
  if (!required.every((key) => keys.includes(key)) || keys.some((key) => !allowed.has(key))) {
    throw new RiskRegisterQueryError();
  }
}

async function listAdministrationCollection(
  strapi: unknown,
  kind: "risk-types" | "controls",
  ctx: RecordValue,
): Promise<unknown> {
  assertCanonicalAdministrationQuery(ctx.query, kind);
  const state = isRecord(ctx.state) ? ctx.state : null;
  const authorization = state && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  if (authorization?.administrationCollectionScope !== "all") {
    return safeError(ctx, 403, "CSRM Administration access is denied.");
  }
  const serviceFactory = (strapi as { service?: (uid: string) => unknown }).service;
  const service = typeof serviceFactory === "function"
    ? serviceFactory.call(strapi, "api::csrm-administration.administration-workflow")
    : null;
  if (!isRecord(service) || typeof service.list !== "function") {
    return safeError(ctx, 400, "CSRM Administration query is not available.");
  }
  return service.list({ kind, state: ctx.state, query: ctx.query });
}

function handleError(ctx: RecordValue, error: unknown): unknown {
  if (error instanceof AdministrationValidationError || error instanceof AdministrationWorkflowError) {
    return safeError(ctx, 400, "CSRM Administration query is invalid.");
  }
  if (error instanceof RiskRegisterQueryError) return safeError(ctx, 400, error.message);
  if (error instanceof RiskRegisterError) return safeError(ctx, error.status, error.message);
  if (error instanceof AssessmentScopeError || error instanceof AssessmentWorkflowError || error instanceof RiskWorkflowError) {
    return safeError(ctx, error.status, error.message);
  }
  throw error;
}

export function riskControllerExtension({ strapi }: { strapi: unknown }) {
  const workflowStrapi = strapi as never;
  return {
    async listRiskRegister(ctx: RecordValue) {
      try {
        return await listRiskRegister({
          repository: createStrapiRiskRegisterRepository(strapi),
          state: ctx.state,
          query: ctx.query,
          // The one clock read: every row's treatment due state is evaluated on this UTC day.
          today: utcToday(new Date()),
        });
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async getRiskRegisterDetail(ctx: RecordValue) {
      try {
        assertClosedAssessmentQuery(ctx.query);
        const riskId = routeId(ctx, "riskId");
        if (!riskId) return safeError(ctx, 404, "CSRM Risk is not available.");
        return { data: await getRiskRegisterDetail({
          repository: createStrapiRiskRegisterRepository(strapi),
          state: ctx.state,
          riskDocumentId: riskId,
        }) };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async listAssessmentRisks(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const assessmentId = routeId(ctx, "assessmentId");
        if (!assessmentId) return safeError(ctx, 400, "CSRM assessment identifier is invalid.");
        return { data: (await listAssessmentRiskDocuments(workflowStrapi, assessmentId)).map(projectRiskSummary) };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async createAssessmentRisk(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const assessmentId = routeId(ctx, "assessmentId");
        const analystId = analystDocumentId(ctx);
        if (!assessmentId || !analystId) return safeError(ctx, 400, "CSRM Risk mutation data is invalid.");
        const document = await createAssessmentRisk({
          strapi: workflowStrapi,
          assessmentDocumentId: assessmentId,
          analystDocumentId: analystId,
          body: mutationBody(ctx),
        });
        ctx.status = 201;
        return { data: projectRiskSummary(document) };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async updateRisk(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const riskId = routeId(ctx, "riskId");
        const analystId = analystDocumentId(ctx);
        if (!riskId || !analystId) return safeError(ctx, 400, "CSRM Risk mutation data is invalid.");
        const document = await updateRisk({
          strapi: workflowStrapi,
          riskDocumentId: riskId,
          analystDocumentId: analystId,
          body: mutationBody(ctx),
        });
        return { data: projectRiskSummary(document) };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async listRiskTypes(ctx: RecordValue) {
      try {
        if (!isEmptyQuery(ctx.query)) return await listAdministrationCollection(strapi, "risk-types", ctx);
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        return { data: (await listRiskTypeDocuments(workflowStrapi)).map(projectRiskTypeSummary) };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async listControls(ctx: RecordValue) {
      try {
        if (!isEmptyQuery(ctx.query)) return await listAdministrationCollection(strapi, "controls", ctx);
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        return { data: (await listControlDocuments(workflowStrapi)).map(projectControlSummary) };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
    async searchActiveUsers(ctx: RecordValue) {
      try {
        const search = parseActiveUserSearchQuery(ctx.query);
        return { data: (await searchActiveUserDocuments(workflowStrapi, search)).map(projectActiveUserSummary) };
      } catch (error) {
        return handleError(ctx, error);
      }
    },
  };
}

export default factories.createCoreController(UID, riskControllerExtension as never);
