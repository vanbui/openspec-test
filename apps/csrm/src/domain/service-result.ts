export type SafeApiError = {
  kind: "http" | "network" | "timeout" | "invalid-response" | "configuration";
  status?: number;
  message: string;
  retryable: boolean;
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SafeApiError };

export const SAFE_API_MESSAGES = {
  configuration: "CSRM is not configured to connect to its service.",
  load: "We couldn’t load this page. Check your connection and try again. If the problem continues, contact your CSRM administrator.",
} as const;
