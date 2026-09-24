import type { Core } from "@strapi/strapi";

import { developmentIdentityEnabled } from "../utils/development-identity-enabled";

const BOB_EMAIL = "bob.doe@idambox.com";
const RISK_TYPE_NAME = "Internet Exposure";

export const RISK_REGISTER_FIXTURE_KEYS = {
  requestNumber: "RAR-DEV-RISK-001",
  assessmentNumber: "ASM-DEV-RISK-001",
  riskNumber: "RSK-DEV-MUTABLE-001",
  controlNumber: "E8-PATCH_APPLICATIONS-003",
  releasedAssessmentNumber: "ASM-2026-33SAEN",
  releasedRequestNumber: "RAR-RELEASED-33SAEN",
  releasedRiskNumber: "RSK-RELEASED-33SAEN",
} as const;

type SeedDocument = { documentId: string; [key: string]: unknown };
type SeedDocumentService = {
  create: (input: { data: Record<string, unknown> }) => Promise<SeedDocument>;
  findMany: (input: Record<string, unknown>) => Promise<SeedDocument[]>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<SeedDocument>;
};

function service(strapi: Core.Strapi, uid: string): SeedDocumentService {
  return strapi.documents(uid as never) as unknown as SeedDocumentService;
}

async function requiredDocument(
  documentService: SeedDocumentService,
  filters: Record<string, unknown>,
  description: string,
): Promise<SeedDocument> {
  const [document] = await documentService.findMany({ filters, limit: 1 });
  if (!document) throw new Error(`Risk Register development fixture ${description} was not found.`);
  return document;
}

async function reconcileByStableKey(input: {
  documentService: SeedDocumentService;
  filters: Record<string, unknown>;
  createData: Record<string, unknown>;
  updateData: Record<string, unknown>;
}): Promise<SeedDocument> {
  const [existing] = await input.documentService.findMany({ filters: input.filters, limit: 1 });
  return existing
    ? input.documentService.update({ documentId: existing.documentId, data: input.updateData })
    : input.documentService.create({ data: input.createData });
}

