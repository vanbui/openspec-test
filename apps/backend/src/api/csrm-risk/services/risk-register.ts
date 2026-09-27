import { deriveTreatmentDueState, type TreatmentDueState } from "../../../csrm/insights/treatment-due-state";
import { isUtcDate } from "../../../csrm/insights/utc-date";
import { isReleased } from "../../csrm-assessment/services/assessment-workflow";
import {
  parseRiskRegisterQuery,
  type RiskRegisterFilters,
  type RiskRegisterSort,
} from "./risk-register-query";

type RecordValue = Record<string, unknown>;
type QueryBuilder = {
  clone: () => QueryBuilder;
  countDistinct: (value: RecordValue) => QueryBuilder;
  first: () => Promise<RecordValue | undefined>;
  leftJoin: (table: string, left: string, right: string) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  offset: (value: number) => QueryBuilder;
  orderBy: (column: string, direction: "asc" | "desc") => QueryBuilder;
  orderByRaw: (sql: string, bindings?: unknown[]) => QueryBuilder;
  select: (column: string) => QueryBuilder;
  where: ((column: string, value: unknown) => QueryBuilder)
    & ((column: string, operator: string, value: unknown) => QueryBuilder)
    & ((callback: (query: QueryBuilder) => void) => QueryBuilder);
  orWhere: ((column: string, value: unknown) => QueryBuilder)
    & ((column: string, operator: string, value: unknown) => QueryBuilder)
    & ((callback: (query: QueryBuilder) => void) => QueryBuilder);
  orWhereRaw: (sql: string, bindings?: unknown[]) => QueryBuilder;
  whereExists: (callback: (query: QueryBuilder) => void) => QueryBuilder;
  whereNotExists: (callback: (query: QueryBuilder) => void) => QueryBuilder;
  whereRaw: (sql: string, bindings?: unknown[]) => QueryBuilder;
  from: (table: string) => QueryBuilder;
  then: Promise<RecordValue[]>["then"];
};
type Connection = ((table: string) => QueryBuilder) & { raw: (sql: string, bindings?: unknown[]) => unknown };

export type RiskRegisterItem = {
  documentId: string;
  riskNumber: string;
  riskStatement: string | null;
  inherentRating: string | null;
  residualRating: string | null;
  treatmentStatus: string | null;
  treatmentOwner: { documentId: string; displayName: string } | null;
  targetDate: string | null;
  /** Derived on read by the single D-04 rule (D-26); the stored "Overdue" status is never read. */
  treatmentDueState: TreatmentDueState;
  assessment: { documentId: string; assessmentNumber: string; title: string };
};

export type RiskRegisterRepository = {
  count: (filters: RiskRegisterFilters) => Promise<number>;
  selectPage: (input: { filters: RiskRegisterFilters; sort: RiskRegisterSort; offset: number; limit: number }) => Promise<string[]>;
  hydrate: (documentIds: readonly string[]) => Promise<RecordValue[]>;
  selectedLabels?: (filters: RiskRegisterFilters) => Promise<Record<string, { documentId: string; label: string }>>;
};

export const MAX_RISK_DETAIL_CONTROL_IMPLEMENTATIONS = 1_000;

export type RiskRegisterDetailRepository = {
  findRisk: (documentId: string) => Promise<RecordValue | null>;
  findControlImplementations: (riskDocumentId: string, limit: number) => Promise<RecordValue[]>;
};

export class RiskRegisterError extends Error {
  constructor(public readonly status: 400 | 403 | 404, message: string) {
    super(message);
    this.name = "RiskRegisterError";
  }
}

