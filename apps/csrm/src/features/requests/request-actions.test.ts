import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveCurrentActor,
  createDraft,
  saveDraftService,
  submitRequestService,
  withdrawRequestService,
} = vi.hoisted(() => ({
  resolveCurrentActor: vi.fn(),
  createDraft: vi.fn(),
  saveDraftService: vi.fn(),
  submitRequestService: vi.fn(),
  withdrawRequestService: vi.fn(),
}));

vi.mock("./resolve-request-actor", () => ({ resolveCurrentActor }));
vi.mock("@/lib/api/csrm-service", () => ({
  createDraft,
  saveDraft: saveDraftService,
  submitRequest: submitRequestService,
  withdrawRequest: withdrawRequestService,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  initialRequestActionState,
  saveDraft,
  submitRequest,
  withdrawRequest,
} from "./request-actions";

function formData(values: Record<string, string | readonly string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const validSubmission = {
  title: "Edge access review",
  description: "Assess the risk introduced by the new edge service.",
  assessmentType: "Project",
  businessPurpose: "Protect customer data during the rollout.",
  businessCriticality: "High",
  thirdPartyInvolvement: "true",
  thirdPartyDetails: "Managed edge provider",
  informationSystems: ["system-1", "system-2"],
  informationAssets: ["asset-1"],
};

describe("request Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCurrentActor.mockResolvedValue({ email: "jane.doe@idambox.com" });
    createDraft.mockResolvedValue({ ok: true, data: { data: { documentId: "request-1" } } });
    saveDraftService.mockResolvedValue({ ok: true, data: { data: { documentId: "request-1" } } });
    submitRequestService.mockResolvedValue({ ok: true, data: { data: { documentId: "request-1" } } });
    withdrawRequestService.mockResolvedValue({ ok: true, data: { data: { documentId: "request-1" } } });
  });

  it("accepts only a nonblank title for a draft and never forwards system-owned fields", async () => {
    const entered = formData({
      title: "  Edge access review  ",
      description: "Saved description",
      requestor: "attacker@example.test",
      requestNumber: "RA-9999",
      requestStatus: "approved",
      submittedDate: "2026-08-22T00:00:00.000Z",
      capability: "function.administration.controls",
    });

    const saved = await saveDraft(undefined, initialRequestActionState, entered);

    expect(createDraft).toHaveBeenCalledWith("jane.doe@idambox.com", {
      title: "Edge access review",
    });
    expect(saved).toMatchObject({
      status: "success",
      announcement: "Draft saved.",
      redirectTo: "/requests/request-1",
      values: { title: "Edge access review", description: "Saved description" },
    });

    const invalid = await saveDraft(undefined, initialRequestActionState, formData({ title: "  ", description: "Keep this" }));
    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(invalid).toMatchObject({
      status: "error",
      fieldErrors: { title: "Enter a request title." },
      focus: "title",
      values: { title: "", description: "Keep this" },
    });
  });

  it("enforces submit requirements, clears false third-party details, and avoids invalid service calls", async () => {
    const invalid = await submitRequest("request-1", initialRequestActionState, formData({ title: "Only title" }));

    expect(invalid).toMatchObject({
      status: "error",
      fieldErrors: {
        description: "Enter a request description.",
        assessmentType: "Choose an assessment type.",
        businessPurpose: "Enter the business purpose.",
        businessCriticality: "Choose the business criticality.",
        thirdPartyInvolvement: "Select whether a third party is involved.",
      },
      focus: "description",
    });
    expect(saveDraftService).not.toHaveBeenCalled();
    expect(submitRequestService).not.toHaveBeenCalled();

    const submitted = await submitRequest(
      "request-1",
      initialRequestActionState,
      formData({ ...validSubmission, thirdPartyInvolvement: "false", thirdPartyDetails: "Must be cleared" }),
    );

    expect(saveDraftService).toHaveBeenCalledWith("jane.doe@idambox.com", "request-1", expect.objectContaining({
      thirdPartyInvolvement: "false",
      thirdPartyDetails: "",
      informationSystems: ["system-1", "system-2"],
      informationAssets: ["asset-1"],
    }));
    expect(submitRequestService).toHaveBeenCalledWith("jane.doe@idambox.com", "request-1");
    expect(submitted).toMatchObject({ status: "success", announcement: "Request submitted.", revalidate: ["/", "/requests", "/requests/request-1"] });
  });

  it("derives the actor only from the trusted server resolver for every mutation", async () => {
    const forged = formData({
      ...validSubmission,
      actorEmail: "bob.doe@idambox.com",
      owner: "bob.doe@idambox.com",
      transition: "approved",
      capability: "function.administration.controls",
    });

    await saveDraft("request-1", initialRequestActionState, forged);
    await submitRequest("request-1", initialRequestActionState, forged);
    await withdrawRequest("request-1");

    expect(resolveCurrentActor).toHaveBeenCalledTimes(3);
    expect(saveDraftService).toHaveBeenCalledWith("jane.doe@idambox.com", "request-1", expect.not.objectContaining({ actorEmail: expect.anything(), owner: expect.anything(), transition: expect.anything(), capability: expect.anything() }));
    expect(submitRequestService).toHaveBeenCalledWith("jane.doe@idambox.com", "request-1");
    expect(withdrawRequestService).toHaveBeenCalledWith("jane.doe@idambox.com", "request-1");
  });

  it("returns only approved safe write failures and preserves entered values", async () => {
    saveDraftService.mockResolvedValue({
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields and try again.", retryable: false, fields: { title: "Title is required", requestor: "not safe" } },
    });

    const result = await saveDraft("request-1", initialRequestActionState, formData({ title: "Entered title", description: "Entered description" }));

    expect(result).toEqual(expect.objectContaining({
      status: "error",
      formError: "Please correct the highlighted fields and try again.",
      fieldErrors: { title: "Title is required" },
      values: expect.objectContaining({ title: "Entered title", description: "Entered description" }),
    }));
    expect(JSON.stringify(result)).not.toContain("not safe");
  });

  it("has a production replacement with no development fixture actor", async () => {
    const production = await import("./resolve-request-actor.production");

    await expect(production.resolveCurrentActor()).resolves.toBeUndefined();
  });
});
