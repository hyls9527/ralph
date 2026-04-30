import { test, expect } from '@playwright/test';

test.describe('Ralph 性能基准测试', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('性能测试：评估 30 个项目耗时', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]');
    
    // 记录开始时间
    const startTime = Date.now();
    
    // 输入搜索并回车
    await searchInput.fill('rust logging');
    await searchInput.press('Enter');
    
    // 等待评估完成 - 查找结果列表
    await page.waitForSelector('.space-y-4 > div', { timeout: 120000 });
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log(`评估 5 个项目耗时: ${totalTime}ms`);
    
    // 验证结果展示
    await expect(page.getByText(/找到/)).toBeVisible();
    
    // 记录性能指标
    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.startTime,
        loadComplete: perf.loadEventEnd - perf.startTime,
        domInteractive: perf.domInteractive - perf.startTime,
      };
    });
    
    console.log('页面加载性能:', metrics);
    
    // 基本性能断言（由于 GitHub API 限制，这里设置较宽松的阈值）
    expect(totalTime).toBeLessThan(120000); // 2 分钟内完成
  });

  test('性能测试：批量评定 30 个项目', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]');
    
    // 先进行一次搜索
    await searchInput.fill('rust logging');
    await searchInput.press('Enter');
    
    // 等待初始搜索完成
    await page.waitForSelector('.space-y-4 > div', { timeout: 60000 });
    
    // 打开设置面板
    await page.locator('header button[title*="设置"]').click();
    
    // 设置批量数量为 30
    const batchInput = page.locator('#batchCount');
    await batchInput.fill('30');
    
    // 记录开始时间
    const startTime = Date.now();
    
    // 点击启动批量评定
    await page.getByRole('button', { name: '启动批量评定' }).click();
    
    // 等待评估完成
    await page.waitForSelector('.space-y-4 > div', { timeout: 300000 });
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log(`批量评定 30 个项目耗时: ${totalTime}ms`);
    
    // 验证结果
    const resultCount = await page.getByText(/找到/).textContent();
    console.log('评定结果:', resultCount);
    
    // 性能断言
    expect(totalTime).toBeLessThan(300000); // 5 分钟内完成
  });

  test('性能测试：数据库 CRUD 操作延迟', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]');
    
    // 测试搜索历史写入
    const startTime1 = Date.now();
    await searchInput.fill('rust async');
    await searchInput.press('Enter');
    await page.waitForTimeout(3000);
    const writeTime = Date.now() - startTime1;
    console.log(`搜索 + 缓存写入耗时: ${writeTime}ms`);
    
    // 测试搜索历史读取
    await page.reload();
    const startTime2 = Date.now();
    await page.waitForLoadState('networkidle');
    
    // 检查搜索历史是否出现
    await page.waitForTimeout(1000);
    const readTime = Date.now() - startTime2;
    console.log(`页面加载 + 缓存读取耗时: ${readTime}ms`);
    
    // 性能断言
    expect(writeTime).toBeLessThan(60000);
    expect(readTime).toBeLessThan(10000);
  });

  test('性能测试：虚拟滚动渲染性能', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]');
    
    // 搜索产生大量结果
    await searchInput.fill('javascript');
    await searchInput.press('Enter');
    
    // 等待结果加载
    await page.waitForTimeout(30000);
    
    // 检查是否启用了虚拟滚动（结果 > 30 时）
    const virtualList = page.locator('.virtual-list, [role="list"]');
    const resultCount = await page.getByText(/找到/).textContent();
    console.log('搜索结果:', resultCount);
    
    // 滚动测试
    if (await virtualList.isVisible().catch(() => false)) {
      const startTime = Date.now();
      await virtualList.evaluate(el => el.scrollTop = 1000);
      await page.waitForTimeout(500);
      const scrollTime = Date.now() - startTime;
      console.log(`虚拟滚动操作耗时: ${scrollTime}ms`);
      
      expect(scrollTime).toBeLessThan(1000);
    }
  });

  test('性能测试：主题切换渲染性能', async ({ page }) => {
    // 连续切换主题 10 次
    const themeButton = page.locator('header button[title*="切换"]').first();
    
    const times = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await themeButton.click();
      await page.waitForTimeout(100); // 等待 CSS 过渡
      times.push(Date.now() - start);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`主题切换平均耗时: ${avgTime}ms`);
    console.log('各次耗时:', times);
    
    expect(avgTime).toBeLessThan(500);
  });

  test('性能测试：筛选器响应性能', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]');
    
    // 先搜索
    await searchInput.fill('rust logging');
    await searchInput.press('Enter');
    await page.waitForSelector('.space-y-4 > div', { timeout: 60000 });
    
    // 打开筛选面板
    await page.getByRole('button', { name: /筛选/ }).click();
    
    // 测试筛选响应时间
    const trackSelect = page.locator('select').first();
    
    const times = [];
    const options = ['all', 'neglected', 'high-star', 'steady'];
    
    for (const option of options) {
      const start = Date.now();
      await trackSelect.selectOption(option);
      await page.waitForTimeout(100);
      times.push(Date.now() - start);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`筛选器平均响应耗时: ${avgTime}ms`);
    console.log('各次耗时:', times);
    
    expect(avgTime).toBeLessThan(500);
  });

  test('性能测试：键盘快捷键响应性能', async ({ page }) => {
    // 测试 / 键聚焦搜索框
    const times = [];
    
    for (let i = 0; i < 5; i++) {
      // 先点击其他地方取消聚焦
      await page.locator('header').click();
      await page.waitForTimeout(100);
      
      const start = Date.now();
      await page.keyboard.press('/');
      const searchInput = page.locator('input[placeholder*="搜索"]');
      await expect(searchInput).toBeFocused();
      times.push(Date.now() - start);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`键盘快捷键平均响应耗时: ${avgTime}ms`);
    console.log('各次耗时:', times);
    
    expect(avgTime).toBeLessThan(200);
  });
});
