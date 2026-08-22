import "server-only";

import { getCsrmInternalToken, getCsrmStrapiBaseUrl } from "@/config/env";
import {
  SAFE_API_MESSAGES,
  type ServiceResult,
} from "@/domain/service-result";

export type ApiClient = {
  request<T>(request: ApiRequest<T>): Promise<ServiceResult<T>>;
};

export type ApiRequest<T> = {
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
  isValid: (value: unknown) => value is T;
  isWrite?: boolean;
};

type ApiClientOptions = {
  fetch?: typeof fetch;
  timeoutMs?: number;
  actorEmail?: string;
};

const defaultTimeoutMs = 10_000;

function buildRequestUrl(baseUrl: URL, path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const prefix = baseUrl.pathname === "/" ? "" : baseUrl.pathname;
  return new URL(`${prefix}/${normalizedPath}`, baseUrl.origin).toString();
}

function error(
  kind: Extract<
    import("@/domain/service-result").SafeApiError["kind"],
    "http" | "network" | "timeout" | "invalid-response"
  >,
  options: Pick<import("@/domain/service-result").SafeApiError, "status" | "retryable">,
): ServiceResult<never> {
  return {
    ok: false,
    error: { kind, message: SAFE_API_MESSAGES.load, ...options },
  };
}

function validationError(body: unknown): ServiceResult<never> | undefined {
  if (!body || typeof body !== "object") return undefined;
  const details = (body as { error?: { details?: { errors?: unknown } } }).error?.details;
  if (!Array.isArray(details?.errors)) return undefined;

  const fields: Record<string, string> = {};
  for (const entry of details.errors) {
    if (!entry || typeof entry !== "object") continue;
    const path = (entry as { path?: unknown }).path;
    const message = (entry as { message?: unknown }).message;
    if (Array.isArray(path) && typeof path[0] === "string" && typeof message === "string") {
      fields[path[0]] = message;
    }
  }

  return Object.keys(fields).length > 0
    ? {
        ok: false,
        error: {
          kind: "validation",
          message: SAFE_API_MESSAGES.validation,
          retryable: false,
          fields,
        },
      }
    : undefined;
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

  return {
    async request<T>(request: ApiRequest<T>): Promise<ServiceResult<T>> {
      const baseUrl = getCsrmStrapiBaseUrl();
      if (!baseUrl.ok) {
        return baseUrl;
      }

      const token = getCsrmInternalToken();
      if (!token.ok) return token;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const headers: Record<string, string> = {
          accept: "application/json",
          authorization: `Bearer ${token.data}`,
        };
        if (options.actorEmail) headers["x-idambox-csrm-actor-email"] = options.actorEmail;
        if (request.body !== undefined) headers["content-type"] = "application/json";

        const response = await fetchImpl(buildRequestUrl(baseUrl.data, request.path), {
          method: request.method,
          headers,
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 400 && request.isWrite) {
            try {
              const parsed = validationError(await response.json());
              if (parsed) return parsed;
            } catch {
              // The public error below intentionally discards malformed server content.
            }
          }
          return error("http", {
            status: response.status,
            retryable: response.status === 429 || response.status >= 500,
          });
        }

        if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
          return error("invalid-response", { retryable: false });
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return error("invalid-response", { retryable: false });
        }

        if (!request.isValid(body)) {
          return error("invalid-response", { retryable: false });
        }

        return { ok: true, data: body as T };
      } catch {
        return error(controller.signal.aborted ? "timeout" : "network", {
          retryable: true,
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
