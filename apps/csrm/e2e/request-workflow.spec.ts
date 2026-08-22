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

test.describe("request workflow", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Jane persists, submits, withdraws, and discovers a request through real Strapi", async ({ page }) => {
    await page.goto("/requests/new");
    await page.getByLabel("Request title").fill("E2E requestor workflow record");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/\/requests\/[A-Za-z0-9_-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "E2E requestor workflow record" })).toBeFocused();

    await page.getByLabel("Request description").fill("A persisted request description for the end-to-end workflow.");
    await page.getByLabel("Assessment type").selectOption("Project");
    await page.getByLabel("Business purpose").fill("Verify the complete Requestor workflow against disposable Strapi storage.");
    await page.getByLabel("Business criticality").selectOption("High");
    await page.getByLabel("No").check();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draft saved." })).toBeVisible();

    await page.getByRole("button", { name: "Submit request" }).click();
    const submitDialog = page.getByRole("dialog");
    await expect(submitDialog).toBeVisible();
    await expect(submitDialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(submitDialog.getByRole("button", { name: "Submit request" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Request submitted." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw submission" })).toBeVisible();

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
