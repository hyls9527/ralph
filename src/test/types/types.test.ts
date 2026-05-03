import { describe, it, expect } from 'vitest';
import {
  ProjectRecommendation,
  TrustBadge,
  LoadingState,
  DimensionWeights,
  defaultDimensionWeights,
} from '../../types';

describe('类型定义验证', () => {
  describe('ProjectRecommendation', () => {
    it('完整对象符合类型', () => {
      const project: ProjectRecommendation = {
        repo: {
          owner: 'test',
          name: 'repo',
          fullName: 'test/repo',
          htmlUrl: 'https://github.com/test/repo',
          description: 'A test repo',
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
        ],
        track: 'high-star',
        neglectIndex: 2.0,
        valueDensity: 0.8,
        steadyState: 0.6,
        dimensions: [
          { dimension: '质量', score: 18, maxScore: 20, subScores: [['测试', 5, 5]] },
        ],
        totalScore: 86,
        grade: 'S',
        oneLiner: 'test-repo | S级推荐',
        evidenceLevel: 'L1',
        trustBadge: {
          level: 2,
          l1: { status: 'recommended', icon: '✓', label: 'Ralph 推荐', color: 'emerald' },
        },
        vetoFlags: [],
        recommendationIndex: 129.0,
        confidenceTier: 'tier1-core',
        decisionTrail: [],
      };

      expect(project.repo.fullName).toBe('test/repo');
      expect(project.track).toBe('high-star');
      expect(project.grade).toBe('S');
    });

    it('可选字段可以为 null/undefined', () => {
      const project: ProjectRecommendation = {
        repo: {
          owner: 'test', name: 'repo', fullName: 'test/repo', htmlUrl: '',
          description: null, stargazersCount: 0, forksCount: 0, openIssuesCount: 0,
          language: null, createdAt: '', updatedAt: '', pushedAt: '',
          license: null, size: 0, hasWiki: false, hasIssuesEnabled: false, topics: [],
        },
        gateChecks: [],
        track: 'steady',
        neglectIndex: 0,
        dimensions: [],
        totalScore: 0,
        grade: 'X',
        oneLiner: '',
        evidenceLevel: 'L5',
        trustBadge: {
          level: 1,
          l1: { status: 'not-recommended', icon: '✗', label: '不推荐', color: 'rose' },
        },
        vetoFlags: [],
        recommendationIndex: 0,
        confidenceTier: 'tier3-full',
        decisionTrail: [],
      };

      expect(project.repo.description).toBeNull();
      expect(project.repo.language).toBeNull();
      expect(project.repo.license).toBeNull();
      expect(project.valueDensity).toBeUndefined();
      expect(project.steadyState).toBeUndefined();
    });
  });

  describe('TrustBadge', () => {
    it('L1 级别徽章', () => {
      const badge: TrustBadge = {
        level: 1,
        l1: { status: 'recommended', icon: '✓', label: 'Ralph 推荐', color: 'emerald' },
      };
      expect(badge.level).toBe(1);
      expect(badge.l2).toBeUndefined();
    });

    it('L2 级别徽章', () => {
      const badge: TrustBadge = {
        level: 2,
        l1: { status: 'caution', icon: '⚠', label: '需谨慎', color: 'amber' },
        l2: {
          gateChecks: [{ gate: 'G1', passed: true }],
          evidenceSummary: '评分 80/105',
          keyMetrics: {
            qualityScore: 18,
            maintenanceScore: 12,
            securityStatus: 'passed',
          },
        },
      };
      expect(badge.l2).toBeDefined();
      expect(badge.l2!.keyMetrics.securityStatus).toBe('passed');
    });

    it('所有状态值', () => {
      const statuses: TrustBadge['l1']['status'][] = ['recommended', 'caution', 'not-recommended'];
      const colors: TrustBadge['l1']['color'][] = ['emerald', 'amber', 'rose'];
      expect(statuses).toHaveLength(3);
      expect(colors).toHaveLength(3);
    });
  });

  describe('LoadingState', () => {
    it('所有阶段', () => {
      const phases: LoadingState['phase'][] = ['idle', 'searching', 'evaluating', 'done', 'error'];
      expect(phases).toHaveLength(5);
    });

    it('完整加载状态', () => {
      const loading: LoadingState = {
        phase: 'searching',
        message: '正在搜索...',
        progress: 50,
      };
      expect(loading.progress).toBe(50);
    });
  });

  describe('DimensionWeights', () => {
    it('默认权重总和为 105', () => {
      const total = Object.values(defaultDimensionWeights).reduce((a, b) => a + b, 0);
      expect(total).toBe(105);
    });

    it('所有维度都有默认权重', () => {
      const keys: (keyof DimensionWeights)[] = [
        'quality', 'maintenance', 'practical', 'documentation', 'community', 'security',
      ];
      for (const key of keys) {
        expect(defaultDimensionWeights[key]).toBeGreaterThan(0);
      }
    });

    it('权重值与维度满分一致', () => {
      expect(defaultDimensionWeights.quality).toBe(20);
      expect(defaultDimensionWeights.maintenance).toBe(15);
      expect(defaultDimensionWeights.practical).toBe(25);
      expect(defaultDimensionWeights.documentation).toBe(15);
      expect(defaultDimensionWeights.community).toBe(10);
      expect(defaultDimensionWeights.security).toBe(20);
    });
  });

  describe('轨道类型', () => {
    it('所有轨道值', () => {
      const tracks: ProjectRecommendation['track'][] = ['neglected', 'high-star', 'steady'];
      expect(tracks).toHaveLength(3);
    });
  });

  describe('等级类型', () => {
    it('所有等级值', () => {
      const grades: ProjectRecommendation['grade'][] = ['S', 'A', 'B', 'X'];
      expect(grades).toHaveLength(4);
    });
  });

  describe('置信层级', () => {
    it('所有置信层级', () => {
      const tiers: ProjectRecommendation['confidenceTier'][] = ['tier1-core', 'tier2-extended', 'tier3-full'];
      expect(tiers).toHaveLength(3);
    });
  });

  describe('证据等级', () => {
    it('所有证据等级', () => {
      const levels: ProjectRecommendation['evidenceLevel'][] = ['L1', 'L2', 'L3', 'L4', 'L5'];
      expect(levels).toHaveLength(5);
    });
  });
});
