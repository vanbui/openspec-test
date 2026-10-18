import type { Database } from "@strapi/database";
import { factories } from "@strapi/strapi";
import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { ACTIVE_RISK_FILTER, activeRiskSql, isActiveRisk } from "../../../csrm/active-risk";

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
  ASSESSMENT_RISK_LIST_POPULATE,
  assertAnalystAssessmentScope,
  assessmentOwnerCollectionDocumentId,
  assertClosedAssessmentQuery,
  assertRequestorAssessmentScope,
  AssessmentScopeError,
  type AssessmentRiskSummary,
  buildAssessmentCollectionQuery,
  projectAnalystAssessmentDetail,
  projectAssessmentDetail,
  projectReleasedAssessmentDetail,
  projectAssessmentRatingSummary,
  projectAssessmentStatusSummary,
  projectAssessmentSummary,
  projectRequestorAssessmentSummary,
  projectAssessmentRiskListItem,
  projectControlImplementationSummary,
  RESIDUAL_RATING_LADDER,
  assessmentAiInputsChanged,
} from "../services/assessment-scope";
import {
  composeAssessmentFilters,
  findReadableReleasedAssessment,
  isReadableReleasedAssessment,
  readableAssessmentFilters,
  RELEASED_ASSESSMENT_FILTERS,
  RELEASED_ASSESSMENT_POPULATE,
  type AssessmentViewer,
} from "../services/released-assessment-read";
import type { SecurityEventLogger } from "../../../csrm/audit/security-event-log";
import { EXPORT_ROW_CAP, ExportQueryError, ExportRefusalError, logRefusedFixedTableRequest, runFixedTableExport, runListExport } from "../../../csrm/exports/run-export";
import { myRiskAssessmentsExportView, riskAssessmentsExportView } from "../../../csrm/exports/export-views";
import { RELEASED_ASSESSMENT_EXPORT_VIEW, releasedAssessmentExportTables } from "../../../csrm/exports/released-assessment-export";
import { resolveExportActor, sendExportError, sendExportFile } from "../../../csrm/exports/send-export";
import { loadAnalystRequestSummaryFacts } from "../../csrm-assessment-request/services/request-summary-facts";
import type { NotesStrapi } from "../../csrm-request-note/services/request-notes";
import { loadAiProvenanceLookups } from "../services/ai-provenance";
import { CSRM_ASSESSMENT_OPERATIONS } from "../operations";
import { isHumanSecurityAnalyst } from "../../../policies/csrm-authorization";
import { decideAiProposals as decideAiProposalsWorkflow } from "../services/ai-proposal-decisions";
import { openRiskProposalSummary } from "../../../csrm/ai/risk-proposals/risk-proposals-read";
import {
  AssessmentWorkflowError,
  projectReleaseReadiness,
  releaseAssessment as releaseAssessmentWorkflow,
  updateAssessment as updateAssessmentWorkflow,
  validateReleaseReadiness,
} from "../services/assessment-workflow";

const UID = "api::csrm-assessment.csrm-assessment" as const;
/* UI-D5: the released export's query holds only these; columns, a page or any other key is a 400. */
const RELEASED_EXPORT_QUERY_KEYS: readonly string[] = ["format", "table", "timeZone"];

/** One page of a released read: the read endpoints serve the first page, the released export reads every page. */
type ReadPage = { readonly start: number; readonly limit: number };
const FIRST_READ_PAGE: ReadPage = Object.freeze({ start: 0, limit: 1_000 });
type RecordValue = Record<string, unknown>;
type Knex = Database["connection"];
type AssessmentDocuments = {
  count: (query: RecordValue) => Promise<number>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/*
 * D-18: whether the policy admitted the caller through the human Security Analyst role (13-03 sets
 * ctx.state.csrmAuthorization.humanAnalyst from the resolved IdamBox User). It opens every generation job to the
 * caller; it never comes from the request, and a missing fact is false.
 */
function humanAnalystFact(ctx: RecordValue): boolean {
  const state = isRecord(ctx.state) ? ctx.state : null;
  const authorization = state && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  return authorization?.humanAnalyst === true;
}

/* WR-101: the human analyst fact held by an eligible person (never the Agent role), which alone is offered a pick-up. */
function eligibleHumanAnalystFact(ctx: RecordValue): boolean {
  const state = isRecord(ctx.state) ? ctx.state : null;
  const authorization = state && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  return authorization?.eligibleHumanAnalyst === true;
}
function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string, reason?: ConflictReason): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : status === 404 ? ctx.notFound : ctx.conflict;
  // A conflict, or an identity-relative 403 such as Phase 16's OWN_REQUEST on a proposal decision, names its closed reason.
  const details = (status === 409 || status === 403) && reason ? { reason } : undefined;
  if (typeof responder === "function") return responder.call(ctx, message, details);
  ctx.status = status;
  return { data: null, error: { status, message, ...(details ? { details } : {}) } };
}

