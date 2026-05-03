import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tauri, type SearchResponse, type BadgeInfo } from '../../services/tauri';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockedInvoke = vi.mocked(invoke);

describe('tauri 服务层', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchAndEvaluate', () => {
    it('调用正确的 Tauri 命令', async () => {
      const mockResponse: SearchResponse = { results: [] };
      mockedInvoke.mockResolvedValueOnce(mockResponse);

      await tauri.searchAndEvaluate('rust logging');

      expect(mockedInvoke).toHaveBeenCalledWith('search_and_evaluate', { query: 'rust logging' });
    });

    it('返回搜索结果', async () => {
      const mockResponse: SearchResponse = {
        results: [{
          repo: { owner: 'test', name: 'repo', fullName: 'test/repo', htmlUrl: '',
            description: null, stargazersCount: 100, forksCount: 10, openIssuesCount: 5,
            language: null, createdAt: '', updatedAt: '', pushedAt: '', license: null,
            size: 0, hasWiki: false, hasIssuesEnabled: false, topics: [] },
          gateChecks: [], track: 'steady', neglectIndex: 0, dimensions: [],
          totalScore: 80, grade: 'A', oneLiner: '', evidenceLevel: 'L1',
          trustBadge: { level: 2, l1: { status: 'recommended', icon: '✓', label: '推荐', color: 'emerald' } },
          vetoFlags: [], recommendationIndex: 40, confidenceTier: 'tier1-core', decisionTrail: [],
        }],
        meta: { queryId: 'q1', totalCandidates: 10, evaluatedCount: 5, dataSource: 'github' },
      };
      mockedInvoke.mockResolvedValueOnce(mockResponse);

      const result = await tauri.searchAndEvaluate('rust');
      expect(result.results).toHaveLength(1);
      expect(result.meta?.queryId).toBe('q1');
    });
  });

  describe('batchEvaluate', () => {
    it('调用正确的 Tauri 命令', async () => {
      mockedInvoke.mockResolvedValueOnce({ results: [] });

      await tauri.batchEvaluate('rust', 30);

      expect(mockedInvoke).toHaveBeenCalledWith('batch_evaluate', { query: 'rust', count: 30 });
    });
  });

  describe('cancelBatch', () => {
    it('调用取消命令', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await tauri.cancelBatch();

      expect(mockedInvoke).toHaveBeenCalledWith('cancel_batch');
    });
  });

  describe('getFavorites', () => {
    it('获取收藏列表', async () => {
      const mockFavorites = [
        { fullName: 'test/repo1', evaluationJson: '{}' },
        { fullName: 'test/repo2', evaluationJson: '{}' },
      ];
      mockedInvoke.mockResolvedValueOnce(mockFavorites);

      const result = await tauri.getFavorites();
      expect(result).toHaveLength(2);
      expect(mockedInvoke).toHaveBeenCalledWith('get_favorites');
    });
  });

  describe('addFavorite', () => {
    it('添加收藏', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await tauri.addFavorite('test/repo', '{}');

      expect(mockedInvoke).toHaveBeenCalledWith('add_favorite', { fullName: 'test/repo', evaluationJson: '{}' });
    });
  });

  describe('removeFavorite', () => {
    it('移除收藏', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await tauri.removeFavorite('test/repo');

      expect(mockedInvoke).toHaveBeenCalledWith('remove_favorite', { fullName: 'test/repo' });
    });
  });

  describe('isFavorite', () => {
    it('检查是否已收藏', async () => {
      mockedInvoke.mockResolvedValueOnce(true);

      const result = await tauri.isFavorite('test/repo');
      expect(result).toBe(true);
      expect(mockedInvoke).toHaveBeenCalledWith('is_favorite', { fullName: 'test/repo' });
    });
  });

  describe('getSearchHistory', () => {
    it('获取搜索历史', async () => {
      const mockHistory = [
        { keyword: 'rust', timestamp: 1700000000 },
      ];
      mockedInvoke.mockResolvedValueOnce(mockHistory);

      const result = await tauri.getSearchHistory();
      expect(result).toHaveLength(1);
    });
  });

  describe('logSearch', () => {
    it('记录搜索', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await tauri.logSearch('rust', 10);

      expect(mockedInvoke).toHaveBeenCalledWith('log_search_history', { query: 'rust', count: 10 });
    });
  });

  describe('clearSearchHistory', () => {
    it('清空搜索历史', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await tauri.clearSearchHistory();

      expect(mockedInvoke).toHaveBeenCalledWith('clear_search_history');
    });
  });

  describe('getEvaluationHistory', () => {
    it('获取评估历史', async () => {
      const mockHistory = [
        { score: 80, grade: 'A', track: 'steady', evaluatedAt: '2024-01-01' },
      ];
      mockedInvoke.mockResolvedValueOnce(mockHistory);

      const result = await tauri.getEvaluationHistory('test/repo');
      expect(result).toHaveLength(1);
      expect(mockedInvoke).toHaveBeenCalledWith('get_evaluation_history', { repoFullName: 'test/repo' });
    });
  });

  describe('getTrendingRepos', () => {
    it('获取趋势项目', async () => {
      mockedInvoke.mockResolvedValueOnce({ results: [] });

      await tauri.getTrendingRepos();

      expect(mockedInvoke).toHaveBeenCalledWith('get_trending_repos');
    });
  });

  describe('clearCache', () => {
    it('清空缓存', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await tauri.clearCache();

      expect(mockedInvoke).toHaveBeenCalledWith('clear_cache');
    });
  });

  describe('saveSettings', () => {
    it('保存设置', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await tauri.saveSettings('ghp_test');

      expect(mockedInvoke).toHaveBeenCalledWith('save_settings', { token: 'ghp_test' });
    });
  });

  describe('generateBadge', () => {
    it('生成徽章', async () => {
      const mockBadge: BadgeInfo = {
        grade: 'S',
        score: 90,
        color: 'emerald',
        url: 'https://img.shields.io/badge/Ralph-S-emerald',
        markdown: '![Ralph](https://img.shields.io/badge/Ralph-S-emerald)',
        html: '<img src="https://img.shields.io/badge/Ralph-S-emerald" />',
      };
      mockedInvoke.mockResolvedValueOnce(mockBadge);

      const result = await tauri.generateBadge('S', 90, 'test/repo');
      expect(result.grade).toBe('S');
      expect(mockedInvoke).toHaveBeenCalledWith('generate_badge', { grade: 'S', score: 90, repoFullName: 'test/repo' });
    });
  });

  describe('错误处理', () => {
    it('Tauri invoke 失败时抛出错误', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('IPC error'));

      await expect(tauri.searchAndEvaluate('test')).rejects.toThrow('IPC error');
    });
  });
});
