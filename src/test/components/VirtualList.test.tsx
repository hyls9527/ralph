import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import VirtualList from '../../components/VirtualList';
import type { ProjectRecommendation } from '../../types';

vi.mock('../../i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      detail: '详情',
      share: '分享',
      report: '报告',
    };
    return map[key] || key;
  },
}));

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

describe('VirtualList', () => {
  it('空列表正常渲染', () => {
    const html = renderToString(
      <VirtualList
        items={[]}
        itemHeight={120}
        containerHeight={600}
        onDetailClick={vi.fn()}
      />
    );
    expect(html).toContain('overflow-y-auto');
  });

  it('单个项目渲染', () => {
    const html = renderToString(
      <VirtualList
        items={[makeProject()]}
        itemHeight={120}
        containerHeight={600}
        onDetailClick={vi.fn()}
      />
    );
    expect(html).toContain('test/repo');
  });

  it('多个项目渲染', () => {
    const items = [
      makeProject({ repo: { ...makeProject().repo, fullName: 'a/repo1' } }),
      makeProject({ repo: { ...makeProject().repo, fullName: 'b/repo2' } }),
      makeProject({ repo: { ...makeProject().repo, fullName: 'c/repo3' } }),
    ];
    const html = renderToString(
      <VirtualList
        items={items}
        itemHeight={120}
        containerHeight={600}
        onDetailClick={vi.fn()}
      />
    );
    expect(html).toContain('a/repo1');
    expect(html).toContain('b/repo2');
    expect(html).toContain('c/repo3');
  });

  it('使用指定容器高度', () => {
    const html = renderToString(
      <VirtualList
        items={[makeProject()]}
        itemHeight={120}
        containerHeight={400}
        onDetailClick={vi.fn()}
      />
    );
    expect(html).toContain('height:400px');
  });

  it('组件渲染不崩溃', () => {
    expect(() =>
      renderToString(
        <VirtualList
          items={[makeProject()]}
          itemHeight={120}
          containerHeight={600}
          onDetailClick={vi.fn()}
        />
      )
    ).not.toThrow();
  });
});
