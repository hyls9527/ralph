import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotification } from '../../hooks/useNotification';

describe('useNotification', () => {
  let mockNotification: {
    permission: NotificationPermission;
    requestPermission: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockNotification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    };

    const MockNotification = vi.fn(function (
      this: { onclick: (() => void) | null; close: () => void },
      _title: string,
      _options?: NotificationOptions,
    ) {
      this.onclick = null;
      this.close = vi.fn();
    }) as unknown as typeof Notification;
    Object.defineProperty(MockNotification, 'permission', {
      get: () => mockNotification.permission,
      configurable: true,
    });
    Object.defineProperty(MockNotification, 'requestPermission', {
      value: mockNotification.requestPermission,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'Notification', {
      value: MockNotification,
      writable: true,
      configurable: true,
    });
  });

  it('requestPermission 请求权限', async () => {
    const { result } = renderHook(() => useNotification());
    let granted: boolean = false;
    await act(async () => {
      granted = await result.current.requestPermission();
    });
    expect(granted).toBe(true);
    expect(Notification.requestPermission).toHaveBeenCalled();
  });

  it('权限已 granted 时直接返回 true', async () => {
    mockNotification.permission = 'granted';
    const { result } = renderHook(() => useNotification());
    let granted: boolean = false;
    await act(async () => {
      granted = await result.current.requestPermission();
    });
    expect(granted).toBe(true);
  });

  it('权限已 denied 时返回 false', async () => {
    mockNotification.permission = 'denied';
    const { result } = renderHook(() => useNotification());
    let granted: boolean = true;
    await act(async () => {
      granted = await result.current.requestPermission();
    });
    expect(granted).toBe(false);
  });

  it('notify 在权限未 granted 时不创建通知', () => {
    const { result } = renderHook(() => useNotification());
    act(() => {
      result.current.notify({ title: 'test', body: 'test body' });
    });
    expect(Notification).not.toHaveBeenCalled();
  });

  it('notify 在权限 granted 时创建通知', () => {
    mockNotification.permission = 'granted';
    const { result } = renderHook(() => useNotification());
    act(() => {
      result.current.notify({ title: 'test', body: 'test body' });
    });
    expect(Notification).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ body: 'test body' }),
    );
  });

  it('notifyDiscovery 发送发现通知', () => {
    mockNotification.permission = 'granted';
    const { result } = renderHook(() => useNotification());
    act(() => {
      result.current.notifyDiscovery('test-repo', 85.5, 'A', 10);
    });
    expect(Notification).toHaveBeenCalledWith(
      expect.stringContaining('Ralph'),
      expect.objectContaining({ tag: 'discovery-test-repo' }),
    );
  });

  it('notifyBatchComplete 发送批量完成通知', () => {
    mockNotification.permission = 'granted';
    const { result } = renderHook(() => useNotification());
    act(() => {
      result.current.notifyBatchComplete(5, 'rust');
    });
    expect(Notification).toHaveBeenCalledWith(
      expect.stringContaining('批量评估完成'),
      expect.objectContaining({ tag: 'batch-complete' }),
    );
  });

  it('无 Notification API 时 requestPermission 返回 false', async () => {
    delete (window as Record<string, unknown>).Notification;
    const { result } = renderHook(() => useNotification());
    let granted: boolean = true;
    await act(async () => {
      granted = await result.current.requestPermission();
    });
    expect(granted).toBe(false);
  });
});
