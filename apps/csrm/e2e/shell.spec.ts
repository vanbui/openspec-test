import { expect, test, type Locator, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const localOrigin = "http://127.0.0.1:3001";
const productionOrigin = "http://127.0.0.1:3002";
const productionOutputPath = fileURLToPath(
  new URL("../.next-e2e-production", import.meta.url),
);

async function emittedJavaScript(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return emittedJavaScript(entryPath);
    return entry.name.endsWith(".js") ? [entryPath] : [];
  }));

  return files.flat();
}

async function blockExternalNetwork(page: Page) {
  const externalRequests: string[] = [];

  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== localOrigin) {
      externalRequests.push(requestUrl.href);
      await route.abort();
      return;
    }

    await route.continue();
  });

  return () => expect(externalRequests, "external browser requests").toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

async function expectVisibleTouchTargets(locator: Locator, description: string) {
  let visibleCount = 0;

  for (const target of await locator.all()) {
    if (!(await target.isVisible())) continue;

    visibleCount += 1;
    const box = await target.boundingBox();
    expect(box, `${description} bounding box`).not.toBeNull();
    expect(box?.width, `${description} width`).toBeGreaterThanOrEqual(44);
    expect(box?.height, `${description} height`).toBeGreaterThanOrEqual(44);
  }

  expect(visibleCount, `visible ${description} count`).toBeGreaterThan(0);
}

async function expectDrawerTouchTargets(dialog: Locator) {
  await expectVisibleTouchTargets(dialog.getByRole("navigation").getByRole("link"), "drawer navigation link");
  await expectVisibleTouchTargets(dialog.getByRole("button", { name: "Close" }), "drawer close control");
}

async function chooseAnalyst(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Security Analyst — Bob" }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText("Security Analyst — Bob");
}

test.describe("Requestor desktop foundation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keeps the approved desktop shell local, filtered, and visually stable", async ({ page }) => {
    const assertLocalNetwork = await blockExternalNetwork(page);

    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Cyber Risk Manager" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "CSRM navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu" })).toContainText("Requestor — Jane");
    expect(
      await page
        .getByText("Your cyber risk management workspace is ready.")
        .evaluate((element) => element.getBoundingClientRect().width),
    ).toBeGreaterThanOrEqual(320);
    await expect(page.getByText("My Requests")).toHaveCount(0);
    await expect(page.getByText("Risk Register", { exact: true })).toHaveCount(0);
    await expect(page).toHaveScreenshot("shell-requestor-desktop.png", { fullPage: true });
    await assertLocalNetwork();
  });
});

test.describe("Requestor mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("traps, dismisses, restores focus, selects routes, and preserves geometry", async ({ page }) => {
    const assertLocalNetwork = await blockExternalNetwork(page);

    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Open navigation" });
    for (const control of [trigger, page.getByRole("button", { name: "Account menu" })]) {
      const box = await control.boundingBox();
      expect(box, "visible touch target").not.toBeNull();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "CSRM navigation" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("navigation", { name: "CSRM navigation" })).toBeVisible();
    await expectDrawerTouchTargets(dialog);
    await page.keyboard.press("Tab");
    await expect(dialog).toContainText("Dashboard");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByRole("link", { name: "Dashboard" }).click();
    await expect(dialog).toBeHidden();
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot("shell-requestor-mobile.png", { fullPage: true });
    await assertLocalNetwork();
  });
});

test.describe("remaining viewport matrix", () => {
  test("keeps small mobile, tablet, analyst desktop, and collapsed desktop evidence operable", async ({ page }) => {
    const assertLocalNetwork = await blockExternalNetwork(page);

    for (const [width, height, screenshot] of [
      [375, 812, "shell-small-mobile.png"],
      [430, 932, "shell-mobile-430.png"],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
      if (width === 375) {
        await page.getByRole("button", { name: "Open navigation" }).click();
        const dialog = page.getByRole("dialog", { name: "CSRM navigation" });
        await expect(dialog).toBeVisible();
        await expectDrawerTouchTargets(dialog);
        await dialog.getByRole("button", { name: "Close" }).click();
        await expect(dialog).toBeHidden();
      }
      await expectNoHorizontalOverflow(page);
      await expect(page).toHaveScreenshot(screenshot, { fullPage: true });
    }

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await expect(page.locator("aside")).toBeHidden();
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot("shell-tablet.png", { fullPage: true });

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");
    await chooseAnalyst(page);
    await expect(page.locator("aside")).toBeVisible();
    await expect(page).toHaveScreenshot("shell-analyst-desktop.png", { fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Collapse navigation" }).click();
    await page.getByRole("link", { name: "Dashboard" }).hover();
    await expect(page.getByRole("tooltip")).toContainText("Dashboard");
    await expect(page).toHaveScreenshot("shell-sidebar-collapsed.png", { fullPage: true });
    await assertLocalNetwork();
  });
});

test.describe("access and state matrix", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("moves focus to the rendered home title after identity navigation settles", async ({ page }) => {
    await page.goto("/test-evidence/states");
    await expect(page.getByRole("heading", { name: /State evidence/ })).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Security Analyst — Bob" }).click();

    await expect(page).toHaveURL(/\/$/);
    const homeTitle = page.getByRole("heading", { level: 1, name: "Cyber Risk Manager" });
    await expect(homeTitle).toBeVisible();
    await expect(homeTitle).toBeFocused();
  });

  test("keeps access states, retry, long copy, and reduced motion local and safe", async ({ page }) => {
    const assertLocalNetwork = await blockExternalNetwork(page);

    await page.goto("/test-evidence/analyst-only");
    await expect(page.getByRole("heading", { name: "You don’t have access to this area" })).toBeVisible();
    await expect(page.getByText("Authorization evidence")).toHaveCount(0);
    await chooseAnalyst(page);
    await page.goto("/test-evidence/analyst-only");
    await expect(page.getByRole("heading", { name: "Authorization evidence" })).toBeVisible();
    await page.goto("/requests");
    await expect(page.getByRole("heading", { name: "This area isn’t available yet" })).toBeVisible();
    await page.goto("/not-a-planned-route");
    await expect(page.getByRole("heading", { name: "This area isn’t available yet" })).toBeVisible();
    await page.goto("/test-evidence/states");
    await expect(page.getByRole("heading", { name: /State evidence/ })).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading page" })).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Retry requested")).toBeVisible();
    await expect(page.getByText("Not provided")).toBeVisible();
    await expect(page.getByRole("list")).toContainText("One item");
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot("shell-states.png", { fullPage: true });
    await assertLocalNetwork();
  });
});

test.describe("production fixture exclusion", () => {
  test("ships neither fixture data nor test-evidence routes", async ({ page }) => {
    await page.goto(productionOrigin);
    const output = (await Promise.all(
      (await emittedJavaScript(productionOutputPath)).map((filePath) => readFile(filePath, "utf8")),
    )).join("\n");
    for (const fixtureOnlyValue of [
      "Development identity",
      "Requestor — Jane",
      "Security Analyst — Bob",
      "fixture:jane.doe@idambox.com",
      "fixture:bob.doe@idambox.com",
      "idambox-csrm-development-identity",
      "function.administration.controls",
      "function.reports.alerts",
    ]) {
      expect(output).not.toContain(fixtureOnlyValue);
    }
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByText("Development identity")).toHaveCount(0);
    for (const testOnlyPath of ["/test-evidence/analyst-only", "/test-evidence/states"]) {
      const evidenceResponse = await page.request.get(`${productionOrigin}${testOnlyPath}`);
      expect(evidenceResponse.status()).toBe(404);
    }
  });
});
