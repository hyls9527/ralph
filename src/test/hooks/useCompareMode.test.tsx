import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { useCompareMode } from '../../hooks/useCompareMode';
import { useUiStore, type UIState } from '../../stores/slices/uiSlice';

vi.mock('../../stores/slices/uiSlice', () => ({
  useUiStore: vi.fn(),
}));

const mockedUseUiStore = vi.mocked(useUiStore);

function TestHarness({ onResult }: { onResult: (result: ReturnType<typeof useCompareMode>) => void }) {
  const result = useCompareMode();
  React.useEffect(() => {
    onResult(result);
  });
  return null;
}

describe('useCompareMode', () => {
  let mockState: UIState;
  let lastResult: ReturnType<typeof useCompareMode> | null = null;

  beforeEach(() => {
    lastResult = null;
    mockState = {
      showSettings: false,
      showTrending: false,
      showFilters: false,
      showHelp: false,
      compareMode: false,
      selectedProjects: [],
      currentPage: 1,
      theme: 'dark',
      selectedDetailProject: null,
      setShowSettings: vi.fn(),
      setShowTrending: vi.fn(),
      setShowFilters: vi.fn(),
      setShowHelp: vi.fn(),
      setCompareMode: vi.fn(),
      addSelectedProject: vi.fn(),
      removeSelectedProject: vi.fn(),
      clearSelectedProjects: vi.fn(),
      setCurrentPage: vi.fn(),
      setTheme: vi.fn(),
      setSelectedDetailProject: vi.fn(),
    };

    mockedUseUiStore.mockImplementation((selector?: (s: UIState) => unknown) => {
      if (selector) {
        return selector(mockState);
      }
      return mockState;
    });
  });

  function renderHook() {
    render(<TestHarness onResult={(r) => { lastResult = r; }} />);
    return {
      get result() { return lastResult!; },
    };
  }

  it('返回初始 compareMode 为 false', () => {
    const { result } = renderHook();
    expect(result.compareMode).toBe(false);
  });

  it('toggleCompareMode 切换模式并清除选择', () => {
    const { result } = renderHook();
    act(() => {
      result.toggleCompareMode();
    });
    expect(mockState.setCompareMode).toHaveBeenCalledWith(true);
    expect(mockState.clearSelectedProjects).toHaveBeenCalled();
  });

  it('toggleCompareMode 关闭时不调用 clearSelectedProjects', () => {
    mockState.compareMode = true;
    const { result } = renderHook();
    act(() => {
      result.toggleCompareMode();
    });
    expect(mockState.setCompareMode).toHaveBeenCalledWith(false);
    expect(mockState.clearSelectedProjects).not.toHaveBeenCalled();
  });

  it('toggleProjectSelection 添加项目', () => {
    const { result } = renderHook();
    act(() => {
      result.toggleProjectSelection('owner/repo');
    });
    expect(mockState.addSelectedProject).toHaveBeenCalledWith('owner/repo');
  });

  it('toggleProjectSelection 移除已选项目', () => {
    mockState.selectedProjects = ['owner/repo'];
    const { result } = renderHook();
    act(() => {
      result.toggleProjectSelection('owner/repo');
    });
    expect(mockState.removeSelectedProject).toHaveBeenCalledWith('owner/repo');
  });

  it('isSelected 检查项目是否已选', () => {
    mockState.selectedProjects = ['owner/repo'];
    const { result } = renderHook();
    expect(result.isSelected('owner/repo')).toBe(true);
    expect(result.isSelected('other/repo')).toBe(false);
  });

  it('clearSelectedProjects 清除所有选择', () => {
    const { result } = renderHook();
    act(() => {
      result.clearSelectedProjects();
    });
    expect(mockState.clearSelectedProjects).toHaveBeenCalled();
  });
});