/*
 * The residual rating ladder as ranks, 1 (Low) to 4 (Critical), in RESIDUAL_RATING_LADDER's order; any other
 * value, null included, has no rank. Constant SQL: no caller value reaches it.
 */
const RESIDUAL_RANK_SQL = "MAX(CASE r.residual_rating WHEN 'Low' THEN 1 WHEN 'Moderate' THEN 2 WHEN 'High' THEN 3 WHEN 'Critical' THEN 4 END)";

/**
 * D-31 (research Pitfall 9): each listed assessment's Risk count and highest residual rating, from one grouped
 * aggregate restricted to the page's assessments, never a per-Risk populate. Only positive integer ids are bound.
 * Phase 16 D-13: both assessment lists count and rate active Risks only (activeRiskSql), so a withdrawn Risk sets
 * neither figure.
 * PostgreSQL returns the aggregates as strings, so both read through Number(). An assessment with no Risk has no
 * row, and the projection reads it as 0 and null; a Risk with no rating, or one off the ladder, has no rank.
 */
export async function riskSummariesFor(connection: Knex, assessmentIds: readonly unknown[]): Promise<Map<number, AssessmentRiskSummary>> {
  const ids = [...new Set(assessmentIds.filter((id): id is number => Number.isSafeInteger(id) && (id as number) > 0))];
  const summaries = new Map<number, AssessmentRiskSummary>();
  if (ids.length === 0) return summaries;
  const rows = await connection("csrm_risks_assessment_lnk as l")
    .join("csrm_risks as r", "r.id", "l.csrm_risk_id")
    .whereIn("l.csrm_assessment_id", ids)
    .whereRaw(activeRiskSql("r"))
    .groupBy("l.csrm_assessment_id")
    .select(
      "l.csrm_assessment_id as assessment_id",
      connection.raw("COUNT(DISTINCT r.id) as risk_count"),
      connection.raw(`${RESIDUAL_RANK_SQL} as highest_rank`),
    ) as Array<{ assessment_id: unknown; risk_count: unknown; highest_rank: unknown }>;
  for (const row of rows) {
    const rank = row.highest_rank === null || row.highest_rank === undefined ? null : Number(row.highest_rank);
    summaries.set(Number(row.assessment_id), {
      riskCount: Number(row.risk_count),
      highestResidualRating: rank !== null && Number.isInteger(rank) ? RESIDUAL_RATING_LADDER[rank - 1] ?? null : null,
    });
  }
  return summaries;
}

function requestContext(ctx: RecordValue): { jobId: string; analystDocumentId: string; humanAnalyst: boolean } | null {
  const params = isRecord(ctx.params) ? ctx.params : null;
  const state = isRecord(ctx.state) ? ctx.state : null;
  const identity = state && isRecord(state.idamboxUser) ? state.idamboxUser : null;
  return params && typeof params.jobId === "string" && params.jobId.length > 0
    && identity && typeof identity.documentId === "string"
    // D-18: the policy's humanAnalyst fact (13-03) opens every draft job to the human Security Analyst.
    ? { jobId: params.jobId, analystDocumentId: identity.documentId, humanAnalyst: humanAnalystFact(ctx) }
    : null;
}