const RISK_DETAIL_SCALAR_FIELDS = [
  "issueStatement", "riskStatement", "riskCategory", "riskSubCategory", "riskCause", "potentialImpact", "dataClassification",
  "inherentLikelihood", "highestInherentConsequence", "inherentRating", "inherentRatingRationale", "residualLikelihood",
  "highestResidualConsequence", "residualRating", "residualRatingRationale", "controlEffectiveness", "riskVelocity",
  "identifiedDate", "targetDate", "closureDate", "isExempted", "exemptionReviewDate", "escalationDetails", "comments",
  "riskCommunicationDate", "treatmentAction", "treatmentPlan", "treatmentResolveDate", "treatmentStatus",
] as const;

type RiskDetailUser = { documentId: string; displayName: string };
type RiskDetailNamedRelation = { documentId: string; name: string };
type RiskDetail = RecordValue & { parentLock: "mutable" | "released" };

function detailUnavailable(): never {
  throw new RiskRegisterError(404, "CSRM Risk is not available.");
}

function projectDetailUser(value: unknown): RiskDetailUser | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.displayName !== "string") detailUnavailable();
  return { documentId: value.documentId, displayName: value.displayName };
}

function projectNamedRelation(value: unknown): RiskDetailNamedRelation | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.name !== "string") detailUnavailable();
  return { documentId: value.documentId, name: value.name };
}

function projectRiskType(value: unknown): RecordValue | null {
  const relation = projectNamedRelation(value);
  if (!relation) return null;
  if (!isRecord(value)) detailUnavailable();
  return { ...relation, description: typeof value.description === "string" ? value.description : null };
}

function projectDetailAssessment(value: unknown): RecordValue {
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.assessmentNumber !== "string") detailUnavailable();
  const request = value.assessmentRequest;
  if (!isRecord(request) || typeof request.title !== "string") detailUnavailable();
  return { documentId: value.documentId, assessmentNumber: value.assessmentNumber, title: request.title };
}

function parentLock(value: unknown): "mutable" | "released" {
  if (!isRecord(value)) detailUnavailable();
  const hasApprover = value.approvedBy !== null && value.approvedBy !== undefined;
  const hasApprovalDate = value.approvalDate !== null && value.approvalDate !== undefined;
  if (isReleased(value)) return "released";
  if ((value.assessmentStatus === "draft" || value.assessmentStatus === "in-review") && !hasApprover && !hasApprovalDate) return "mutable";
  return detailUnavailable();
}

/**
 * The one method applyDisclosableParent calls on the outer query. Both this
 * module's QueryBuilder and knex's own builder satisfy it, so the alert and
 * report repositories reuse the rule rather than copy it.
 */
export type DisclosableParentQuery = {
  whereExists(callback: (parent: QueryBuilder) => void): unknown;
};

/**
 * Keep list disclosure identical to the fail-closed detail parent gate. A Risk
 * is disclosable when its parent assessment is mutable (draft or in review,
 * with no approval facts) or completely released (approved, an approval date
 * and an approver). The outer query must alias csrm_risks as `r`.
 */
export function applyDisclosableParent<T extends DisclosableParentQuery>(query: T): T {
  query.whereExists((parent) => {
    parent.from("csrm_risks_assessment_lnk as risk_assessment")
      .leftJoin("csrm_assessments as assessment_parent", "risk_assessment.csrm_assessment_id", "assessment_parent.id")
      .whereRaw("risk_assessment.csrm_risk_id = r.id")
      .where((eligible) => {
        eligible.where((mutable) => {
          mutable.whereRaw("assessment_parent.assessment_status IN (?, ?)", ["draft", "in-review"])
            .whereRaw("assessment_parent.approval_date IS NULL")
            .whereNotExists((approvedBy) => {
              approvedBy.from("csrm_assessments_approved_by_lnk as approval_link")
                .whereRaw("approval_link.csrm_assessment_id = assessment_parent.id")
                .select("approval_link.id");
            });
        }).orWhere((released) => {
          released.where("assessment_parent.assessment_status", "approved")
            .whereRaw("assessment_parent.approval_date IS NOT NULL")
            .whereExists((approvedBy) => {
              approvedBy.from("csrm_assessments_approved_by_lnk as approval_link")
                .whereRaw("approval_link.csrm_assessment_id = assessment_parent.id")
                .select("approval_link.id");
            });
        });
      })
      .select("risk_assessment.id");
  });
  return query;
}

