---
name: ralph-playwright-test-e2e
description: Execute end-to-end tests using Playwright. Use when running E2E test suites, writing new E2E tests, debugging failing E2E tests, or setting up Playwright test infrastructure.
---
# E2E Test Execution with Playwright

End-to-end testing framework using Playwright for web applications.

## When to Use

- Running E2E test suites
- Writing new E2E tests
- Debugging failing E2E tests
- Setting up Playwright test infrastructure
- Cross-browser testing

## Setup

### Install

```bash
npm init playwright@latest
# or
npm install -D @playwright/test
npx playwright install
```

### Configuration (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Writing Tests

### Basic Page Test

```typescript
import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/My App/);
  await expect(page.locator('h1')).toBeVisible();
});
```

### Interaction Test

```typescript
test('user can submit form', async ({ page }) => {
  await page.goto('/contact');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="message"]', 'Hello!');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success')).toBeVisible();
});
```

### API Test

```typescript
test('API returns data', async ({ request }) => {
  const response = await request.get('/api/items');
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.length).toBeGreaterThan(0);
});
```

## Running Tests

```bash
# Run all tests
npx playwright test

# Run specific file
npx playwright test e2e/app.spec.ts

# Run in headed mode (visible browser)
npx playwright test --headed

# Run specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug

# Generate trace on failure
npx playwright test --trace on-first-retry

# View report
npx playwright show-report
```

## Best Practices

1. Use `data-testid` for stable selectors
2. Use page object models for complex flows
3. Test user behavior, not implementation
4. Keep tests independent and idempotent
5. Use `test.describe` for grouping
6. Use `test.beforeEach` for setup
