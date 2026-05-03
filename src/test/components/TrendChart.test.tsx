import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import TrendChart from '../../components/TrendChart';
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
    dimensions: [],
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

describe('TrendChart', () => {
  it('空项目列表正常渲染', () => {
    const html = renderToString(<TrendChart projects={[]} />);
    expect(html).toContain('评分分布统计');
    expect(html).toContain('平均分');
    expect(html).toContain('个项目');
  });

  it('单个 S 级项目渲染', () => {
    const html = renderToString(
      <TrendChart projects={[makeProject({ totalScore: 90, grade: 'S' })]} />
    );
    expect(html).toContain('S 级');
    expect(html).toContain('A 级');
    expect(html).toContain('B 级');
    expect(html).toContain('未入选');
    expect(html).toContain('个项目');
  });

  it('多个不同等级项目渲染', () => {
    const projects = [
      makeProject({ totalScore: 90, grade: 'S', repo: { ...makeProject().repo, fullName: 'a/s' } }),
      makeProject({ totalScore: 80, grade: 'A', repo: { ...makeProject().repo, fullName: 'b/a' } }),
      makeProject({ totalScore: 75, grade: 'B', repo: { ...makeProject().repo, fullName: 'c/b' } }),
      makeProject({ totalScore: 70, grade: 'X', repo: { ...makeProject().repo, fullName: 'd/x' } }),
    ];
    const html = renderToString(<TrendChart projects={projects} />);
    expect(html).toContain('轨道分布');
    expect(html).toContain('S 级');
  });

  it('渲染 SVG 柱状图', () => {
    const html = renderToString(
      <TrendChart projects={[makeProject()]} />
    );
    expect(html).toContain('<svg');
    expect(html).toContain('<rect');
  });

  it('不同轨道项目渲染', () => {
    const projects = [
      makeProject({ track: 'neglected', repo: { ...makeProject().repo, fullName: 'a/n' } }),
      makeProject({ track: 'high-star', repo: { ...makeProject().repo, fullName: 'b/h' } }),
      makeProject({ track: 'steady', repo: { ...makeProject().repo, fullName: 'c/s' } }),
    ];
    const html = renderToString(<TrendChart projects={projects} />);
    expect(html).toContain('被忽视');
    expect(html).toContain('高星');
    expect(html).toContain('稳态');
  });

  it('计算并显示平均分', () => {
    const projects = [
      makeProject({ totalScore: 100, repo: { ...makeProject().repo, fullName: 'a/100' } }),
      makeProject({ totalScore: 80, repo: { ...makeProject().repo, fullName: 'b/80' } }),
    ];
    const html = renderToString(<TrendChart projects={projects} />);
    expect(html).toContain('90.0');
  });
});