function projectControlImplementation(document: RecordValue): RecordValue {
  if (typeof document.documentId !== "string" || !isRecord(document.control)
    || typeof document.control.documentId !== "string" || typeof document.control.controlNumber !== "string"
    || typeof document.control.name !== "string") detailUnavailable();
  return {
    documentId: document.documentId,
    control: {
      documentId: document.control.documentId,
      controlNumber: document.control.controlNumber,
      name: document.control.name,
    },
    controlOwner: projectDetailUser(document.controlOwner),
    controlStatus: document.controlStatus ?? null,
    effectivenessRating: document.effectivenessRating ?? null,
    evidence: document.evidence ?? null,
    implementationDueDate: document.implementationDueDate ?? null,
    implementedDate: document.implementedDate ?? null,
    reviewDate: document.reviewDate ?? null,
  };
}

function projectRiskRegisterDetail(document: RecordValue, implementations: RecordValue[]): RiskDetail {
  if (typeof document.documentId !== "string" || typeof document.riskNumber !== "string") detailUnavailable();
  const result: RiskDetail = {
    documentId: document.documentId,
    riskNumber: document.riskNumber,
    parentLock: parentLock(document.assessment),
  };
  for (const field of RISK_DETAIL_SCALAR_FIELDS) result[field] = document[field] ?? null;
  result.riskType = projectRiskType(document.riskType);
  result.riskOwner = projectDetailUser(document.riskOwner);
  result.treatmentOwner = projectDetailUser(document.treatmentOwner);
  result.informationSystemImpacted = projectNamedRelation(document.informationSystemImpacted);
  result.informationAssetImpacted = projectNamedRelation(document.informationAssetImpacted);
  result.assessment = projectDetailAssessment(document.assessment);
  result.controlImplementations = implementations.map(projectControlImplementation);
  return result;
}

export async function getRiskRegisterDetail(input: {
  repository: RiskRegisterDetailRepository;
  state: unknown;
  riskDocumentId: string;
}): Promise<RiskDetail> {
  assertRiskRegisterScope(input.state);
  if (input.riskDocumentId.length === 0) detailUnavailable();
  const risk = await input.repository.findRisk(input.riskDocumentId);
  if (!risk) detailUnavailable();
  const implementations = await input.repository.findControlImplementations(
    input.riskDocumentId,
    MAX_RISK_DETAIL_CONTROL_IMPLEMENTATIONS + 1,
  );
  if (implementations.length > MAX_RISK_DETAIL_CONTROL_IMPLEMENTATIONS) detailUnavailable();
  return projectRiskRegisterDetail(risk, implementations);
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertRiskRegisterScope(state: unknown): void {
  if (!isRecord(state)
    || !isRecord(state.csrmAuthorization)
    || state.csrmAuthorization.riskRegisterCollectionScope !== "all") {
    throw new RiskRegisterError(403, "CSRM Risk Register access is denied.");
  }
}

function projectUser(value: unknown): RiskRegisterItem["treatmentOwner"] {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.displayName !== "string") {
    throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  }
  return { documentId: value.documentId, displayName: value.displayName };
}

function projectAssessment(value: unknown): RiskRegisterItem["assessment"] {
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.assessmentNumber !== "string") {
    throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  }
  const request = value.assessmentRequest;
  if (!isRecord(request) || typeof request.title !== "string") {
    throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  }
  return { documentId: value.documentId, assessmentNumber: value.assessmentNumber, title: request.title };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * One register row. `today` is the caller's UTC calendar date: the treatment
 * due state is evaluated on it and never on a clock read here (D-02). The
 * closure date is read to derive that state but is not disclosed on the row.
 */
