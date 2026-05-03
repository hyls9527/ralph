import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import ComparisonPanel from '../../components/ComparisonPanel';
import type { ProjectRecommendation } from '../../types';

function makeProject(overrides: Partial<ProjectRecommendation> = {}): ProjectRecommendation {
  return {
    repo: {
      owner: 'test',
      name: 'repo',
      fullName: 'test/repo',
      htmlUrl: 'https://github.com/test/repo',
      description: 'A test repo',
      stargazersCount: 100,
      language: 'Rust',
      updatedAt: '2024-01-01T00:00:00Z',
      createdAt: '2023-01-01T00:00:00Z',
      pushedAt: '2024-01-01T00:00:00Z',
      topics: [],
      license: { spdxId: 'MIT', name: 'MIT License' },
      forksCount: 10,
      openIssuesCount: 5,
      size: 1000,
      hasWiki: true,
      hasIssuesEnabled: true,
    },
    totalScore: 85,
    grade: 'S',
    track: 'neglected',
    neglectIndex: 5.0,
    recommendationIndex: 0.92,
    evidenceLevel: 'L1',
    dimensions: [
      { dimension: '质量', score: 18, maxScore: 20, subScores: [] },
      { dimension: '维护', score: 15, maxScore: 20, subScores: [] },
      { dimension: '实用', score: 16, maxScore: 20, subScores: [] },
      { dimension: '文档', score: 14, maxScore: 15, subScores: [] },
      { dimension: '社区', score: 12, maxScore: 15, subScores: [] },
      { dimension: '安全', score: 10, maxScore: 15, subScores: [] },
    ],
    trustBadge: {
      level: 2,
      l1: { status: 'recommended', icon: '✓', label: 'Ralph 推荐', color: 'emerald' },
    },
    vetoFlags: [],
    gateChecks: [],
    oneLiner: 'test-repo | S级推荐',
    confidenceTier: 'tier1-core',
    decisionTrail: [],
    ...overrides,
  };
}

vi.mock('../../i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      comparison: '对比',
      exitComparison: '退出对比',
      neglected: '被忽视',
      highStar: '高星',
      steady: '稳态',
    };
    return map[key] || key;
  },
}));

describe('ComparisonPanel', () => {
  it('单个项目渲染', () => {
    const html = renderToString(
      <ComparisonPanel projects={[makeProject()]} onExit={vi.fn()} />
    );
    expect(html).toContain('repo');
  });

  it('两个项目对比渲染', () => {
    const projects = [
      makeProject({ repo: { ...makeProject().repo, name: 'proj1', fullName: 'a/proj1' } }),
      makeProject({ repo: { ...makeProject().repo, name: 'proj2', fullName: 'b/proj2' } }),
    ];
    const html = renderToString(
      <ComparisonPanel projects={projects} onExit={vi.fn()} />
    );
    expect(html).toContain('proj1');
    expect(html).toContain('proj2');
  });

  it('渲染退出按钮', () => {
    const html = renderToString(
      <ComparisonPanel projects={[makeProject()]} onExit={vi.fn()} />
    );
    expect(html).toContain('<button');
  });

  it('两个项目时渲染雷达图 SVG', () => {
    const projects = [
      makeProject({ repo: { ...makeProject().repo, name: 'p1', fullName: 'a/p1' } }),
      makeProject({ repo: { ...makeProject().repo, name: 'p2', fullName: 'b/p2' } }),
    ];
    const html = renderToString(
      <ComparisonPanel projects={projects} onExit={vi.fn()} />
    );
    expect(html).toContain('<svg');
  });

  it('渲染维度对比信息', () => {
    const html = renderToString(
      <ComparisonPanel projects={[makeProject()]} onExit={vi.fn()} />
    );
    expect(html).toContain('质量');
    expect(html).toContain('维护');
  });

  it('组件渲染不崩溃', () => {
    expect(() =>
      renderToString(
        <ComparisonPanel projects={[makeProject()]} onExit={vi.fn()} />
      )
    ).not.toThrow();
  });
});
