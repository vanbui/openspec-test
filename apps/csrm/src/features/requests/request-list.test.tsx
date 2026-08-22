/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/requests",
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams("sort=updated-desc"),
}));

import { RequestList } from "./request-list";

afterEach(() => {
  cleanup();
  mockReplace.mockReset();
  vi.useRealTimers();
});

const requests = [
  {
    documentId: "request-1",
    requestNumber: "REQ-0001",
    title: "A long vendor platform request title that remains available to assistive technology",
    requestStatus: "draft",
    assessmentType: "Project",
    updatedAt: "2026-08-23T10:00:00.000Z",
  },
  {
    documentId: "request-2",
    requestNumber: "REQ-0002",
    title: "Customer data review",
    requestStatus: "submitted",
    assessmentType: null,
    updatedAt: "2026-08-22T10:00:00.000Z",
  },
] as const;

function renderList(overrides: Partial<React.ComponentProps<typeof RequestList>> = {}) {
  return render(
    <RequestList
      filters={{ page: 1, q: "", sort: "updated-desc", status: "" }}
      requests={requests}
      total={2}
      {...overrides}
    />,
  );
}

describe("RequestList", () => {
  it("renders one labelled desktop table and equivalent mobile cards with named request actions", () => {
    renderList();

    const table = screen.getByRole("table", { name: "My risk assessment requests" });
    expect(within(table).getByRole("columnheader", { name: /request/i })).toBeDefined();
    expect(within(table).getByRole("columnheader", { name: /status/i })).toBeDefined();
    expect(within(table).getByRole("columnheader", { name: /assessment type/i })).toBeDefined();
    expect(within(table).getByRole("columnheader", { name: /updated/i })).toBeDefined();
    expect(within(table).getByRole("columnheader", { name: /actions/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /view request REQ-0001/i })).toHaveAttribute("href", "/requests/request-1");
    expect(screen.getAllByRole("list", { name: "My risk assessment requests" })).toHaveLength(1);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(1);
  });

  it("uses the exact filter controls, debounces keyword URLs, and resets page on a filter change", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderList({ filters: { page: 3, q: "", sort: "updated-desc", status: "" } });

    expect(screen.getByRole("combobox", { name: "Status" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Sort requests" })).toHaveValue("updated-desc");
    expect(screen.queryByRole("combobox", { name: /assessment/i })).toBeNull();

    await user.type(screen.getByRole("searchbox", { name: "Search requests" }), "vendor");
    expect(mockReplace).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(mockReplace).toHaveBeenLastCalledWith("/requests?q=vendor&sort=updated-desc", { scroll: false });

    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "submitted");
    expect(mockReplace).toHaveBeenLastCalledWith("/requests?status=submitted&sort=updated-desc", { scroll: false });
  });

  it("exposes only the active table sort, deterministic result announcements, and bounded pagination", async () => {
    const user = userEvent.setup();
    renderList({ filters: { page: 2, q: "", sort: "title-asc", status: "" }, total: 27 });

    expect(screen.getByRole("columnheader", { name: /request/i })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: /updated/i })).not.toHaveAttribute("aria-sort");
    expect(screen.getByRole("status").textContent).toContain("27 requests");
    expect(screen.getByRole("navigation", { name: "Request pagination" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Previous page" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    await user.selectOptions(screen.getByRole("combobox", { name: "Sort requests" }), "updated-asc");
    await waitFor(() => expect(mockReplace).toHaveBeenLastCalledWith("/requests?sort=updated-asc", { scroll: false }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Request results" }));
  });

  it("uses distinct empty states and clears only list query controls", async () => {
    const user = userEvent.setup();
    renderList({ filters: { page: 2, q: "vendor", sort: "title-asc", status: "draft" }, requests: [], total: 0 });

    expect(screen.getByRole("heading", { name: "No matching requests" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/requests", { scroll: false });
  });
});