export function projectRiskRegisterItem(document: RecordValue, today: string): RiskRegisterItem {
  if (typeof document.documentId !== "string" || typeof document.riskNumber !== "string") {
    throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  }
  const treatmentStatus = stringOrNull(document.treatmentStatus);
  const targetDate = stringOrNull(document.targetDate);
  return {
    documentId: document.documentId,
    riskNumber: document.riskNumber,
    riskStatement: stringOrNull(document.riskStatement),
    inherentRating: stringOrNull(document.inherentRating),
    residualRating: stringOrNull(document.residualRating),
    treatmentStatus,
    treatmentOwner: projectUser(document.treatmentOwner),
    targetDate,
    treatmentDueState: deriveTreatmentDueState(
      { targetDate, treatmentStatus, closureDate: stringOrNull(document.closureDate) },
      today,
    ),
    assessment: projectAssessment(document.assessment),
  };
}

export async function listRiskRegister(input: {
  repository: RiskRegisterRepository;
  state: unknown;
  query: unknown;
  /** The UTC calendar date (YYYY-MM-DD) every row's treatment due state is evaluated on. */
  today: string;
}): Promise<{
  data: RiskRegisterItem[];
  meta: {
    pagination: { page: number; pageSize: number; pageCount: number; total: number };
    selectedLabels: Record<string, { documentId: string; label: string }>;
  };
}> {
  assertRiskRegisterScope(input.state);
  const { today } = input;
  if (!isUtcDate(today)) throw new RiskRegisterError(400, "CSRM Risk Register date is invalid.");
  const parsed = parseRiskRegisterQuery(input.query);
  const [total, ids, selectedLabels] = await Promise.all([
    input.repository.count(parsed.filters),
    input.repository.selectPage({
      filters: parsed.filters,
      sort: parsed.sort,
      offset: (parsed.page - 1) * parsed.pageSize,
      limit: parsed.pageSize,
    }),
    input.repository.selectedLabels?.(parsed.filters) ?? {},
  ]);
  const documents = ids.length > 0 ? await input.repository.hydrate(ids) : [];
  const byId = new Map(documents.map((document) => [document.documentId, document]));
  const ordered = ids.map((id) => byId.get(id)).filter((document): document is RecordValue => document !== undefined);
  if (ordered.length !== ids.length) throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  return {
    data: ordered.map((document) => projectRiskRegisterItem(document, today)),
    meta: {
      pagination: { page: parsed.page, pageSize: parsed.pageSize, pageCount: Math.ceil(total / parsed.pageSize), total },
      selectedLabels,
    },
  };
}

function relationExists(query: QueryBuilder, table: string, targetTable: string, foreignColumn: string, documentId: string): void {
  query.from(`${table} as link`)
    .leftJoin(`${targetTable} as target`, `link.${foreignColumn}`, "target.id")
    .whereRaw("link.csrm_risk_id = r.id")
    .where("target.document_id", documentId)
    .select("link.id");
}

