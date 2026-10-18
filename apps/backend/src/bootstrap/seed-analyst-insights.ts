import type { Core } from "@strapi/strapi";

import { addUtcDays, utcToday } from "../csrm/insights/utc-date";
import { developmentIdentityEnabled } from "../utils/development-identity-enabled";
import { seedRequestDetails } from "./seed-request-details";

/*
 * The dedicated Phase 7 fixture (D-23). It gives every analyst alert kind, the
 * exposure figures and the release throughput a deterministic source in a fresh
 * E2E database and in the development database.
 *
 * Every date is a whole-day offset from the day the fixture runs, rewritten on
 * every run, so its overdue, due-soon and review-due conditions hold whatever
 * the date. Each offset stays at least three days from a window edge in the
 * direction time moves, so a long suite that crosses UTC midnight cannot move
 * a record into another category.
 *
 * One released, open Risk carries the treatment action Accept (D-45), so the
 * browser proves the Risk register's Accepted marker and the analyst Home's
 * accepted link on a real record. It is Moderate with no target date, so it
 * raises no alert and moves no alert figure.
 *
 * The fixture never creates a Control: it uses two existing library Controls by
 * their stable numbers. It shares no record with any other fixture, and no
 * request is `submitted`, so no spec can start generation on one.
 *
 * The browser specs duplicate these keys, titles and offsets by value.
 */

const OWNER_EMAIL = "jane.doe@idambox.com";
const ANALYST_EMAIL = "bob.doe@idambox.com";

export const ANALYST_INSIGHTS_FIXTURE = {
  informationSystemName: "Phase 7 exposure platform",
  controlNumbers: {
    /** The Planned implementation on the overdue Risk. */
    planned: "E8-PATCH_OPERATING_SYSTEMS-001",
    /** The Ineffective implementation on the Critical Risk. */
    ineffective: "E8-MULTI_FACTOR_AUTHENTICATION-001",
  },
  requests: {
    overdue: { requestNumber: "RAR-E2E-P7-OVERDUE-001", title: "Privileged access vault upgrade and clustering", requestStatus: "under-review" },
    dueSoon: { requestNumber: "RAR-E2E-P7-DUESOON-001", title: "Security log migration to Microsoft Sentinel", requestStatus: "questionnaire-in-progress" },
    mutable: { requestNumber: "RAR-E2E-P7-MUTABLE-001", title: "Operational reporting platform annual review", requestStatus: "under-review" },
    released: { requestNumber: "RAR-E2E-P7-RELEASED-001", title: "Immutable cloud backup for tier 1 systems", requestStatus: "approved" },
  },
  assessments: {
    mutable: "ASM-E2E-P7-MUTABLE-001",
    released: "ASM-E2E-P7-RELEASED-001",
  },
  risks: {
    overdue: "RSK-E2E-P7-OVERDUE-001",
    dueSoon: "RSK-E2E-P7-DUESOON-001",
    critical: "RSK-E2E-P7-CRITICAL-001",
    closed: "RSK-E2E-P7-CLOSED-001",
    released: "RSK-E2E-P7-RELEASED-001",
    /** D-45: the one released, open, accepted Risk. */
    accepted: "RSK-E2E-P7-ACCEPTED-001",
  },
} as const;

/**
 * Every date the fixture writes, as whole UTC days from the run's today, keyed
 * `<stable key>.<field>` (`<Risk number>.implementation.<field>` for a Control
 * Implementation). Dates not listed here are written as empty.
 *
 * Request submission dates are later than every other development fixture's,
 * and never affect an alert.
 */