async function reconcileRiskRegisterWorkflow(strapi: Core.Strapi): Promise<void> {
  const userService = service(strapi, "api::idambox-user.idambox-user");
  const requestService = service(strapi, "api::csrm-assessment-request.csrm-assessment-request");
  const assessmentService = service(strapi, "api::csrm-assessment.csrm-assessment");
  const riskService = service(strapi, "api::csrm-risk.csrm-risk");
  const implementationService = service(strapi, "api::csrm-control-implementation.csrm-control-implementation");
  const riskTypeService = service(strapi, "api::csrm-risk-type.csrm-risk-type");
  const controlService = service(strapi, "api::csrm-control.csrm-control");
  const systemService = service(strapi, "api::csrm-information-system.csrm-information-system");
  const assetService = service(strapi, "api::csrm-information-asset.csrm-information-asset");

  const [bob, riskType, control, informationSystem, informationAsset] = await Promise.all([
    requiredDocument(userService, { email: { $eq: BOB_EMAIL } }, `owner ${BOB_EMAIL}`),
    requiredDocument(riskTypeService, { name: { $eq: RISK_TYPE_NAME } }, `RiskType ${RISK_TYPE_NAME}`),
    requiredDocument(controlService, { controlNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.controlNumber } }, `Control ${RISK_REGISTER_FIXTURE_KEYS.controlNumber}`),
    requiredDocument(systemService, { name: { $eq: "Customer portal" } }, "information system Customer portal"),
    requiredDocument(assetService, { name: { $eq: "Customer records" } }, "information asset Customer records"),
  ]);

  const [existingReleasedAssessment] = await assessmentService.findMany({
    filters: { assessmentNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.releasedAssessmentNumber } },
    limit: 1,
  });
  if (!existingReleasedAssessment) {
    const releasedRequest = await requestService.create({
      data: {
        requestNumber: RISK_REGISTER_FIXTURE_KEYS.releasedRequestNumber,
        title: "Canonical released assessment request",
        requestStatus: "approved",
        submittedDate: "2026-08-30T00:00:00.000Z",
        requestor: bob.documentId,
      },
    });
    const releasedAssessment = await assessmentService.create({
      data: {
        assessmentNumber: RISK_REGISTER_FIXTURE_KEYS.releasedAssessmentNumber,
        assessmentStatus: "approved",
        summary: "Canonical released assessment",
        overallRating: "Moderate",
        generatedDate: "2026-08-30T00:00:00.000Z",
        assessmentDate: "2026-08-30T00:00:00.000Z",
        approvalDate: "2026-08-30T00:00:00.000Z",
        generatedBy: bob.documentId,
        reviewedBy: bob.documentId,
        approvedBy: bob.documentId,
        assessmentRequest: releasedRequest.documentId,
      },
    });
    await riskService.create({
      data: {
        riskNumber: RISK_REGISTER_FIXTURE_KEYS.releasedRiskNumber,
        issueStatement: "Released customer portal exposure requires retained oversight.",
        riskStatement: "Released internet exposure Risk retained for immutable register verification.",
        riskCategory: "Cyber Security",
        riskSubCategory: "Access Control",
        riskCause: "The customer portal is reachable from untrusted networks.",
        potentialImpact: "Unauthorised access could expose restricted customer records.",
        dataClassification: "Restricted",
        inherentLikelihood: "Likely",
        highestInherentConsequence: "Major",
        inherentRating: "High",
        inherentRatingRationale: "Internet reachability and restricted data create material exposure.",
        residualLikelihood: "Possible",
        highestResidualConsequence: "Moderate",
        residualRating: "Moderate",
        residualRatingRationale: "Released controls reduce but do not remove exposure.",
        controlEffectiveness: "Partially Effective",
        riskVelocity: "High",
        identifiedDate: "2026-08-30",
        targetDate: null,
        isExempted: false,
        treatmentAction: "Accept",
        treatmentStatus: "Complete",
        closureDate: "2026-08-30",
        riskType: riskType.documentId,
        riskOwner: bob.documentId,
        treatmentOwner: bob.documentId,
        informationSystemImpacted: informationSystem.documentId,
        informationAssetImpacted: informationAsset.documentId,
        assessment: releasedAssessment.documentId,
      },
    });
  }

  const requestPresentation = {
    title: "Mutable Risk Register development assessment",
    description: "Stable development fixture for authorised Security Analyst Risk maintenance.",
    requestor: bob.documentId,
  };
  const requestCreationFacts = {
    assessmentType: "Project",
    businessUnit: "Security Operations",
    businessPurpose: "Exercise Risk Register search, detail, and mitigation maintenance.",
    businessCriticality: "High",
    thirdPartyInvolvement: false,
  };
  const request = await reconcileByStableKey({
    documentService: requestService,
    filters: { requestNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.requestNumber } },
    createData: {
      requestNumber: RISK_REGISTER_FIXTURE_KEYS.requestNumber,
      ...requestPresentation,
      ...requestCreationFacts,
      requestStatus: "under-review",
      submittedDate: "2026-08-31T00:00:00.000Z",
    },
    updateData: requestPresentation,
  });

  const assessmentCreationFacts = {
    summary: "Mutable Risk Register fixture for analyst review.",
    overallRating: "High",
    overallControlEffectiveness: "Partially Effective",
    recommendationsSummary: "Complete the planned mitigation and reassess residual exposure.",
    overallRiskRationale: "Internet exposure creates material unauthorised-access risk.",
  };
  const assessmentRelation = { assessmentRequest: request.documentId };
  const assessment = await reconcileByStableKey({
    documentService: assessmentService,
    filters: { assessmentNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.assessmentNumber } },
    createData: {
      assessmentNumber: RISK_REGISTER_FIXTURE_KEYS.assessmentNumber,
      ...assessmentCreationFacts,
      ...assessmentRelation,
      assessmentStatus: "in-review",
      generatedDate: "2026-08-31T00:00:00.000Z",
      generatedBy: bob.documentId,
      reviewedBy: bob.documentId,
    },
    updateData: assessmentRelation,
  });

  const riskRelations = {
    riskType: riskType.documentId,
    riskOwner: bob.documentId,
    treatmentOwner: bob.documentId,
    informationSystemImpacted: informationSystem.documentId,
    informationAssetImpacted: informationAsset.documentId,
    assessment: assessment.documentId,
  };
  const [riskBeforeSeed] = await riskService.findMany({
    filters: { riskNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.riskNumber } },
    limit: 1,
  });
  const risk = await reconcileByStableKey({
    documentService: riskService,
    filters: { riskNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.riskNumber } },
    createData: {
      riskNumber: RISK_REGISTER_FIXTURE_KEYS.riskNumber,
      issueStatement: "Customer portal internet exposure requires active mitigation.",
      riskStatement: "Potential unauthorised access creates a mutable customer portal risk.",
      riskCategory: "Cyber Security",
      riskSubCategory: "Access Control",
      riskCause: "The customer portal is reachable from untrusted networks.",
      potentialImpact: "Unauthorised access could expose restricted customer records.",
      dataClassification: "Restricted",
      inherentLikelihood: "Likely",
      highestInherentConsequence: "Major",
      inherentRating: "High",
      inherentRatingRationale: "Internet reachability and restricted data increase inherent exposure.",
      residualLikelihood: "Possible",
      highestResidualConsequence: "Moderate",
      residualRating: "Moderate",
      residualRatingRationale: "Planned patching and access controls reduce but do not remove exposure.",
      controlEffectiveness: "Partially Effective",
      riskVelocity: "High",
      identifiedDate: "2026-08-31",
      targetDate: "2026-12-01",
      isExempted: false,
      treatmentAction: "Treat",
      treatmentPlan: "Maintain application patching and verify the control implementation.",
      treatmentResolveDate: "2026-12-01",
      treatmentStatus: "In Progress",
      ...riskRelations,
    },
    // Mutable Risk facts and editable relations belong to the running workflow.
    // Reseeding intentionally leaves an existing Risk byte-for-byte untouched.
    updateData: {},
  });

  const implementationRelations = {
    control: control.documentId,
    risk: risk.documentId,
    controlOwner: bob.documentId,
  };
  const [managedImplementation] = await implementationService.findMany({
    filters: {
      risk: { documentId: { $eq: risk.documentId } },
      control: { documentId: { $eq: control.documentId } },
    },
    limit: 1,
  });
  // Creation is the only safe time to assign editable implementation relations.
  // If the managed implementation was removed, an analyst replacement must not
  // be selected, repointed, or recreated over on a later bootstrap.
  if (!managedImplementation) {
    const existingForRisk = await implementationService.findMany({
      filters: { risk: { documentId: { $eq: risk.documentId } } },
      limit: 1,
    });
    if (riskBeforeSeed || existingForRisk.length > 0) {
      strapi.log.info(`CSRM mutable Risk Register fixture ${RISK_REGISTER_FIXTURE_KEYS.riskNumber} retains analyst mitigation choices.`);
    } else {
    await implementationService.create({
      data: {
        ...implementationRelations,
        controlStatus: "Planned",
        effectivenessRating: "Not Assessed",
        evidence: "Confirm application patching evidence before completing mitigation.",
        implementationDueDate: "2026-12-01",
      },
    });
    }
  }

  strapi.log.info(`CSRM mutable Risk Register fixture ${RISK_REGISTER_FIXTURE_KEYS.riskNumber} reconciled.`);
}

let reconciliationQueue: Promise<void> = Promise.resolve();

export function seedRiskRegisterWorkflow(strapi: Core.Strapi): Promise<void> {
  if (process.env.IDAMBOX_SEED_CSRM !== "true" || !developmentIdentityEnabled()) {
    return Promise.resolve();
  }

  const reconciliation = reconciliationQueue.then(
    () => reconcileRiskRegisterWorkflow(strapi),
    () => reconcileRiskRegisterWorkflow(strapi),
  );
  reconciliationQueue = reconciliation.catch(() => undefined);
  return reconciliation;
}
