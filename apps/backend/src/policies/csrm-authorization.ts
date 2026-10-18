import type { Core } from "@strapi/strapi";
import { CSRM_ANALYST_INSIGHT_OPERATIONS } from "../api/csrm-analyst-insight/operations";
import { CSRM_ASSESSMENT_OPERATIONS } from "../api/csrm-assessment/operations";
import { CSRM_REQUEST_ASSIGNMENT_OPERATIONS, listAnalystReviewRequests } from "../api/csrm-assessment-request/operations";
import { CSRM_QUESTIONNAIRE_OPERATIONS } from "../api/csrm-questionnaire/operations";
import { CSRM_REQUEST_ATTACHMENT_OPERATIONS } from "../api/csrm-request-attachment/operations";
import { CSRM_REQUEST_NOTE_OPERATIONS } from "../api/csrm-request-note/operations";
import { CSRM_RISK_OPERATIONS } from "../api/csrm-risk/operations";
import { isEligiblePerson, SECURITY_ANALYST_AGENT_ROLE_NAME } from "../csrm/people/eligible-person";
import { isSelectorQuery } from "../utils/selector-query";
import { isRegisteredSourceServiceUser } from "../iam/identity/source-principal";

const REQUESTOR_ROLE_NAME = "Requestor";
/** The human Security Analyst role (Phase 13 eligibility reads it from here, never from a duplicated literal). */
export const HUMAN_SECURITY_ANALYST_ROLE_NAME = "Security Analyst";
export { SECURITY_ANALYST_AGENT_ROLE_NAME };
const SECURITY_ANALYST_ROLE_NAMES = new Set([
  HUMAN_SECURITY_ANALYST_ROLE_NAME,
  SECURITY_ANALYST_AGENT_ROLE_NAME,
]);
const RELEASE_ASSESSMENT_OPERATION = "POST:/api/v1/risk_assessments/{assessmentId}/release";
/* Phase 13 (D-26, D-30): the AI-input mark on a request note, which refuses automation in its own words. */
const NOTE_AI_INPUT_OPERATION: string = CSRM_REQUEST_NOTE_OPERATIONS.setAiInput;
/* Phase 14 (D-30, D-31, D-38): the AI inclusion of a request attachment and its text preview, which refuse automation in their own words. */
const ATTACHMENT_AI_INPUT_OPERATION: string = CSRM_REQUEST_ATTACHMENT_OPERATIONS.setAiInput;
const ATTACHMENT_AI_OPERATIONS: ReadonlySet<string> = new Set([CSRM_REQUEST_ATTACHMENT_OPERATIONS.setAiInput, CSRM_REQUEST_ATTACHMENT_OPERATIONS.getAiText]);
const ANALYST_INSIGHT_OPERATIONS: ReadonlySet<string> = new Set(Object.values(CSRM_ANALYST_INSIGHT_OPERATIONS));
/* Phase 13 (G-1, D-30): the request assignment operations, which refuse automation in their own words. */
const REQUEST_ASSIGNMENT_OPERATIONS: ReadonlySet<string> = new Set(Object.values(CSRM_REQUEST_ASSIGNMENT_OPERATIONS));
/* Phase 12 (D-24, D-25, D-32): starting, following and retrying a draft, reading an AI run and deciding on its proposals. */
const AI_ASSISTANCE_OPERATIONS: ReadonlySet<string> = new Set([
  "POST:/api/v1/questionnaires/{questionnaireId}/generate_assessment",
  "GET:/api/v1/assessment_draft_jobs/{jobId}",
  "POST:/api/v1/assessment_draft_jobs/{jobId}/retry",
  "GET:/api/v1/ai_runs/{runId}",
  "POST:/api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions",
]);

/*
 * Phase 15 (D-31, W-9): asking the AI about a questionnaire and deciding its proposals is human analyst work, refused to
 * automation in its own sentence.
 */
const QUESTIONNAIRE_AI_OPERATIONS: ReadonlySet<string> = new Set([
  "POST:/api/v1/questionnaires/{questionnaireId}/ai_proposals",
  "GET:/api/v1/questionnaires/{questionnaireId}/ai_proposals",
  "POST:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite",
  "GET:/api/v1/questionnaire_proposal_jobs/{jobId}",
  "POST:/api/v1/questionnaire_proposal_jobs/{jobId}/retry",
  "POST:/api/v1/questionnaires/{questionnaireId}/ai_proposal_decisions",
]);

