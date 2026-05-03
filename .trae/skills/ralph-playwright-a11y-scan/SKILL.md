---
name: ralph-playwright-a11y-scan
description: Run WCAG accessibility audits using Playwright and axe-core. Use when checking for accessibility violations, auditing pages against WCAG 2.1 AA, generating a11y reports, or fixing accessibility issues.
---
# WCAG Accessibility Audit with Playwright

Automated accessibility scanning using Playwright + axe-core against WCAG 2.1 AA standards.

## When to Use

- Auditing pages for WCAG compliance
- Checking for accessibility violations before release
- Generating accessibility reports
- Fixing a11y issues found in code review

## Setup

### Install Dependencies

```bash
npm install -D @playwright/test axe-core playwright
```

### Configure Playwright

Ensure `playwright.config.ts` includes:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
});
```

## Running Audits

### Quick Scan (Single Page)

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('accessibility scan - homepage', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### Full Site Scan (Multiple Pages)

```typescript
const pages = ['/', '/about', '/contact', '/dashboard'];

for (const path of pages) {
  test(`a11y scan - ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
```

### Scan Specific Component

```typescript
test('modal accessibility', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="open-modal"]');
  const results = await new AxeBuilder({ page })
    .include('[data-testid="modal"]')
    .analyze();
  expect(results.violations).toEqual([]);
});
```

## Common Violations & Fixes

| Violation | Fix |
|-----------|-----|
| `color-contrast` | Ensure 4.5:1 ratio for text |
| `image-alt` | Add alt text to `<img>` |
| `label` | Associate `<label>` with form inputs |
| `button-name` | Add text or aria-label to buttons |
| `link-name` | Add text or aria-label to links |
| `list` | Use `<ul>/<ol>` with `<li>` children |
| `document-title` | Add `<title>` to pages |
| `html-has-lang` | Add `lang` attribute to `<html>` |

## Generate Report

```bash
npx playwright test --reporter=html
```

## CLI Commands

```bash
# Run all a11y tests
npx playwright test --grep "a11y"

# Run specific page scan
npx playwright test e2e/a11y.spec.ts

# Generate JSON report
npx playwright test --reporter=json > a11y-report.json
```
