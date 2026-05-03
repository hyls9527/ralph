const { chromium } = require('@playwright/test');

const BASE_URL = 'http://localhost:1420';

async function main() {
  console.log('\n=== Ralph E2E Debug ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on('close', () => console.log('[PAGE CLOSED EVENT]'));
  page.on('crash', () => console.log('[PAGE CRASHED EVENT]'));
  page.on('pageerror', (err) => console.log('[PAGE ERROR]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[CONSOLE ERROR]', msg.text());
  });

  await page.addInitScript(() => {
    localStorage.setItem('ralph-onboarding-seen', '1');
  });

  console.log('1. Navigating to', BASE_URL);
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('2. Page loaded, URL:', page.url());
    console.log('3. Page isClosed:', page.isClosed());
  } catch (e) {
    console.log('2. Goto failed:', e.message);
    console.log('3. Page isClosed:', page.isClosed());
  }

  if (!page.isClosed()) {
    console.log('4. Taking screenshot...');
    await page.screenshot({ path: 'e2e/debug-screenshot.png' });
    console.log('5. Screenshot saved');

    console.log('6. Getting page title...');
    const title = await page.title();
    console.log('7. Title:', title);

    console.log('8. Getting HTML...');
    const html = await page.content();
    console.log('9. HTML length:', html.length);
    console.log('10. First 500 chars:', html.substring(0, 500));
  }

  await browser.close();
  console.log('\nDone!');
  process.exit(0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
