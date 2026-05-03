import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import TrendingDiscovery from '../../components/TrendingDiscovery';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('../../services/tauri', () => ({
  tauri: {
    getTrending: vi.fn().mockResolvedValue([]),
    getDiscoveryStatus: vi.fn().mockResolvedValue({ running: false, discoveriesCount: 0 }),
    getDiscoveryResults: vi.fn().mockResolvedValue([]),
    getDiscoveryConfig: vi.fn().mockResolvedValue({
      topics: [],
      languages: [],
      minStars: 10,
      maxStars: 500,
      minScore: 73,
      intervalMinutes: 60,
      maxPerRound: 5,
    }),
    startDiscovery: vi.fn().mockResolvedValue(undefined),
    stopDiscovery: vi.fn().mockResolvedValue(undefined),
    updateDiscoveryConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      trendingTitle: '趋势发现',
      trendingFetch: '加载趋势',
      trendingHint: '点击加载趋势按钮获取热门项目',
      language: '语言',
      loading: '加载中...',
      noDescription: '暂无描述',
      evaluateShort: '评估',
      startDiscovery: '开始发现',
      stopDiscovery: '停止发现',
      settings: '设置',
      neglected: '被忽视',
      highStar: '高星',
      steady: '稳态',
    };
    return map[key] || key;
  },
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifyDiscovery: vi.fn(),
    requestPermission: vi.fn(),
    permission: 'granted',
  }),
}));

describe('TrendingDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染趋势和发现标签', () => {
    const html = renderToString(
      <TrendingDiscovery onEvaluateProject={vi.fn()} />
    );
    expect(html).toContain('趋势发现');
    expect(html).toContain('Trending');
    expect(html).toContain('Discovery');
  });

  it('渲染语言筛选按钮', () => {
    const html = renderToString(
      <TrendingDiscovery onEvaluateProject={vi.fn()} />
    );
    expect(html).toContain('All');
    expect(html).toContain('Rust');
  });

  it('渲染加载趋势按钮', () => {
    const html = renderToString(
      <TrendingDiscovery onEvaluateProject={vi.fn()} />
    );
    expect(html).toContain('加载趋势');
  });

  it('组件渲染不崩溃', () => {
    expect(() =>
      renderToString(<TrendingDiscovery onEvaluateProject={vi.fn()} />)
    ).not.toThrow();
  });
});