/*
 * Phase 16 (D-43): withdrawing a Risk, reinstating it and reading its history are human analyst work. The catalogue
 * grants them to role.security_analyst alone through API-only Functions, and this set refuses automation again, in its
 * own sentence. Listed as literals, each with the handler it guards.
 */
const RISK_CURATION_OPERATIONS: ReadonlySet<string> = new Set([
  "POST:/api/v1/risk_assessments/{assessmentId}/risk_withdrawals",
  "POST:/api/v1/risk_assessments/{assessmentId}/risk_reinstatements",
  "GET:/api/v1/risks/{riskId}/history",
]);

/*
 * Phase 16 (D-26, D-41, D-43; G-3): asking the AI to suggest more risks or rewrite one, following and retrying a risk
 * proposal job and reading an assessment's AI proposals are human analyst work, so every run names an accountable analyst. The catalogue grants them
 * to role.security_analyst alone through API-only Functions, and this set refuses automation again, in its own sentence.
 * Listed as literals, each with the handler it guards.
 */
const RISK_AI_PROPOSAL_OPERATIONS: ReadonlySet<string> = new Set([
  "POST:/api/v1/risk_assessments/{assessmentId}/risk_suggestions",
  "POST:/api/v1/risks/{riskId}/rewrite",
  "GET:/api/v1/risk_proposal_jobs/{jobId}",
  "POST:/api/v1/risk_proposal_jobs/{jobId}/retry",
  "GET:/api/v1/risk_assessments/{assessmentId}/ai_proposals",
]);

/*
 * Phase 19 (D-13): the analyst exports are human analyst work only. The catalogue grants each to role.security_analyst
 * alone through a human-only API Function, and HUMAN_ANALYST_ONLY_OPERATIONS (which spreads this set) refuses automation
 * again; the human-only refusal words each in the exports' own words (BE2-06). Listed as literals, each with the handler
 * it guards; SERVICE_IDENTITY_REFUSED_OPERATIONS below refuses the service identity on every export as well.
 */
export const HUMAN_ONLY_EXPORT_OPERATIONS: ReadonlySet<string> = new Set([
  "GET:/api/v1/risks/export?format={format}",
  // 19-07: the review queue's export (exportReviewRequests), with the queue read it discloses.
  "GET:/api/v1/assessment_requests/export",
  // 19-08: the questionnaire review list's export (exportQuestionnaires), with the review list read it discloses.
  "GET:/api/v1/questionnaires/export",
  // 19-08: the alert list's export (exportAlerts), with the alert read and the insight scope's underlying reads. It is
  // outside ANALYST_INSIGHT_OPERATIONS, so it refuses in the exports' words, not the insights'.
  "GET:/api/v1/alerts/export",
  // 19-09: the reserved report export (reports.export), with the report read and the insight scope's underlying reads.
  // Outside ANALYST_INSIGHT_OPERATIONS as well, so it refuses in the exports' words.
  "POST:/api/v1/reports/{reportKey}/export",
  // 19-10: the analyst Risk assessments list's export (exportAssessments), with the list read it discloses.
  "GET:/api/v1/risk_assessments/export",
  // 19-14: the four reference-list exports (export<Plural>), each with its Administration list read. The templates and
  // error reports are human-only through the Administration scope, as every Administration operation is.
  "GET:/api/v1/risk_types/export?format={format}",
  "GET:/api/v1/controls/export?format={format}",
  "GET:/api/v1/information_systems/export?format={format}",
  "GET:/api/v1/information_assets/export?format={format}",
]);

