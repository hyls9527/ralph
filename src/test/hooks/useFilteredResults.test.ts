import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../stores/useAppStore';
import { useFilterStore } from '../../stores/slices/filterSlice';
import { useUiStore } from '../../stores/slices/uiSlice';
import {
  applyDimensionWeights,
  filterAndSort,
  paginate,
  extractLanguages,
} from '../../lib/filter-utils';
import type { ProjectRecommendation, DimensionWeights } from '../../types';

function createMockProject(
  overrides: Partial<ProjectRecommendation> = {},
): ProjectRecommendation {
  return {
    repo: {
      owner: 'test',
      name: 'repo',
      fullName: 'test/repo',
      htmlUrl: '',
      description: null,
      stargazersCount: 100,
      forksCount: 10,
      openIssuesCount: 5,
      language: 'Rust',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2024-12-01T00:00:00Z',
      pushedAt: '2024-12-01T00:00:00Z',
      license: null,
      size: 5000,
      hasWiki: false,
      hasIssuesEnabled: false,
      topics: [],
    },
    gateChecks: [],
    track: 'steady',
    neglectIndex: 3.0,
    dimensions: [
      { dimension: '质量', score: 15, maxScore: 20, subScores: [] },
      { dimension: '维护', score: 10, maxScore: 15, subScores: [] },
      { dimension: '实用', score: 20, maxScore: 25, subScores: [] },
      { dimension: '文档', score: 10, maxScore: 15, subScores: [] },
      { dimension: '社区', score: 7, maxScore: 10, subScores: [] },
      { dimension: '安全', score: 15, maxScore: 20, subScores: [] },
    ],
    totalScore: 77,
    grade: 'B',
    oneLiner: '',
    evidenceLevel: 'L1',
    trustBadge: {
      level: 2,
      l1: { status: 'recommended', icon: '✓', label: '推荐', color: 'emerald' },
    },
    vetoFlags: [],
    recommendationIndex: 38.5,
    confidenceTier: 'tier1-core',
    decisionTrail: [],
    ...overrides,
  };
}

type PartialProject = Partial<Omit<ProjectRecommendation, 'repo'>> & {
  repo?: Partial<ProjectRecommendation['repo']>;
};

function makeProject(
  name: string,
  opts: PartialProject = {},
): ProjectRecommendation {
  const base = createMockProject();
  return {
    ...base,
    ...opts,
    repo: { ...base.repo, ...(opts.repo || {}), fullName: name },
  };
}

function getFilterCriteria() {
  const f = useFilterStore.getState();
  return {
    trackFilter: f.trackFilter,
    languageFilter: f.languageFilter,
    minScore: f.minScore,
    minStars: f.minStars,
    sortBy: f.sortBy,
    sortOrder: f.sortOrder,
  };
}

