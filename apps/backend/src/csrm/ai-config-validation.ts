export class CsrmAiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsrmAiConfigurationError";
  }
}

type StrapiConfig = { config: { get: (key: string) => unknown } };

function requireValue(value: unknown, environmentVariable: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CsrmAiConfigurationError(`CSRM AI provider configuration requires ${environmentVariable}.`);
  }
}

export function assertCsrmAiConfiguration(strapi: StrapiConfig): void {
  const config = strapi.config.get("ai") as Record<string, unknown> | undefined;
  if (config?.provider !== "openai-compatible") return;
  const assessmentDraft = config.assessmentDraft as Record<string, unknown> | undefined;
  const questionnaireGeneration = config.questionnaireGeneration as Record<string, unknown> | undefined;
  requireValue(assessmentDraft?.baseURL, "CSRM_AI_ASSESSMENT_BASE_URL");
  requireValue(assessmentDraft?.model, "CSRM_AI_ASSESSMENT_MODEL");
  requireValue(questionnaireGeneration?.baseURL, "CSRM_AI_QUESTIONNAIRE_BASE_URL");
  requireValue(questionnaireGeneration?.model, "CSRM_AI_QUESTIONNAIRE_MODEL");
}
