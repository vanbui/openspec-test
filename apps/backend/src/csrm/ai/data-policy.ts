export const DATA_CLASSIFICATIONS = ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"] as const;
export type DataClassification = typeof DATA_CLASSIFICATIONS[number];
export type ClassificationSource = "assets" | "default";
export type AiPolicyReason = "AI_POLICY_NOT_CONFIGURED" | "AI_CLASSIFICATION_ABOVE_CEILING" | null;
export type AiPolicyDecision = {
  status: "allowed" | "refused";
  reason: AiPolicyReason;
  requestClassification: DataClassification;
  classificationSource: ClassificationSource;
  ceiling: DataClassification | null;
};

export class AiDataPolicyConfigurationError extends Error {
  constructor() {
    super("Invalid AI data classification ceiling.");
    this.name = "AiDataPolicyConfigurationError";
  }
}

export function isDataClassification(value: unknown): value is DataClassification {
  return typeof value === "string" && DATA_CLASSIFICATIONS.includes(value as DataClassification);
}

export function isDevelopmentRuntime(env: { NODE_ENV?: string; CSRM_ENVIRONMENT?: string } = process.env): boolean {
  return env.NODE_ENV === "development" && env.CSRM_ENVIRONMENT === "development";
}

export function requestClassification(assets: readonly { dataClassification?: unknown }[]): { level: DataClassification; source: ClassificationSource } {
  let level: DataClassification | null = null;
  for (const asset of assets) {
    const classification = asset.dataClassification;
    if (isDataClassification(classification) && (level === null || DATA_CLASSIFICATIONS.indexOf(classification) > DATA_CLASSIFICATIONS.indexOf(level))) level = classification;
  }
  return level === null ? { level: "Internal", source: "default" } : { level, source: "assets" };
}

export function parseClassificationCeiling(value: unknown): DataClassification | null {
  if (value === undefined || value === "") return null;
  if (isDataClassification(value)) return value;
  throw new AiDataPolicyConfigurationError();
}

export function evaluateAiDataPolicy(input: { assets: readonly { dataClassification?: unknown }[]; ceiling: DataClassification | null; developmentRuntime: boolean }): AiPolicyDecision {
  const classification = requestClassification(input.assets);
  const reason: AiPolicyReason = input.ceiling === null && !input.developmentRuntime
    ? "AI_POLICY_NOT_CONFIGURED"
    : input.ceiling !== null && DATA_CLASSIFICATIONS.indexOf(classification.level) > DATA_CLASSIFICATIONS.indexOf(input.ceiling)
      ? "AI_CLASSIFICATION_ABOVE_CEILING"
      : null;
  return { status: reason === null ? "allowed" : "refused", reason, requestClassification: classification.level, classificationSource: classification.source, ceiling: input.ceiling };
}

export function readAiDataPolicyConfiguration(strapi: { config: { get: (key: string) => unknown } }, env: { NODE_ENV?: string; CSRM_ENVIRONMENT?: string } = process.env): { ceiling: DataClassification | null; developmentRuntime: boolean } {
  const config = strapi.config.get("ai") as { dataClassificationCeiling?: unknown } | undefined;
  return { ceiling: parseClassificationCeiling(config?.dataClassificationCeiling), developmentRuntime: isDevelopmentRuntime(env) };
}

export function aiPolicyRefusalMessage(decision: AiPolicyDecision): string | null {
  if (decision.reason === "AI_POLICY_NOT_CONFIGURED") return "The AI provider has not been approved for any information classification.";
  if (decision.reason === "AI_CLASSIFICATION_ABOVE_CEILING") return `This request's information is classified ${decision.requestClassification}, above the ${decision.ceiling} limit the AI provider is approved for.`;
  return null;
}
