import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

async function signInAsSecurityAnalyst(page: Page): Promise<void> {
  await page.goto('/sign-in?returnTo=/app');
  await page.getByRole('button', { name: 'Continue as Security Analyst' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('main')).toBeVisible();
}

for (const viewport of viewports) {
  test(`keeps the authorised shell responsive at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await signInAsSecurityAnalyst(page);

    const mobileTrigger = page.getByRole('button', { name: 'Open navigation' });
    const isMobile = viewport.width < 1024;

    if (isMobile) {
      await expect(mobileTrigger).toBeVisible();
      await mobileTrigger.click();
      await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
    } else {
      await expect(mobileTrigger).toBeHidden();
      await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    }

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('returns keyboard focus to the menu trigger after closing the mobile sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsSecurityAnalyst(page);

  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
