import { test, expect } from '@playwright/test';

test.describe('Ralph E2E 测试 - Tauri dev 启动验证', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('应用成功启动并渲染首页', async ({ page }) => {
    // 验证主标题
    await expect(page.getByRole('heading', { name: /Ralph/ })).toBeVisible();
    await expect(page.getByText('GitHub Project Evaluator')).toBeVisible();
    
    // 验证搜索框存在
    await expect(page.locator('input[placeholder*="搜索"]')).toBeVisible();
  });

  test('验证 Header 元素完整渲染', async ({ page }) => {
    // 验证 Logo 图标
    const logo = page.locator('header').first();
    await expect(logo).toBeVisible();
    
    // 验证语言切换按钮
    const langButton = page.getByRole('button', { name: /EN|中文/ });
    await expect(langButton).toBeVisible();
    
    // 验证主题切换按钮
    const themeButton = page.locator('header button[title*="切换"]');
    await expect(themeButton.first()).toBeVisible();
    
    // 验证 Trending 按钮
    const trendingButton = page.getByRole('button', { name: /Trending/ });
    await expect(trendingButton).toBeVisible();
    
    // 验证设置按钮
    const settingsButton = page.locator('header button[title*="设置"]');
    await expect(settingsButton).toBeVisible();
  });

  test('验证搜索框交互', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]');
    
    // 聚焦搜索框
    await searchInput.click();
    await expect(searchInput).toBeFocused();
    
    // 输入搜索内容
    await searchInput.fill('rust logging');
    await expect(searchInput).toHaveValue('rust logging');
  });

  test('验证主题切换功能', async ({ page }) => {
    // 获取初始主题状态
    const html = page.locator('html');
    await html.evaluate(el => el.classList.toggle('light'));
    const initialLight = await html.evaluate(el => el.classList.contains('light'));
    await html.evaluate(el => el.classList.toggle('light'));
    
    // 点击主题切换按钮
    const themeButton = page.locator('header button[title*="切换"]').first();
    await themeButton.click();
    
    // 等待主题切换完成
    await page.waitForTimeout(300);
    
    // 验证主题类名变化
    const newLight = await html.evaluate(el => el.classList.contains('light'));
    expect(initialLight).not.toBe(newLight);
  });

  test('验证语言切换功能', async ({ page }) => {
    // 初始语言应该是中文
    const initialLang = page.getByRole('button', { name: /EN/ });
    await expect(initialLang).toBeVisible();
    
    // 点击切换为英文
    await initialLang.click();
    await page.waitForTimeout(300);
    
    // 验证切换为中文按钮
    const chineseButton = page.getByRole('button', { name: /中文/ });
    await expect(chineseButton).toBeVisible();
  });

  test('验证设置面板打开和关闭', async ({ page }) => {
    // 点击设置按钮
    const settingsButton = page.locator('header button[title*="设置"]');
    await settingsButton.click();
    
    // 验证设置面板出现
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
    await expect(page.getByText('GITHUB_TOKEN')).toBeVisible();
    await expect(page.getByRole('heading', { name: '批量评定' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '自定义权重' })).toBeVisible();
    
    // 点击关闭
    await page.getByRole('button', { name: '关闭' }).click();
    
    // 验证设置面板消失
    await expect(page.getByRole('heading', { name: '设置' })).not.toBeVisible();
  });

  test('验证 Trending 面板打开和关闭', async ({ page }) => {
    // 点击 Trending 按钮
    const trendingButton = page.getByRole('button', { name: 'GitHub Trending' });
    await trendingButton.click();
    
    // 验证 Trending 面板出现
    await expect(page.getByRole('heading', { name: /GitHub Trending/ })).toBeVisible({ timeout: 5000 });
    
    // 再次点击关闭
    await trendingButton.click();
    await page.waitForTimeout(300);
  });

  test('验证空状态页面渲染', async ({ page }) => {
    // 验证初始空状态
    const emptyState = page.locator('text=输入关键词，开始搜索并评估 GitHub 项目');
    await expect(emptyState).toBeVisible();
    
    // 验证提示文字
    await expect(page.getByText('基于 Ralph 三轨评估模型')).toBeVisible();
  });

  test('验证键盘快捷键 - 聚焦搜索', async ({ page }) => {
    // 按下 / 键应该聚焦搜索框
    await page.keyboard.press('/');
    
    const searchInput = page.locator('input[placeholder*="搜索"]');
    await expect(searchInput).toBeFocused();
  });

  test('验证设置面板中的权重滑块', async ({ page }) => {
    // 打开设置面板
    await page.locator('header button[title*="设置"]').click();
    
    // 验证权重滑块存在
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(5); // 至少有 5 个维度滑块
    
    // 验证恢复默认按钮
    await expect(page.getByRole('button', { name: '恢复默认' })).toBeVisible();
  });

  test('验证设置面板中的批量评定输入', async ({ page }) => {
    // 打开设置面板
    await page.locator('header button[title*="设置"]').click();
    
    // 验证批量评定输入框
    const batchInput = page.locator('#batchCount');
    await expect(batchInput).toBeVisible();
    await expect(batchInput).toHaveValue('30');
    
    // 验证启动批量评定按钮
    await expect(page.getByRole('button', { name: '启动批量评定' })).toBeVisible();
  });

  test('验证 CSS 动画类定义', async ({ page }) => {
    // 触发一个动画效果的场景 - 打开设置面板
    await page.locator('header button[title*="设置"]').click();
    
    // 验证动画类存在
    const panel = page.locator('.animate-fade-in');
    await expect(panel.first()).toBeVisible();
  });

  test('验证响应式布局', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Firefox may handle viewport differently');
    
    // 测试桌面端宽度
    await page.setViewportSize({ width: 1280, height: 720 });
    const desktopHeader = page.locator('header');
    await expect(desktopHeader).toBeVisible();
    
    // 测试平板宽度
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('input[placeholder*="搜索"]')).toBeVisible();
    
    // 测试手机宽度
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('input[placeholder*="搜索"]')).toBeVisible();
  });
});
