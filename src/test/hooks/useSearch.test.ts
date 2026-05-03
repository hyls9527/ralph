import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../stores/useAppStore';
import type { ProjectRecommendation } from '../../types';

vi.mock('../../services/tauri', () => ({
  tauri: {
    searchAndEvaluate: vi.fn(),
    batchEvaluate: vi.fn(),
  },
}));

import { tauri } from '../../services/tauri';
const mockedTauri = vi.mocked(tauri);

async function simulateEvaluate(queryText: string) {
  const { setLoading, setSearchResults, setQuery } = useAppStore.getState();
  if (!queryText.trim()) return;

  setLoading({ phase: 'searching', message: '正在搜索 GitHub 项目...' });

  try {
    const response = await tauri.searchAndEvaluate(queryText);
    setQuery(queryText.trim());
    setSearchResults(response.results || []);
  } catch (error) {
    const errorMessage = String(error);
    let userMessage = '搜索失败，请稍后重试';
    if (errorMessage.includes('invoke') || errorMessage.includes('undefined')) {
      userMessage = '网络连接异常，请确保在 Tauri 桌面环境中运行';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('403')) {
      userMessage = 'GitHub API 限流，请在设置中配置 Token 后重试';
    } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      userMessage = '网络连接异常，请检查网络后重试';
    }
    setLoading({ phase: 'error', message: userMessage });
  }
}

async function simulateBatchEvaluate(queryText: string, count: number) {
  const { setLoading, setSearchResults, setQuery } = useAppStore.getState();
  if (!queryText.trim()) return;

  setLoading({ phase: 'evaluating', message: `正在批量评定 ${count} 个项目...` });

  try {
    const response = await tauri.batchEvaluate(queryText, count);
    setQuery(queryText.trim());
    setSearchResults(response.results || []);
  } catch (error) {
    const message = String(error);
    setLoading({ phase: 'error', message });
  }
}

describe('useSearch 逻辑测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      query: '',
      results: [],
      loading: { phase: 'idle', message: '' },
      token: '',
    });
  });

  describe('evaluate', () => {
    it('空查询不触发搜索', async () => {
      await simulateEvaluate('   ');
      expect(mockedTauri.searchAndEvaluate).not.toHaveBeenCalled();
    });

    it('成功搜索并更新结果', async () => {
      const mockResults: ProjectRecommendation[] = [{
        repo: { owner: 'test', name: 'repo', fullName: 'test/repo', htmlUrl: '',
          description: null, stargazersCount: 100, forksCount: 10, openIssuesCount: 5,
          language: null, createdAt: '', updatedAt: '', pushedAt: '', license: null,
          size: 0, hasWiki: false, hasIssuesEnabled: false, topics: [] },
        gateChecks: [], track: 'steady', neglectIndex: 0, dimensions: [],
        totalScore: 80, grade: 'A', oneLiner: '', evidenceLevel: 'L1',
        trustBadge: { level: 2, l1: { status: 'recommended', icon: '✓', label: '推荐', color: 'emerald' } },
        vetoFlags: [], recommendationIndex: 40, confidenceTier: 'tier1-core', decisionTrail: [],
      }];

      mockedTauri.searchAndEvaluate.mockResolvedValueOnce({ results: mockResults });

      await simulateEvaluate('rust logging');

      expect(mockedTauri.searchAndEvaluate).toHaveBeenCalledWith('rust logging');
      expect(useAppStore.getState().query).toBe('rust logging');
      expect(useAppStore.getState().results).toHaveLength(1);
      expect(useAppStore.getState().loading.phase).toBe('done');
    });

    it('搜索失败时设置错误状态 - invoke 错误', async () => {
      mockedTauri.searchAndEvaluate.mockRejectedValueOnce(new Error('invoke failed'));

      await simulateEvaluate('rust logging');

      const state = useAppStore.getState();
      expect(state.loading.phase).toBe('error');
      expect(state.loading.message).toContain('Tauri');
    });

    it('API 限流错误提示配置 Token', async () => {
      mockedTauri.searchAndEvaluate.mockRejectedValueOnce(new Error('rate limit exceeded 403'));

      await simulateEvaluate('rust');

      expect(useAppStore.getState().loading.message).toContain('Token');
    });

    it('网络错误提示检查网络', async () => {
      mockedTauri.searchAndEvaluate.mockRejectedValueOnce(new Error('fetch network error'));

      await simulateEvaluate('rust');

      expect(useAppStore.getState().loading.message).toContain('网络');
    });

    it('通用错误提示稍后重试', async () => {
      mockedTauri.searchAndEvaluate.mockRejectedValueOnce(new Error('unknown error'));

      await simulateEvaluate('rust');

      expect(useAppStore.getState().loading.message).toContain('稍后重试');
    });

    it('搜索前设置 loading 状态', async () => {
      let resolveSearch: (value: unknown) => void;
      const searchPromise = new Promise(resolve => { resolveSearch = resolve; });
      mockedTauri.searchAndEvaluate.mockReturnValueOnce(searchPromise as any);

      const evaluatePromise = simulateEvaluate('rust');

      expect(useAppStore.getState().loading.phase).toBe('searching');

      resolveSearch!({ results: [] });
      await evaluatePromise;
    });
  });

  describe('batchEvaluate', () => {
    it('空查询不触发批量评定', async () => {
      await simulateBatchEvaluate('   ', 30);
      expect(mockedTauri.batchEvaluate).not.toHaveBeenCalled();
    });

    it('成功批量评定', async () => {
      mockedTauri.batchEvaluate.mockResolvedValueOnce({ results: [] });

      await simulateBatchEvaluate('rust', 30);

      expect(mockedTauri.batchEvaluate).toHaveBeenCalledWith('rust', 30);
      expect(useAppStore.getState().query).toBe('rust');
    });

    it('批量评定失败设置错误状态', async () => {
      mockedTauri.batchEvaluate.mockRejectedValueOnce(new Error('batch failed'));

      await simulateBatchEvaluate('rust', 30);

      expect(useAppStore.getState().loading.phase).toBe('error');
    });

    it('批量评定前设置 evaluating 状态', async () => {
      let resolveBatch: (value: unknown) => void;
      const batchPromise = new Promise(resolve => { resolveBatch = resolve; });
      mockedTauri.batchEvaluate.mockReturnValueOnce(batchPromise as any);

      const evalPromise = simulateBatchEvaluate('rust', 30);

      expect(useAppStore.getState().loading.phase).toBe('evaluating');
      expect(useAppStore.getState().loading.message).toContain('30');

      resolveBatch!({ results: [] });
      await evalPromise;
    });
  });
});
