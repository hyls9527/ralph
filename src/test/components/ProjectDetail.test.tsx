import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import ProjectDetail from '../../components/ProjectDetail';
import type { ProjectRecommendation } from '../../types';

function makeProject(
  overrides: Partial<ProjectRecommendation> = {},
): ProjectRecommendation {
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
      l1: {
        status: 'recommended',
        icon: '✓',
        label: 'Ralph 推荐',
        color: 'emerald',
      },
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
      projectDetail: '项目详情',
      close: '关闭',
      noEvaluationHistory: '暂无评估历史',
      neglected: '被忽视',
      highStar: '高星',
      steady: '稳态',
    };
    return map[key] || key;
  },
}));

vi.mock('../../services/tauri', () => ({
  tauri: {
    getEvaluationHistory: vi.fn().mockResolvedValue([]),
  },
}));

describe('ProjectDetail', () => {
  it('渲染项目名称', () => {
    const html = renderToString(
      <ProjectDetail project={makeProject()} onClose={vi.fn()} />,
    );
    expect(html).toContain('test/repo');
  });

  it('渲染项目描述', () => {
    const html = renderToString(
      <ProjectDetail project={makeProject()} onClose={vi.fn()} />,
    );
    expect(html).toContain('A test repo');
  });

  it('渲染关闭按钮', () => {
    const html = renderToString(
      <ProjectDetail project={makeProject()} onClose={vi.fn()} />,
    );
    expect(html).toContain('<button');
  });

  it('渲染 SVG 图标', () => {
    const html = renderToString(
      <ProjectDetail project={makeProject()} onClose={vi.fn()} />,
    );
    expect(html).toContain('<svg');
  });

  it('渲染评分信息', () => {
    const html = renderToString(
      <ProjectDetail project={makeProject()} onClose={vi.fn()} />,
    );
    expect(html).toContain('85');
  });

  it('渲染等级信息', () => {
    const html = renderToString(
      <ProjectDetail project={makeProject({ grade: 'S' })} onClose={vi.fn()} />,
    );
    expect(html).toContain('S');
  });

  it('渲染轨道信息', () => {
    const html = renderToString(
      <ProjectDetail
        project={makeProject({ track: 'neglected' })}
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('被忽视');
  });

  it('渲染评估历史区域', () => {
    const html = renderToString(
      <ProjectDetail project={makeProject()} onClose={vi.fn()} />,
    );
    expect(html).toContain('historyTrend');
  });

  it('组件渲染不崩溃', () => {
    expect(() =>
      renderToString(
        <ProjectDetail project={makeProject()} onClose={vi.fn()} />,
      ),
    ).not.toThrow();
  });
});
