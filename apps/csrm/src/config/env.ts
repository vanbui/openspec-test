import "server-only";

import { SAFE_API_MESSAGES, type ServiceResult } from "@/domain/service-result";

const developmentBaseUrl = "http://localhost:1337/api";

/**
 * Reads only server-side configuration. This URL is intentionally not public
 * runtime configuration and its pathname remains the Strapi API prefix.
 */
export function getCsrmStrapiBaseUrl(): ServiceResult<URL> {
  const configured = process.env.CSRM_STRAPI_BASE_URL?.trim();
  const rawUrl = configured || (process.env.NODE_ENV === "production" ? undefined : developmentBaseUrl);

  if (!rawUrl) {
    return {
      ok: false,
      error: {
        kind: "configuration",
        message: SAFE_API_MESSAGES.configuration,
        retryable: false,
      },
    };
  }

  try {
    const url = new URL(rawUrl);
    if (!/^https?:$/.test(url.protocol) || url.search || url.hash) {
      throw new Error("Invalid Strapi base URL");
    }

    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return { ok: true, data: url };
  } catch {
    return {
      ok: false,
      error: {
        kind: "configuration",
        message: SAFE_API_MESSAGES.configuration,
        retryable: false,
      },
    };
  }
}