/*
 * Operations no automation identity may reach, whatever the catalogue says: the
 * assessment release, the five questionnaire governance operations, the read of a
 * request's current generation jobs and the five analyst insight operations. An
 * identity holding an analyst-shaped role name is
 * denied each of them unless the grant comes from the human Security Analyst role.
 *
 * For the assessment release this set is the refusal itself. Its FunctionAPI
 * belongs to the Risk Assessment Details Function
 * (`function.risk_assessments.risk_assessment_details`), which the catalogue grants
 * to `role.security_analyst_agent` as well as to `role.security_analyst`. The
 * service agent's role therefore carries the release grant, and only this guard
 * keeps AI-assisted automation from becoming a releasing authority (the
 * authorization matrix's release row refuses the seeded agent).
 *
 * The catalogue grants the other eleven to `role.security_analyst` only, so for them
 * the set is a second, independent refusal: a later catalogue edit that
 * accidentally widened one of those Functions still could not reach automation.
 * The five questionnaire governance URLs are listed as literals so the guard is in
 * place from the moment each handler is mounted. The read of a request's current
 * generation jobs (Phase 10 D-25) is listed the same way: every human analyst
 * may see what is generating on a request, and no automation identity may. The
 * analyst insight operations (D-07) summarise workload across every record in the analyst's scope, so they
 * are human analyst work only, and the guard is in place before any insight
 * handler is mounted. Phase 12 (D-32, G-3): every AI run needs an accountable human initiator, so starting,
 * following and retrying a draft are human analyst work only, as is reading what any AI run used (D-25).
 * Phase 13 (G-1, D-30): a request's accountable analyst is a human, so changing who holds a request is human
 * analyst work only; the catalogue grants it to `role.security_analyst` alone, and this set refuses automation again.
 * Reading who may hold a request (D-06) names people, so it is human analyst work only as well. Marking a request
 * note as changing the AI inputs (D-26, D-30) chooses what free text reaches the AI provider, so it is a human
 * analyst's decision only: the catalogue grants it to `role.security_analyst` alone, and this set refuses
 * automation again. The literal is listed with the handler it guards, so it is guarded the moment it is served.
 * Phase 14 (D-30, D-31, D-38, G-3): including a request attachment's text in the AI inputs, and reading that text,
 * choose what file content reaches the AI provider, so they are a human analyst's alone: the catalogue grants them to
 * `role.security_analyst` alone, and this set refuses automation again. Both are listed as literals, as the note mark is.
 */
export const HUMAN_ANALYST_ONLY_OPERATIONS: ReadonlySet<string> = new Set([
  ...AI_ASSISTANCE_OPERATIONS,
  ...QUESTIONNAIRE_AI_OPERATIONS,
  ...RISK_CURATION_OPERATIONS,
  ...RISK_AI_PROPOSAL_OPERATIONS,
  RELEASE_ASSESSMENT_OPERATION,
  "POST:/api/v1/questionnaires/{questionnaireId}/release",
  "POST:/api/v1/questionnaires/{questionnaireId}/return_to_review",
  "POST:/api/v1/questionnaires/{questionnaireId}/questions",
  "PATCH:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}",
  "DELETE:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}",
  "GET:/api/v1/assessment_requests/{requestId}/generation_jobs",
  "PUT:/api/v1/assessment_requests/{requestId}/assignee",
  "GET:/api/v1/assessment_requests/{requestId}/assignable_analysts",
  "PUT:/api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input",
  "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input",
  "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text",
  // Phase 19 (D-13): the human-only analyst exports (HUMAN_ONLY_EXPORT_OPERATIONS above).
  ...HUMAN_ONLY_EXPORT_OPERATIONS,
  ...ANALYST_INSIGHT_OPERATIONS,
]);

/*
 * Operations the service identity is refused whatever it holds (Phase 19 D-13; G-1). A caller that is not an eligible
 * person under isEligiblePerson (the holder of the role SECURITY_ANALYST_AGENT_ROLE_NAME names) is denied every member,
 * through any grant: a grant through the Requestor birthright would otherwise admit the service identity to an own-record
 * export, which HUMAN_ANALYST_ONLY_OPERATIONS cannot list without refusing human Requestors. The set is generic: Phase 19
 * adds its 14 export operations, and Phases 19.1 and 17 add their own members, each with its own denial sentence in
 * serviceIdentityDenialMessage. Listed as literals, each with the handler it guards.
 */
export const SERVICE_IDENTITY_REFUSED_OPERATIONS: ReadonlySet<string> = new Set([
  "GET:/api/v1/risks/export?format={format}",
  // 19-07: the review queue's export (exportReviewRequests).
  "GET:/api/v1/assessment_requests/export",
  // 19-07: the caller's own requests (exportMyRequests), granted through the Requestor birthright: not human-only.
  "GET:/api/v1/my_requests/export",
  // 19-08: the questionnaire review list's export (exportQuestionnaires).
  "GET:/api/v1/questionnaires/export",
  // 19-08: the caller's own questionnaires (exportMyQuestionnaires), granted through the Requestor birthright: not human-only.
  "GET:/api/v1/my_questionnaires/export",
  // 19-08: the alert list's export (exportAlerts).
  "GET:/api/v1/alerts/export",
  // 19-09: the reserved report export (reports.export).
  "POST:/api/v1/reports/{reportKey}/export",
  // 19-10: the released risk assessment (exportReleasedAssessment), granted through the Requestor birthright as well as
  // the Security Analyst role: not human-only, because the one record-read check admits its Requestor.
  "GET:/api/v1/risk_assessments/{assessmentId}/export",
  // 19-10: the analyst Risk assessments list's export (exportAssessments).
  "GET:/api/v1/risk_assessments/export",
  // 19-10: the caller's own released assessments (exportMyAssessments), granted through the Requestor birthright: not
  // human-only.
  "GET:/api/v1/my_risk_assessments/export",
  // 19-14: the four reference-list exports (export<Plural>).
  "GET:/api/v1/risk_types/export?format={format}",
  "GET:/api/v1/controls/export?format={format}",
  "GET:/api/v1/information_systems/export?format={format}",
  "GET:/api/v1/information_assets/export?format={format}",
]);

