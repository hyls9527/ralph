import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../stores/useAppStore';
import type { ProjectRecommendation } from '../../types';

const mockProject: ProjectRecommendation = {
  repo: {
    owner: 'test',
    name: 'test-repo',
    fullName: 'test/test-repo',
    htmlUrl: 'https://github.com/test/test-repo',
    description: 'A test repository',
    stargazersCount: 1000,
    forksCount: 100,
    openIssuesCount: 10,
    language: 'Rust',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
    pushedAt: '2024-12-01T00:00:00Z',
    license: { spdxId: 'MIT', name: 'MIT License' },
    size: 5000,
    hasWiki: true,
    hasIssuesEnabled: true,
    topics: ['rust', 'testing'],
  },
  gateChecks: [
    { gate: 'G1', passed: true, reason: null, evidenceLevel: 'L1' },
    { gate: 'G2', passed: true, reason: null, evidenceLevel: 'L1' },
  ],
  track: 'high-star',
  neglectIndex: 2.0,
  valueDensity: 0.8,
  steadyState: 0.6,
  dimensions: [
    { dimension: '质量', score: 18, maxScore: 20, subScores: [['项目结构', 5, 5], ['测试覆盖', 4, 5], ['CI/CD', 4, 5], ['代码规范', 5, 5]] },
    { dimension: '维护', score: 12, maxScore: 15, subScores: [] },
    { dimension: '实用', score: 20, maxScore: 25, subScores: [] },
    { dimension: '文档', score: 12, maxScore: 15, subScores: [] },
    { dimension: '社区', score: 8, maxScore: 10, subScores: [] },
    { dimension: '安全', score: 16, maxScore: 20, subScores: [] },
  ],
  totalScore: 86,
  grade: 'S',
  oneLiner: 'test-repo | S级推荐，热门项目 | A test repository',
  evidenceLevel: 'L1',
  trustBadge: {
    level: 2,
    l1: { status: 'recommended', icon: '✓', label: 'Ralph 推荐', color: 'emerald' },
    l2: {
      gateChecks: [],
      evidenceSummary: '评分 86/105 | 证据等级 L1',
      keyMetrics: { qualityScore: 18, maintenanceScore: 12, securityStatus: 'passed' },
    },
  },
  vetoFlags: [],
  recommendationIndex: 129.0,
  confidenceTier: 'tier1-core',
  decisionTrail: [],
};

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      query: '',
      results: [],
      loading: { phase: 'idle', message: '' },
      token: '',
    });
  });

  it('初始状态正确', () => {
    const state = useAppStore.getState();
    expect(state.query).toBe('');
    expect(state.results).toEqual([]);
    expect(state.loading.phase).toBe('idle');
    expect(state.token).toBe('');
  });

  it('setQuery 更新查询文本', () => {
    useAppStore.getState().setQuery('rust logging');
    expect(useAppStore.getState().query).toBe('rust logging');
  });

  it('setQuery 处理空字符串', () => {
    useAppStore.getState().setQuery('');
    expect(useAppStore.getState().query).toBe('');
  });

  it('setQuery 处理特殊字符', () => {
    useAppStore.getState().setQuery('C++ 网络库 🔍');
    expect(useAppStore.getState().query).toBe('C++ 网络库 🔍');
  });

  it('setSearchResults 更新结果并设置 loading 为 done', () => {
    useAppStore.getState().setLoading({ phase: 'searching', message: '搜索中...' });
    useAppStore.getState().setSearchResults([mockProject]);

    const state = useAppStore.getState();
    expect(state.results).toHaveLength(1);
    expect(state.results[0].repo.fullName).toBe('test/test-repo');
    expect(state.loading.phase).toBe('done');
  });

  it('setSearchResults 处理空结果', () => {
    useAppStore.getState().setSearchResults([]);
    const state = useAppStore.getState();
    expect(state.results).toHaveLength(0);
    expect(state.loading.phase).toBe('done');
  });

  it('setSearchResults 处理大量结果', () => {
    const manyResults = Array.from({ length: 100 }, (_, i) => ({
      ...mockProject,
      repo: { ...mockProject.repo, fullName: `test/repo-${i}`, stargazersCount: i * 100 },
      totalScore: 50 + (i % 50),
    }));
    useAppStore.getState().setSearchResults(manyResults);
    expect(useAppStore.getState().results).toHaveLength(100);
  });

  it('setLoading 更新加载状态', () => {
    useAppStore.getState().setLoading({ phase: 'searching', message: '正在搜索...' });
    expect(useAppStore.getState().loading.phase).toBe('searching');
    expect(useAppStore.getState().loading.message).toBe('正在搜索...');
  });

  it('setLoading 部分更新保留其他字段', () => {
    useAppStore.getState().setLoading({ phase: 'evaluating', message: '评估中...' });
    useAppStore.getState().setLoading({ message: '更新消息' });
    const state = useAppStore.getState();
    expect(state.loading.phase).toBe('evaluating');
    expect(state.loading.message).toBe('更新消息');
  });

  it('setLoading 所有阶段转换', () => {
    const phases: Array<['idle' | 'searching' | 'evaluating' | 'done' | 'error', string]> = [
      ['searching', '正在搜索 GitHub 项目...'],
      ['evaluating', '正在评估项目...'],
      ['done', ''],
      ['error', '搜索失败'],
      ['idle', ''],
    ];

    for (const [phase, message] of phases) {
      useAppStore.getState().setLoading({ phase, message });
      expect(useAppStore.getState().loading.phase).toBe(phase);
      expect(useAppStore.getState().loading.message).toBe(message);
    }
  });

  it('setToken 更新 token', () => {
    useAppStore.getState().setToken('ghp_test123');
    expect(useAppStore.getState().token).toBe('ghp_test123');
  });

  it('setToken 处理空 token', () => {
    useAppStore.getState().setToken('ghp_test123');
    useAppStore.getState().setToken('');
    expect(useAppStore.getState().token).toBe('');
  });

  it('连续操作状态一致性', () => {
    useAppStore.getState().setQuery('rust');
    useAppStore.getState().setLoading({ phase: 'searching', message: '搜索中' });
    useAppStore.getState().setSearchResults([mockProject]);

    const state = useAppStore.getState();
    expect(state.query).toBe('rust');
    expect(state.results).toHaveLength(1);
    expect(state.loading.phase).toBe('done');
  });
});
