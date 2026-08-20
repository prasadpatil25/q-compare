import { test, expect } from '@playwright/test';

test('QAI weight slider updates and persists', async ({ page }) => {
  await page.goto('/settings');
  const slider = page.getByLabel(/^context \(/);
  await slider.fill('0.5');
  await expect(page.getByLabel(/^context \(0\.5/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/^context \(0\.5/)).toBeVisible();
  await page.getByRole('button', { name: /reset to defaults/i }).click();
  await expect(page.getByLabel(/^context \(0\.25/)).toBeVisible();
});