describe('useFilteredResults 纯函数测试', () => {
  beforeEach(() => {
    useAppStore.setState({
      results: [],
      loading: { phase: 'idle', message: '' },
      query: '',
      token: '',
    });
    useFilterStore.getState().resetFilters();
    useUiStore.setState({ currentPage: 1 });
  });

  describe('filterAndSort - 基础过滤', () => {
    it('无结果时返回空列表', () => {
      const result = filterAndSort([], getFilterCriteria());
      expect(result).toEqual([]);
    });

    it('返回所有结果（无过滤条件）', () => {
      const projects = [makeProject('test/repo1'), makeProject('test/repo2')];
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result).toHaveLength(2);
    });
  });

  describe('filterAndSort - 轨道过滤', () => {
    const projects = [
      makeProject('neglected/repo', { track: 'neglected' }),
      makeProject('highstar/repo', { track: 'high-star' }),
      makeProject('steady/repo', { track: 'steady' }),
    ];

    it('过滤 neglected 轨道', () => {
      useFilterStore.getState().setTrackFilter('neglected');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result).toHaveLength(1);
      expect(result[0].track).toBe('neglected');
    });

    it('过滤 high-star 轨道', () => {
      useFilterStore.getState().setTrackFilter('high-star');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result).toHaveLength(1);
      expect(result[0].track).toBe('high-star');
    });

    it('过滤 steady 轨道', () => {
      useFilterStore.getState().setTrackFilter('steady');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result).toHaveLength(1);
      expect(result[0].track).toBe('steady');
    });

    it('all 轨道返回全部', () => {
      useFilterStore.getState().setTrackFilter('all');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result).toHaveLength(3);
    });
  });

  describe('filterAndSort - 语言过滤', () => {
    it('按语言过滤', () => {
      const projects = [
        makeProject('rust/repo', { repo: { language: 'Rust' } }),
        makeProject('python/repo', { repo: { language: 'Python' } }),
      ];
      useFilterStore.getState().setLanguageFilter('Rust');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result).toHaveLength(1);
      expect(result[0].repo.language).toBe('Rust');
    });
  });

  describe('filterAndSort - 最低分数过滤', () => {
    it('按最低分数过滤', () => {
      const projects = [
        makeProject('high/repo', { totalScore: 90 }),
        makeProject('low/repo', { totalScore: 60 }),
      ];
      useFilterStore.getState().setMinScore(80);
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result).toHaveLength(1);
      expect(result[0].totalScore).toBe(90);
    });
  });

  describe('filterAndSort - 最低星数过滤', () => {
    it('按最低星数过滤', () => {
      const projects = [
        makeProject('popular/repo', { repo: { stargazersCount: 5000 } }),
        makeProject('unpopular/repo', { repo: { stargazersCount: 50 } }),
      ];
      useFilterStore.getState().setMinStars(1000);
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result).toHaveLength(1);
      expect(result[0].repo.stargazersCount).toBe(5000);
    });
  });

  describe('filterAndSort - 排序', () => {
    const projects = [
      makeProject('a/repo', {
        totalScore: 60,
        recommendationIndex: 30,
        repo: { stargazersCount: 5000, updatedAt: '2024-01-01T00:00:00Z' },
      }),
      makeProject('b/repo', {
        totalScore: 90,
        recommendationIndex: 135,
        repo: { stargazersCount: 1000, updatedAt: '2024-12-01T00:00:00Z' },
      }),
      makeProject('c/repo', {
        totalScore: 75,
        recommendationIndex: 60,
        repo: { stargazersCount: 500, updatedAt: '2024-06-01T00:00:00Z' },
      }),
    ];

    it('按分数降序排序', () => {
      useFilterStore.getState().setSortBy('score');
      useFilterStore.getState().setSortOrder('desc');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result[0].totalScore).toBe(90);
      expect(result[2].totalScore).toBe(60);
    });

    it('按分数升序排序', () => {
      useFilterStore.getState().setSortBy('score');
      useFilterStore.getState().setSortOrder('asc');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result[0].totalScore).toBe(60);
      expect(result[2].totalScore).toBe(90);
    });

    it('按星数降序排序', () => {
      useFilterStore.getState().setSortBy('stars');
      useFilterStore.getState().setSortOrder('desc');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result[0].repo.stargazersCount).toBe(5000);
    });

    it('按推荐指数降序排序', () => {
      useFilterStore.getState().setSortBy('recommendationIndex');
      useFilterStore.getState().setSortOrder('desc');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result[0].recommendationIndex).toBe(135);
    });

    it('按更新时间降序排序', () => {
      useFilterStore.getState().setSortBy('updatedAt');
      useFilterStore.getState().setSortOrder('desc');
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result[0].repo.updatedAt).toBe('2024-12-01T00:00:00Z');
    });
  });

  describe('filterAndSort - 组合过滤', () => {
    it('同时应用轨道和最低分数过滤', () => {
      const projects = [
        makeProject('n1/repo', { track: 'neglected', totalScore: 90 }),
        makeProject('n2/repo', { track: 'neglected', totalScore: 60 }),
        makeProject('h1/repo', { track: 'high-star', totalScore: 85 }),
      ];
      useFilterStore.getState().setTrackFilter('neglected');
      useFilterStore.getState().setMinScore(80);
      const result = filterAndSort(projects, getFilterCriteria());
      expect(result).toHaveLength(1);
      expect(result[0].track).toBe('neglected');
      expect(result[0].totalScore).toBe(90);
    });
  });

  describe('paginate', () => {
    it('分页计算正确', () => {
      const projects = Array.from({ length: 25 }, (_, i) =>
        makeProject(`test/repo-${i}`),
      );
      const { totalResults, totalPages, hasNextPage, hasPrevPage } = paginate(
        projects,
        1,
      );
      expect(totalResults).toBe(25);
      expect(totalPages).toBe(3);
      expect(hasNextPage).toBe(true);
      expect(hasPrevPage).toBe(false);
    });

    it('第一页返回10条', () => {
      const projects = Array.from({ length: 25 }, (_, i) =>
        makeProject(`test/repo-${i}`),
      );
      const { paginatedResults } = paginate(projects, 1);
      expect(paginatedResults).toHaveLength(10);
    });

    it('最后一页返回剩余条目', () => {
      const projects = Array.from({ length: 25 }, (_, i) =>
        makeProject(`test/repo-${i}`),
      );
      const { paginatedResults } = paginate(projects, 3);
      expect(paginatedResults).toHaveLength(5);
    });

    it('单页时无上下页', () => {
      const projects = [makeProject('only/repo')];
      const { totalPages, hasNextPage, hasPrevPage } = paginate(projects, 1);
      expect(totalPages).toBe(1);
      expect(hasNextPage).toBe(false);
      expect(hasPrevPage).toBe(false);
    });

    it('超出范围页码自动修正', () => {
      const projects = Array.from({ length: 5 }, (_, i) =>
        makeProject(`test/repo-${i}`),
      );
      const { currentPage, paginatedResults } = paginate(projects, 99);
      expect(currentPage).toBe(1);
      expect(paginatedResults).toHaveLength(5);
    });
  });

  describe('extractLanguages', () => {
    it('提取所有唯一语言', () => {
      const projects = [
        makeProject('r1', {
          repo: { ...createMockProject().repo, language: 'Rust' },
        }),
        makeProject('r2', {
          repo: { ...createMockProject().repo, language: 'Python' },
        }),
        makeProject('r3', {
          repo: { ...createMockProject().repo, language: 'Rust' },
        }),
        makeProject('r4', {
          repo: { ...createMockProject().repo, language: null },
        }),
      ];
      const languages = extractLanguages(projects);
      expect(languages).toContain('Rust');
      expect(languages).toContain('Python');
      expect(languages).toHaveLength(2);
    });

    it('无结果时返回空数组', () => {
      expect(extractLanguages([])).toEqual([]);
    });
  });

  describe('applyDimensionWeights', () => {
    it('应用自定义权重重新评分', () => {
      const project = createMockProject({
        dimensions: [
          { dimension: '质量', score: 20, maxScore: 20, subScores: [] },
          { dimension: '维护', score: 0, maxScore: 15, subScores: [] },
          { dimension: '实用', score: 0, maxScore: 25, subScores: [] },
          { dimension: '文档', score: 0, maxScore: 15, subScores: [] },
          { dimension: '社区', score: 0, maxScore: 10, subScores: [] },
          { dimension: '安全', score: 0, maxScore: 20, subScores: [] },
        ],
      });
      const weights: DimensionWeights = {
        quality: 100,
        maintenance: 0,
        practical: 0,
        documentation: 0,
        community: 0,
        security: 0,
      };
      const result = applyDimensionWeights([project], weights);
      expect(result[0].weightedScore).toBe(100);
    });

    it('权重为零时返回原始结果', () => {
      const project = createMockProject();
      const weights: DimensionWeights = {
        quality: 0,
        maintenance: 0,
        practical: 0,
        documentation: 0,
        community: 0,
        security: 0,
      };
      const result = applyDimensionWeights([project], weights);
      expect(result[0].weightedScore).toBeUndefined();
    });

    it('无 dimensionWeights 时返回原始结果', () => {
      const project = createMockProject();
      const result = applyDimensionWeights([project], {
        quality: 0,
        maintenance: 0,
        practical: 0,
        documentation: 0,
        community: 0,
        security: 0,
      });
      expect(result[0]).toEqual(project);
    });
  });
});
