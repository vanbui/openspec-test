import type { Core } from "@strapi/strapi";

const config = ({ env }: Core.Config.Shared.ConfigParams) => ({
  provider: env("CSRM_AI_PROVIDER", "deterministic"),
  providerLabel: env("CSRM_AI_PROVIDER_LABEL", "openai-compatible"),
  structuredOutputMode: env.bool("CSRM_AI_STRUCTURED_OUTPUT", true),
  requestTimeoutMs: env.int("CSRM_AI_REQUEST_TIMEOUT_MS", 60000),
  reasoningEffort: env("CSRM_AI_REASONING_EFFORT", ""),
  completionTranscriptDiagnostics: env.bool("CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS", false),
  dataClassificationCeiling: env("CSRM_AI_DATA_CLASSIFICATION_CEILING", ""),
  assessmentDraft: {
    baseURL: env("CSRM_AI_ASSESSMENT_BASE_URL"),
    apiKey: env("CSRM_AI_ASSESSMENT_API_KEY", ""),
    model: env("CSRM_AI_ASSESSMENT_MODEL"),
    maxOutputTokens: env.int("CSRM_AI_ASSESSMENT_MAX_OUTPUT_TOKENS", 8000),
  },
  questionnaireGeneration: {
    baseURL: env("CSRM_AI_QUESTIONNAIRE_BASE_URL"),
    apiKey: env("CSRM_AI_QUESTIONNAIRE_API_KEY", ""),
    model: env("CSRM_AI_QUESTIONNAIRE_MODEL"),
    maxOutputTokens: env.int("CSRM_AI_QUESTIONNAIRE_MAX_OUTPUT_TOKENS", 16000),
  },
});

export default config;
