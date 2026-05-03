import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from '../../stores/slices/filterSlice';

describe('useFilterStore', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
  });

  it('初始状态正确', () => {
    const state = useFilterStore.getState();
    expect(state.sortBy).toBe('recommendationIndex');
    expect(state.sortOrder).toBe('desc');
    expect(state.trackFilter).toBe('all');
    expect(state.languageFilter).toBe('all');
    expect(state.minScore).toBe(0);
    expect(state.minStars).toBe(0);
  });

  it('setSortBy 更新排序字段', () => {
    useFilterStore.getState().setSortBy('score');
    expect(useFilterStore.getState().sortBy).toBe('score');
  });

  it('setSortBy 所有排序字段', () => {
    const sortOptions: Array<
      'recommendationIndex' | 'score' | 'stars' | 'updatedAt'
    > = ['recommendationIndex', 'score', 'stars', 'updatedAt'];
    for (const sortBy of sortOptions) {
      useFilterStore.getState().setSortBy(sortBy);
      expect(useFilterStore.getState().sortBy).toBe(sortBy);
    }
  });

  it('setSortOrder 更新排序方向', () => {
    useFilterStore.getState().setSortOrder('asc');
    expect(useFilterStore.getState().sortOrder).toBe('asc');
    useFilterStore.getState().setSortOrder('desc');
    expect(useFilterStore.getState().sortOrder).toBe('desc');
  });

  it('setTrackFilter 更新轨道过滤', () => {
    const tracks: Array<'all' | 'neglected' | 'high-star' | 'steady'> = [
      'all',
      'neglected',
      'high-star',
      'steady',
    ];
    for (const track of tracks) {
      useFilterStore.getState().setTrackFilter(track);
      expect(useFilterStore.getState().trackFilter).toBe(track);
    }
  });

  it('setLanguageFilter 更新语言过滤', () => {
    useFilterStore.getState().setLanguageFilter('Rust');
    expect(useFilterStore.getState().languageFilter).toBe('Rust');
  });

  it('setMinScore 更新最低分数', () => {
    useFilterStore.getState().setMinScore(80);
    expect(useFilterStore.getState().minScore).toBe(80);
  });

  it('setMinScore 边界值 - 零分', () => {
    useFilterStore.getState().setMinScore(0);
    expect(useFilterStore.getState().minScore).toBe(0);
  });

  it('setMinScore 边界值 - 满分', () => {
    useFilterStore.getState().setMinScore(105);
    expect(useFilterStore.getState().minScore).toBe(105);
  });

  it('setMinStars 更新最低星数', () => {
    useFilterStore.getState().setMinStars(1000);
    expect(useFilterStore.getState().minStars).toBe(1000);
  });

  it('setMinStars 边界值 - 零', () => {
    useFilterStore.getState().setMinStars(0);
    expect(useFilterStore.getState().minStars).toBe(0);
  });

  it('resetFilters 恢复默认值', () => {
    useFilterStore.getState().setSortBy('stars');
    useFilterStore.getState().setSortOrder('asc');
    useFilterStore.getState().setTrackFilter('neglected');
    useFilterStore.getState().setLanguageFilter('Python');
    useFilterStore.getState().setMinScore(80);
    useFilterStore.getState().setMinStars(500);

    useFilterStore.getState().resetFilters();

    const state = useFilterStore.getState();
    expect(state.sortBy).toBe('recommendationIndex');
    expect(state.sortOrder).toBe('desc');
    expect(state.trackFilter).toBe('all');
    expect(state.languageFilter).toBe('all');
    expect(state.minScore).toBe(0);
    expect(state.minStars).toBe(0);
  });

  it('多次修改后 resetFilters 仍正确', () => {
    for (let i = 0; i < 10; i++) {
      useFilterStore.getState().setMinScore(i * 10);
      useFilterStore.getState().setMinStars(i * 100);
    }
    useFilterStore.getState().resetFilters();
    const state = useFilterStore.getState();
    expect(state.minScore).toBe(0);
    expect(state.minStars).toBe(0);
  });
});
