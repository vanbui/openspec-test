import "server-only";

import { getCsrmStrapiBaseUrl } from "@/config/env";
import {
  SAFE_API_MESSAGES,
  type ServiceResult,
} from "@/domain/service-result";

export type ApiClient = {
  get<T>(path: string, isValid?: (value: unknown) => value is T): Promise<ServiceResult<T>>;
};

type ApiClientOptions = {
  fetch?: typeof fetch;
  timeoutMs?: number;
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

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

  return {
    async get<T>(
      path: string,
      isValid?: (value: unknown) => value is T,
    ): Promise<ServiceResult<T>> {
      const baseUrl = getCsrmStrapiBaseUrl();
      if (!baseUrl.ok) {
        return baseUrl;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(buildRequestUrl(baseUrl.data, path), {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
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

        if (isValid && !isValid(body)) {
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
