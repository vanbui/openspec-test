import type { Core } from "@strapi/strapi";
import { isSelectorQuery } from "../utils/selector-query";

const REQUESTOR_ROLE_NAME = "Requestor";
const SECURITY_ANALYST_ROLE_NAMES = new Set([
  "Security Analyst",
  "Security Analyst Agent",
]);
const HUMAN_SECURITY_ANALYST_ROLE_NAME = "Security Analyst";
const RELEASE_ASSESSMENT_OPERATION = "POST:/api/v1/risk_assessments/{assessmentId}/release";

/*
 * Operations no automation identity may reach, whatever the catalogue says.
 *
 * The capability catalogue already grants each of these to `role.security_analyst`
 * only. This set is the second, independent refusal: an identity holding an
 * analyst-shaped role name is still denied unless the grant comes from the human
 * Security Analyst role, so a later catalogue edit that accidentally widened one
 * of these Functions could not turn AI-assisted automation into a releasing
 * authority. The five questionnaire governance URLs are listed as literals so the
 * guard is in place from the moment each handler is mounted.
 */
const HUMAN_ANALYST_ONLY_OPERATIONS: ReadonlySet<string> = new Set([
  RELEASE_ASSESSMENT_OPERATION,
  "POST:/api/v1/questionnaires/{questionnaireId}/release",
  "POST:/api/v1/questionnaires/{questionnaireId}/return_to_review",
  "POST:/api/v1/questionnaires/{questionnaireId}/questions",
  "PATCH:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}",
  "DELETE:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}",
]);

type AuthorizationConfig = {
  operation: string;
  administrationListOperation?: string;
  requireReferenceDataScope?: boolean;
  requireAnalystAdministrationScope?: boolean;
  requireAnalystRiskRegisterScope?: boolean;
  requireAnalystRequestCollectionScope?: boolean;
  requireRequestOwnership?: boolean;
  requireRequestCollectionScope?: boolean;
  requireAssessmentOwnerCollectionScope?: boolean;
  requireQuestionnaireOwnership?: boolean;
  requireQuestionnaireCollectionScope?: boolean;
  /*
   * Set on every Requestor-reachable questionnaire resource route. The decision
   * reads the dedicated release fact directly (D-14); it never parses the
   * governance event log, so a malformed log cannot deny a released record.
   */
  requireQuestionnaireReleasedForRequestor?: boolean;
  /** Set on the analyst review surfaces, which are deliberately not My lists. */
  allowAnalystQuestionnaireReviewScope?: boolean;
};

type IdamBoxIdentity = { documentId: string; id?: number };
type FunctionApi = { url?: string };
type FunctionGrant = { functionApis?: FunctionApi[] };
type RoleGrant = { name?: string; functions?: FunctionGrant[] };
type IdamBoxUser = IdamBoxIdentity & { accountStatus?: string; roles?: RoleGrant[] };
type AssessmentRequest = { requestor?: IdamBoxIdentity | null };
type Questionnaire = { assessmentRequest?: AssessmentRequest | null; releasedAt?: unknown };
type CollectionScope = "own" | "all";
type AssessmentRequestActor = "requestor" | "analyst";

type AuthorizationContext = {
  forbidden?: (message: string) => unknown;
  params: { id?: string; requestId?: string; questionnaireId?: string };
  query?: Record<string, unknown>;
  request?: { query?: Record<string, unknown> };
  state: {
    idamboxUser?: IdamBoxIdentity;
    csrmAuthorization?: {
      assessmentRequestActor?: AssessmentRequestActor;
      assessmentRequestCollectionScope?: CollectionScope;
      assessmentRequestRequestorId?: number;
      assessmentOwnerCollectionScope?: "own";
      assessmentOwnerDocumentId?: string;
      assessmentReviewCollectionScope?: "all";
      riskRegisterCollectionScope?: "all";
      administrationCollectionScope?: "all";
      referenceDataCollectionScope?: "all";
      questionnaireActor?: AssessmentRequestActor;
      questionnaireCollectionScope?: CollectionScope;
      questionnaireRequestorId?: number;
    };
  };
};

type DocumentService = {
  findMany: (params: unknown) => Promise<RoleGrant[]>;
  findOne: (params: unknown) => Promise<IdamBoxUser | AssessmentRequest | null>;
};
type AuthorizationStrapi = { documents: (uid: string) => DocumentService };
type EffectiveGrants = {
  explicitRoles: RoleGrant[];
  requestorRoles: RoleGrant[];
  requestorId: number;
};

function deny(context: AuthorizationContext, message: string): false {
  context.forbidden?.(message);
  return false;
}

function isIdamBoxIdentity(value: unknown): value is IdamBoxIdentity {
  return typeof value === "object" && value !== null && typeof (value as { documentId?: unknown }).documentId === "string";
}

function hasOperation(roles: RoleGrant[], operation: string): boolean {
  return roles.some((role) => role.functions?.some((functionGrant) =>
    functionGrant.functionApis?.some((functionApi) => functionApi.url === operation),
  ));
}

