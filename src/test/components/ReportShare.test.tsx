import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ReportShare from '../../components/ReportShare';
import type { ProjectRecommendation } from '../../types';

function makeProject(overrides: Partial<ProjectRecommendation> = {}): ProjectRecommendation {
  return {
    repo: {
      owner: 'test',
      name: 'repo',
      fullName: 'test/repo',
      htmlUrl: 'https://github.com/test/repo',
      description: 'A test repository',
      stargazersCount: 1500,
      forksCount: 200,
      openIssuesCount: 15,
      language: 'Rust',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2024-12-01T00:00:00Z',
      pushedAt: '2024-12-01T00:00:00Z',
      license: { spdxId: 'MIT', name: 'MIT License' },
      size: 5000,
      hasWiki: true,
      hasIssuesEnabled: true,
      topics: ['rust', 'cli'],
    },
    gateChecks: [
      { gate: 'G1', passed: true, reason: null, evidenceLevel: 'L1' },
      { gate: 'G2', passed: true, reason: null, evidenceLevel: 'L1' },
    ],
    track: 'high-star',
    neglectIndex: 2.5,
    valueDensity: 0.75,
    steadyState: 0.55,
    dimensions: [
      { dimension: '质量', score: 18, maxScore: 20, subScores: [['测试', 5, 5], ['覆盖率', 4, 5]] },
      { dimension: '维护', score: 12, maxScore: 15, subScores: [] },
      { dimension: '实用', score: 22, maxScore: 25, subScores: [] },
      { dimension: '文档', score: 10, maxScore: 15, subScores: [] },
      { dimension: '社区', score: 8, maxScore: 10, subScores: [] },
      { dimension: '安全', score: 16, maxScore: 20, subScores: [] },
    ],
    totalScore: 86,
    grade: 'S',
    oneLiner: 'test-repo | S级推荐',
    evidenceLevel: 'L1',
    trustBadge: {
      level: 2,
      l1: { status: 'recommended', icon: '✓', label: 'Ralph 推荐', color: 'emerald' },
      l2: {
        gateChecks: [],
        evidenceSummary: '高质量项目',
        keyMetrics: {
          qualityScore: 90,
          maintenanceScore: 80,
          securityStatus: 'passed' as const,
        },
      },
    },
    vetoFlags: [],
    recommendationIndex: 129.0,
    confidenceTier: 'tier1-core',
    decisionTrail: [],
    ...overrides,
  };
}

describe('ReportShare', () => {
  it('渲染触发按钮', () => {
    const html = renderToString(<ReportShare project={makeProject()} />);
    expect(html).toContain('生成评估报告');
  });

  it('初始不显示模态框', () => {
    const html = renderToString(<ReportShare project={makeProject()} />);
    expect(html).not.toContain('评估报告 - test/repo');
  });

  it('模态框关闭时不渲染内容', () => {
    const html = renderToString(<ReportShare project={makeProject()} />);
    expect(html).not.toContain('复制到剪贴板');
    expect(html).not.toContain('导出 Markdown');
  });

  it('渲染 SVG 图标', () => {
    const html = renderToString(<ReportShare project={makeProject()} />);
    expect(html).toContain('<svg');
  });

  it('neglected 轨道项目正常渲染', () => {
    const html = renderToString(
      <ReportShare project={makeProject({ track: 'neglected' })} />
    );
    expect(html).toContain('生成评估报告');
  });

  it('steady 轨道项目正常渲染', () => {
    const html = renderToString(
      <ReportShare project={makeProject({ track: 'steady' })} />
    );
    expect(html).toContain('生成评估报告');
  });

  it('无描述项目正常渲染', () => {
    const project = makeProject();
    project.repo.description = '';
    const html = renderToString(<ReportShare project={project} />);
    expect(html).toContain('生成评估报告');
  });

  it('有否决标记项目正常渲染', () => {
    const html = renderToString(
      <ReportShare project={makeProject({ vetoFlags: ['存档项目'] })} />
    );
    expect(html).toContain('生成评估报告');
  });

  it('无 trustBadge 项目正常渲染', () => {
    const html = renderToString(
      <ReportShare project={makeProject({ trustBadge: undefined })} />
    );
    expect(html).toContain('生成评估报告');
  });
});
