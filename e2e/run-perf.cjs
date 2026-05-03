const { chromium } = require('@playwright/test');

const BASE_URL = 'http://localhost:1420';

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    const result = await fn();
    passed++;
    const extra = result !== undefined ? ` (${result})` : '';
    console.log(`  PASS  ${name}${extra}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message.split('\n')[0] });
    console.log(`  FAIL  ${name}: ${e.message.split('\n')[0]}`);
  }
}

async function main() {
  console.log('\n=== Ralph Performance Tests ===\n');

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

  // ============================================================
  // Group 1: Page Load Performance
  // ============================================================
  console.log('[Page Load Performance]');

  await test('首页加载时间 (domcontentloaded)', async () => {
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const loadTime = Date.now() - start;
    if (loadTime > 3000) throw new Error(`Page load took ${loadTime}ms (limit: 3000ms)`);
    return `${loadTime}ms`;
  });

  await test('页面完全渲染 (load event)', async () => {
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 15000 });
    const loadTime = Date.now() - start;
    if (loadTime > 5000) throw new Error(`Full render took ${loadTime}ms (limit: 5000ms)`);
    return `${loadTime}ms`;
  });

  await test('DOM 交互就绪时间', async () => {
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        domInteractive: Math.round(nav.domInteractive),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        loadComplete: Math.round(nav.loadEventEnd),
      };
    });
    if (metrics.domInteractive > 3000) throw new Error(`DOM interactive: ${metrics.domInteractive}ms`);
    return `DOM:${metrics.domInteractive}ms DCL:${metrics.domContentLoaded}ms Load:${metrics.loadComplete}ms`;
  });

  // ============================================================
  // Group 2: UI Interaction Performance
  // ============================================================
  console.log('\n[UI Interaction Performance]');

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  await test('搜索框聚焦响应 < 100ms', async () => {
    const start = Date.now();
    await page.locator('#search-input').click();
    const responseTime = Date.now() - start;
    if (responseTime > 100) throw new Error(`Focus took ${responseTime}ms`);
    return `${responseTime}ms`;
  });

  await test('输入响应 < 50ms/字符', async () => {
    const input = page.locator('#search-input');
    const text = 'rust logging framework';
    const start = Date.now();
    await input.fill(text);
    const totalTime = Date.now() - start;
    const perChar = totalTime / text.length;
    if (perChar > 50) throw new Error(`Per-char input: ${perChar.toFixed(1)}ms`);
    return `${perChar.toFixed(1)}ms/char`;
  });

  await test('语言切换响应 < 200ms', async () => {
    const langBtn = page.locator('#ralph-lang-btn');
    const start = Date.now();
    await langBtn.click();
    await page.waitForTimeout(100);
    const responseTime = Date.now() - start;
    if (responseTime > 200) throw new Error(`Lang switch took ${responseTime}ms`);
    return `${responseTime}ms`;
  });

  // ============================================================
  // Group 3: Rendering Performance
  // ============================================================
  console.log('\n[Rendering Performance]');

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  await test('Header 渲染时间 < 500ms', async () => {
    const start = Date.now();
    const header = page.locator('header').first();
    await header.waitFor({ state: 'visible', timeout: 2000 });
    const renderTime = Date.now() - start;
    if (renderTime > 500) throw new Error(`Header render took ${renderTime}ms`);
    return `${renderTime}ms`;
  });

  await test('空状态组件渲染时间 < 500ms', async () => {
    const start = Date.now();
    const emptyHint = page.locator('.text-gray-500, .text-gray-400').first();
    await emptyHint.waitFor({ state: 'visible', timeout: 2000 });
    const renderTime = Date.now() - start;
    if (renderTime > 500) throw new Error(`Empty state render took ${renderTime}ms`);
    return `${renderTime}ms`;
  });

  // ============================================================
  // Group 4: Memory
  // ============================================================
  console.log('\n[Memory]');

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);

  await test('页面 JS 堆内存 < 50MB', async () => {
    const metrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        };
      }
      return null;
    });
    if (metrics && metrics.usedJSHeapSize > 50) {
      throw new Error(`JS heap: ${metrics.usedJSHeapSize}MB`);
    }
    return metrics ? `${metrics.usedJSHeapSize}MB used / ${metrics.totalJSHeapSize}MB total` : 'N/A (non-Chromium)';
  });

  // ============================================================
  // Group 5: Responsive Performance
  // ============================================================
  console.log('\n[Responsive Performance]');

  await test('移动端视口渲染 < 4s', async () => {
    const mp = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await mp.addInitScript(() => { localStorage.setItem('ralph-onboarding-seen', '1'); });
    const start = Date.now();
    await mp.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const loadTime = Date.now() - start;
    await mp.close();
    if (loadTime > 4000) throw new Error(`Mobile load took ${loadTime}ms`);
    return `${loadTime}ms`;
  });

  await test('平板视口渲染 < 4s', async () => {
    const tp = await browser.newPage({ viewport: { width: 768, height: 1024 } });
    await tp.addInitScript(() => { localStorage.setItem('ralph-onboarding-seen', '1'); });
    const start = Date.now();
    await tp.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const loadTime = Date.now() - start;
    await tp.close();
    if (loadTime > 4000) throw new Error(`Tablet load took ${loadTime}ms`);
    return `${loadTime}ms`;
  });

  // ============================================================
  // Group 6: Keyboard Shortcut Performance
  // ============================================================
  console.log('\n[Keyboard Shortcut Performance]');

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  await test('快捷键 / 响应 < 200ms', async () => {
    await page.locator('header').click();
    await page.waitForTimeout(100);
    const start = Date.now();
    await page.keyboard.press('/');
    await page.waitForTimeout(50);
    const focused = await page.locator('#search-input').evaluate(el => el === document.activeElement);
    const responseTime = Date.now() - start;
    if (!focused) throw new Error('Search input not focused');
    if (responseTime > 200) throw new Error(`Shortcut response took ${responseTime}ms`);
    return `${responseTime}ms`;
  });

  // ============================================================
  // Summary
  // ============================================================
  await browser.close();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Performance Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
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
