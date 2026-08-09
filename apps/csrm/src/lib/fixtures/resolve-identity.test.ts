import { describe, expect, it, vi } from "vitest";

import {
  developmentFixtureCookieName,
  developmentIdentitySelectorState,
  resolveDevelopmentIdentity,
  setDevelopmentIdentity,
} from "./resolve-identity";

describe("development identity resolver", () => {
  it("defaults development and test to Jane, and selects Bob only through the exact fixture key", () => {
    const jane = resolveDevelopmentIdentity({ runtime: "development" });
    const bob = resolveDevelopmentIdentity({
      runtime: "test",
      cookieValue: "analyst",
    });

    expect(jane).toMatchObject({
      fixtureKey: "requestor",
      displayName: "Requestor — Jane",
      email: "jane.doe@idambox.com",
    });
    expect(jane?.capabilities).toHaveLength(8);
    expect(bob).toMatchObject({
      fixtureKey: "analyst",
      displayName: "Security Analyst — Bob",
      email: "bob.doe@idambox.com",
    });
    expect(bob?.capabilities).toHaveLength(23);
  });

  it("returns no fixture identity or selector in production", () => {
    expect(
      resolveDevelopmentIdentity({ runtime: "production", cookieValue: "analyst" }),
    ).toBeUndefined();
    expect(developmentIdentitySelectorState("production")).toBeUndefined();
  });

  it("rejects unknown or arbitrary elevated input and writes only an httpOnly strict development cookie", () => {
    const set = vi.fn();

    expect(() =>
      setDevelopmentIdentity({
        fixtureKey: "Security Analyst",
        runtime: "development",
        cookieStore: { set },
      }),
    ).toThrow("Invalid development identity selection.");
    expect(() =>
      setDevelopmentIdentity({
        fixtureKey: "analyst",
        runtime: "production",
        cookieStore: { set },
      }),
    ).toThrow("Development identity selection is unavailable.");

    setDevelopmentIdentity({
      fixtureKey: "analyst",
      runtime: "test",
      cookieStore: { set },
    });

    expect(set).toHaveBeenCalledWith(developmentFixtureCookieName, "analyst", {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
  });

  it("does not use URL, public environment, client storage, roles, or unknown cookies as an elevation channel", () => {
    expect(
      resolveDevelopmentIdentity({ runtime: "development", cookieValue: "role.security_analyst" }),
    ).toMatchObject({ fixtureKey: "requestor" });
    expect(
      resolveDevelopmentIdentity({ runtime: "development", cookieValue: "unknown" }),
    ).toMatchObject({ fixtureKey: "requestor" });
  });
});