/** The service identity's refusal on a SERVICE_IDENTITY_REFUSED_OPERATIONS member; a later non-export member adds its branch first. */
function serviceIdentityDenialMessage(_operation: string): string {
  return "CSRM exports are refused to automation identities.";
}

/*
 * D-14: an analyst insight must never widen scope. The dashboard, the alerts and
 * the reports disclose facts from the Risk Register, the review queue, the
 * questionnaire review list and the assessment review list, so the human analyst
 * must hold each of those reads as well as the insight operation itself.
 */
const ANALYST_INSIGHT_UNDERLYING_READS = [
  CSRM_RISK_OPERATIONS.listRegister,
  listAnalystReviewRequests,
  CSRM_QUESTIONNAIRE_OPERATIONS.listAll,
  CSRM_ASSESSMENT_OPERATIONS.list,
] as const;

function humanAnalystDenialMessage(operation: string): string {
  if (operation === RELEASE_ASSESSMENT_OPERATION) return "CSRM assessment release requires a human Security Analyst.";
  if (ANALYST_INSIGHT_OPERATIONS.has(operation)) return "CSRM analyst insights require a human Security Analyst.";
  // IN-101: the AI operations refuse automation in their own words, not questionnaire governance's.
  if (AI_ASSISTANCE_OPERATIONS.has(operation)) return "CSRM AI assistance requires a human Security Analyst.";
  if (QUESTIONNAIRE_AI_OPERATIONS.has(operation)) return "Asking the AI about a questionnaire or deciding its proposals requires a human Security Analyst.";
  if (RISK_CURATION_OPERATIONS.has(operation)) return "CSRM risk curation is limited to human Security Analysts.";
  if (RISK_AI_PROPOSAL_OPERATIONS.has(operation)) return "CSRM risk AI proposals are limited to human Security Analysts.";
  if (REQUEST_ASSIGNMENT_OPERATIONS.has(operation)) return "CSRM request assignment requires a human Security Analyst.";
  if (operation === NOTE_AI_INPUT_OPERATION) return "Marking a note as changing the AI inputs requires a human Security Analyst.";
  if (ATTACHMENT_AI_OPERATIONS.has(operation)) return "Choosing which attachment text the AI may read requires a human Security Analyst.";
  // Phase 19: a human-only analyst export refuses in the exports' own words. The branch reads the export set, never the
  // service-identity refusal set, so the non-export members Phases 17 and 19.1 add there keep their own wording (BE2-06).
  if (HUMAN_ONLY_EXPORT_OPERATIONS.has(operation)) return "CSRM analyst exports require a human Security Analyst.";
  return "CSRM questionnaire governance requires a human Security Analyst.";
}

type AuthorizationConfig = {
  operation: string;
  administrationListOperation?: string;
  requireReferenceDataScope?: boolean;
  requireAnalystAdministrationScope?: boolean;
  requireAnalystRiskRegisterScope?: boolean;
  /** Set on every analyst insight route: the dashboard summary, alerts and reports. */
  requireAnalystInsightScope?: boolean;
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
  /*
   * Phase 19 (D-13): set on every export route, the list read the export discloses. The caller must hold it through the
   * same grant path that admitted the export (the human Security Analyst role for an analyst export; the explicit or
   * birthright roles otherwise), as the analyst insights require their underlying reads.
   */
  underlyingRead?: string;
  /*
   * BE2-01 (Phase 19 code review): the further reads an export discloses beyond `underlyingRead`, each required the same
   * way. The released-assessment export discloses the detail, the released risks read and each Risk's control
   * implementations read, so it names all three (D-13, D-21).
   */
  additionalUnderlyingReads?: readonly string[];
};

