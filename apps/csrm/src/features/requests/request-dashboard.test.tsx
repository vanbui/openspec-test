/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import { RequestDashboard } from "./request-dashboard";

afterEach(() => {
  cleanup();
  mockRefresh.mockReset();
});

const dashboard = {
  statusCounts: { draft: 1, submitted: 2, closed: 0 },
  needsAttention: [{ documentId: "request-1", requestNumber: "REQ-0001", title: "Vendor platform review", requestStatus: "draft", submittedDate: null }],
  recentSubmissions: [{ documentId: "request-2", requestNumber: "REQ-0002", title: "Customer data review", requestStatus: "submitted", submittedDate: "2026-08-22T10:00:00.000Z" }],
  notices: [{ documentId: "request-1", message: "Complete Vendor platform review before submitting." }],
} as const;

describe("RequestDashboard", () => {
  it("uses the action-first widget order with owner-bound named record links and status-filtered summaries", () => {
    render(<RequestDashboard dashboard={dashboard} />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Needs your attention",
      "Recently submitted",
      "Request status",
      "Notifications",
    ]);
    expect(screen.getByRole("link", { name: /Vendor platform review REQ-0001/i }).getAttribute("href")).toBe("/requests/request-1");
    expect(screen.getByText("Continue editing before you submit this request.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Complete Vendor platform review before submitting." }).getAttribute("href")).toBe("/requests/request-1");
    expect(screen.getByRole("link", { name: "1 Draft request" }).getAttribute("href")).toBe("/requests?status=draft");
    expect(screen.getByRole("link", { name: "2 Submitted requests" }).getAttribute("href")).toBe("/requests?status=submitted");
  });

  it("renders the exact dashboard empty copy and labels zero counts without fabricated workflow data", () => {
    render(<RequestDashboard dashboard={{ statusCounts: { draft: 0 }, needsAttention: [], recentSubmissions: [], notices: [] }} />);

    expect(screen.getByText("You have no requests requiring action.")).toBeDefined();
    expect(screen.getByText("You have not submitted any requests yet.")).toBeDefined();
    expect(screen.getByText("No new notifications.")).toBeDefined();
    expect(screen.getByRole("link", { name: "0 Draft requests" })).toBeDefined();
    expect(screen.queryByText(/risk score|questionnaire|assessment metric/i)).toBeNull();
  });

  it("keeps successful widgets visible while a recoverable widget error can retry", async () => {
    const user = userEvent.setup();
    render(<RequestDashboard dashboard={dashboard} failedWidgets={["notifications"]} />);

    const notifications = screen.getByRole("heading", { name: "Notifications" }).closest("section");
    expect(within(notifications!).getByRole("alert").textContent).toContain("We couldn’t load this widget.");
    expect(screen.getByText("Vendor platform review")).toBeDefined();
    await user.click(within(notifications!).getByRole("button", { name: "Try again" }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("uses a semantic responsive grid and never relies on colour-only status", () => {
    const { container } = render(<RequestDashboard dashboard={dashboard} />);

    expect(container.querySelector("[data-dashboard-grid]")?.className).toContain("md:grid-cols-2");
    expect(container.querySelector("[data-dashboard-grid]")?.className).toContain("xl:grid-cols-3");
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });
});
