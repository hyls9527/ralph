import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/tauri', () => ({
  tauri: {
    getFavorites: vi.fn().mockResolvedValue([]),
    addFavorite: vi.fn().mockResolvedValue(undefined),
    removeFavorite: vi.fn().mockResolvedValue(undefined),
  },
}));

import { useFavoriteStore } from '../../stores/slices/favoriteSlice';

describe('favoriteSlice', () => {
  beforeEach(() => {
    useFavoriteStore.setState({
      favorites: new Set<string>(),
      pending: new Set<string>(),
    });
    vi.clearAllMocks();
  });

  it('初始状态 favorites 为空', () => {
    const state = useFavoriteStore.getState();
    expect(state.favorites.size).toBe(0);
    expect(state.pending.size).toBe(0);
  });

  it('isFavorite 对不存在的项目返回 false', () => {
    const { isFavorite } = useFavoriteStore.getState();
    expect(isFavorite('owner/repo')).toBe(false);
  });

  it('isPending 对不存在的项目返回 false', () => {
    const { isPending } = useFavoriteStore.getState();
    expect(isPending('owner/repo')).toBe(false);
  });

  it('手动设置 favorites 后 isFavorite 返回 true', () => {
    useFavoriteStore.setState({ favorites: new Set(['owner/repo']) });
    const { isFavorite } = useFavoriteStore.getState();
    expect(isFavorite('owner/repo')).toBe(true);
  });

  it('手动设置 pending 后 isPending 返回 true', () => {
    useFavoriteStore.setState({ pending: new Set(['owner/repo']) });
    const { isPending } = useFavoriteStore.getState();
    expect(isPending('owner/repo')).toBe(true);
  });

  it('loadFavorites 加载收藏列表', async () => {
    const { tauri } = await import('../../services/tauri');
    (tauri.getFavorites as any).mockResolvedValue([
      { fullName: 'repo/a', name: 'a' },
      { fullName: 'repo/b', name: 'b' },
    ]);

    const { loadFavorites } = useFavoriteStore.getState();
    await loadFavorites();

    const state = useFavoriteStore.getState();
    expect(state.favorites.has('repo/a')).toBe(true);
    expect(state.favorites.has('repo/b')).toBe(true);
  });
});