export type IdamBoxIdentity = { documentId: string; id?: number };
type FunctionApi = { url?: string };
type FunctionGrant = { name?: string; menuPath?: string | null; functionApis?: FunctionApi[] };
export type RoleGrant = { name?: string; functions?: FunctionGrant[] };
type IdamBoxUser = IdamBoxIdentity & { accountStatus?: string; displayName?: string; roles?: RoleGrant[] };
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
      analystInsightScope?: "all";
      administrationCollectionScope?: "all";
      referenceDataCollectionScope?: "all";
      questionnaireActor?: AssessmentRequestActor;
      questionnaireCollectionScope?: CollectionScope;
      questionnaireRequestorId?: number;
      /*
       * Phase 13 (T-13-09): facts of the resolved IdamBox User, never of the query. Whether the caller holds the
       * operation through the human Security Analyst role, and the caller's numeric user id for later SQL.
       */
      humanAnalyst?: boolean;
      viewerId?: number;
      /*
       * WR-101 (G-1, D-05): `humanAnalyst`, held by an eligible person (isEligiblePerson: never a holder of the Security
       * Analyst Agent role, whatever else they hold). Only such a caller acts on, or is offered, a request's assignment.
       */
      eligibleHumanAnalyst?: boolean;
      /*
       * WR-102 (D-26, D-30): the caller holds the AI-input mark operation through the human Security Analyst role, the
       * human-analyst-only guard's own test, and is an eligible person. The mark is set or offered on this fact alone,
       * when posting as later, never on the notes grant.
       */
      canMarkNoteAiInputs?: boolean;
      /*
       * Phase 14 (D-28, D-30): the caller holds the attachment AI inclusion through the human Security Analyst role, the
       * human-analyst-only guard's own test, and is an eligible person. A file's AI facts are served, and its inclusion
       * changed or previewed, on this fact alone, never on the attachments grant.
       */
      canUseAttachmentAiInputs?: boolean;
    };
  };
};

