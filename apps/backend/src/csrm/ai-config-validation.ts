import { isDevelopmentRuntime, parseClassificationCeiling, AiDataPolicyConfigurationError } from "./ai/data-policy";

export class CsrmAiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsrmAiConfigurationError";
  }
}

type StrapiConfig = { config: { get: (key: string) => unknown }; log?: { warn?: (message: string) => void } };

function requireValue(value: unknown, environmentVariable: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CsrmAiConfigurationError(`CSRM AI provider configuration requires ${environmentVariable}.`);
  }
}

export function assertCsrmAiConfiguration(strapi: StrapiConfig): void {
  const config = strapi.config.get("ai") as Record<string, unknown> | undefined;
  try {
    parseClassificationCeiling(config?.dataClassificationCeiling);
  } catch (error) {
    if (!(error instanceof AiDataPolicyConfigurationError)) throw error;
    throw new CsrmAiConfigurationError("CSRM_AI_DATA_CLASSIFICATION_CEILING must be empty or one of Public, Internal, Restricted or Critical Infrastructure Sensitive.");
  }
  if (!isDevelopmentRuntime()) {
    if (config?.completionTranscriptDiagnostics === true) strapi.log?.warn?.("CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS is ignored outside development.");
    if (parseClassificationCeiling(config?.dataClassificationCeiling) === null) strapi.log?.warn?.("AI generation is refused until CSRM_AI_DATA_CLASSIFICATION_CEILING is set.");
  }
  if (config?.provider !== "openai-compatible") return;
  const assessmentDraft = config.assessmentDraft as Record<string, unknown> | undefined;
  const questionnaireGeneration = config.questionnaireGeneration as Record<string, unknown> | undefined;
  requireValue(assessmentDraft?.baseURL, "CSRM_AI_ASSESSMENT_BASE_URL");
  requireValue(assessmentDraft?.model, "CSRM_AI_ASSESSMENT_MODEL");
  requireValue(questionnaireGeneration?.baseURL, "CSRM_AI_QUESTIONNAIRE_BASE_URL");
  requireValue(questionnaireGeneration?.model, "CSRM_AI_QUESTIONNAIRE_MODEL");
}
