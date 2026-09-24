import type { Core } from "@strapi/strapi";

import { developmentIdentityEnabled } from "../utils/development-identity-enabled";

const OWNER_EMAIL = "jane.doe@idambox.com";
const ANALYST_EMAIL = "bob.doe@idambox.com";
const NON_OWNER_EMAIL = "maya.requestor@idambox.com";

export const ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE = {
  analystAssessmentNumber: "ASM-E2E-NAV-ANALYST-001",
  analystRequestNumber: "RAR-E2E-NAV-ANALYST-001",
  analystRequestTitle: "Analyst navigation lifecycle review request",
  ownerAssessmentNumber: "ASM-E2E-NAV-OWNER-001",
  ownerRequestNumber: "RAR-E2E-NAV-OWNER-001",
  ownerRequestTitle: "Owner navigation lifecycle released request",
} as const;

type SeedDocument = { documentId: string };
type SeedDocumentService = {
  create: (input: { data: Record<string, unknown> }) => Promise<SeedDocument>;
  findMany: (input: Record<string, unknown>) => Promise<SeedDocument[]>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<SeedDocument>;
};

function service(strapi: Core.Strapi, uid: string): SeedDocumentService {
  return strapi.documents(uid as never) as unknown as SeedDocumentService;
}

async function requiredUser(userService: SeedDocumentService, email: string): Promise<SeedDocument> {
  const [user] = await userService.findMany({ filters: { email: { $eq: email } }, limit: 1 });
  if (!user) throw new Error(`Assessment navigation lifecycle fixture user ${email} was not found.`);
  return user;
}

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

export async function seedAssessmentNavigationLifecycle(strapi: Core.Strapi): Promise<void> {
  if (process.env.IDAMBOX_SEED_CSRM !== "true" || !developmentIdentityEnabled()) return;

  const userService = service(strapi, "api::idambox-user.idambox-user");
  const requestService = service(strapi, "api::csrm-assessment-request.csrm-assessment-request");
  const assessmentService = service(strapi, "api::csrm-assessment.csrm-assessment");

  const nonOwner = await reconcile(userService, { email: { $eq: NON_OWNER_EMAIL } }, {
    email: NON_OWNER_EMAIL,
    username: "maya.requestor",
    firstName: "Maya",
    lastName: "Requestor",
    displayName: "Maya Requestor",
    accountStatus: "active",
    roles: [],
  });
  const [owner, analyst] = await Promise.all([
    requiredUser(userService, OWNER_EMAIL),
    requiredUser(userService, ANALYST_EMAIL),
  ]);

  const ownerRequest = await reconcile(requestService, {
    requestNumber: { $eq: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.ownerRequestNumber },
  }, {
    requestNumber: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.ownerRequestNumber,
    title: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.ownerRequestTitle,
    description: "Dedicated released assessment fixture owned only by the primary Requestor.",
    assessmentType: "Project",
    businessUnit: "Navigation assurance",
    businessPurpose: "Prove Requestor assessment navigation and record-level denial.",
    businessCriticality: "High",
    thirdPartyInvolvement: false,
    submittedDate: "2026-09-01T00:00:00.000Z",
    requestStatus: "approved",
    requestor: owner.documentId,
  });
  await reconcile(assessmentService, {
    assessmentNumber: { $eq: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.ownerAssessmentNumber },
  }, {
    assessmentNumber: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.ownerAssessmentNumber,
    assessmentStatus: "approved",
    summary: "Dedicated released Requestor assessment navigation fixture.",
    overallRating: "Moderate",
    overallControlEffectiveness: "Partially Effective",
    generatedDate: "2026-09-01T00:00:00.000Z",
    assessmentDate: "2026-09-02T00:00:00.000Z",
    approvalDate: "2026-09-03T00:00:00.000Z",
    generatedBy: analyst.documentId,
    reviewedBy: analyst.documentId,
    approvedBy: analyst.documentId,
    assessmentRequest: ownerRequest.documentId,
  });

  const analystRequest = await reconcile(requestService, {
    requestNumber: { $eq: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.analystRequestNumber },
  }, {
    requestNumber: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.analystRequestNumber,
    title: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.analystRequestTitle,
    description: "Dedicated in-review assessment fixture for the Security Analyst.",
    assessmentType: "Project",
    businessUnit: "Navigation assurance",
    businessPurpose: "Prove Analyst assessment navigation and lifecycle visibility.",
    businessCriticality: "Moderate",
    thirdPartyInvolvement: false,
    submittedDate: "2026-09-04T00:00:00.000Z",
    requestStatus: "under-review",
    requestor: owner.documentId,
  });
  await reconcile(assessmentService, {
    assessmentNumber: { $eq: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.analystAssessmentNumber },
  }, {
    assessmentNumber: ASSESSMENT_NAVIGATION_LIFECYCLE_FIXTURE.analystAssessmentNumber,
    assessmentStatus: "in-review",
    summary: "Dedicated in-review Security Analyst assessment navigation fixture.",
    overallRating: "Moderate",
    overallControlEffectiveness: "Partially Effective",
    generatedDate: "2026-09-04T00:00:00.000Z",
    generatedBy: analyst.documentId,
    reviewedBy: analyst.documentId,
    assessmentRequest: analystRequest.documentId,
  });

  if (nonOwner.documentId === owner.documentId) {
    throw new Error("Assessment navigation lifecycle fixture requires an unrelated Requestor.");
  }
  strapi.log.info("CSRM assessment navigation lifecycle fixtures reconciled.");
}
