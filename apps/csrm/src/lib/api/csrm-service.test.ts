import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listApplications } from "@/lib/api/csrm-service";
import { applicationsFixture } from "@/test/fixtures";
import { server } from "@/test/msw-server";

afterEach(() => vi.unstubAllEnvs());

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
