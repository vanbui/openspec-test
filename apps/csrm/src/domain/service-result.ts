export type SafeApiError = {
  kind: "http" | "network" | "timeout" | "invalid-response" | "configuration";
  status?: number;
  message: string;
  retryable: boolean;
};

export type SafeValidationError = {
  kind: "validation";
  message: string;
  retryable: false;
  fields: Record<string, string>;
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SafeApiError | SafeValidationError };

export const SAFE_API_MESSAGES = {
  configuration: "CSRM is not configured to connect to its service.",
  load: "We couldn’t load this page. Check your connection and try again. If the problem continues, contact your CSRM administrator.",
  write: "We couldn’t save your request. Check your connection and try again.",
  validation: "Please correct the highlighted fields and try again.",
} as const;