function hasExplicitAnalystOperation(roles: RoleGrant[], operation: string): boolean {
  return roles.some((role) =>
    role.name !== undefined && SECURITY_ANALYST_ROLE_NAMES.has(role.name) && hasOperation([role], operation),
  );
}

async function loadEffectiveGrants(
  strapi: AuthorizationStrapi,
  identity: IdamBoxIdentity,
): Promise<EffectiveGrants | null> {
  const userService = strapi.documents("api::idambox-user.idambox-user");
  const roleService = strapi.documents("api::role.role");
  const user = (await userService.findOne({
    documentId: identity.documentId,
    populate: { roles: { populate: { functions: { populate: { functionApis: true } } } } },
  })) as IdamBoxUser | null;

  if (!user || user.accountStatus !== "active") {
    return null;
  }

  const requestorRoles = await roleService.findMany({
    filters: { name: { $eq: REQUESTOR_ROLE_NAME } },
    populate: { functions: { populate: { functionApis: true } } },
    limit: 1,
  });

  if (typeof user.id !== "number") return null;
  return { explicitRoles: user.roles ?? [], requestorRoles, requestorId: user.id };
}

function setCollectionScope(context: AuthorizationContext, scope: CollectionScope, requestorId?: number): void {
  context.state.csrmAuthorization = {
    ...context.state.csrmAuthorization,
    assessmentRequestCollectionScope: scope,
    ...(requestorId === undefined ? {} : { assessmentRequestRequestorId: requestorId }),
  };
}

function setAssessmentOwnerCollectionScope(context: AuthorizationContext, ownerDocumentId: string): void {
  context.state.csrmAuthorization = {
    ...context.state.csrmAuthorization,
    assessmentOwnerCollectionScope: "own",
    assessmentOwnerDocumentId: ownerDocumentId,
  };
}

/**
 * The authoritative release gate. A generated questionnaire stays analyst-only
 * until an explicit Analyst release writes this dedicated fact, and an absent
 * fact means never released.
 */
function isReleased(questionnaire: Questionnaire): boolean {
  return typeof questionnaire.releasedAt === "string" && questionnaire.releasedAt.length > 0;
}

function hasHumanAnalystOperation(roles: RoleGrant[], operation: string): boolean {
  return roles.some((role) =>
    role.name === HUMAN_SECURITY_ANALYST_ROLE_NAME && hasOperation([role], operation),
  );
}

function isCanonicalPickerPaginationQuery(query: Record<string, unknown>): boolean {
  const entries = Object.entries(query);
  if (entries.length === 0) return true;
  const values = new Map(entries);
  if (values.size !== entries.length || [...values.keys()].some((key) => key !== "page" && key !== "pageSize")) return false;
  const page = values.get("page");
  const pageSize = values.get("pageSize");
  if (page !== undefined && (typeof page !== "string" || !/^[1-9]\d*$/.test(page)
    || !Number.isSafeInteger(Number(page)) || Number(page) > 1_000_000)) return false;
  if (pageSize !== undefined && (typeof pageSize !== "string" || ![10, 25, 50, 100].includes(Number(pageSize)))) return false;
  return true;
}

function setAssessmentRequestActor(context: AuthorizationContext, actor: AssessmentRequestActor): void {
  context.state.csrmAuthorization = {
    ...context.state.csrmAuthorization,
    assessmentRequestActor: actor,
  };
}

function setQuestionnaireDecision(
  context: AuthorizationContext,
  actor: AssessmentRequestActor,
  scope?: CollectionScope,
  requestorId?: number,
): void {
  context.state.csrmAuthorization = {
    ...context.state.csrmAuthorization,
    questionnaireActor: actor,
    ...(scope === undefined ? {} : { questionnaireCollectionScope: scope }),
    ...(requestorId === undefined ? {} : { questionnaireRequestorId: requestorId }),
  };
}

