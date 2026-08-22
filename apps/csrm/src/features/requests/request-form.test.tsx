/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialRequestActionState, type RequestActionState } from "./request-form-state";

const { mockReplace, mockSaveDraft, mockSubmitRequest } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockSaveDraft: vi.fn(),
  mockSubmitRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/components/ui/request-form-primitives", async () => {
  const React = await import("react");
  return {
    RequestFormSection: ({ title, children }: { title: string; children: React.ReactNode }) => <section><h2>{title}</h2>{children}</section>,
    RequestFormField: ({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) => <div><label htmlFor={id}>{label}</label>{children}{error ? <p id={`${id}-error`}>{error}</p> : null}</div>,
    RequestConfirmationDialog: ({ open, title, description, cancelLabel, confirmLabel, onOpenChange, onConfirm }: { open: boolean; title: string; description: string; cancelLabel: string; confirmLabel: string; onOpenChange: (open: boolean) => void; onConfirm: () => void }) => open ? <div aria-label={title} role="dialog"><h2>{title}</h2><p>{description}</p><button autoFocus onClick={() => onOpenChange(false)} type="button">{cancelLabel}</button><button onClick={onConfirm} type="button">{confirmLabel}</button></div> : null,
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
      saveDraftAction={mockSaveDraft}
      submitRequestAction={mockSubmitRequest}
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
    expect(screen.getAllByText("Enter a request title to save a draft.")).toHaveLength(2);
    expect(mockSaveDraft).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Request title"), "Vendor platform");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toContain("Draft saved.");
    expect(mockReplace).toHaveBeenCalledWith("/requests/request-1");
  });

  it("focuses the exact validation summary and only opens submission confirmation when valid", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Submit request" }));
    const summary = screen.getByRole("alert", { name: "Check the highlighted fields" });
    expect(document.activeElement).toBe(summary);
    expect(screen.getByLabelText("Request title").getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByRole("dialog", { name: "Submit risk assessment request?" })).toBeNull();
  });

  it("opens the safe-default submit confirmation only after every required value is present", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Request title"), "Vendor platform");
    await user.type(screen.getByLabelText("Request description"), "A new managed platform for customer work.");
    await user.selectOptions(screen.getByLabelText("Assessment type"), "Project");
    await user.type(screen.getByLabelText("Business purpose"), "Support a regulated customer service.");
    await user.selectOptions(screen.getByLabelText("Business criticality"), "High");
    await user.click(screen.getByRole("radio", { name: "No" }));
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(screen.getByRole("dialog", { name: "Submit risk assessment request?" }).textContent).toContain(
      "Once submitted, your request will be available for Security Analyst review.",
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep editing" }));
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

  it("intercepts dirty breadcrumb navigation with the exact unsaved-work confirmation", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Request title"), "Unfinished draft");
    await user.click(screen.getByRole("link", { name: "Risk Assessment Requests" }));

    expect(screen.getByRole("dialog", { name: "Discard unsaved changes?" }).textContent).toContain(
      "Your changes have not been saved. Do you want to keep editing or discard them?",
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep editing" }));
  });
});
