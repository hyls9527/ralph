import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import SearchBar from '../../components/SearchBar';

const mockSetQuery = vi.fn();
const mockSetLoading = vi.fn();
const mockSetSearchResults = vi.fn();

const mockStore = {
  setQuery: mockSetQuery,
  setLoading: mockSetLoading,
  setSearchResults: mockSetSearchResults,
};

vi.mock('../../stores/useAppStore', () => ({
  useAppStore: (selector?: (s: unknown) => unknown) => {
    if (selector) return selector(mockStore);
    return mockStore;
  },
}));

vi.mock('../../services/tauri', () => ({
  tauri: {
    getSearchHistory: vi.fn().mockResolvedValue([]),
  },
}));

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染搜索输入框', () => {
    const html = renderToString(<SearchBar />);
    expect(html).toContain('placeholder');
    expect(html).toContain('search-input');
  });

  it('渲染搜索按钮', () => {
    const html = renderToString(<SearchBar />);
    expect(html).toContain('<button');
    expect(html).toContain('搜索');
  });

  it('包含 SVG 搜索图标', () => {
    const html = renderToString(<SearchBar />);
    expect(html).toContain('<svg');
  });

  it('输入框有 aria-label', () => {
    const html = renderToString(<SearchBar />);
    expect(html).toContain('aria-label');
  });

  it('组件渲染不崩溃', () => {
    expect(() => renderToString(<SearchBar />)).not.toThrow();
  });
});
