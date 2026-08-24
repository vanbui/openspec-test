import { expect, test, type Locator, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const strapiOrigin = "http://127.0.0.1:1338";
const productionOrigin = "http://127.0.0.1:3002";
const internalToken = "idambox-csrm-e2e-internal-token-0123456789abcdef";
const productionOutputPath = fileURLToPath(
  new URL("../.next-e2e-production", import.meta.url),
);

type CreatedRequest = {
  documentId: string;
  requestNumber: string;
  title: string;
};

async function emittedJavaScript(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return emittedJavaScript(entryPath);
    return entry.name.endsWith(".js") ? [entryPath] : [];
  }));

  return files.flat();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true);
}

async function expectConfirmationDialogLayout(page: Page, dialog: Locator) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("The confirmation-dialog assertion requires a fixed viewport.");

  const dialogBox = await dialog.boundingBox();
  if (!dialogBox) throw new Error("The confirmation dialog must have a bounding box.");

  expect(dialogBox.width, "confirmation dialog must not collapse to a narrow column").toBeGreaterThan(300);
  expect(dialogBox.x, "confirmation dialog left gutter").toBeGreaterThanOrEqual(16);
  expect(dialogBox.x + dialogBox.width, "confirmation dialog right gutter").toBeLessThanOrEqual(viewport.width - 16);
  expect(dialogBox.y, "confirmation dialog top viewport bound").toBeGreaterThanOrEqual(16);
  expect(dialogBox.y + dialogBox.height, "confirmation dialog bottom viewport bound").toBeLessThanOrEqual(viewport.height - 16);

  for (const [name, target] of [
    ["confirmation title", dialog.getByRole("heading", { name: "Submit risk assessment request?" })],
    ["confirmation description", dialog.getByText("Once submitted, your request will be available for Security Analyst review. You can withdraw it only until processing begins.")],
  ] as const) {
    const box = await target.boundingBox();
    if (!box) throw new Error(`${name} must have a bounding box.`);
    expect(box.width, `${name} usable content width`).toBeGreaterThanOrEqual(200);
  }

  await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expectNoHorizontalOverflow(page);
}

async function expectVisibleTouchTargets(targets: Locator, description: string) {
  let visibleCount = 0;
  for (const target of await targets.all()) {
    if (!(await target.isVisible())) continue;
    visibleCount += 1;
    const box = await target.boundingBox();
    expect(box, `${description} box`).not.toBeNull();
    expect(box?.width, `${description} width`).toBeGreaterThanOrEqual(44);
    expect(box?.height, `${description} height`).toBeGreaterThanOrEqual(44);
  }
  expect(visibleCount, `${description} must be visible`).toBeGreaterThan(0);
}

async function chooseAnalyst(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Security Analyst — Bob" }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText("Security Analyst — Bob");
}

async function createRequestFor(
  page: Page,
  actorEmail: string,
  title: string,
): Promise<CreatedRequest> {
  const response = await page.request.post(`${strapiOrigin}/api/csrm-assessment-requests`, {
    data: { data: { title } },
    headers: {
      authorization: `Bearer ${internalToken}`,
      "x-idambox-csrm-actor-email": actorEmail,
    },
  });
  expect(response.status()).toBe(201);
  const payload = await response.json() as { data: CreatedRequest };
  return payload.data;
}

async function createSubmittedRequestFor(
  page: Page,
  actorEmail: string,
  title: string,
): Promise<CreatedRequest> {
  const draft = await createRequestFor(page, actorEmail, title);
  const saveResponse = await page.request.put(`${strapiOrigin}/api/csrm-assessment-requests/${draft.documentId}`, {
    data: {
      data: {
        title,
        description: "A persisted request used to verify owner-bound dashboard derivation.",
        assessmentType: "Project",
        businessPurpose: "Verify the Requestor dashboard workflow state.",
        businessCriticality: "High",
        thirdPartyInvolvement: false,
      },
    },
    headers: {
      authorization: `Bearer ${internalToken}`,
      "x-idambox-csrm-actor-email": actorEmail,
    },
  });
  expect(saveResponse.status()).toBe(200);

  const submitResponse = await page.request.post(`${strapiOrigin}/api/csrm-assessment-requests/${draft.documentId}/submit`, {
    data: { data: {} },
    headers: {
      authorization: `Bearer ${internalToken}`,
      "x-idambox-csrm-actor-email": actorEmail,
    },
  });
  expect(submitResponse.status()).toBe(200);
  return draft;
}

