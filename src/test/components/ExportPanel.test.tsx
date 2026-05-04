import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import ExportPanel from '../../components/ExportPanel';
import type { ProjectRecommendation } from '../../types';

vi.mock('../../i18n', () => {
  const mockT = (key: string) => {
    const map: Record<string, string> = {
      ralphReport: 'Ralph 评估报告',
      generatedAt: '生成时间',
      projectCount: '项目数量',
      descriptionLabel: '描述',
      noneValue: '无',
      language: '语言',
      totalScoreLabel: '总分',
      grade: '等级',
      gradeSuffix: '级',
      trackLabel: '轨道',
      recommendationIndex: '推荐指数',
      evidenceLevel: '证据等级',
      oneLinerLabel: '一句话推荐',
      dimensions: '维度评分',
      dimension: '维度',
      scoreLabel: '得分',
      maxScoreLabel: '满分',
      achievementRate: '得分率',
      subScoreDetails: '子项得分',
      jsonExport: '导出 JSON',
      mdExport: '导出 Markdown',
    };
    return map[key] || key;
  };
  return {
    t: mockT,
    useI18n: () => ({ t: mockT, lang: 'zh', switchLang: vi.fn() }),
  };
});

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
    gateChecks: [],
    track: 'high-star',
    neglectIndex: 2.5,
    valueDensity: 0.75,
    steadyState: 0.55,
    dimensions: [
      { dimension: '质量', score: 18, maxScore: 20, subScores: [['测试', 5, 5]] },
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
    },
    vetoFlags: [],
    recommendationIndex: 129.0,
    confidenceTier: 'tier1-core',
    decisionTrail: [],
    ...overrides,
  };
}

describe('ExportPanel', () => {
  it('无项目时返回 null', () => {
    const html = renderToString(<ExportPanel projects={[]} />);
    expect(html).toBe('');
  });

  it('有项目时渲染导出按钮', () => {
    const html = renderToString(
      <ExportPanel projects={[makeProject()]} />
    );
    expect(html).toContain('导出 JSON');
    expect(html).toContain('导出 Markdown');
  });

  it('多个项目时渲染导出按钮', () => {
    const html = renderToString(
      <ExportPanel projects={[makeProject(), makeProject({ repo: { ...makeProject().repo, fullName: 'other/repo' } })]} />
    );
    expect(html).toContain('导出 JSON');
    expect(html).toContain('导出 Markdown');
  });
});
