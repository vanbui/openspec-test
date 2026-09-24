import OpenAI from "openai";

export type CsrmAiOperation = "assessmentDraft" | "questionnaireGeneration";
export type CsrmAiOperationConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  structuredOutputMode: boolean;
  providerLabel: string;
  reasoningEffort: string;
  completionTranscriptDiagnostics: boolean;
};
export type CsrmAiFailureCode = "PROVIDER_AUTH_ERROR" | "PROVIDER_RATE_LIMITED" | "PROVIDER_TIMEOUT" | "PROVIDER_OUTPUT_INVALID";

export class CsrmAiProviderError extends Error {
  constructor(public readonly code: CsrmAiFailureCode, public readonly safeMessage: string, public readonly diagnostic?: Record<string, unknown>) {
    super(safeMessage);
    this.name = "CsrmAiProviderError";
  }
}

type AiConfig = Omit<CsrmAiOperationConfig, "baseURL" | "apiKey" | "model" | "maxOutputTokens"> & Record<CsrmAiOperation, Pick<CsrmAiOperationConfig, "baseURL" | "apiKey" | "model" | "maxOutputTokens">>;

export function logCompletionDiagnostic(config: CsrmAiOperationConfig, payload: Record<string, unknown>) {
  if (config.completionTranscriptDiagnostics) globalThis.strapi.log.info(JSON.stringify(payload));
}

function diagnosticProviderError(error: unknown): Record<string, unknown> {
  if (!(error instanceof OpenAI.APIError)) return { errorName: error instanceof Error ? error.name : "UnknownError" };
  return {
    errorName: error.name,
    status: error.status ?? null,
    requestId: error.requestID ?? null,
    providerMessage: error.message,
    providerType: typeof error.error === "object" && error.error !== null && "type" in error.error ? (error.error as { type?: unknown }).type ?? null : null,
    providerCode: typeof error.error === "object" && error.error !== null && "code" in error.error ? (error.error as { code?: unknown }).code ?? null : null,
  };
}

function outputTokenLimit(config: CsrmAiOperationConfig): Record<string, number> {
  // Current OpenAI reasoning models reject the legacy max_tokens field. Keep it for
  // self-hosted OpenAI-compatible servers, many of which do not yet accept its replacement.
  return new URL(config.baseURL).hostname === "api.openai.com"
    ? { max_completion_tokens: config.maxOutputTokens }
    : { max_tokens: config.maxOutputTokens };
}

export function readCsrmAiOperationConfig(operation: CsrmAiOperation): CsrmAiOperationConfig {
  const config = globalThis.strapi.config.get("ai") as AiConfig;
  const operationConfig = config?.[operation];
  const baseURL = operationConfig?.baseURL?.trim();
  const model = operationConfig?.model?.trim();
  if (!baseURL || !model) throw new CsrmAiProviderError("PROVIDER_AUTH_ERROR", "Provider configuration is unavailable.");
  return {
    baseURL,
    apiKey: operationConfig.apiKey ?? "",
    model,
    maxOutputTokens: operationConfig.maxOutputTokens,
    requestTimeoutMs: config.requestTimeoutMs,
    structuredOutputMode: config.structuredOutputMode,
    providerLabel: config.providerLabel,
    reasoningEffort: config.reasoningEffort ?? "",
    completionTranscriptDiagnostics: config.completionTranscriptDiagnostics === true,
  };
}

export async function requestJsonCompletion(input: { config: CsrmAiOperationConfig; systemPrompt: string; userPrompt: string; schemaName: string; jsonSchema: Record<string, unknown> }): Promise<unknown> {
  const { config, systemPrompt, userPrompt, schemaName, jsonSchema } = input;
  try {
    logCompletionDiagnostic(config, { event: "csrm.ai.completion.prompt", schemaName, systemPrompt, userPrompt });
    const apiKey = config.apiKey ?? "";
    const client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: apiKey || "unused",
      timeout: config.requestTimeoutMs,
      maxRetries: 0,
      fetch: apiKey ? undefined : async (url, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("authorization");
        return fetch(url, { ...init, headers });
      },
    });
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      ...outputTokenLimit(config),
      ...(config.structuredOutputMode ? { response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema: jsonSchema } } } : {}),
      ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort as OpenAI.Chat.Completions.ChatCompletionReasoningEffort } : {}),
    });
    const choice = response.choices[0];
    const rawText = choice?.message?.content;
    logCompletionDiagnostic(config, {
      event: "csrm.ai.completion.response", schemaName, content: rawText ?? null,
      finishReason: choice?.finish_reason ?? null, refusal: choice?.message?.refusal ?? null,
    });
    if (!rawText?.trim()) throw new CsrmAiProviderError("PROVIDER_OUTPUT_INVALID", "Provider returned invalid output.", {
      stage: "completion_response", reason: "empty_content", finishReason: choice?.finish_reason ?? null, refusal: choice?.message?.refusal ?? null,
    });
    try {
      return JSON.parse(rawText);
    } catch {
      throw new CsrmAiProviderError("PROVIDER_OUTPUT_INVALID", "Provider returned invalid output.", { stage: "completion_response", reason: "content_is_not_json" });
    }
  } catch (error) {
    const providerError = error instanceof CsrmAiProviderError
      ? error
      : error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError
        ? new CsrmAiProviderError("PROVIDER_AUTH_ERROR", "Provider authentication failed.")
        : error instanceof OpenAI.RateLimitError
          ? new CsrmAiProviderError("PROVIDER_RATE_LIMITED", "Provider rate limit reached.")
          : error instanceof OpenAI.APIConnectionTimeoutError
            ? new CsrmAiProviderError("PROVIDER_TIMEOUT", "Provider request timed out.")
          : error instanceof OpenAI.BadRequestError
            ? new CsrmAiProviderError("PROVIDER_OUTPUT_INVALID", "Provider rejected the completion request.", { stage: "completion_request", reason: "provider_rejected_request", ...diagnosticProviderError(error) })
            : new CsrmAiProviderError("PROVIDER_OUTPUT_INVALID", "Provider returned invalid output.", { stage: "completion_request", reason: "provider_request_failed", ...diagnosticProviderError(error) });
    logCompletionDiagnostic(config, { event: "csrm.ai.completion.failure", schemaName, code: providerError.code, ...(providerError.diagnostic ?? {}) });
    throw providerError;
  }
}