export const ANALYST_INSIGHTS_DAY_OFFSETS = Object.freeze({
  "RAR-E2E-P7-OVERDUE-001.submittedDate": -14,
  "RAR-E2E-P7-OVERDUE-001.dueDate": -10,
  "RAR-E2E-P7-DUESOON-001.submittedDate": -4,
  "RAR-E2E-P7-DUESOON-001.dueDate": 5,
  "RAR-E2E-P7-MUTABLE-001.submittedDate": -9,
  "RAR-E2E-P7-RELEASED-001.submittedDate": -12,
  "ASM-E2E-P7-MUTABLE-001.generatedDate": -6,
  "ASM-E2E-P7-RELEASED-001.generatedDate": -8,
  "ASM-E2E-P7-RELEASED-001.assessmentDate": -5,
  "ASM-E2E-P7-RELEASED-001.approvalDate": -5,
  "ASM-E2E-P7-RELEASED-001.nextReviewDate": -3,
  "RSK-E2E-P7-OVERDUE-001.targetDate": -30,
  "RSK-E2E-P7-DUESOON-001.targetDate": 7,
  "RSK-E2E-P7-CRITICAL-001.identifiedDate": -20,
  "RSK-E2E-P7-CLOSED-001.targetDate": -40,
  "RSK-E2E-P7-CLOSED-001.closureDate": -5,
  "RSK-E2E-P7-RELEASED-001.targetDate": -12,
  "RSK-E2E-P7-OVERDUE-001.implementation.implementationDueDate": -10,
  "RSK-E2E-P7-CRITICAL-001.implementation.reviewDate": -15,
} as const);
type DayOffsetKey = keyof typeof ANALYST_INSIGHTS_DAY_OFFSETS;

type SeedDocument = { documentId: string; [key: string]: unknown };
type SeedDocumentService = {
  create: (input: { data: Record<string, unknown> }) => Promise<SeedDocument>;
  findMany: (input: Record<string, unknown>) => Promise<SeedDocument[]>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<SeedDocument>;
};

export type SeedAnalystInsightsOptions = {
  /** The clock the fixture is anchored on. Tests pass a fixed instant. */
  now?: () => Date;
};

function service(strapi: Core.Strapi, uid: string): SeedDocumentService {
  return strapi.documents(uid as never) as unknown as SeedDocumentService;
}

async function required(documentService: SeedDocumentService, filters: Record<string, unknown>, description: string): Promise<SeedDocument> {
  const [document] = await documentService.findMany({ filters, limit: 1 });
  if (!document) throw new Error(`Phase 7 analyst insight fixture ${description} was not found.`);
  return document;
}