export function assessmentControllerExtension({ strapi }: { strapi: unknown }) {
  const documents = () => (strapi as { documents: (uid: string) => AssessmentDocuments }).documents(UID);
  const connection = () => (strapi as { db: { connection: Knex } }).db.connection;

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

  /** D-14: the Requestor as the one record-read check's viewer, the IdamBox User the policy resolved. */
  function requestorViewer(ctx: RecordValue): AssessmentViewer {
    assertRequestorAssessmentScope(ctx.state);
    const viewerDocumentId = identityDocumentId(ctx);
    if (!viewerDocumentId) throw new AssessmentScopeError(403);
    return { kind: "requestor", documentId: viewerDocumentId };
  }

  /*
   * The released risks read, shared by GET /v1/risk_assessments/{id}/risks and the released export. Phase 16 D-08,
   * D-13: it serves active Risks to both actors (ACTIVE_RISK_FILTER); the analyst sees a withdrawn Risk, marked, in the
   * assessment detail only. The documents come back unprojected, so a caller can check each against the rule again.
   */
  async function readAssessmentRisks(assessmentDocumentId: string, page: ReadPage = FIRST_READ_PAGE): Promise<RecordValue[]> {
    return (strapi as { documents: (uid: string) => AssessmentDocuments })
      .documents("api::csrm-risk.csrm-risk")
      .findMany({
        filters: { assessment: { documentId: { $eq: assessmentDocumentId } }, ...ACTIVE_RISK_FILTER },
        populate: ASSESSMENT_RISK_LIST_POPULATE,
        // The risk number is unique, so every page of this order is stable.
        sort: ["riskNumber:asc"],
        start: page.start,
        limit: page.limit,
      });
  }

  /** One Risk's control implementations read, shared by GET /v1/risks/{id}/control_implementations and the released export. */
  async function readRiskControlImplementations(riskDocumentId: string, page: ReadPage = FIRST_READ_PAGE): Promise<RecordValue[]> {
    const implementations = await (strapi as { documents: (uid: string) => AssessmentDocuments })
      .documents("api::csrm-control-implementation.csrm-control-implementation")
      .findMany({
        filters: { risk: { documentId: { $eq: riskDocumentId } } },
        populate: { control: true, controlOwner: true },
        // A stable order, so the export's pages and the read return the implementations in one order.
        sort: ["id:asc"],
        start: page.start,
        limit: page.limit,
      });
    return implementations.map(projectControlImplementationSummary);
  }

  /*
   * BE1-07 (Phase 19 code review): the export reads every page of a read, never its first 1,000 rows alone, so its
   * tables are never silently cut ("never a partial file", D-17). It stops once `ceiling` rows are read: the export's
   * row cap then refuses the file with EXPORT_ROW_LIMIT, so an over-cap assessment is never loaded whole.
   */
  async function readEveryPage(read: (page: ReadPage) => Promise<RecordValue[]>, ceiling: number): Promise<RecordValue[]> {
    const rows: RecordValue[] = [];
    for (let start = 0; rows.length <= ceiling; start += FIRST_READ_PAGE.limit) {
      const found = await read({ start, limit: FIRST_READ_PAGE.limit });
      rows.push(...found);
      if (found.length < FIRST_READ_PAGE.limit) break;
    }
    return rows;
  }

  /*
   * D-21: the released record's export, built from exactly what the three released reads return to its Requestor: the
   * released detail, the released risks read and the control-implementation read of each of those Risks. Phase 16 D-08:
   * a Requestor never reads a withdrawn Risk's implementations (isActiveRisk), so neither actor's file holds them.
   */
  async function releasedExportOf(record: RecordValue, documentId: string) {
    const risks = (await readEveryPage((page) => readAssessmentRisks(documentId, page), EXPORT_ROW_CAP)).filter((risk) => isActiveRisk(risk));
    const controlImplementations = new Map<string, RecordValue[]>();
    let rows = risks.length;
    for (const risk of risks) {
      if (rows > EXPORT_ROW_CAP) break;
      const implementations = await readEveryPage((page) => readRiskControlImplementations(String(risk.documentId), page), EXPORT_ROW_CAP - rows);
      controlImplementations.set(String(risk.documentId), implementations);
      rows += implementations.length;
    }
    return releasedAssessmentExportTables({
      detail: projectReleasedAssessmentDetail(record),
      risks: risks.map(projectAssessmentRiskListItem),
      controlImplementations,
    });
  }

  async function listDocuments(ctx: RecordValue, scope: "owner" | "analyst"): Promise<{ data: RecordValue[]; meta: RecordValue } | unknown> {
    try {
      const { dataQuery, countQuery, pagination } = buildAssessmentCollectionQuery(ctx.query, ctx.state, scope);
      const [found, total] = await Promise.all([documents().findMany(dataQuery), documents().count(countQuery)]);
      const riskSummaries = await riskSummariesFor(connection(), found.map((document) => document.id));
      return {
        // D-23, WR-304, D10: the Requestor's own list never names who generated a draft.
        data: found.map((document) => (scope === "owner" ? projectRequestorAssessmentSummary : projectAssessmentSummary)(document, riskSummaries.get(Number(document.id)))),
        meta: { pagination: { ...pagination, pageCount: Math.ceil(total / pagination.pageSize), total } },
      };
    } catch (error) {
      if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
      throw error;
    }
  }

  /*
   * Phase 19 (D-04, D-05, D-13): one assessment list's export, whole, through the list's own parser, scope, order and
   * projection (the view), as one file and one log line. The view's scope refusal is a 403; the policy refuses the rest.
   */
  async function exportList(ctx: RecordValue, view: ReturnType<typeof riskAssessmentsExportView>) {
    try {
      const file = await runListExport({
        view,
        query: ctx.query,
        state: ctx.state,
        actor: await resolveExportActor(strapi, ctx.state),
        now: new Date(),
        log: (strapi as { log: SecurityEventLogger }).log,
      });
      sendExportFile(ctx as unknown as Parameters<typeof sendExportFile>[0], file);
      return undefined;
    } catch (error) {
      if (sendExportError(ctx as unknown as Parameters<typeof sendExportError>[0], error)) return undefined;
      if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
      throw error;
    }
  }

  async function handle(ctx: RecordValue, retry: boolean) {
    try {
      const input = requestContext(ctx);
      if (!input) return safeError(ctx, 400, "CSRM assessment draft job identifier is invalid.");
      const data = retry
        ? await retryAssessmentDraftJob({ strapi: strapi as never, ...input })
        : await getAssessmentDraftJob({ strapi: strapi as never, ...input });
      if (retry) ctx.status = 202;
      return { data };
    } catch (error) {
      if (error instanceof AssessmentDraftWorkflowError || error instanceof AssessmentDraftRegistryError) {
        // IN-104: a retry the AI data policy refuses names its closed reason, as the enqueue does (D-28).
        return safeError(ctx, error.status, error.message, error instanceof AssessmentDraftWorkflowError ? error.reason : undefined);
      }
      throw error;
    }
  }
  return {
    async listAssessments(ctx: RecordValue) {
      return listDocuments(ctx, "analyst");
    },
    /* GET /api/v1/risk_assessments/export: the analyst Risk assessments list, human Security Analyst only (D-13). */
    async exportAssessments(ctx: RecordValue) {
      return exportList(ctx, riskAssessmentsExportView(strapi));
    },
    /* GET /api/v1/my_risk_assessments/export: the caller's own released assessments, for every person (D-04, D-14). */
    async exportMyAssessments(ctx: RecordValue) {
      return exportList(ctx, myRiskAssessmentsExportView(strapi));
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
          const released = await findReadableReleasedAssessment({ documents: documents(), viewer: requestorViewer(ctx), documentId });
          return released ? { data: projectReleasedAssessmentDetail(released) } : safeError(ctx, 404, "CSRM assessment was not found.");
        }
        assertAnalystAssessmentScope(ctx.state);
        const document = await documents().findOne({ documentId, ...ASSESSMENT_DETAIL_QUERY });
        if (!document) return safeError(ctx, 404, "CSRM assessment was not found.");
        const risks = await loadAnalystAssessmentRiskDetails(strapi as never, documentId);
        const ownerLabels = await loadAnalystAssessmentOwnerLabels(strapi as never, risks);
        const aiLookups = await loadAiProvenanceLookups(strapi as never, { assessment: document, risks });
        // D-29, D-16, D-25 (T-13-54): the AI-inputs signal and the request summary facts, for a human Security Analyst only.
        const humanAnalyst = humanAnalystFact(ctx);
        const requestId = isRecord(document.assessmentRequest) && typeof document.assessmentRequest.documentId === "string" ? document.assessmentRequest.documentId : null;
        const aiInputsChanged = humanAnalyst ? await assessmentAiInputsChanged(strapi as never, document) : null;
        const requestFacts = await loadAnalystRequestSummaryFacts(strapi as unknown as NotesStrapi, requestId, { documentId: identityDocumentId(ctx), humanAnalyst, eligibleHumanAnalyst: humanAnalyst && eligibleHumanAnalystFact(ctx) });
        return { data: projectAnalystAssessmentDetail({
          assessment: document,
          risks,
          ownerLabels,
          aiLookups,
          // Phase 16 D-42: the open risk AI proposals, derived from the runs as the release path reads them.
          releaseReadiness: projectReleaseReadiness({ ...document, risks }, { openAiProposals: (await openRiskProposalSummary(strapi as never, documentId)).openCount }),
          aiInputsChanged,
          requestFacts,
        }) };
      } catch (error) {
        if (error instanceof AssessmentScopeError || error instanceof AssessmentWorkflowError || error instanceof RiskWorkflowError) return safeError(ctx, error.status, error.message, error instanceof AssessmentWorkflowError ? error.reason : undefined);
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
          // Verifier W-3: only a human Security Analyst's edit moves an AI field out of proposed.
          humanAnalyst: await isHumanSecurityAnalyst(strapi as never, identity, CSRM_ASSESSMENT_OPERATIONS.update),
          body: request.body,
        });
        return { data: projectAssessmentDetail(document) };
      } catch (error) {
        if (error instanceof AssessmentScopeError || error instanceof AssessmentWorkflowError) {
          return safeError(ctx, error.status, error.message, error instanceof AssessmentWorkflowError ? error.reason : undefined);
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
          return safeError(ctx, error.status, error.message, error instanceof AssessmentWorkflowError ? error.reason : undefined);
        }
        throw error;
      }
    },
    async decideAiProposals(ctx: RecordValue) {
      try {
        assertAnalystAssessmentScope(ctx.state);
        assertClosedAssessmentQuery(ctx.query);
        const documentId = routeId(ctx, "assessmentId");
        const analystDocumentId = identityDocumentId(ctx);
        const request = isRecord(ctx.request) ? ctx.request : null;
        if (!documentId || !analystDocumentId || !request) return safeError(ctx, 400, "Proposal decision data is invalid.");
        return { data: await decideAiProposalsWorkflow({ strapi: strapi as never, assessmentDocumentId: documentId, analystDocumentId, humanAnalyst: humanAnalystFact(ctx), body: request.body }) };
      } catch (error) {
        if (error instanceof AssessmentScopeError || error instanceof AssessmentWorkflowError) {
          return safeError(ctx, error.status, error.message, error instanceof AssessmentWorkflowError ? error.reason : undefined);
        }
        throw error;
      }
    },
    async listMyReleasedAssessments(ctx: RecordValue) {
      try {
        return await listDocuments(ctx, "owner");
      } catch (error) {
        if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
        throw error;
      }
    },
    async myRatingSummary(ctx: RecordValue) {
      try {
        const viewer: AssessmentViewer = { kind: "requestor", documentId: assessmentOwnerCollectionDocumentId(ctx.state) };
        assertClosedAssessmentQuery(ctx.query);
        // D-14: the caller's released assessments by the one record-read check, as filters and again in memory.
        const found = await documents().findMany({
          filters: composeAssessmentFilters(RELEASED_ASSESSMENT_FILTERS, readableAssessmentFilters(viewer)),
          populate: structuredClone(RELEASED_ASSESSMENT_POPULATE),
          limit: 1_000,
        });
        return { data: projectAssessmentRatingSummary(found.filter((document) => isReadableReleasedAssessment(document, viewer))) };
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
        if (actor(ctx) === "requestor" && !await findReadableReleasedAssessment({ documents: documents(), viewer: requestorViewer(ctx), documentId })) {
          return safeError(ctx, 404, "CSRM assessment was not found.");
        }
        if (actor(ctx) !== "requestor") assertAnalystAssessmentScope(ctx.state);
        return { data: (await readAssessmentRisks(documentId)).map(projectAssessmentRiskListItem) };
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
        if (actor(ctx) === "requestor" && !await findReadableReleasedAssessment({ documents: documents(), viewer: requestorViewer(ctx), documentId: parentId })) {
          return safeError(ctx, 404, "CSRM Risk was not found.");
        }
        // Phase 16 D-08: a Requestor never learns a withdrawn Risk exists, so its read is the unknown Risk's 404. An
        // analyst still reads a withdrawn Risk's control implementations (read-only history).
        if (actor(ctx) === "requestor" && !isActiveRisk(risk)) return safeError(ctx, 404, "CSRM Risk was not found.");
        if (actor(ctx) !== "requestor") assertAnalystAssessmentScope(ctx.state);
        return { data: await readRiskControlImplementations(riskId) };
      } catch (error) {
        if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
        throw error;
      }
    },
    /*
     * Phase 19 (D-03 group 2, D-14 to D-16, D-21; UI-D5): GET /api/v1/risk_assessments/{assessmentId}/export. The
     * released record, read through the one record-read check, as its Summary, Risks and Mitigation controls tables
     * (XLSX) or one of its two record tables (CSV), through the fixed-table pipeline: one file and one log line.
     * - A Requestor who may not read the released record (another person's, or their own unreleased one) gets the
     *   missing record's 404, with no export event: a 404 stays in the request log (D-16, D-18).
     * - The analyst exports through the analyst read: a missing assessment is its 404; one it can read but that is not
     *   released is 409 ASSESSMENT_NOT_RELEASED with one export.refused line (D-15); a released one is read through the
     *   same check with the analyst viewer, so both actors' files hold the same tables (D-21).
     * The query holds only format, table and timeZone: columns or any other key is a 400 (UI-D5).
     */
    async exportReleasedAssessment(ctx: RecordValue) {
      const now = new Date();
      try {
        const documentId = assessmentId(ctx);
        if (!documentId) return safeError(ctx, 400, "CSRM assessment identifier is invalid.");
        let viewer: AssessmentViewer;
        if (actor(ctx) === "requestor") {
          viewer = requestorViewer(ctx);
        } else {
          assertAnalystAssessmentScope(ctx.state);
          viewer = { kind: "analyst" };
        }
        const record = await findReadableReleasedAssessment({ documents: documents(), viewer, documentId });
        if (!record && (viewer.kind === "requestor" || !await documents().findOne({ documentId, fields: ["documentId"] }))) {
          return safeError(ctx, 404, "CSRM assessment was not found.");
        }
        const exporter = await resolveExportActor(strapi, ctx.state);
        const log = (strapi as { log: SecurityEventLogger }).log;
        const subject = { kind: "risk-assessment" as const, documentId };
        const query = isRecord(ctx.query) ? ctx.query : null;
        if (!query || Object.keys(query).some((key) => !RELEASED_EXPORT_QUERY_KEYS.includes(key))) {
          logRefusedFixedTableRequest({ viewKey: RELEASED_ASSESSMENT_EXPORT_VIEW, actor: exporter, format: query?.format, now, log, subject });
          throw new ExportQueryError();
        }
        if (!record) {
          logRefusedFixedTableRequest({ viewKey: RELEASED_ASSESSMENT_EXPORT_VIEW, actor: exporter, format: query.format, now, log, subject, reason: "ASSESSMENT_NOT_RELEASED" });
          throw new ExportRefusalError({ reason: "ASSESSMENT_NOT_RELEASED", status: 409, message: "CSRM assessment is not released, so it cannot be exported." });
        }
        const released = await releasedExportOf(record, documentId);
        const file = await runFixedTableExport({
          viewKey: RELEASED_ASSESSMENT_EXPORT_VIEW,
          slug: released.slug,
          heading: released.heading,
          tables: released.tables,
          format: query.format,
          table: query.table,
          timeZone: query.timeZone,
          actor: exporter,
          now,
          log,
          about: released.about,
          subject,
        });
        sendExportFile(ctx as unknown as Parameters<typeof sendExportFile>[0], file);
        return undefined;
      } catch (error) {
        if (sendExportError(ctx as unknown as Parameters<typeof sendExportError>[0], error)) return undefined;
        if (error instanceof AssessmentScopeError) return safeError(ctx, error.status, error.message);
        throw error;
      }
    },
    getDraftJob: (ctx: RecordValue) => handle(ctx, false),
    retryDraftJob: (ctx: RecordValue) => handle(ctx, true),
  };
}

export default factories.createCoreController(UID, assessmentControllerExtension as never);
