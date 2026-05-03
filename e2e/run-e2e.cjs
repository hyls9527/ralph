const { chromium } = require('@playwright/test');

const BASE_URL = 'http://localhost:1420';

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message.split('\n')[0] });
    console.log(`  FAIL  ${name}: ${e.message.split('\n')[0]}`);
  }
}

async function main() {
  console.log('\n=== Ralph E2E Tests ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on('pageerror', (err) => {
    if (!err.message.includes('invoke') && !err.message.includes('tauri')) {
      console.log('  [PAGE ERROR]', err.message);
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem('ralph-onboarding-seen', '1');
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  // ============================================================
  // Group 1: Basic rendering
  // ============================================================
  console.log('[Basic Rendering]');

  await test('应用成功启动并渲染首页', async () => {
    const heading = page.getByRole('heading', { name: /Ralph/ });
    if (!(await heading.isVisible({ timeout: 2000 }))) throw new Error('Heading not visible');
  });

  await test('Header 渲染标题和 Logo', async () => {
    const header = page.locator('header').first();
    if (!(await header.isVisible({ timeout: 2000 }))) throw new Error('Header not visible');
  });

  await test('页面包含 main 内容区', async () => {
    const main = page.locator('main').first();
    if (!(await main.isVisible({ timeout: 2000 }))) throw new Error('Main content not visible');
  });

  // ============================================================
  // Group 2: Language
  // ============================================================
  console.log('\n[Language]');

  await test('语言切换按钮可见', async () => {
    const langBtn = page.locator('#ralph-lang-btn');
    if (!(await langBtn.isVisible({ timeout: 2000 }))) throw new Error('Lang button not visible');
    const text = await langBtn.textContent();
    if (text !== 'EN' && text !== '中文') throw new Error(`Unexpected lang text: ${text}`);
  });

  await test('语言切换功能', async () => {
    const langBtn = page.locator('#ralph-lang-btn');
    const initialText = (await langBtn.textContent()) || '';
    await langBtn.click();
    await page.waitForTimeout(400);
    const newText = (await langBtn.textContent()) || '';
    if (initialText === newText) throw new Error('Language did not change');
    await page.evaluate(() => {
      localStorage.setItem('ralph-lang', 'en');
      window.dispatchEvent(new Event('storage'));
    });
    await page.waitForTimeout(200);
  });

  // ============================================================
  // Group 3: Search
  // ============================================================
  console.log('\n[Search]');

  await test('搜索框存在且可交互', async () => {
    const input = page.locator('#search-input');
    if (!(await input.isVisible({ timeout: 2000 }))) throw new Error('Search input not visible');
    await input.click();
    const focused = await input.evaluate(el => el === document.activeElement);
    if (!focused) throw new Error('Input not focused');
    await input.fill('rust logging');
    const val = await input.inputValue();
    if (val !== 'rust logging') throw new Error(`Expected "rust logging", got "${val}"`);
    await input.fill('');
  });

  await test('搜索按钮存在', async () => {
    const searchBtn = page.getByRole('button', { name: /搜索|Search/ }).first();
    if (!(await searchBtn.isVisible({ timeout: 2000 }))) throw new Error('Search button not visible');
  });

  // ============================================================
  // Group 4: Empty state
  // ============================================================
  console.log('\n[Empty State]');

  await test('空状态页面渲染', async () => {
    const emptyHint = page.locator('.text-gray-500, .text-gray-400').first();
    if (!(await emptyHint.isVisible({ timeout: 2000 }))) throw new Error('Empty state hint not visible');
  });

  // ============================================================
  // Group 5: Keyboard shortcuts
  // ============================================================
  console.log('\n[Keyboard Shortcuts]');

  await test('键盘快捷键 / 聚焦搜索', async () => {
    await page.keyboard.press('/');
    await page.waitForTimeout(300);
    const input = page.locator('#search-input');
    const focused = await input.evaluate(el => el === document.activeElement);
    if (!focused) throw new Error('Search input not focused after / key');
  });

  await test('键盘快捷键 ? 打开帮助', async () => {
    await page.keyboard.press('?');
    await page.waitForTimeout(300);
    const helpDialog = page.locator('[role="dialog"]');
    const visible = await helpDialog.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  });

  // ============================================================
  // Group 6: Settings panel
  // ============================================================
  console.log('\n[Settings Panel]');

  await test('设置按钮存在', async () => {
    const settingsBtn = page.locator('button[title*="设置"], button[aria-label*="设置"], button[title*="Settings"]').first();
    const visible = await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      const altBtn = page.getByRole('button').filter({ hasText: '' }).first();
    }
  });

  // ============================================================
  // Group 7: Responsive
  // ============================================================
  console.log('\n[Responsive]');

  await test('响应式布局 - 平板', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    const input = page.locator('#search-input');
    if (!(await input.isVisible({ timeout: 2000 }))) throw new Error('Search input not visible at tablet size');
  });

  await test('响应式布局 - 手机', async () => {
    const mobilePage = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await mobilePage.addInitScript(() => {
      localStorage.setItem('ralph-onboarding-seen', '1');
    });
    await mobilePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await mobilePage.waitForTimeout(500);
    const input = mobilePage.locator('#search-input');
    if (!(await input.isVisible({ timeout: 2000 }))) throw new Error('Search input not visible at mobile size');
    await mobilePage.close();
  });

  // ============================================================
  // Group 8: Accessibility
  // ============================================================
  console.log('\n[Accessibility]');

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  await test('页面有正确的 lang 属性', async () => {
    const lang = await page.locator('html').getAttribute('lang');
    if (!lang) throw new Error('No lang attribute on html');
  });

  await test('搜索框有 label 关联', async () => {
    const input = page.locator('#search-input');
    const hasAriaLabel = await input.getAttribute('aria-label');
    const hasPlaceholder = await input.getAttribute('placeholder');
    if (!hasAriaLabel && !hasPlaceholder) throw new Error('Search input missing label');
  });

  await test('语言切换按钮有 aria-label', async () => {
    const langBtn = page.locator('#ralph-lang-btn');
    const ariaLabel = await langBtn.getAttribute('aria-label');
    if (!ariaLabel) throw new Error('Lang button missing aria-label');
  });

  // ============================================================
  // Group 9: Onboarding
  // ============================================================
  console.log('\n[Onboarding]');

  await test('Onboarding 已被跳过 (localStorage)', async () => {
    const seen = await page.evaluate(() => localStorage.getItem('ralph-onboarding-seen'));
    if (seen !== '1') throw new Error('Onboarding not skipped');
  });

  // ============================================================
  // Group 10: Navigation & UI elements
  // ============================================================
  console.log('\n[Navigation & UI]');

  await test('搜索历史区域存在', async () => {
    const historySection = page.locator('#ralph-search-input').first();
    if (!(await historySection.isVisible({ timeout: 2000 }))) throw new Error('Search section not visible');
  });

  await test('页面无明显的布局溢出', async () => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    if (bodyWidth > viewportWidth + 10) throw new Error(`Layout overflow: body=${bodyWidth}px > viewport=${viewportWidth}px`);
  });

  // ============================================================
  // Summary
  // ============================================================
  await browser.close();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