function applyFilters(query: QueryBuilder, filters: RiskRegisterFilters): QueryBuilder {
  applyDisclosableParent(query);
  if (filters.q) {
    const escaped = `%${filters.q.toLocaleLowerCase("en-AU").replace(/[!%_]/g, "!$&")}%`;
    query.where((nested) => {
      nested.whereRaw("LOWER(r.risk_number) LIKE ? ESCAPE '!'", [escaped])
        .orWhereRaw("LOWER(r.risk_statement) LIKE ? ESCAPE '!'", [escaped]);
    });
  }
  if (filters.treatmentStatus) query.where("r.treatment_status", filters.treatmentStatus);
  if (filters.inherentRating) query.where("r.inherent_rating", filters.inherentRating);
  if (filters.residualRating) query.where("r.residual_rating", filters.residualRating);
  if (filters.targetDateFrom) query.where("r.target_date", ">=", filters.targetDateFrom);
  if (filters.targetDateTo) query.where("r.target_date", "<=", filters.targetDateTo);
  // D-36: a Risk is closed exactly when a closure date is recorded. Both fragments
  // are constants chosen from the parsed closed enum; no request value reaches the SQL.
  if (filters.state === "open") query.whereRaw("r.closure_date IS NULL");
  else if (filters.state === "closed") query.whereRaw("r.closure_date IS NOT NULL");
  const relations = [
    [filters.riskOwner, "csrm_risks_risk_owner_lnk", "idambox_users", "idambox_user_id"],
    [filters.treatmentOwner, "csrm_risks_treatment_owner_lnk", "idambox_users", "idambox_user_id"],
    [filters.assessment, "csrm_risks_assessment_lnk", "csrm_assessments", "csrm_assessment_id"],
    [filters.system, "csrm_risks_information_system_impacted_lnk", "csrm_information_systems", "csrm_information_system_id"],
    [filters.asset, "csrm_risks_information_asset_impacted_lnk", "csrm_information_assets", "csrm_information_asset_id"],
  ] as const;
  for (const [documentId, table, target, foreign] of relations) {
    if (documentId) query.whereExists((nested) => relationExists(nested, table, target, foreign, documentId));
  }
  if (filters.mitigationStatus === "none") {
    query.whereNotExists((nested) => {
      nested.from("csrm_control_implementations_risk_lnk as implementation_link")
        .whereRaw("implementation_link.csrm_risk_id = r.id")
        .select("implementation_link.id");
    });
  } else if (filters.mitigationStatus) {
    query.whereExists((nested) => {
      nested.from("csrm_control_implementations_risk_lnk as implementation_link")
        .leftJoin("csrm_control_implementations as implementation", "implementation_link.csrm_control_implementation_id", "implementation.id")
        .whereRaw("implementation_link.csrm_risk_id = r.id")
        .where("implementation.control_status", filters.mitigationStatus as string)
        .select("implementation_link.id");
    });
  }
  return query;
}

function orderedQuery(connection: Connection, filters: RiskRegisterFilters, sort: RiskRegisterSort): QueryBuilder {
  const query = applyFilters(connection("csrm_risks as r"), filters);
  const direction = sort.direction;
  if (sort.field === "treatmentOwner") {
    query.leftJoin("csrm_risks_treatment_owner_lnk as treatment_owner_link", "r.id", "treatment_owner_link.csrm_risk_id")
      .leftJoin("idambox_users as treatment_owner", "treatment_owner_link.idambox_user_id", "treatment_owner.id");
    query.orderByRaw("CASE WHEN treatment_owner.display_name IS NULL THEN 1 ELSE 0 END ASC")
      .orderBy("treatment_owner.display_name", direction);
  } else if (sort.field === "assessment") {
    query.leftJoin("csrm_risks_assessment_lnk as assessment_link", "r.id", "assessment_link.csrm_risk_id")
      .leftJoin("csrm_assessments as assessment", "assessment_link.csrm_assessment_id", "assessment.id")
      .orderBy("assessment.assessment_number", direction);
  } else if (sort.field === "inherentRating" || sort.field === "residualRating") {
    const column = sort.field === "inherentRating" ? "r.inherent_rating" : "r.residual_rating";
    /*
     * The severity ladder, Low to Critical, in the sort's direction. A Risk with no rating, or one
     * off the ladder, follows every rated Risk in both directions, as an undated Risk does in the
     * target-date sort, so a descending sort leads with Critical. The column comes from the closed
     * sort field and the direction from its parsed enum; both fragments are otherwise constant.
     */
    query.orderByRaw(`CASE WHEN ${column} IN ('Low', 'Moderate', 'High', 'Critical') THEN 0 ELSE 1 END ASC`)
      .orderByRaw(`CASE ${column} WHEN 'Low' THEN 1 WHEN 'Moderate' THEN 2 WHEN 'High' THEN 3 WHEN 'Critical' THEN 4 ELSE 5 END ${direction}`);
  } else if (sort.field === "targetDate") {
    query.orderByRaw("CASE WHEN r.target_date IS NULL THEN 1 ELSE 0 END ASC")
      .orderBy("r.target_date", direction);
  } else {
    const columns = {
      riskNumber: "r.risk_number",
      riskStatement: "r.risk_statement",
      treatmentStatus: "r.treatment_status",
    } as const;
    query.orderBy(columns[sort.field as keyof typeof columns], direction);
  }
  return query.orderBy("r.risk_number", "asc");
}

