import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAFE_API_MESSAGES } from "@/domain/service-result";
import { createApiClient } from "@/lib/api/client";
import {
  createDraft,
  getAccessibleRequest,
  getRequestorDashboard,
  listInformationAssets,
  listInformationSystems,
  listOwnedRequests,
  saveDraft,
  submitRequest,
  withdrawRequest,
} from "@/lib/api/csrm-service";
import {
  informationAssetsFixture,
  informationSystemsFixture,
  requestDashboardFixture,
  requestFixture,
  requestListFixture,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";

const actor = "requestor@example.test";

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.stubEnv("CSRM_STRAPI_BASE_URL", "http://strapi.test/api");
  vi.stubEnv("IDAMBOX_CSRM_INTERNAL_TOKEN", "local-test-token-that-is-at-least-thirty-two-bytes");
});

function expectInternalHeaders(request: Request) {
  expect(request.headers.get("authorization")).toMatch(/^Bearer .+$/);
  expect(request.headers.get("x-idambox-csrm-actor-email")).toBe(actor);
  expect(request.headers.get("accept")).toBe("application/json");
}

describe("CSRM request service", () => {
  it("serializes Phase 7 operations", async () => {
    const observed: Array<{ method: string; path: string; body?: unknown }> = [];
    server.use(
      http.all("http://strapi.test/api/:path*", async ({ request }) => {
        expectInternalHeaders(request);
        const url = new URL(request.url);
        observed.push({
          method: request.method,
          path: `${url.pathname}${url.search}`,
          body: request.method === "GET" ? undefined : await request.json(),
        });

        if (url.pathname.endsWith("/dashboard")) return HttpResponse.json(requestDashboardFixture);
        if (url.pathname.endsWith("/submit") || url.pathname.endsWith("/withdraw")) {
          return HttpResponse.json(requestFixture);
        }
        if (url.pathname.endsWith("/csrm-information-systems")) {
          return HttpResponse.json(informationSystemsFixture);
        }
        if (url.pathname.endsWith("/csrm-information-assets")) {
          return HttpResponse.json(informationAssetsFixture);
        }
        if (url.pathname.includes("request-1")) return HttpResponse.json(requestFixture);
        if (request.method === "GET") return HttpResponse.json(requestListFixture);
        return HttpResponse.json(requestFixture);
      }),
    );

    await expect(listOwnedRequests(actor, { keyword: "one & two", status: "draft", page: 2 })).resolves.toMatchObject({ ok: true });
    await expect(createDraft(actor, { title: "Draft request" })).resolves.toMatchObject({ ok: true });
    await expect(getAccessibleRequest(actor, "request-1")).resolves.toMatchObject({ ok: true });
    await expect(saveDraft(actor, "request-1", { title: "Saved request", thirdPartyInvolvement: "false" })).resolves.toMatchObject({ ok: true });
    await expect(getRequestorDashboard(actor)).resolves.toMatchObject({ ok: true });
    await expect(submitRequest(actor, "request-1")).resolves.toMatchObject({ ok: true });
    await expect(withdrawRequest(actor, "request-1")).resolves.toMatchObject({ ok: true });
    await expect(listInformationSystems(actor, "core & edge")).resolves.toMatchObject({ ok: true });
    await expect(listInformationAssets(actor, "asset name")).resolves.toMatchObject({ ok: true });

    expect(observed).toEqual([
      expect.objectContaining({ method: "GET", path: "/api/csrm-assessment-requests?_q=one+%26+two&filters%5BrequestStatus%5D%5B%24eq%5D=draft&pagination%5Bpage%5D=2&pagination%5BpageSize%5D=25" }),
      expect.objectContaining({ method: "POST", path: "/api/csrm-assessment-requests", body: { data: { title: "Draft request" } } }),
      expect.objectContaining({ method: "GET", path: "/api/csrm-assessment-requests/request-1" }),
      expect.objectContaining({ method: "PUT", path: "/api/csrm-assessment-requests/request-1", body: { data: { title: "Saved request", thirdPartyInvolvement: "false" } } }),
      expect.objectContaining({ method: "GET", path: "/api/csrm-assessment-requests/dashboard" }),
      expect.objectContaining({ method: "POST", path: "/api/csrm-assessment-requests/request-1/submit", body: { data: {} } }),
      expect.objectContaining({ method: "POST", path: "/api/csrm-assessment-requests/request-1/withdraw", body: { data: {} } }),
      expect.objectContaining({ method: "GET", path: "/api/csrm-information-systems?_q=core+%26+edge&pagination%5BpageSize%5D=25" }),
      expect.objectContaining({ method: "GET", path: "/api/csrm-information-assets?_q=asset+name&pagination%5BpageSize%5D=25" }),
    ]);
  });

  it("authenticates the internal actor", async () => {
    vi.stubEnv("CSRM_STRAPI_BASE_URL", "http://strapi.test/custom/prefix/");
    server.use(
      http.get("http://strapi.test/custom/prefix/csrm-assessment-requests/dashboard", ({ request }) => {
        expectInternalHeaders(request);
        expect(request.headers.get("content-type")).toBeNull();
        return HttpResponse.json(requestDashboardFixture);
      }),
    );

    await expect(getRequestorDashboard(actor)).resolves.toEqual({ ok: true, data: requestDashboardFixture });

    vi.stubEnv("IDAMBOX_CSRM_INTERNAL_TOKEN", "");
    await expect(getRequestorDashboard(actor)).resolves.toMatchObject({
      ok: false,
      error: { kind: "configuration", retryable: false },
    });
  });

  it("maps request failures safely", async () => {
    const leaked = "raw-token-and-actor@example.test";
    server.use(
      http.get("http://strapi.test/api/csrm-assessment-requests/request-1", () =>
        new HttpResponse(leaked, { status: 403, headers: { "x-secret": leaked } }),
      ),
    );

    const result = await getAccessibleRequest(actor, "request-1");
    expect(result).toEqual({
      ok: false,
      error: { kind: "http", status: 403, message: SAFE_API_MESSAGES.load, retryable: false },
    });
    expect(JSON.stringify(result)).not.toContain(leaked);

    server.use(
      http.put("http://strapi.test/api/csrm-assessment-requests/request-1", () =>
        HttpResponse.json({ error: { details: { errors: [{ path: ["title"], message: "Title is required" }] } } }, { status: 400 }),
      ),
    );
    await expect(saveDraft(actor, "request-1", { title: "" })).resolves.toEqual({
      ok: false,
      error: {
        kind: "validation",
        message: "Please correct the highlighted fields and try again.",
        retryable: false,
        fields: { title: "Title is required" },
      },
    });

    const malformed = await createApiClient({ fetch: async () => new HttpResponse("not-json") }).request({
      method: "GET",
      path: "/csrm-assessment-requests",
      isValid: (value: unknown): value is unknown => value !== undefined,
    });
    expect(malformed).toMatchObject({ ok: false, error: { kind: "invalid-response", retryable: false } });
  });
});
