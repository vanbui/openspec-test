/* Phase 12 D-25: the one read of what an AI run used, held by a human Security Analyst only (D-32). */
export const CSRM_AI_RUN_OPERATIONS = Object.freeze({
  getRun: "GET:/api/v1/ai_runs/{runId}",
} as const);