export function createStrapiRiskRegisterRepository(strapi: unknown): RiskRegisterRepository & RiskRegisterDetailRepository {
  if (!isRecord(strapi) || !isRecord(strapi.db) || typeof strapi.db.connection !== "function"
    || typeof strapi.documents !== "function") {
    throw new RiskRegisterError(400, "CSRM Risk Register repository is unavailable.");
  }
  const connection = strapi.db.connection as Connection;
  const documentsFor = strapi.documents as (uid: string) => {
    findOne?: (query: RecordValue) => Promise<RecordValue | null>;
    findMany: (query: RecordValue) => Promise<RecordValue[]>;
  };
  const documents = documentsFor("api::csrm-risk.csrm-risk");
  const controlImplementations = documentsFor("api::csrm-control-implementation.csrm-control-implementation");
  return {
    async findRisk(documentId) {
      if (typeof documents.findOne !== "function") throw new RiskRegisterError(400, "CSRM Risk Register repository is unavailable.");
      return documents.findOne({
        documentId,
        populate: {
          riskType: true,
          riskOwner: true,
          treatmentOwner: true,
          informationSystemImpacted: true,
          informationAssetImpacted: true,
          assessment: { populate: { approvedBy: true, assessmentRequest: true } },
        },
      });
    },
    async findControlImplementations(riskDocumentId, limit) {
      return controlImplementations.findMany({
        filters: { risk: { documentId: { $eq: riskDocumentId } } },
        populate: { control: true, controlOwner: true },
        sort: ["createdAt:asc", "documentId:asc"],
        limit,
      });
    },
    async count(filters) {
      const row = await applyFilters(connection("csrm_risks as r"), filters)
        .countDistinct({ total: "r.id" })
        .first();
      return Number(row?.total ?? 0);
    },
    async selectPage({ filters, sort, offset, limit }) {
      const rows = await orderedQuery(connection, filters, sort)
        .select("r.document_id")
        .offset(offset)
        .limit(limit) as unknown as RecordValue[];
      return rows.map((row) => row.document_id).filter((id): id is string => typeof id === "string");
    },
    async hydrate(documentIds) {
      return documents.findMany({
        filters: { documentId: { $in: [...documentIds] } },
        populate: {
          treatmentOwner: true,
          assessment: { populate: { assessmentRequest: true } },
        },
        limit: documentIds.length,
      });
    },
    async selectedLabels(filters) {
      const result: Record<string, { documentId: string; label: string }> = {};
      const requests = [
        ["riskOwner", filters.riskOwner, "api::idambox-user.idambox-user", "displayName"],
        ["treatmentOwner", filters.treatmentOwner, "api::idambox-user.idambox-user", "displayName"],
        ["assessment", filters.assessment, "api::csrm-assessment.csrm-assessment", "assessmentNumber"],
        ["system", filters.system, "api::csrm-information-system.csrm-information-system", "name"],
        ["asset", filters.asset, "api::csrm-information-asset.csrm-information-asset", "name"],
      ] as const;
      await Promise.all(requests.map(async ([key, documentId, uid, labelField]) => {
        if (!documentId) return;
        const rows = await documentsFor(uid).findMany({
          filters: { documentId: { $eq: documentId } },
          fields: ["documentId", labelField],
          limit: 1,
        });
        const row = rows[0];
        if (row?.documentId === documentId && typeof row[labelField] === "string") {
          result[key] = { documentId, label: row[labelField] as string };
        }
      }));
      return result;
    },
  };
}
