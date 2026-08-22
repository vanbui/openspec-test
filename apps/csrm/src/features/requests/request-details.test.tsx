/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialRequestActionState } from "./request-form-state";

const { mockWithdraw } = vi.hoisted(() => ({ mockWithdraw: vi.fn() }));

vi.mock("./request-form", () => ({
  RequestForm: ({ saveLabel }: { saveLabel?: string }) => <div data-testid="request-form">{saveLabel ?? "Save draft"}</div>,
}));

vi.mock("@/components/ui/request-form-primitives", async () => {
  const React = await import("react");
  return {
    RequestConfirmationDialog: ({ open, title, description, cancelLabel, confirmLabel }: { open: boolean; title: string; description: string; cancelLabel: string; confirmLabel: string }) => open ? <div aria-label={title} role="dialog"><p>{description}</p><button autoFocus>{cancelLabel}</button><button>{confirmLabel}</button></div> : null,
  };
});

import { RequestDetails } from "./request-details";

afterEach(() => {
  cleanup();
  mockWithdraw.mockReset();
});

const catalogue = { informationSystems: [], informationAssets: [] };

function request(status: string, overrides: Record<string, unknown> = {}) {
  return {
    documentId: "request-1",
    requestNumber: "REQ-0001",
    title: "A very long vendor platform request title that must wrap safely on narrow screens",
    description: "A detailed request description.",
    assessmentType: "Project",
    division: "Technology",
    businessUnit: "Platform",
    businessPurpose: "Support customer services.",
    businessCriticality: "High",
    thirdPartyInvolvement: false,
    thirdPartyDetails: null,
    regulatoryRequirements: null,
    dueDate: null,
    requestStatus: status,
    requestor: { displayName: "Requestor One" },
    informationSystems: [],
    informationAssets: [],
    ...overrides,
  };
}

describe("RequestDetails", () => {
  it("shows the owned draft form and never exposes a delete control", () => {
    render(
      <RequestDetails
        actorKind="owner"
        initialCatalogue={catalogue}
        request={request("draft")}
        saveDraftAction={vi.fn()}
        submitRequestAction={vi.fn()}
        withdrawRequestAction={mockWithdraw}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: /A very long vendor platform/i })).toBeDefined();
    expect(screen.getByText("REQ-0001")).toBeDefined();
    expect(screen.getByTestId("request-form").textContent).toBe("Save draft");
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("shows analyst collaboration only for draft editing and keeps submission requestor-only", () => {
    render(
      <RequestDetails
        actorKind="analyst"
        initialCatalogue={catalogue}
        request={request("draft")}
        saveDraftAction={vi.fn()}
        submitRequestAction={vi.fn()}
        withdrawRequestAction={mockWithdraw}
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "You are editing a Requestor draft. The Requestor must review and submit it.",
    );
    expect(screen.getByTestId("request-form").textContent).toBe("Save draft changes");
  });

  it("renders submitted withdrawal with the approved confirmation and read-only later statuses", () => {
    const { rerender } = render(
      <RequestDetails
        actorKind="owner"
        initialCatalogue={catalogue}
        request={request("submitted")}
        saveDraftAction={vi.fn()}
        submitRequestAction={vi.fn()}
        withdrawRequestAction={mockWithdraw}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Workflow" }).textContent).toBe("Workflow");
    expect(screen.getByText("Submitted — awaiting Security Analyst review.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Withdraw submission" })).toBeDefined();

    rerender(
      <RequestDetails
        actorKind="owner"
        initialCatalogue={catalogue}
        request={request("under-review")}
        saveDraftAction={vi.fn()}
        submitRequestAction={vi.fn()}
        withdrawRequestAction={mockWithdraw}
      />,
    );

    expect(screen.getByText("Under review — a Security Analyst is reviewing this request.")).toBeDefined();
    expect(screen.queryByTestId("request-form")).toBeNull();
    expect(screen.queryByRole("button", { name: "Withdraw submission" })).toBeNull();
    expect(screen.getByText("Not provided")).toBeDefined();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
