/**
 * Ralph E2E 测试配置
 * 
 * ⚠️ 前提条件：运行E2E测试前必须先启动Tauri dev服务器
 * 
 * 启动方式（二选一）：
 * 1. Tauri dev（完整功能）: pnpm tauri dev
 * 2. Vite dev（仅前端UI）: pnpm run dev
 * 
 * 注意：
 * - Tauri dev 提供完整后端API（搜索、评估、历史记录等）
 * - Vite dev 仅提供前端UI，后端调用会返回undefined
 * - 部分测试用例依赖Tauri IPC Bridge，仅在Tauri dev环境下可通过
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'e2e-report' }], ['list']],
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});
