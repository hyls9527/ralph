import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import FavoritesManager from '../../components/FavoritesManager';

vi.mock('../../stores/slices/favoriteSlice', () => ({
  useFavoriteStore: (selector: (s: unknown) => unknown) => {
    const store = {
      loadFavorites: vi.fn().mockResolvedValue(undefined),
    };
    return selector(store);
  },
  useFavoriteSelector: () => ({
    isFavorite: vi.fn().mockReturnValue(false),
    toggleFavorite: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../services/tauri', () => ({
  tauri: {
    getFavorites: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      favorites: '收藏',
      loadFavoritesFailed: '加载收藏失败',
      justNow: '刚刚',
      hoursAgo: '{n}小时前',
      daysAgo: '{n}天前',
      neglected: '被忽视',
      highStar: '高星',
      steady: '稳态',
    };
    return map[key] || key;
  },
}));

describe('FavoritesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初始渲染收藏按钮', () => {
    const html = renderToString(<FavoritesManager isLight={false} />);
    expect(html).toContain('<button');
    expect(html).toContain('收藏');
  });

  it('暗色模式正常渲染', () => {
    const html = renderToString(<FavoritesManager isLight={false} />);
    expect(html).toContain('收藏');
  });

  it('亮色模式正常渲染', () => {
    const html = renderToString(<FavoritesManager isLight={true} />);
    expect(html).toContain('收藏');
  });

  it('组件渲染不崩溃', () => {
    expect(() =>
      renderToString(<FavoritesManager isLight={false} />),
    ).not.toThrow();
  });
});
