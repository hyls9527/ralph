import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import ResultCard from '../../components/ResultCard';
import type { ProjectRecommendation } from '../../types';

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

vi.mock('../../i18n', () => {
  const mockT = (key: string) => {
    const map: Record<string, string> = {
      detail: '详情',
      favorite: '收藏',
      unfavorite: '取消收藏',
      share: '分享',
      report: '报告',
      generateReport: '生成报告',
      trackNeglected: '被忽视',
      trackHighStar: '高星',
      trackSteady: '稳态',
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
    },
    vetoFlags: [],
    recommendationIndex: 129.0,
    confidenceTier: 'tier1-core',
    decisionTrail: [],
    ...overrides,
  };
}

describe('ResultCard', () => {
  it('渲染项目名称', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('test/repo');
  });

  it('渲染项目描述', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('A test repository');
  });

  it('渲染 Star 数量', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('1.5k');
  });

  it('渲染 Fork 数量', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('200');
  });

  it('渲染编程语言', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('Rust');
  });

  it('渲染等级 S', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ grade: 'S' })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('S');
  });

  it('渲染等级 A', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ grade: 'A' })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('A');
  });

  it('渲染等级 B', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ grade: 'B' })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('B');
  });

  it('渲染等级 X', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ grade: 'X' })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('X');
  });

  it('渲染总分', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ totalScore: 86 })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('86');
  });

  it('渲染推荐指数', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ recommendationIndex: 129.0 })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('129.0');
  });

  it('渲染轨道标签 neglected', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ track: 'neglected' })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('被忽视');
  });

  it('渲染轨道标签 high-star', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ track: 'high-star' })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('高星');
  });

  it('渲染轨道标签 steady', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ track: 'steady' })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('稳态');
  });

  it('渲染信任徽章', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('Ralph 推荐');
  });

  it('渲染置信度徽章', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ evidenceLevel: 'L1' })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('L1');
  });

  it('渲染雷达图 SVG', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('<svg');
  });

  it('渲染详情按钮', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('详情');
  });

  it('已收藏时显示填充星标', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} isFavorite={true} onFavoriteToggle={vi.fn()} />
    );
    expect(html).toContain('text-amber-400');
  });

  it('未收藏时显示空心星标', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} isFavorite={false} onFavoriteToggle={vi.fn()} />
    );
    expect(html).toContain('text-gray-400');
  });

  it('有防博弈警告时渲染警告区域', () => {
    const html = renderToString(
      <ResultCard
        project={makeProject({ vetoFlags: ['star-inflation', 'review-manipulation'] })}
        onDetailClick={vi.fn()}
      />
    );
    expect(html).toContain('防博弈警告');
  });

  it('无防博弈警告时不渲染警告区域', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ vetoFlags: [] })} onDetailClick={vi.fn()} />
    );
    expect(html).not.toContain('防博弈警告');
  });

  it('neglected 轨道显示忽视指数', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ track: 'neglected', neglectIndex: 15.5 })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('忽视');
    expect(html).toContain('15.5');
  });

  it('high-star 轨道显示价值密度', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ track: 'high-star', valueDensity: 0.75 })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('价值密度');
    expect(html).toContain('0.75');
  });

  it('steady 轨道显示稳态系数', () => {
    const html = renderToString(
      <ResultCard project={makeProject({ track: 'steady', steadyState: 0.55 })} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('稳态');
    expect(html).toContain('0.55');
  });

  it('有子分数时渲染下钻区域', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('子分数');
  });

  it('渲染分享报告组件', () => {
    const html = renderToString(
      <ResultCard project={makeProject()} onDetailClick={vi.fn()} />
    );
    expect(html).toContain('报告');
  });
});
