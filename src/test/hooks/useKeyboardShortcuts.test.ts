import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  setHelpModalToggle,
  setThemeToggle,
  getShortcutsForHelp,
  isInputFocused,
} from '../../hooks/useKeyboardShortcuts';

vi.mock('../../lib/escape-stack', () => ({
  escapeStack: {
    hasItems: vi.fn(() => false),
    handleEscape: vi.fn(),
  },
}));

function fireKeydown(key: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'target', { value: target, writable: false });
  document.dispatchEvent(event);
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('注册 keydown 事件监听器', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ onSearchFocus: vi.fn() })
    );

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('/ 键聚焦搜索框', () => {
    const input = document.createElement('input');
    input.id = 'search-input';
    document.body.appendChild(input);
    const focusSpy = vi.spyOn(input, 'focus');

    renderHook(() => useKeyboardShortcuts({}));

    act(() => {
      fireKeydown('/');
    });
    expect(focusSpy).toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('Escape 键触发 onClosePopup', () => {
    const onClosePopup = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onClosePopup }));

    act(() => {
      fireKeydown('Escape');
    });
    expect(onClosePopup).toHaveBeenCalled();
  });

  it('ArrowRight 触发 onNextPage', () => {
    const onNextPage = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNextPage, totalPages: 5 }));

    act(() => {
      fireKeydown('ArrowRight');
    });
    expect(onNextPage).toHaveBeenCalled();
  });

  it('ArrowLeft 触发 onPrevPage', () => {
    const onPrevPage = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onPrevPage, totalPages: 5 }));

    act(() => {
      fireKeydown('ArrowLeft');
    });
    expect(onPrevPage).toHaveBeenCalled();
  });

  it('单页时不触发翻页', () => {
    const onNextPage = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNextPage, totalPages: 1 }));

    act(() => {
      fireKeydown('ArrowRight');
    });
    expect(onNextPage).not.toHaveBeenCalled();
  });

  it('输入框中不触发快捷键', () => {
    const onSearchFocus = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSearchFocus }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      fireKeydown('/', input);
    });
    expect(onSearchFocus).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('d 键触发 onToggleTheme', () => {
    const onToggleTheme = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onToggleTheme }));

    act(() => {
      fireKeydown('d');
    });
    expect(onToggleTheme).toHaveBeenCalled();
  });
});

describe('setHelpModalToggle', () => {
  it('设置帮助模态框切换函数', () => {
    const fn = vi.fn();
    setHelpModalToggle(fn);
    expect(fn).toBeDefined();
  });
});

describe('setThemeToggle', () => {
  it('设置主题切换函数', () => {
    const fn = vi.fn();
    setThemeToggle(fn);
    expect(fn).toBeDefined();
  });
});

describe('getShortcutsForHelp', () => {
  it('返回快捷键列表不含 action 和 when', () => {
    const shortcuts = getShortcutsForHelp();
    expect(shortcuts.length).toBeGreaterThan(0);
    for (const s of shortcuts) {
      expect(s).not.toHaveProperty('action');
      expect(s).not.toHaveProperty('when');
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('key');
      expect(s).toHaveProperty('description');
    }
  });
});

describe('isInputFocused', () => {
  it('无焦点元素时返回 false', () => {
    const activeEl = document.activeElement;
    if (activeEl && 'blur' in activeEl) {
      (activeEl as HTMLElement).blur();
    }
    expect(isInputFocused()).toBeFalsy();
  });
});