export default async function csrmAuthorization(
  policyContext: AuthorizationContext,
  config: AuthorizationConfig,
  { strapi }: { strapi: Core.Strapi },
): Promise<boolean> {
  const identity = policyContext.state.idamboxUser;
  const requestQuery = policyContext.query ?? policyContext.request?.query ?? {};
  const operation = config.administrationListOperation && !isSelectorQuery(requestQuery)
    ? config.administrationListOperation
    : config.operation;
  if (!isIdamBoxIdentity(identity) || !operation) {
    return deny(policyContext, "CSRM FunctionAPI access is denied.");
  }

  const authorizationStrapi = strapi as unknown as AuthorizationStrapi;
  const grants = await loadEffectiveGrants(authorizationStrapi, identity);
  if (!grants) {
    return deny(policyContext, "CSRM FunctionAPI access is denied.");
  }

  const explicitAnalystOperation = hasExplicitAnalystOperation(grants.explicitRoles, operation);
  const requestorOperation = hasOperation(grants.requestorRoles, operation);
  const effectiveOperation = explicitAnalystOperation || hasOperation(grants.explicitRoles, operation) || requestorOperation;
  if (!effectiveOperation) {
    return deny(policyContext, "CSRM FunctionAPI access is denied.");
  }
  if (HUMAN_ANALYST_ONLY_OPERATIONS.has(operation)
    && !hasHumanAnalystOperation(grants.explicitRoles, operation)) {
    return deny(policyContext, operation === RELEASE_ASSESSMENT_OPERATION
      ? "CSRM assessment release requires a human Security Analyst."
      : "CSRM questionnaire governance requires a human Security Analyst.");
  }

  setAssessmentRequestActor(policyContext, explicitAnalystOperation ? "analyst" : "requestor");

  // A bounded reference-data read (the selector hydration routes) is authorised
  // by its own FunctionAPI grant and nothing wider. The option was declared here
  // from the start but never implemented, so the hydration services asserted a
  // scope no route could grant them.
  if (config.requireReferenceDataScope) {
    policyContext.state.csrmAuthorization = {
      ...policyContext.state.csrmAuthorization,
      referenceDataCollectionScope: "all",
    };
    return true;
  }

  if (config.requireAnalystAdministrationScope || (config.administrationListOperation && operation === config.administrationListOperation)) {
    if (!hasHumanAnalystOperation(grants.explicitRoles, operation)) {
      return deny(policyContext, "CSRM Administration access is denied.");
    }
    policyContext.state.csrmAuthorization = {
      ...policyContext.state.csrmAuthorization,
      administrationCollectionScope: "all",
    };
    return true;
  }

  if (config.administrationListOperation) {
    if (operation === config.operation) {
      policyContext.state.csrmAuthorization = {
        ...policyContext.state.csrmAuthorization,
        referenceDataCollectionScope: "all",
      };
      return true;
    }
    policyContext.state.csrmAuthorization = {
      ...policyContext.state.csrmAuthorization,
      administrationCollectionScope: "all",
    };
    return true;
  }

  if (config.requireAnalystRiskRegisterScope) {
    if (!hasHumanAnalystOperation(grants.explicitRoles, config.operation)) {
      return deny(policyContext, "CSRM Risk Register access is denied.");
    }
    policyContext.state.csrmAuthorization = {
      ...policyContext.state.csrmAuthorization,
      riskRegisterCollectionScope: "all",
    };
    return true;
  }

  if (config.requireAnalystRequestCollectionScope) {
    if (!explicitAnalystOperation) {
      return deny(policyContext, "CSRM assessment review access is denied.");
    }
    policyContext.state.csrmAuthorization = {
      ...policyContext.state.csrmAuthorization,
      assessmentReviewCollectionScope: "all",
    };
    return true;
  }

  if (config.requireQuestionnaireCollectionScope) {
    // A My list is owner-scoped for every actor. The analyst review surfaces are
    // separate routes and keep the wider scope their explicit grant carries.
    if (config.allowAnalystQuestionnaireReviewScope && explicitAnalystOperation) {
      setQuestionnaireDecision(policyContext, "analyst", "all");
      return true;
    }
    setQuestionnaireDecision(policyContext, explicitAnalystOperation ? "analyst" : "requestor", "own", grants.requestorId);
    return true;
  }

  if (config.requireQuestionnaireOwnership) {
    setQuestionnaireDecision(policyContext, explicitAnalystOperation ? "analyst" : "requestor");
    const documentId = policyContext.params.questionnaireId;
    if (!documentId) return deny(policyContext, "CSRM questionnaire access is denied.");
    if (explicitAnalystOperation) return true;
    // One read resolves both record-level questions: who owns the questionnaire
    // and whether it has been released. The release fact is selected by name so
    // this decision never depends on the mutable governance log.
    const questionnaire = (await authorizationStrapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({
      documentId,
      populate: { assessmentRequest: { populate: { requestor: true } } },
    })) as Questionnaire | null;
    if (questionnaire?.assessmentRequest?.requestor?.documentId !== identity.documentId) {
      return deny(policyContext, "CSRM questionnaire access is denied.");
    }
    if (config.requireQuestionnaireReleasedForRequestor && !isReleased(questionnaire)) {
      return deny(policyContext, "CSRM questionnaire access is denied.");
    }
    return true;
  }

  if (config.requireRequestCollectionScope) {
    setCollectionScope(policyContext, "own", grants.requestorId);
    return true;
  }

  if (config.requireAssessmentOwnerCollectionScope) {
    setAssessmentOwnerCollectionScope(policyContext, identity.documentId);
    return true;
  }

  if (!config.requireRequestOwnership) {
    return true;
  }

  const documentId = policyContext.params.id ?? policyContext.params.requestId;
  if (!documentId) {
    return deny(policyContext, "CSRM assessment request access is denied.");
  }
  if (explicitAnalystOperation) {
    return true;
  }

  const assessmentRequestService = authorizationStrapi.documents("api::csrm-assessment-request.csrm-assessment-request");
  const assessmentRequest = (await assessmentRequestService.findOne({
    documentId,
    populate: { requestor: true },
  })) as AssessmentRequest | null;
  if (!assessmentRequest || assessmentRequest.requestor?.documentId !== identity.documentId) {
    return deny(policyContext, "CSRM assessment request access is denied.");
  }
  return true;
}
