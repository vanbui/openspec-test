/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialRequestActionState, type RequestActionState } from "./request-actions";

const { mockReplace, mockSaveDraft, mockSubmitRequest } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockSaveDraft: vi.fn(),
  mockSubmitRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("./request-actions", async () => {
  const actual = await vi.importActual<typeof import("./request-actions")>("./request-actions");
  return {
    ...actual,
    saveDraft: mockSaveDraft,
    submitRequest: mockSubmitRequest,
  };
});

import { RequestForm } from "./request-form";

afterEach(() => {
  cleanup();
  mockReplace.mockReset();
  mockSaveDraft.mockReset();
  mockSubmitRequest.mockReset();
});

function successfulDraft(): RequestActionState {
  return {
    ...initialRequestActionState,
    status: "success",
    values: { ...initialRequestActionState.values, title: "Vendor platform" },
    announcement: "Draft saved.",
    redirectTo: "/requests/request-1",
  };
}

function renderForm() {
  return render(
    <RequestForm
      initialCatalogue={{
        informationSystems: [{ documentId: "system-1", name: "Payments platform" }],
        informationAssets: [{ documentId: "asset-1", name: "Customer records" }],
      }}
    />,
  );
}

describe("RequestForm", () => {
  it("renders the one progressive persisted-field form in the approved section order", () => {
    renderForm();

    expect(screen.getByRole("heading", { level: 1, name: "New risk assessment request" })).toBeDefined();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Request details",
      "Business context",
      "Third-party and regulatory context",
      "Related CSRM catalogue records",
    ]);
    expect(screen.queryByLabelText(/sponsor/i)).toBeNull();
    expect(screen.queryByLabelText(/system owner/i)).toBeNull();
  });

  it("validates title only for a draft and waits for acknowledgement before routing", async () => {
    const user = userEvent.setup();
    mockSaveDraft.mockResolvedValue(successfulDraft());
    renderForm();

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(screen.getByText("Enter a request title to save a draft.")).toBeDefined();
    expect(mockSaveDraft).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Request title"), "Vendor platform");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("Draft saved.");
    expect(mockReplace).toHaveBeenCalledWith("/requests/request-1");
  });

  it("focuses the exact validation summary and only opens submission confirmation when valid", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Submit request" }));
    const summary = screen.getByRole("alert", { name: "Check the highlighted fields" });
    expect(summary).toHaveFocus();
    expect(screen.getByLabelText("Request title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("dialog", { name: "Submit risk assessment request?" })).toBeNull();
  });

  it("shows and clears third-party details only for the Yes choice", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByLabelText("Third-party details")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Yes" }));
    await user.type(screen.getByLabelText("Third-party details"), "Cloud provider");
    await user.click(screen.getByRole("radio", { name: "No" }));

    expect(screen.queryByLabelText("Third-party details")).toBeNull();
    expect(screen.queryByDisplayValue("Cloud provider")).toBeNull();
  });

  it("keeps optional catalogue relations keyboard-selectable and removable", async () => {
    const user = userEvent.setup();
    renderForm();

    const systems = screen.getByRole("button", { name: "Select information systems" });
    await user.click(systems);
    await user.type(screen.getByRole("searchbox", { name: "Search information systems" }), "Payments");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByRole("button", { name: "Remove Payments platform" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Remove Payments platform" }));
    expect(screen.queryByRole("button", { name: "Remove Payments platform" })).toBeNull();
  });
});
