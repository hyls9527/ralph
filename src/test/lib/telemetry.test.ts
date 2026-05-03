import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TelemetryCore, {
  getTelemetry,
  initTelemetry,
} from '../../lib/telemetry';
import type {
  TelemetryConfig,
  ErrorData,
  FeedbackData,
} from '../../lib/telemetry';

describe('TelemetryCore', () => {
  let telemetry: TelemetryCore;

  const minimalConfig: Partial<TelemetryConfig> = {
    enabled: true,
    sampleRate: 1.0,
    maxEventsPerSession: 1000,
    maxLocalStorageSize: 10,
    autoFlushInterval: 99999,
    debugMode: false,
    privacyMode: 'full',
    consentRequired: false,
  };

  beforeEach(() => {
    telemetry = new TelemetryCore(minimalConfig);
  });

  afterEach(() => {
    telemetry.destroy();
  });

  it('初始化后 getSession 返回有效会话', () => {
    const session = telemetry.getSession();
    expect(session.id).toBeTruthy();
    expect(session.startTime).toBeGreaterThan(0);
    expect(session.pageViews).toBeGreaterThanOrEqual(0);
    expect(session.actions).toBeGreaterThanOrEqual(0);
    expect(session.errors).toBe(0);
    expect(session.deviceInfo).toBeDefined();
    expect(typeof session.deviceInfo.platform).toBe('string');
  });

  it('track 不抛出错误', () => {
    expect(() =>
      telemetry.track('click', 'ux', { elementId: 'btn' }),
    ).not.toThrow();
  });

  it('trackClick 不抛出错误', () => {
    const btn = document.createElement('button');
    btn.id = 'test-btn';
    btn.textContent = 'Click me';
    expect(() => telemetry.trackClick(btn)).not.toThrow();
  });

  it('trackView 不抛出错误', () => {
    expect(() => telemetry.trackView('home')).not.toThrow();
  });

  it('trackSearch 不抛出错误', () => {
    expect(() => telemetry.trackSearch('rust', 10, 150)).not.toThrow();
  });

  it('trackFilter 不抛出错误', () => {
    expect(() =>
      telemetry.trackFilter({ language: 'rust', track: 'neglected' }, 50),
    ).not.toThrow();
  });

  it('trackError 不抛出错误', () => {
    const errorData: ErrorData = {
      errorType: 'js',
      message: 'Test error',
      severity: 'error',
      recoverable: true,
    };
    expect(() => telemetry.trackError(errorData)).not.toThrow();
  });

  it('trackFeedback 不抛出错误', () => {
    const feedback: FeedbackData = {
      type: 'rating',
      score: 8,
      comment: 'Great app',
    };
    expect(() => telemetry.trackFeedback(feedback)).not.toThrow();
  });

  it('recordPerformanceMetric 不抛出错误', () => {
    expect(() => telemetry.recordPerformanceMetric('fcp', 120)).not.toThrow();
  });

  it('flush 不抛出错误', async () => {
    telemetry.track('click', 'ux', {});
    await expect(telemetry.flush()).resolves.toBeUndefined();
  });

  it('getErrors 初始返回空数组', () => {
    const errors = telemetry.getErrors();
    expect(Array.isArray(errors)).toBe(true);
  });

  it('clearAllData 不抛出错误', () => {
    expect(() => telemetry.clearAllData()).not.toThrow();
  });

  it('exportData 返回 JSON 字符串', async () => {
    const data = await telemetry.exportData();
    expect(typeof data).toBe('string');
    const parsed = JSON.parse(data);
    expect(parsed).toHaveProperty('session');
    expect(parsed).toHaveProperty('exportedAt');
  });

  it('on 注册事件监听器并返回取消函数', () => {
    const callback = vi.fn();
    const unsubscribe = telemetry.on('event', callback);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('destroy 后可以安全调用', () => {
    telemetry.destroy();
    expect(() => telemetry.destroy()).not.toThrow();
  });
});

describe('getTelemetry', () => {
  it('返回 TelemetryCore 实例', () => {
    const t = getTelemetry();
    expect(t).toBeInstanceOf(TelemetryCore);
    t.destroy();
  });

  it('多次调用返回同一实例', () => {
    const t1 = getTelemetry();
    const t2 = getTelemetry();
    expect(t1).toBe(t2);
    t1.destroy();
  });
});

describe('initTelemetry', () => {
  it('创建新实例', () => {
    getTelemetry();
    const t2 = initTelemetry();
    expect(t2).toBeInstanceOf(TelemetryCore);
    t2.destroy();
  });
});
