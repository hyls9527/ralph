import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../stores/slices/uiSlice', () => ({
  useUiStore: vi.fn((selector: any) => {
    const state = {
      theme: 'dark',
      setTheme: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  setThemeToggle: vi.fn(),
}));

import { useTheme } from '../../hooks/useTheme';
import { useUiStore } from '../../stores/slices/uiSlice';
import { setThemeToggle } from '../../hooks/useKeyboardShortcuts';

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('light', 'dark');
  });

  it('返回 theme 和 isDark', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
  });

  it('注册 setThemeToggle', () => {
    renderHook(() => useTheme());
    expect(setThemeToggle).toHaveBeenCalled();
  });

  it('应用 theme class 到 document', () => {
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggleTheme 切换主题', () => {
    const setTheme = vi.fn();
    (useUiStore as any).mockImplementation((selector: any) => {
      const state = { theme: 'dark', setTheme };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggleTheme();
    });
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
