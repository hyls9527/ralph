import { test, expect } from '@playwright/test';

test('minimal test', async ({ page }) => {
  await page.goto('http://localhost:1420', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
});
