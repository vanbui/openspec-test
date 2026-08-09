import { expect, test, type Page } from "@playwright/test";

const localOrigin = "http://127.0.0.1:3001";

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

async function chooseAnalyst(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Security Analyst — Bob" }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText("Bob Doe");
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
