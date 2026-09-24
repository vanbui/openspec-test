export type CsrmAiProviderMode = "deterministic" | "openai-compatible";

export const CSRM_AI_PROVIDER_MODE: CsrmAiProviderMode =
  process.env.CSRM_AI_PROVIDER === "openai-compatible" ? "openai-compatible" : "deterministic";