test.describe("request workflow", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Jane persists, submits, withdraws, and discovers a request through real Strapi", async ({ page }) => {
    await page.goto("/requests/new");
    await page.getByLabel("Request title").fill("E2E requestor workflow record");
    await page.getByLabel("Request description").fill("A persisted request description for the end-to-end workflow.");
    await page.getByLabel("Assessment type").selectOption("Project");
    await page.getByLabel("Division").fill("Technology");
    await page.getByLabel("Business unit").fill("Platform engineering");
    await page.getByLabel("Business purpose").fill("Verify the complete Requestor workflow against disposable Strapi storage.");
    await page.getByLabel("Business criticality").selectOption("High");
    await page.getByLabel("Yes").check();
    await page.getByLabel("Third-party details").fill("Managed workflow testing provider.");
    await page.getByLabel("Regulatory requirements").fill("APRA CPS 234");
    await page.getByLabel("Requested due date").fill("2026-09-01");

    let selectedSystemName: string | undefined;
    await page.getByRole("button", { name: "Select information systems" }).click();
    const systemOptions = page.getByRole("option");
    if (await systemOptions.count()) {
      selectedSystemName = (await systemOptions.first().textContent())?.trim();
      await systemOptions.first().getByRole("button").click();
    }

    let selectedAssetName: string | undefined;
    await page.getByRole("button", { name: "Select information assets" }).click();
    const assetOptions = page.getByRole("option");
    if (await assetOptions.count()) {
      selectedAssetName = (await assetOptions.first().textContent())?.trim();
      await assetOptions.first().getByRole("button").click();
    }

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/\/requests\/[A-Za-z0-9_-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "E2E requestor workflow record" })).toBeFocused();
    await page.reload();
    await expect(page.getByLabel("Request description")).toHaveValue("A persisted request description for the end-to-end workflow.");
    await expect(page.getByLabel("Assessment type")).toHaveValue("Project");
    await expect(page.getByLabel("Division")).toHaveValue("Technology");
    await expect(page.getByLabel("Business unit")).toHaveValue("Platform engineering");
    await expect(page.getByLabel("Business purpose")).toHaveValue("Verify the complete Requestor workflow against disposable Strapi storage.");
    await expect(page.getByLabel("Business criticality")).toHaveValue("High");
    await expect(page.getByLabel("Yes")).toBeChecked();
    await expect(page.getByLabel("Third-party details")).toHaveValue("Managed workflow testing provider.");
    await expect(page.getByLabel("Regulatory requirements")).toHaveValue("APRA CPS 234");
    await expect(page.getByLabel("Requested due date")).toHaveValue("2026-09-01");
    if (selectedSystemName) await expect(page.getByRole("button", { name: `Remove ${selectedSystemName}` })).toBeVisible();
    if (selectedAssetName) await expect(page.getByRole("button", { name: `Remove ${selectedAssetName}` })).toBeVisible();

    await page.getByRole("button", { name: "Submit request" }).click();
    const submitDialog = page.getByRole("dialog");
    await expect(submitDialog).toBeVisible();
    await expectConfirmationDialogLayout(page, submitDialog);
    await expect(submitDialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
    await submitDialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(submitDialog).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(submitDialog).toBeVisible();
    await expectConfirmationDialogLayout(page, submitDialog);
    await expect(submitDialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(submitDialog.getByRole("button", { name: "Submit request" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Request submitted." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw submission" })).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole("button", { name: "Withdraw submission" }).click();
    const withdrawDialog = page.getByRole("dialog");
    await expect(withdrawDialog.getByRole("button", { name: "Keep submission" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(withdrawDialog.getByRole("button", { name: "Withdraw submission" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Request returned to draft." })).toBeVisible();

    await page.getByRole("link", { name: "Risk Assessment Requests" }).click();
    await expect(page.getByRole("heading", { name: "My Requests" })).toBeVisible();
    await expect(page.getByText("E2E requestor workflow record", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("table", { name: "My risk assessment requests" })).toBeVisible();
    await expect(page).toHaveScreenshot("request-dashboard-desktop-1440.png", {
      fullPage: true,
      mask: [page.getByText(/^CRA-\d{4}-[A-F0-9]+$/)],
    });
  });

  test("Bob can save Jane's draft while Jane receives a metadata-safe denial for Bob's record", async ({ page }) => {
    const janeDraft = await createRequestFor(page, "jane.doe@idambox.com", "Jane analyst collaboration draft");
    const bobDraft = await createRequestFor(page, "bob.doe@idambox.com", "Bob ownership denial record");

    await page.goto(`/requests/${janeDraft.documentId}`);
    await chooseAnalyst(page);
    await page.goto(`/requests/${janeDraft.documentId}`);
    await expect(page.getByText("You are editing a Requestor draft. The Requestor must review and submit it.")).toBeVisible();
    await page.getByLabel("Request title").fill("Analyst enriched real-stack draft");
    await page.getByRole("button", { name: "Save draft changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draft saved." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit request" })).toHaveCount(0);

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Requestor — Jane" }).click();
    await expect(page.getByRole("button", { name: "Account menu" })).toContainText("Requestor — Jane");
    await page.goto(`/requests/${bobDraft.documentId}`);
    await expect(page.getByRole("heading", { name: "You don’t have access to this area" })).toBeVisible();
    await expect(page.getByText(bobDraft.title)).toHaveCount(0);
    await expect(page.getByText(bobDraft.requestNumber)).toHaveCount(0);
    const response = await page.request.get(`${strapiOrigin}/api/csrm-assessment-requests/${bobDraft.documentId}`, {
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-idambox-csrm-actor-email": "jane.doe@idambox.com",
      },
    });
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain(bobDraft.title);
  });

  test("derives Jane's dashboard widgets and notices from owned persisted workflow state", async ({ page }) => {
    const janeDraft = await createRequestFor(page, "jane.doe@idambox.com", "Jane dashboard draft needing action");
    const janeSubmitted = await createSubmittedRequestFor(page, "jane.doe@idambox.com", "Jane dashboard recent submission");
    const bobDraft = await createRequestFor(page, "bob.doe@idambox.com", "Bob private dashboard draft");

    const response = await page.request.get(`${strapiOrigin}/api/csrm-assessment-requests/dashboard`, {
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-idambox-csrm-actor-email": "jane.doe@idambox.com",
      },
    });
    expect(response.status()).toBe(200);
    const dashboard = await response.json() as {
      data: {
        needsAttention: CreatedRequest[];
        recentSubmissions: CreatedRequest[];
        notices: { documentId: string; message: string }[];
      };
    };

    expect(dashboard.data.needsAttention.map((request) => request.documentId)).toContain(janeDraft.documentId);
    expect(dashboard.data.needsAttention.map((request) => request.documentId)).not.toContain(janeSubmitted.documentId);
    expect(dashboard.data.needsAttention.map((request) => request.documentId)).not.toContain(bobDraft.documentId);
    expect(dashboard.data.recentSubmissions.map((request) => request.documentId)).toContain(janeSubmitted.documentId);
    expect(dashboard.data.recentSubmissions.map((request) => request.documentId)).not.toContain(janeDraft.documentId);
    expect(dashboard.data.recentSubmissions.map((request) => request.documentId)).not.toContain(bobDraft.documentId);
    expect(dashboard.data.notices).toEqual(expect.arrayContaining([
      { documentId: janeDraft.documentId, message: 'Complete "Jane dashboard draft needing action" before submitting.' },
      { documentId: janeSubmitted.documentId, message: '"Jane dashboard recent submission" was submitted and is awaiting Security Analyst review.' },
    ]));

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Jane dashboard draft needing action CRA-/ })).toBeVisible();
    await expect(page.getByText('Complete "Jane dashboard draft needing action" before submitting.')).toBeVisible();
    await expect(page.getByText('"Jane dashboard recent submission" was submitted and is awaiting Security Analyst review.')).toBeVisible();
  });

  test("keeps request controls accessible, URL-driven, responsive, and overflow-free", async ({ page }) => {
    const created = await createRequestFor(page, "jane.doe@idambox.com", "Long request title that verifies the requestor view remains legible at every required viewport without horizontal overflow");
    await page.goto("/requests");
    await page.getByLabel("Search requests").fill("Long request");
    await expect(page).toHaveURL(/q=Long\+request/);
    await page.getByLabel("Status").selectOption("draft");
    await expect(page).toHaveURL(/status=draft/);
    await page.getByLabel("Sort requests").selectOption("title-asc");
    await expect(page).toHaveURL(/sort=title-asc/);
    await expect(page.getByRole("link", { name: `View request ${created.requestNumber}` })).toBeVisible();

    for (const [width, height] of [[375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/requests");
      await expectNoHorizontalOverflow(page);
      if (width < 768) {
        await expect(page.getByRole("list", { name: "My risk assessment requests" })).toBeVisible();
        await expectVisibleTouchTargets(page.getByRole("link", { name: "View request", exact: true }), "mobile request link");
      } else {
        await expect(page.getByRole("table", { name: "My risk assessment requests" })).toBeVisible();
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/requests/new");
    await page.getByLabel("Request title").fill("Mobile progressive form evidence");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("alert", { name: "Check the highlighted fields" })).toBeFocused();
    await expect(page).toHaveScreenshot("request-form-mobile-390.png", { fullPage: true });
  });
});

test.describe("request production boundary", () => {
  test("excludes fixtures and test records from emitted assets and production HTTP behavior", async ({ page }) => {
    const output = (await Promise.all(
      (await emittedJavaScript(productionOutputPath)).map((filePath) => readFile(filePath, "utf8")),
    )).join("\n");
    for (const excludedValue of [
      "Development identity",
      "Requestor — Jane",
      "Security Analyst — Bob",
      "fixture:jane.doe@idambox.com",
      "fixture:bob.doe@idambox.com",
      internalToken,
      "E2E requestor workflow record",
      "request-workflow.spec",
    ]) {
      expect(output, `production output must exclude ${excludedValue}`).not.toContain(excludedValue);
    }

    await page.goto(productionOrigin);
    await expect(page.getByText("Development identity")).toHaveCount(0);
    for (const pathname of ["/test-evidence/analyst-only", "/test-evidence/states"]) {
      const response = await page.request.get(`${productionOrigin}${pathname}`);
      expect(response.status(), `production ${pathname}`).toBe(404);
    }
  });
});
