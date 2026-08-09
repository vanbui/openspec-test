import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAFE_API_MESSAGES } from "@/domain/service-result";
import { createApiClient } from "@/lib/api/client";
import { listApplications } from "@/lib/api/csrm-service";
import { applicationsFixture } from "@/test/fixtures";
import { server } from "@/test/msw-server";

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => vi.stubEnv("CSRM_STRAPI_BASE_URL", "http://strapi.test/api"));

describe("listApplications", () => {
  it("lists applications through the generated contract", async () => {
    vi.stubEnv("CSRM_STRAPI_BASE_URL", "http://strapi.test/api");

    await expect(listApplications()).resolves.toEqual({
      ok: true,
      data: applicationsFixture,
    });
  });

  it("preserves the configured Strapi prefix", async () => {
    vi.stubEnv("CSRM_STRAPI_BASE_URL", "http://strapi.test/custom/prefix/");
    server.use(
      http.get("http://strapi.test/custom/prefix/applications", () =>
        HttpResponse.json(applicationsFixture),
      ),
    );

    await expect(listApplications()).resolves.toEqual({
      ok: true,
      data: applicationsFixture,
    });
  });

  it("returns a configuration failure before making a request in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CSRM_STRAPI_BASE_URL", "");

    await expect(listApplications()).resolves.toMatchObject({
      ok: false,
      error: {
        kind: "configuration",
        retryable: false,
      },
    });
  });
});

describe("Strapi transport failure normalization", () => {
  it.each([
    [400, false],
    [403, false],
    [500, true],
  ])("returns a safe HTTP result for %i without response leakage", async (status, retryable) => {
    const leakedBody = "internal-stack-token@example.test";
    server.use(
      http.get(
        "http://strapi.test/api/applications",
        () =>
          new HttpResponse(leakedBody, {
            status,
            headers: { "x-internal-token": leakedBody },
          }),
      ),
    );

    const result = await listApplications();

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "http",
        message: SAFE_API_MESSAGES.load,
        retryable,
        status,
      },
    });
    expect(JSON.stringify(result)).not.toContain(leakedBody);
  });

  it("returns invalid-response for malformed success content", async () => {
    server.use(
      http.get(
        "http://strapi.test/api/applications",
        () => new HttpResponse("not-json", { status: 200 }),
      ),
    );

    await expect(listApplications()).resolves.toEqual({
      ok: false,
      error: {
        kind: "invalid-response",
        message: SAFE_API_MESSAGES.load,
        retryable: false,
      },
    });
  });

  it("returns invalid-response when JSON does not satisfy the generated collection shape", async () => {
    server.use(
      http.get("http://strapi.test/api/applications", () =>
        HttpResponse.json({ invalid: true }),
      ),
    );

    await expect(listApplications()).resolves.toMatchObject({
      ok: false,
      error: { kind: "invalid-response", retryable: false },
    });
  });

  it("returns timeout without exposing an abort cause", async () => {
    const stalledFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("internal timeout detail", "AbortError")),
        );
      });

    await expect(
      createApiClient({ fetch: stalledFetch, timeoutMs: 1 }).get("/applications"),
    ).resolves.toEqual({
      ok: false,
      error: {
        kind: "timeout",
        message: SAFE_API_MESSAGES.load,
        retryable: true,
      },
    });
  });

  it("returns network without exposing the transport rejection", async () => {
    const rejectedFetch: typeof fetch = () =>
      Promise.reject(new Error("raw network credential detail"));

    const result = await createApiClient({ fetch: rejectedFetch }).get("/applications");

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "network",
        message: SAFE_API_MESSAGES.load,
        retryable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain("credential");
  });

  it("rejects an unmatched host instead of reaching a live network", async () => {
    await expect(fetch("http://unmatched.strapi.test/applications")).rejects.toThrow();
  });
});
