import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StatsDashboard from '../../components/StatsDashboard';

vi.mock('../../services/tauri', () => ({
  tauri: {
    getStats: vi.fn(),
  },
}));

vi.mock('../../i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      totalEvaluated: '累计评估',
      avgScore: '平均分',
      topScore: '最高分',
      recent7d: '近7天',
      gradeDistribution: '等级分布',
      trackDistribution: '轨道分布',
      neglected: '被忽视',
      highStar: '高星',
      steady: '稳态',
      loadFailed: '加载失败',
      retry: '重试',
      noStatsData: '暂无统计数据',
      refresh: '刷新',
    };
    return map[key] || key;
  },
}));

import { tauri } from '../../services/tauri';
const mockedTauri = vi.mocked(tauri);

describe('StatsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染加载状态', async () => {
    mockedTauri.getStats.mockReturnValue(new Promise(() => {}));
    const { container } = render(<StatsDashboard />);
    expect(container.innerHTML).toContain('animate-spin');
  });

  it('渲染错误状态', async () => {
    mockedTauri.getStats.mockRejectedValue(new Error('fetch failed'));
    render(<StatsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeTruthy();
    });
    expect(screen.getByText('重试')).toBeTruthy();
  });

  it('渲染空数据状态', async () => {
    mockedTauri.getStats.mockResolvedValue({ total: 0, avgScore: 0, topScore: 0, recent7d: 0, favorites: 0, byGrade: [], byTrack: [] });
    render(<StatsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('暂无统计数据')).toBeTruthy();
    });
  });

  it('渲染统计数据', async () => {
    mockedTauri.getStats.mockResolvedValue({
      total: 100,
      avgScore: 72.5,
      topScore: 98,
      recent7d: 15,
      favorites: 12,
      byGrade: [
        { grade: 'S', count: 20 },
        { grade: 'A', count: 50 },
        { grade: 'B', count: 25 },
        { grade: 'X', count: 5 },
      ],
      byTrack: [
        { track: 'neglected', count: 40 },
        { track: 'high-star', count: 35 },
        { track: 'steady', count: 25 },
      ],
    });
    render(<StatsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('100')).toBeTruthy();
    });
    expect(screen.getByText('72.5')).toBeTruthy();
    expect(screen.getByText('98')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('累计评估')).toBeTruthy();
    expect(screen.getByText('等级分布')).toBeTruthy();
    expect(screen.getByText('轨道分布')).toBeTruthy();
    expect(screen.getByText('刷新')).toBeTruthy();
  });

  it('渲染等级分布条', async () => {
    mockedTauri.getStats.mockResolvedValue({
      total: 10,
      avgScore: 70,
      topScore: 90,
      recent7d: 3,
      favorites: 5,
      byGrade: [
        { grade: 'S', count: 3 },
        { grade: 'A', count: 5 },
        { grade: 'B', count: 2 },
        { grade: 'X', count: 0 },
      ],
      byTrack: [],
    });
    render(<StatsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('S')).toBeTruthy();
    });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('渲染轨道分布标签', async () => {
    mockedTauri.getStats.mockResolvedValue({
      total: 10,
      avgScore: 70,
      topScore: 90,
      recent7d: 3,
      favorites: 4,
      byGrade: [],
      byTrack: [
        { track: 'neglected', count: 5 },
        { track: 'high-star', count: 3 },
        { track: 'steady', count: 2 },
      ],
    });
    render(<StatsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('被忽视')).toBeTruthy();
    });
    expect(screen.getByText('高星')).toBeTruthy();
    expect(screen.getByText('稳态')).toBeTruthy();
  });
});
