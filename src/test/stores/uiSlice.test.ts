import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../../stores/slices/uiSlice';
import type { ProjectRecommendation } from '../../types';

const mockProject: ProjectRecommendation = {
  repo: {
    owner: 'test',
    name: 'repo',
    fullName: 'test/repo',
    htmlUrl: '',
    description: null,
    stargazersCount: 100,
    forksCount: 10,
    openIssuesCount: 5,
    language: null,
    createdAt: '',
    updatedAt: '',
    pushedAt: '',
    license: null,
    size: 0,
    hasWiki: false,
    hasIssuesEnabled: false,
    topics: [],
  },
  gateChecks: [],
  track: 'steady',
  neglectIndex: 0,
  dimensions: [],
  totalScore: 80,
  grade: 'A',
  oneLiner: '',
  evidenceLevel: 'L1',
  trustBadge: {
    level: 2,
    l1: { status: 'recommended', icon: '✓', label: '推荐', color: 'emerald' },
  },
  vetoFlags: [],
  recommendationIndex: 40,
  confidenceTier: 'tier1-core',
  decisionTrail: [],
};

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      showSettings: false,
      showTrending: false,
      showFilters: false,
      showHelp: false,
      compareMode: false,
      selectedProjects: [],
      currentPage: 1,
      theme: 'dark',
      selectedDetailProject: null,
    });
  });

  it('初始状态正确', () => {
    const state = useUiStore.getState();
    expect(state.showSettings).toBe(false);
    expect(state.showTrending).toBe(false);
    expect(state.showFilters).toBe(false);
    expect(state.showHelp).toBe(false);
    expect(state.compareMode).toBe(false);
    expect(state.selectedProjects).toEqual([]);
    expect(state.currentPage).toBe(1);
    expect(state.theme).toBe('dark');
    expect(state.selectedDetailProject).toBeNull();
  });

  it('setShowSettings 切换设置面板', () => {
    useUiStore.getState().setShowSettings(true);
    expect(useUiStore.getState().showSettings).toBe(true);
    useUiStore.getState().setShowSettings(false);
    expect(useUiStore.getState().showSettings).toBe(false);
  });

  it('setShowTrending 切换趋势面板', () => {
    useUiStore.getState().setShowTrending(true);
    expect(useUiStore.getState().showTrending).toBe(true);
  });

  it('setShowFilters 切换筛选面板', () => {
    useUiStore.getState().setShowFilters(true);
    expect(useUiStore.getState().showFilters).toBe(true);
  });

  it('setShowHelp 切换帮助面板', () => {
    useUiStore.getState().setShowHelp(true);
    expect(useUiStore.getState().showHelp).toBe(true);
  });

  it('setCompareMode 切换对比模式', () => {
    useUiStore.getState().setCompareMode(true);
    expect(useUiStore.getState().compareMode).toBe(true);
  });

  it('addSelectedProject 添加选中项目', () => {
    useUiStore.getState().addSelectedProject('test/repo1');
    expect(useUiStore.getState().selectedProjects).toEqual(['test/repo1']);
  });

  it('addSelectedProject 添加多个项目', () => {
    useUiStore.getState().addSelectedProject('test/repo1');
    useUiStore.getState().addSelectedProject('test/repo2');
    useUiStore.getState().addSelectedProject('test/repo3');
    expect(useUiStore.getState().selectedProjects).toEqual([
      'test/repo1',
      'test/repo2',
      'test/repo3',
    ]);
  });

  it('removeSelectedProject 移除选中项目', () => {
    useUiStore.getState().addSelectedProject('test/repo1');
    useUiStore.getState().addSelectedProject('test/repo2');
    useUiStore.getState().removeSelectedProject('test/repo1');
    expect(useUiStore.getState().selectedProjects).toEqual(['test/repo2']);
  });

  it('removeSelectedProject 移除不存在的项目不影响列表', () => {
    useUiStore.getState().addSelectedProject('test/repo1');
    useUiStore.getState().removeSelectedProject('test/nonexistent');
    expect(useUiStore.getState().selectedProjects).toEqual(['test/repo1']);
  });

  it('clearSelectedProjects 清空所有选中', () => {
    useUiStore.getState().addSelectedProject('test/repo1');
    useUiStore.getState().addSelectedProject('test/repo2');
    useUiStore.getState().clearSelectedProjects();
    expect(useUiStore.getState().selectedProjects).toEqual([]);
  });

  it('setCurrentPage 设置当前页', () => {
    useUiStore.getState().setCurrentPage(3);
    expect(useUiStore.getState().currentPage).toBe(3);
  });

  it('setCurrentPage 边界值 - 第1页', () => {
    useUiStore.getState().setCurrentPage(1);
    expect(useUiStore.getState().currentPage).toBe(1);
  });

  it('setTheme 切换主题', () => {
    useUiStore.getState().setTheme('light');
    expect(useUiStore.getState().theme).toBe('light');
    useUiStore.getState().setTheme('dark');
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('setSelectedDetailProject 设置详情项目', () => {
    useUiStore.getState().setSelectedDetailProject(mockProject);
    expect(useUiStore.getState().selectedDetailProject).toEqual(mockProject);
  });

  it('setSelectedDetailProject 清除详情项目', () => {
    useUiStore.getState().setSelectedDetailProject(mockProject);
    useUiStore.getState().setSelectedDetailProject(null);
    expect(useUiStore.getState().selectedDetailProject).toBeNull();
  });

  it('面板互斥 - 打开设置关闭其他面板', () => {
    useUiStore.getState().setShowTrending(true);
    useUiStore.getState().setShowSettings(true);
    expect(useUiStore.getState().showSettings).toBe(true);
  });
});
