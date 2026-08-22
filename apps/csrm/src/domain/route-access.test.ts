import { describe, expect, it, vi } from "vitest";

import { requestorCapabilityIds } from "@/config/capabilities";

import { resolveRouteAccess } from "./route-access";

describe("route-access preflight", () => {
  it("allows an enabled route with its Function before protected work", async () => {
    const protectedLoad = vi.fn(async () => undefined);

    await expect(
      resolveRouteAccess("/", requestorCapabilityIds, protectedLoad),
    ).resolves.toMatchObject({ kind: "allowed", route: { href: "/" } });
    expect(protectedLoad).toHaveBeenCalledTimes(1);
  });

  it("returns forbidden for a known enabled route lacking its Function without protected work", async () => {
    const protectedLoad = vi.fn(async () => undefined);

    await expect(resolveRouteAccess("/", [], protectedLoad)).resolves.toMatchObject({
      kind: "forbidden",
      route: { href: "/", capability: "function.dashboard.dashboard" },
    });
    expect(protectedLoad).not.toHaveBeenCalled();
  });

  it("returns unavailable for planned and unknown paths without protected work", async () => {
    const protectedLoad = vi.fn(async () => undefined);

    await expect(
      resolveRouteAccess("/requests", requestorCapabilityIds, protectedLoad),
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(
      resolveRouteAccess("/not-a-csrm-route", requestorCapabilityIds, protectedLoad),
    ).resolves.toEqual({ kind: "unavailable" });
    expect(protectedLoad).not.toHaveBeenCalled();
  });

  it("matches enabled registered bracket segments before protected detail loading", async () => {
    const protectedLoad = vi.fn(async () => undefined);

    await expect(
      resolveRouteAccess("/requests/request-1", requestorCapabilityIds, protectedLoad),
    ).resolves.toMatchObject({ kind: "allowed", route: { id: "request-details" } });
    expect(protectedLoad).toHaveBeenCalledTimes(1);
  });

  it("classifies only route status and Function capability, never a role display label", async () => {
    await expect(
      resolveRouteAccess("/", ["function.dashboard.dashboard"]),
    ).resolves.toMatchObject({ kind: "allowed" });
    await expect(resolveRouteAccess("/", [])).resolves.toMatchObject({
      kind: "forbidden",
    });
  });
});
