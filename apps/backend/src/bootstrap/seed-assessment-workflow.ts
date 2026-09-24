import type { Core } from "@strapi/strapi";

import {
  DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES,
  type DeterministicAssessmentRiskTypeName,
} from "../api/csrm-assessment/services/deterministic-assessment-draft-provider";
import { developmentIdentityEnabled } from "../utils/development-identity-enabled";

type RiskTypeSeed = {
  description: string;
  controlNumbers: readonly string[];
};

export const ASSESSMENT_RISK_TYPE_SEEDS: Readonly<Record<DeterministicAssessmentRiskTypeName, RiskTypeSeed>> = {
  "Internet Exposure": {
    description: "Reusable deterministic draft mapping for internet-reachable and externally hosted services.",
    controlNumbers: ["E8-PATCH_APPLICATIONS-003", "V3.1.1"],
  },
  "Personal Information Handling": {
    description: "Reusable deterministic draft mapping for services that handle personal information.",
    controlNumbers: ["APP-12", "GV.OC-03"],
  },
  "Third-Party Dependency": {
    description: "Reusable deterministic draft mapping for external providers and service dependencies.",
    controlNumbers: ["CPS-234-16", "GV.SC-04"],
  },
};

type SeedDocument = { documentId: string; name?: unknown; controlNumber?: unknown };
type SeedDocumentService = {
  create: (input: { data: Record<string, unknown> }) => Promise<SeedDocument>;
  findMany: (input: Record<string, unknown>) => Promise<SeedDocument[]>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<SeedDocument>;
};

function service(strapi: Core.Strapi, uid: string): SeedDocumentService {
  return strapi.documents(uid as never) as unknown as SeedDocumentService;
}

export async function seedAssessmentWorkflow(strapi: Core.Strapi): Promise<void> {
  if (process.env.IDAMBOX_SEED_CSRM !== "true" || !developmentIdentityEnabled()) return;

  const riskTypeService = service(strapi, "api::csrm-risk-type.csrm-risk-type");
  const controlService = service(strapi, "api::csrm-control.csrm-control");
  const requiredControlNumbers = [...new Set(DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES
    .flatMap((name) => [...ASSESSMENT_RISK_TYPE_SEEDS[name].controlNumbers]))].sort();
  const controls = await controlService.findMany({
    filters: { controlNumber: { $in: requiredControlNumbers } },
    fields: ["controlNumber"],
    limit: requiredControlNumbers.length,
  });
  const controlsByNumber = new Map(controls.flatMap((control) =>
    typeof control.controlNumber === "string" ? [[control.controlNumber, control] as const] : []));
  const missingControls = requiredControlNumbers.filter((controlNumber) => !controlsByNumber.has(controlNumber));
  if (missingControls.length > 0) {
    throw new Error(`Assessment workflow controls were not found: ${missingControls.join(", ")}.`);
  }

  const existingRiskTypes = await riskTypeService.findMany({
    filters: { name: { $in: [...DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES] } },
    fields: ["name"],
    limit: DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES.length,
  });
  const existingByName = new Map(existingRiskTypes.flatMap((riskType) =>
    typeof riskType.name === "string" ? [[riskType.name, riskType] as const] : []));

  for (const name of DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES) {
    const seed = ASSESSMENT_RISK_TYPE_SEEDS[name];
    const data = {
      name,
      description: seed.description,
      applicableControls: [...seed.controlNumbers].sort().map((controlNumber) => controlsByNumber.get(controlNumber)?.documentId),
    };
    const existing = existingByName.get(name);
    if (existing) await riskTypeService.update({ documentId: existing.documentId, data });
    else await riskTypeService.create({ data });
  }

  strapi.log.info("CSRM assessment workflow RiskType fixtures reconciled.");
}
