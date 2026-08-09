/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { routeDefinitions } from "@/config/routes";
import type { IdentitySnapshot } from "@/domain/identity";

import { AppShell } from "./app-shell";

const requestor: IdentitySnapshot = {
  fixtureKey: "requestor",
  subject: "fixture:jane.doe@idambox.com",
  displayName: "Requestor — Jane",
  email: "jane.doe@idambox.com",
  capabilities: ["function.dashboard.dashboard"],
};

const analyst: IdentitySnapshot = {
  ...requestor,
  fixtureKey: "analyst",
  subject: "fixture:bob.doe@idambox.com",
  displayName: "Security Analyst — Bob",
  email: "bob.doe@idambox.com",
  capabilities: [
    "function.dashboard.dashboard",
    "function.administration.controls",
  ],
};

afterEach(cleanup);

function renderShell(identity: IdentitySnapshot = requestor) {
  return render(
    <AppShell identity={identity} routes={routeDefinitions}>
      <h1>Cyber Risk Manager</h1>
      <p>Your cyber risk management workspace is ready.</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("renders the desktop foundation shell with ordered landmarks and one page title", () => {
    const { container } = renderShell();

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const header = screen.getByRole("banner");
    const navigation = screen.getByRole("navigation", { name: "CSRM navigation" });
    const main = screen.getByRole("main");

    const landmarks: readonly Element[] = [skipLink, header, navigation, main];

    expect(landmarks).toEqual(
      [...container.querySelectorAll("a, header, nav, main")].filter((node) =>
        landmarks.includes(node),
      ),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(main.id).toBe("main-content");
    expect(main.className).toContain("lg:pl-[272px]");
    expect(main.className).toContain("lg:pt-16");
    expect(main.querySelector(".max-w-canvas")).not.toBeNull();
    expect(header.className).toContain("lg:pl-[272px]");
  });

  it("filters planned navigation for both requestor and analyst identities", () => {
    const { rerender } = renderShell();

    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).toContain("border-l-[3px]");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).toContain("bg-primary-soft");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).toContain("font-semibold");
    expect(screen.queryByText("Risk Assessment Requests")).toBeNull();
    expect(screen.queryByText("Administration")).toBeNull();
    expect(screen.queryByRole("link", { name: "Controls" })).toBeNull();

    rerender(
      <AppShell identity={analyst} routes={routeDefinitions}>
        <h1>Cyber Risk Manager</h1>
      </AppShell>,
    );

    expect(screen.getAllByRole("link", { name: "Dashboard" })).toHaveLength(1);
    expect(screen.queryByText("Administration")).toBeNull();
    expect(screen.queryByRole("link", { name: "Controls" })).toBeNull();
  });
});