/** Updates the one record matching the stable key, or creates it. */
async function reconcile(
  documentService: SeedDocumentService,
  filters: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<SeedDocument> {
  const [existing] = await documentService.findMany({ filters, limit: 1 });
  return existing
    ? documentService.update({ documentId: existing.documentId, data })
    : documentService.create({ data });
}

async function reconcileAnalystInsights(strapi: Core.Strapi, options: SeedAnalystInsightsOptions): Promise<void> {
  const today = utcToday(options.now?.() ?? new Date());
  const day = (key: DayOffsetKey): string => addUtcDays(today, ANALYST_INSIGHTS_DAY_OFFSETS[key]);
  const instant = (key: DayOffsetKey): string => `${day(key)}T00:00:00.000Z`;
  const { requests, assessments, risks, controlNumbers } = ANALYST_INSIGHTS_FIXTURE;

  const users = service(strapi, "api::idambox-user.idambox-user");
  const controls = service(strapi, "api::csrm-control.csrm-control");
  const [owner, analyst, plannedControl, ineffectiveControl] = await Promise.all([
    required(users, { email: { $eq: OWNER_EMAIL } }, `owner ${OWNER_EMAIL}`),
    required(users, { email: { $eq: ANALYST_EMAIL } }, `analyst ${ANALYST_EMAIL}`),
    required(controls, { controlNumber: { $eq: controlNumbers.planned } }, `Control ${controlNumbers.planned}`),
    required(controls, { controlNumber: { $eq: controlNumbers.ineffective } }, `Control ${controlNumbers.ineffective}`),
  ]);

  const system = await reconcile(service(strapi, "api::csrm-information-system.csrm-information-system"), {
    name: { $eq: ANALYST_INSIGHTS_FIXTURE.informationSystemName },
  }, {
    name: ANALYST_INSIGHTS_FIXTURE.informationSystemName,
    description: "Dedicated Phase 7 fixture system carrying High and Critical residual Risks.",
  });

  const requestService = service(strapi, "api::csrm-assessment-request.csrm-assessment-request");
  const request = (
    fixture: typeof requests[keyof typeof requests],
    facts: { submittedDate: string; dueDate: string | null },
  ) => reconcile(requestService, { requestNumber: { $eq: fixture.requestNumber } }, {
    requestNumber: fixture.requestNumber,
    title: fixture.title,
    ...seedRequestDetails(fixture.requestNumber),
    businessCriticality: "High",
    requestStatus: fixture.requestStatus,
    submittedDate: facts.submittedDate,
    dueDate: facts.dueDate,
    revertReason: null,
    revertedAt: null,
    revertedBy: null,
    requestor: owner.documentId,
  });
  await request(requests.overdue, {
    submittedDate: instant("RAR-E2E-P7-OVERDUE-001.submittedDate"),
    dueDate: day("RAR-E2E-P7-OVERDUE-001.dueDate"),
  });
  await request(requests.dueSoon, {
    submittedDate: instant("RAR-E2E-P7-DUESOON-001.submittedDate"),
    dueDate: day("RAR-E2E-P7-DUESOON-001.dueDate"),
  });
  const mutableRequest = await request(requests.mutable, {
    submittedDate: instant("RAR-E2E-P7-MUTABLE-001.submittedDate"),
    dueDate: null,
  });
  const releasedRequest = await request(requests.released, {
    submittedDate: instant("RAR-E2E-P7-RELEASED-001.submittedDate"),
    dueDate: null,
  });

  const assessmentService = service(strapi, "api::csrm-assessment.csrm-assessment");
  const mutableAssessment = await reconcile(assessmentService, { assessmentNumber: { $eq: assessments.mutable } }, {
    assessmentNumber: assessments.mutable,
    assessmentStatus: "in-review",
    summary: "Phase 7 in-review assessment fixture.",
    overallRating: "Critical",
    overallControlEffectiveness: "Partially Effective",
    generatedDate: instant("ASM-E2E-P7-MUTABLE-001.generatedDate"),
    assessmentDate: null,
    approvalDate: null,
    nextReviewDate: null,
    generatedBy: analyst.documentId,
    reviewedBy: analyst.documentId,
    approvedBy: null,
    assessmentRequest: mutableRequest.documentId,
  });
  const releasedAssessment = await reconcile(assessmentService, { assessmentNumber: { $eq: assessments.released } }, {
    assessmentNumber: assessments.released,
    assessmentStatus: "approved",
    summary: "Phase 7 released assessment fixture.",
    overallRating: "Critical",
    overallControlEffectiveness: "Partially Effective",
    generatedDate: instant("ASM-E2E-P7-RELEASED-001.generatedDate"),
    assessmentDate: instant("ASM-E2E-P7-RELEASED-001.assessmentDate"),
    approvalDate: instant("ASM-E2E-P7-RELEASED-001.approvalDate"),
    nextReviewDate: day("ASM-E2E-P7-RELEASED-001.nextReviewDate"),
    generatedBy: analyst.documentId,
    reviewedBy: analyst.documentId,
    approvedBy: analyst.documentId,
    assessmentRequest: releasedRequest.documentId,
  });

  const riskService = service(strapi, "api::csrm-risk.csrm-risk");
  const risk = (
    riskNumber: string,
    facts: {
      assessment: SeedDocument;
      statement: string;
      rating: "Moderate" | "High" | "Critical";
      /** Treat, unless the fixture is the accepted Risk (D-45). */
      treatmentAction?: "Accept" | "Treat";
      treatmentStatus: "Not Started" | "In Progress" | "Complete" | null;
      targetDate: string | null;
      identifiedDate: string | null;
      closureDate: string | null;
      exposed: boolean;
    },
  ) => reconcile(riskService, { riskNumber: { $eq: riskNumber } }, {
    riskNumber,
    riskStatement: facts.statement,
    riskCategory: "Cyber Security",
    inherentRating: facts.rating,
    residualRating: facts.rating,
    treatmentAction: facts.treatmentAction ?? "Treat",
    treatmentStatus: facts.treatmentStatus,
    targetDate: facts.targetDate,
    identifiedDate: facts.identifiedDate,
    closureDate: facts.closureDate,
    riskOwner: analyst.documentId,
    treatmentOwner: analyst.documentId,
    informationSystemImpacted: facts.exposed ? system.documentId : null,
    assessment: facts.assessment.documentId,
  });
  const overdueRisk = await risk(risks.overdue, {
    assessment: mutableAssessment,
    statement: "Phase 7 platform operating systems remain unpatched past their treatment target.",
    rating: "High",
    treatmentStatus: "In Progress",
    targetDate: day("RSK-E2E-P7-OVERDUE-001.targetDate"),
    identifiedDate: null,
    closureDate: null,
    exposed: true,
  });
  await risk(risks.dueSoon, {
    assessment: mutableAssessment,
    statement: "Phase 7 platform logging gaps must be closed before the treatment target.",
    rating: "Moderate",
    treatmentStatus: "Not Started",
    targetDate: day("RSK-E2E-P7-DUESOON-001.targetDate"),
    identifiedDate: null,
    closureDate: null,
    exposed: false,
  });
  const criticalRisk = await risk(risks.critical, {
    assessment: mutableAssessment,
    statement: "Phase 7 platform administrator sign-in lacks enforced multi-factor authentication.",
    rating: "Critical",
    treatmentStatus: "Not Started",
    targetDate: null,
    identifiedDate: day("RSK-E2E-P7-CRITICAL-001.identifiedDate"),
    closureDate: null,
    exposed: true,
  });
  await risk(risks.closed, {
    assessment: mutableAssessment,
    statement: "Phase 7 platform legacy file transfer service has been decommissioned.",
    rating: "High",
    treatmentStatus: "Complete",
    targetDate: day("RSK-E2E-P7-CLOSED-001.targetDate"),
    identifiedDate: null,
    closureDate: day("RSK-E2E-P7-CLOSED-001.closureDate"),
    exposed: false,
  });
  await risk(risks.released, {
    assessment: releasedAssessment,
    statement: "Phase 7 released platform backups are not tested against a restore target.",
    rating: "Critical",
    treatmentStatus: "In Progress",
    targetDate: day("RSK-E2E-P7-RELEASED-001.targetDate"),
    identifiedDate: null,
    closureDate: null,
    exposed: false,
  });
  // D-45: released and open, and accepted, so it carries no treatment status and no target date.
  await risk(risks.accepted, {
    assessment: releasedAssessment,
    statement: "Accepted fixture: Phase 7 released platform archive retention exceeds policy, and the risk is accepted.",
    rating: "Moderate",
    treatmentAction: "Accept",
    treatmentStatus: null,
    targetDate: null,
    identifiedDate: null,
    closureDate: null,
    exposed: false,
  });

  // A Control Implementation's stable key is its Risk and its Control.
  const implementationService = service(strapi, "api::csrm-control-implementation.csrm-control-implementation");
  const implementation = (riskDocument: SeedDocument, control: SeedDocument, data: Record<string, unknown>) =>
    reconcile(implementationService, {
      risk: { documentId: { $eq: riskDocument.documentId } },
      control: { documentId: { $eq: control.documentId } },
    }, {
      risk: riskDocument.documentId,
      control: control.documentId,
      controlOwner: analyst.documentId,
      implementedDate: null,
      ...data,
    });
  await implementation(overdueRisk, plannedControl, {
    controlStatus: "Planned",
    effectivenessRating: "Not Assessed",
    evidence: "Patch deployment is scheduled but has not completed.",
    implementationDueDate: day("RSK-E2E-P7-OVERDUE-001.implementation.implementationDueDate"),
    reviewDate: null,
  });
  await implementation(criticalRisk, ineffectiveControl, {
    controlStatus: "Implemented",
    effectivenessRating: "Ineffective",
    evidence: "The last review found administrator accounts that bypass multi-factor authentication.",
    implementationDueDate: null,
    reviewDate: day("RSK-E2E-P7-CRITICAL-001.implementation.reviewDate"),
  });

  strapi.log.info(`CSRM Phase 7 analyst insight fixture reconciled for ${today}.`);
}

let reconciliationQueue: Promise<void> = Promise.resolve();

/**
 * Reconciles the Phase 7 fixture in development only: the seed flag and every
 * development identity gate must be set. Runs are serialised, so concurrent
 * boots never create a record twice.
 */
export function seedAnalystInsights(strapi: Core.Strapi, options: SeedAnalystInsightsOptions = {}): Promise<void> {
  if (process.env.IDAMBOX_SEED_CSRM !== "true" || !developmentIdentityEnabled()) {
    return Promise.resolve();
  }

  const reconciliation = reconciliationQueue.then(
    () => reconcileAnalystInsights(strapi, options),
    () => reconcileAnalystInsights(strapi, options),
  );
  reconciliationQueue = reconciliation.catch(() => undefined);
  return reconciliation;
}
