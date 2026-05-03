import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PDFExport from '../../components/PDFExport';
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

vi.mock('../../i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      pdfReport: '导出 PDF',
      exportPdfTooltip: '导出 PDF',
      allowPopup: '请允许弹出窗口',
      ralphReport: 'Ralph 评估报告',
      neglected: '被忽视',
      highStar: '高星',
      steady: '稳态',
    };
    return map[key] || key;
  },
}));

describe('PDFExport', () => {
  it('空项目列表返回空内容', () => {
    const html = renderToString(<PDFExport projects={[]} query="" />);
    expect(html).toBe('');
  });

  it('有项目时渲染导出按钮', () => {
    const html = renderToString(
      <PDFExport projects={[makeProject()]} query="rust" />
    );
    expect(html).toContain('导出 PDF');
  });

  it('多个项目时渲染导出按钮', () => {
    const projects = [
      makeProject({ repo: { ...makeProject().repo, name: 'r1', fullName: 'a/r1' } }),
      makeProject({ repo: { ...makeProject().repo, name: 'r2', fullName: 'b/r2' } }),
    ];
    const html = renderToString(
      <PDFExport projects={projects} query="test" />
    );
    expect(html).toContain('导出 PDF');
  });

  it('组件渲染不崩溃', () => {
    expect(() =>
      renderToString(<PDFExport projects={[makeProject()]} query="test" />)
    ).not.toThrow();
  });
});