type DocumentService = {
  findMany: (params: unknown) => Promise<RoleGrant[]>;
  findOne: (params: unknown) => Promise<IdamBoxUser | AssessmentRequest | null>;
};
export type AuthorizationStrapi = { documents: (uid: string) => DocumentService };
export type EffectiveGrants = {
  registeredSourceService: boolean;
  displayName: string;
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

export function hasOperation(roles: RoleGrant[], operation: string): boolean {
  return roles.some((role) => role.functions?.some((functionGrant) =>
    functionGrant.functionApis?.some((functionApi) => functionApi.url === operation),
  ));
}

function hasExplicitAnalystOperation(roles: RoleGrant[], operation: string): boolean {
  return roles.some((role) =>
    role.name !== undefined && SECURITY_ANALYST_ROLE_NAMES.has(role.name) && hasOperation([role], operation),
  );
}

export async function loadEffectiveGrants(
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

  const registeredSourceService = await isRegisteredSourceServiceUser(strapi, identity.documentId);
  const requestorRoles = registeredSourceService ? [] : await roleService.findMany({
    filters: { name: { $eq: REQUESTOR_ROLE_NAME } },
    populate: { functions: { populate: { functionApis: true } } },
    limit: 1,
  });

  if (typeof user.id !== "number") return null;
  // A malformed service grant must never become human access through a catalogue edit.
  const explicitRoles = registeredSourceService
    ? (user.roles ?? []).filter((role) => role.name === "Identity Provisioning")
    : user.roles ?? [];
  return { displayName: user.displayName ?? "", explicitRoles, requestorRoles, requestorId: user.id, registeredSourceService };
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

export function hasHumanAnalystOperation(roles: RoleGrant[], operation: string): boolean {
  return roles.some((role) =>
    role.name === HUMAN_SECURITY_ANALYST_ROLE_NAME && hasOperation([role], operation),
  );
}

/*
 * Verifier W-3 (D-21, G-1): whether the resolved IdamBox User (`ctx.state.idamboxUser`) acts on `operation` as a human
 * Security Analyst, decided as the human-analyst-only guard decides it: an active user holding the operation through the
 * human Security Analyst Role. An automation identity holding it only through an analyst-shaped Role (the Security
 * Analyst Agent) is not one. It reads only the user's grants, never the auth mode.
 */
export async function isHumanSecurityAnalyst(strapi: AuthorizationStrapi, identity: unknown, operation: string): Promise<boolean> {
  if (!isIdamBoxIdentity(identity)) return false;
  const grants = await loadEffectiveGrants(strapi, identity);
  return grants !== null && !grants.registeredSourceService && hasHumanAnalystOperation(grants.explicitRoles, operation);
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
  if (!grants || grants.registeredSourceService) {
    return deny(policyContext, "CSRM FunctionAPI access is denied.");
  }

  const explicitAnalystOperation = hasExplicitAnalystOperation(grants.explicitRoles, operation);
  const requestorOperation = hasOperation(grants.requestorRoles, operation);
  const effectiveOperation = explicitAnalystOperation || hasOperation(grants.explicitRoles, operation) || requestorOperation;
  if (!effectiveOperation) {
    return deny(policyContext, "CSRM FunctionAPI access is denied.");
  }
  // Phase 19 (D-13, G-1): the service identity is refused these whatever it holds, its Requestor birthright included.
  // loadEffectiveGrants admits an active user only, so eligibility here turns on the roles held.
  if (SERVICE_IDENTITY_REFUSED_OPERATIONS.has(operation)
    && !isEligiblePerson({ accountStatus: "active", roles: grants.explicitRoles, registeredSourceService: grants.registeredSourceService })) {
    return deny(policyContext, serviceIdentityDenialMessage(operation));
  }
  if (HUMAN_ANALYST_ONLY_OPERATIONS.has(operation)
    && !hasHumanAnalystOperation(grants.explicitRoles, operation)) {
    return deny(policyContext, humanAnalystDenialMessage(operation));
  }
  // Phase 19 (D-13): an export never widens its list. The list read must be held through the path that admitted the
  // export, checked before any scope branch (the register's returns early).
  if (config.underlyingRead !== undefined || config.additionalUnderlyingReads !== undefined) {
    const throughAnalystRole = hasHumanAnalystOperation(grants.explicitRoles, operation);
    const holds = (read: string) => throughAnalystRole
      ? hasHumanAnalystOperation(grants.explicitRoles, read)
      : hasOperation(grants.explicitRoles, read) || hasOperation(grants.requestorRoles, read);
    const reads = [...(config.underlyingRead === undefined ? [] : [config.underlyingRead]), ...(config.additionalUnderlyingReads ?? [])];
    if (!reads.every(holds)) return deny(policyContext, "CSRM export requires the list read.");
  }

  setAssessmentRequestActor(policyContext, explicitAnalystOperation ? "analyst" : "requestor");
  const humanAnalyst = hasHumanAnalystOperation(grants.explicitRoles, operation);
  // loadEffectiveGrants admits an active user only, so eligibility here turns on the roles held.
  const eligiblePerson = isEligiblePerson({ accountStatus: "active", roles: grants.explicitRoles, registeredSourceService: grants.registeredSourceService });
  policyContext.state.csrmAuthorization = {
    ...policyContext.state.csrmAuthorization,
    humanAnalyst,
    eligibleHumanAnalyst: humanAnalyst && eligiblePerson,
    canMarkNoteAiInputs: eligiblePerson && hasHumanAnalystOperation(grants.explicitRoles, NOTE_AI_INPUT_OPERATION),
    canUseAttachmentAiInputs: eligiblePerson && hasHumanAnalystOperation(grants.explicitRoles, ATTACHMENT_AI_INPUT_OPERATION),
    viewerId: grants.requestorId,
  };

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

  if (config.requireAnalystInsightScope) {
    const requiredOperations = [config.operation, ...ANALYST_INSIGHT_UNDERLYING_READS];
    if (!requiredOperations.every((required) => hasHumanAnalystOperation(grants.explicitRoles, required))) {
      return deny(policyContext, "CSRM analyst insight access is denied.");
    }
    policyContext.state.csrmAuthorization = {
      ...policyContext.state.csrmAuthorization,
      analystInsightScope: "all",
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
      // Ownership is established first. Only answer mutations disclose this recoverable state to their owner.
      if (config.operation === "PATCH:/api/v1/questionnaires/{questionnaireId}/answers" || config.operation === "POST:/api/v1/questionnaires/{questionnaireId}/submit") {
        throw Object.assign(new Error("CSRM questionnaire is not currently answerable."), {
          name: "ConflictError", status: 409, expose: true, details: { reason: "QUESTIONNAIRE_NOT_ANSWERABLE" },
        });
      }
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
