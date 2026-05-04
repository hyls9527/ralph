import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import SearchHistory from '../../components/SearchHistory';

vi.mock('../../services/tauri', () => ({
  tauri: {
    getSearchHistory: vi.fn().mockResolvedValue([
      { keyword: 'rust', timestamp: Date.now() - 3600000 },
      { keyword: 'python', timestamp: Date.now() - 7200000 },
    ]),
    clearSearchHistory: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../i18n', () => {
  const mockT = (key: string, params?: Record<string, number>) => {
    const map: Record<string, string> = {
      searchHistory: '搜索历史',
      clear: '清除',
      justNow: '刚刚',
      minsAgo: `${params?.n ?? 0} 分钟前`,
      hoursAgo: `${params?.n ?? 0} 小时前`,
      daysAgo: `${params?.n ?? 0} 天前`,
      loadHistoryFailed: '加载历史失败',
      clearHistoryFailed: '清除历史失败',
    };
    return map[key] || key;
  };
  return {
    t: mockT,
    useI18n: () => ({ t: mockT, lang: 'zh', switchLang: vi.fn() }),
  };
});

describe('SearchHistory', () => {
  it('初始渲染切换按钮', () => {
    const html = renderToString(
      <SearchHistory onReSearch={vi.fn()} isLight={false} />
    );
    expect(html).toContain('搜索历史');
  });

  it('暗色模式使用深色样式', () => {
    const html = renderToString(
      <SearchHistory onReSearch={vi.fn()} isLight={false} />
    );
    expect(html).toContain('border-gray-700');
  });

  it('亮色模式使用浅色样式', () => {
    const html = renderToString(
      <SearchHistory onReSearch={vi.fn()} isLight={true} />
    );
    expect(html).toContain('border-gray-300');
  });

  it('初始不显示历史面板', () => {
    const html = renderToString(
      <SearchHistory onReSearch={vi.fn()} isLight={false} />
    );
    expect(html).not.toContain('animate-fade-in');
  });

  it('按钮可点击', () => {
    const html = renderToString(
      <SearchHistory onReSearch={vi.fn()} isLight={false} />
    );
    expect(html).toContain('<button');
  });
});
