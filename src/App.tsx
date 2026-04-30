import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from './stores/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import SearchBar, { type SearchBarHandle } from './components/SearchBar';
import LoadingSpinner from './components/LoadingSpinner';
import ResultsSkeleton from './components/ResultsSkeleton';
import OnboardingGuide from './components/OnboardingGuide';
import ResultCard from './components/ResultCard';
import ComparisonPanel from './components/ComparisonPanel';
import ExportPanel from './components/ExportPanel';
import ProjectDetail from './components/ProjectDetail';
import SearchHistory from './components/SearchHistory';
import FavoritesManager from './components/FavoritesManager';
import VirtualList from './components/VirtualList';
import PDFExport from './components/PDFExport';
import TrendChart from './components/TrendChart';
import TrendingDiscovery from './components/TrendingDiscovery';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useI18n } from './i18n';
import type { ProjectRecommendation, DimensionWeights } from './types';
import { defaultDimensionWeights } from './types';

type SortKey = 'score' | 'stars' | 'recommendationIndex' | 'name';
type TrackFilter = 'all' | 'neglected' | 'high-star' | 'steady';
type Theme = 'dark' | 'light';

interface SearchResponse {
  results: ProjectRecommendation[];
  meta: {
    queryId: string;
    totalCandidates: number;
    evaluatedCount: number;
    dataSource: string;
  };
}

const PAGE_SIZE = 10;

function App() {
  const { results, query, loading, setToken, setLoading, setSearchResults } = useAppStore();
  const { lang, switchLang } = useI18n();
  const searchBarRef = useRef<SearchBarHandle>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>(() => {
    const saved = localStorage.getItem('ralph-sortBy');
    return (saved as SortKey) || 'recommendationIndex';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('ralph-sortOrder');
    return (saved as 'asc' | 'desc') || 'desc';
  });
  const [trackFilter, setTrackFilter] = useState<TrackFilter>(() => {
    const saved = localStorage.getItem('ralph-trackFilter');
    return (saved as TrackFilter) || 'all';
  });
  const [languageFilter, setLanguageFilter] = useState<string>(() => {
    const saved = localStorage.getItem('ralph-languageFilter');
    return saved || 'all';
  });
  const [minScore, setMinScore] = useState<number>(() => {
    const saved = localStorage.getItem('ralph-minScore');
    return saved ? Number(saved) : 0;
  });
  const [minStars, setMinStars] = useState<number>(() => {
    const saved = localStorage.getItem('ralph-minStars');
    return saved ? Number(saved) : 0;
  });
  const [compareMode, setCompareMode] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('ralph-theme');
    return (saved as Theme) || 'dark';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [settingsToken, setSettingsToken] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetailProject, setSelectedDetailProject] = useState<ProjectRecommendation | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // 自定义维度权重
  const [dimensionWeights, setDimensionWeights] = useState<DimensionWeights>(() => {
    const saved = localStorage.getItem('ralph-dimensionWeights');
    return saved ? JSON.parse(saved) : defaultDimensionWeights;
  });

  // 加载收藏
  useEffect(() => {
    invoke<string[]>('get_favorites')
      .then((data) => {
        const names = data.map((f: any) => f.repo?.full_name || f.full_name);
        setFavorites(new Set(names.filter(Boolean)));
      })
      .catch(() => {});
  }, []);

  const toggleFavorite = useCallback(async (fullName: string, project?: ProjectRecommendation) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(fullName)) {
        next.delete(fullName);
        invoke('remove_favorite', { fullName }).catch(() => {});
      } else {
        next.add(fullName);
        if (project) {
          invoke('add_favorite', { fullName, evaluationJson: JSON.stringify(project) }).catch(() => {});
        }
      }
      return next;
    });
  }, []);

  const handleReSearch = useCallback((newQuery: string) => {
    searchBarRef.current?.setSearchAndExecute(newQuery);
  }, []);

  // 权重调整后的重新评分 + 排序
  const weightedResults = useMemo(() => {
    const totalWeight = Object.values(dimensionWeights).reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return results;

    return results.map(project => {
      const dims = project.dimensions || [];
      const weightedScore = dims.reduce((acc, dim) => {
        const ratio = dim.maxScore > 0 ? dim.score / dim.maxScore : 0;
        const weightKey = dim.dimension as keyof DimensionWeights;
        return acc + ratio * (dimensionWeights[weightKey] ?? 0);
      }, 0);

      return {
        ...project,
        weightedScore: Math.round(weightedScore * 10) / 10,
      };
    });
  }, [results, dimensionWeights]);

  // 过滤条件变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [trackFilter, languageFilter, minScore, minStars]);

  useEffect(() => {
    localStorage.setItem('ralph-theme', theme);
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ralph-sortBy', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('ralph-sortOrder', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem('ralph-trackFilter', trackFilter);
  }, [trackFilter]);

  useEffect(() => {
    localStorage.setItem('ralph-languageFilter', languageFilter);
  }, [languageFilter]);

  useEffect(() => {
    localStorage.setItem('ralph-minScore', String(minScore));
  }, [minScore]);

  useEffect(() => {
    localStorage.setItem('ralph-minStars', String(minStars));
  }, [minStars]);

  useEffect(() => {
    localStorage.setItem('ralph-dimensionWeights', JSON.stringify(dimensionWeights));
  }, [dimensionWeights]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // 提取所有语言
  const languages = useMemo(() => {
    const set = new Set<string>();
    results.forEach(p => { if (p.repo.language) set.add(p.repo.language); });
    return Array.from(set).sort();
  }, [results]);

  // 过滤 + 排序
  const filteredResults = useMemo(() => {
    let filtered = weightedResults.filter(p => {
      if (trackFilter !== 'all' && p.track !== trackFilter) return false;
      if (languageFilter !== 'all' && p.repo.language !== languageFilter) return false;
      const score = p.totalScore;
      if (score < minScore) return false;
      if (p.repo.stargazersCount < minStars) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const aScore = a.totalScore;
      const bScore = b.totalScore;

      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'score': aVal = aScore; bVal = bScore; break;
        case 'stars': aVal = a.repo.stargazersCount; bVal = b.repo.stargazersCount; break;
        case 'recommendationIndex': aVal = a.recommendationIndex; bVal = b.recommendationIndex; break;
        case 'name': return sortOrder === 'asc' ? a.repo.fullName.localeCompare(b.repo.fullName) : b.repo.fullName.localeCompare(a.repo.fullName);
        default: aVal = aScore; bVal = bScore;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [weightedResults, sortBy, sortOrder, trackFilter, languageFilter, minScore, minStars, dimensionWeights]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedResults = useMemo(() =>
    filteredResults.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredResults, safePage]
  );

  const hasNextPage = safePage < totalPages;
  const hasPrevPage = safePage > 1;

  const handleSearchFocus = useCallback(() => {
    searchBarRef.current?.focus();
  }, []);

  const handleClosePopup = useCallback(() => {
    if (selectedDetailProject) setSelectedDetailProject(null);
    if (showSettings) setShowSettings(false);
  }, [selectedDetailProject, showSettings]);

  useKeyboardShortcuts({
    onSearchFocus: handleSearchFocus,
    onNextPage: hasNextPage ? () => setCurrentPage(p => p + 1) : () => {},
    onPrevPage: hasPrevPage ? () => setCurrentPage(p => p - 1) : () => {},
    onClosePopup: handleClosePopup,
    onToggleTheme: toggleTheme,
    hasPopupOpen: !!selectedDetailProject || showSettings,
    totalPages,
  });

  const toggleCompare = useCallback(() => {
    setCompareMode(prev => !prev);
    setSelectedProjects(new Set());
  }, []);

  const toggleProjectSelection = useCallback((fullName: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName); else next.add(fullName);
      return next;
    });
  }, []);

  const selectedProjectsList = useMemo(() =>
    filteredResults.filter(p => selectedProjects.has(p.repo.fullName)),
    [filteredResults, selectedProjects]
  );

  const hasSearched = query !== '' && results.length === 0 && loading.phase !== 'searching' && loading.phase !== 'evaluating';
  const hasActiveFilters = trackFilter !== 'all' || languageFilter !== 'all' || minScore > 0 || minStars > 0;

  const resetFilters = () => {
    setTrackFilter('all');
    setLanguageFilter('all');
    setMinScore(0);
    setMinStars(0);
  };

  const saveSettings = () => {
    if (settingsToken.trim()) setToken(settingsToken.trim());
    setShowSettings(false);
  };

  const handleEvaluateFromTrending = useCallback(async (repo: any) => {
    setLoading({ phase: 'searching', message: `正在评估 ${repo.full_name}...` });
    try {
      const response = await invoke<SearchResponse>('search_and_evaluate', {
        query: `repo:${repo.full_name}`,
      });
      if (response.results.length > 0) {
        setSearchResults(response.results);
        setShowTrending(false);
      }
    } catch (error) {
      const errorMessage = String(error);
      setLoading({
        phase: 'error',
        message: `评估失败: ${errorMessage}`,
      });
    }
  }, [setLoading, setSearchResults]);

  const clearCache = () => {
    localStorage.clear();
    setShowSettings(false);
  };

  const resetWeights = () => {
    setDimensionWeights(defaultDimensionWeights);
  };

  const runBatch = async () => {
    const countInput = document.getElementById('batchCount') as HTMLInputElement;
    const count = parseInt(countInput?.value || '30');
    if (!query.trim()) {
      setError('请先进行搜索再启动批量评定');
      return;
    }
    setLoading({ phase: 'evaluating', message: `正在批量评定 ${count} 个项目...` });
    try {
      const response = await invoke<SearchResponse>('batch_evaluate', {
        query: query.trim(),
        count: Math.min(Math.max(count, 10), 100),
      });
      setSearchResults(response.results);
      setShowSettings(false);
    } catch (error) {
      setLoading({ phase: 'error', message: `批量评定失败: ${String(error)}` });
    }
  };

  // 主题样式
  const isLight = theme === 'light';
  const bg = isLight ? 'bg-gray-50' : 'bg-gray-950';
  const text = isLight ? 'text-gray-900' : 'text-gray-100';
  const headerBg = isLight ? 'bg-white/80 border-gray-200' : 'bg-gray-950/80 border-gray-800';
  const cardBg = isLight ? 'bg-white/60 border-gray-200 hover:border-violet-400/40' : 'bg-gray-900/60 border-gray-800 hover:border-violet-500/40';

  // 错误边界
  if (error) {
    return (
      <div className={`min-h-screen ${bg} ${text} flex items-center justify-center`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">发生错误</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={() => setError(null)} className="text-sm px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} ${text} transition-colors duration-200`}>
      {/* Header */}
      <header className={`border-b ${headerBg} backdrop-blur sticky top-0 z-10`}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold">
            Ralph <span className="text-violet-400 font-normal text-sm">GitHub Project Evaluator</span>
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <button id="ralph-lang-btn" onClick={() => switchLang(lang === 'zh' ? 'en' : 'zh')}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${isLight ? 'hover:bg-gray-200 text-gray-600' : 'hover:bg-gray-800 text-gray-400'}`}
              title="切换语言">
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
            <button onClick={toggleTheme}
              className={`p-1.5 rounded-lg transition-colors ${isLight ? 'hover:bg-gray-200 text-gray-600' : 'hover:bg-gray-800 text-gray-400'}`}
              title={isLight ? '切换暗黑模式' : '切换明亮模式'}>
              {isLight ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <button id="ralph-trending-btn" onClick={() => setShowTrending(!showTrending)}
              className={`p-1.5 rounded-lg transition-colors ${showTrending ? 'bg-amber-600/20 text-amber-400' : isLight ? 'hover:bg-gray-200 text-gray-600' : 'hover:bg-gray-800 text-gray-400'}`}
              title="GitHub Trending">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 3.258 1.37 6.12z" clipRule="evenodd" />
              </svg>
            </button>
            <button id="ralph-settings-btn" onClick={() => setShowSettings(true)}
              className={`p-1.5 rounded-lg transition-colors ${isLight ? 'hover:bg-gray-200 text-gray-600' : 'hover:bg-gray-800 text-gray-400'}`}
              title="设置">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 设置面板 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowSettings(false)}>
          <div className={`w-full max-w-md mx-4 rounded-xl shadow-2xl ${isLight ? 'bg-white' : 'bg-gray-900'} p-6 animate-fade-in`}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">设置</h3>
            <div className="space-y-4">
              <div>
                <label className={`text-xs block mb-1 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>GITHUB_TOKEN</label>
                <input type="password" value={settingsToken} onChange={e => setSettingsToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-100'
                  } focus:outline-none focus:border-violet-500`} />
                <p className={`text-xs mt-1 ${isLight ? 'text-gray-500' : 'text-gray-600'}`}>
                  用于 GitHub API 认证，避免速率限制
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={saveSettings}
                  className="flex-1 text-sm py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500">
                  保存
                </button>
                <button onClick={clearCache}
                  className={`text-sm px-4 py-2 rounded-lg border ${
                    isLight ? 'border-gray-300 text-gray-600 hover:bg-gray-100' : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                  }`}>
                  清理缓存
                </button>
              </div>
              <div className={`border-t pt-4 ${isLight ? 'border-gray-200' : 'border-gray-700'}`}>
                <h4 className={`text-sm font-semibold mb-2 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>批量评定</h4>
                <div className="flex gap-2">
                  <input type="number" id="batchCount" defaultValue={30} min={10} max={100}
                    className={`w-20 px-2 py-1.5 text-sm rounded-lg border ${
                      isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-100'
                    }`} />
                  <button onClick={runBatch}
                    className="flex-1 text-sm py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500">
                    启动批量评定
                  </button>
                </div>
                <p className={`text-xs mt-1 ${isLight ? 'text-gray-500' : 'text-gray-600'}`}>
                  从当前搜索结果中批量评定更多项目
                </p>
              </div>
              <div className={`border-t pt-4 ${isLight ? 'border-gray-200' : 'border-gray-700'}`}>
                <h4 className={`text-sm font-semibold mb-2 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                  自定义权重
                </h4>
                <p className={`text-xs mb-2 ${isLight ? 'text-gray-500' : 'text-gray-600'}`}>
                  调整各维度权重会影响所有项目的评分和排序
                </p>
                <div className="space-y-2">
                  {Object.entries(dimensionWeights).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className={`text-xs w-16 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                        {{
                          quality: '质量',
                          maintenance: '维护',
                          practical: '实用',
                          documentation: '文档',
                          community: '社区',
                          security: '安全',
                        }[key] || key}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        value={value}
                        onChange={e => setDimensionWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        className="flex-1 accent-violet-500"
                      />
                      <span className={`text-xs w-8 text-right ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={resetWeights}
                    className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                      isLight ? 'border-gray-300 text-gray-600 hover:bg-gray-100' : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                    }`}>
                    恢复默认
                  </button>
                </div>
                <p className={`text-xs mt-1 ${isLight ? 'text-gray-500' : 'text-gray-600'}`}>
                  权重修改仅在前端生效，不会重新运行后端评估
                </p>
              </div>
              <button onClick={() => setShowSettings(false)}
                className={`w-full text-sm py-2 ${isLight ? 'text-gray-500' : 'text-gray-600'}`}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div id="ralph-search-input"><SearchBar ref={searchBarRef} /></div>
        <div className="flex items-center gap-2 mb-4">
          <SearchHistory onReSearch={handleReSearch} isLight={isLight} />
          <FavoritesManager onReSearch={handleReSearch} isLight={isLight} />
        </div>

        {/* Trending Discovery Panel */}
        {showTrending && (
          <div className="mb-6 animate-fade-in">
            <TrendingDiscovery onEvaluateProject={handleEvaluateFromTrending} />
          </div>
        )}

        <LoadingSpinner />

        {/* 骨架屏 - 搜索进行中 */}
        {(loading.phase === 'searching' || loading.phase === 'evaluating') && results.length === 0 && (
          <ResultsSkeleton count={3} isLight={isLight} />
        )}

        {/* 搜索进度实时展示 */}
        {(loading.phase === 'searching' || loading.phase === 'evaluating') && (
          <div className={`rounded-xl p-4 mb-4 border ${
            isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/10 border-blue-700/30'
          }`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className="flex-1">
                <p className={`text-sm font-medium ${isLight ? 'text-gray-900' : 'text-gray-200'}`}>
                  {loading.phase === 'searching' ? '正在搜索 GitHub 项目...' :
                   loading.phase === 'evaluating' ? '正在进行六维评估...' : '处理中...'}
                </p>
                {loading.message && (
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{loading.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 对比模式 */}
        {compareMode && selectedProjectsList.length > 0 && (
          <ComparisonPanel projects={selectedProjectsList} onExit={toggleCompare} />
        )}

        {/* 趋势图表 */}
        {results.length > 0 && <TrendChart projects={filteredResults} />}

        {/* Results */}
        {results.length > 0 && (
          <div>
            {/* 工具栏 */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className={`text-sm font-medium ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                  找到 <span className="text-violet-400">{filteredResults.length}</span> / {results.length} 个项目
                </h2>
                {hasActiveFilters && (
                  <button onClick={resetFilters} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    重置筛选
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <PDFExport projects={filteredResults} query={query} />
                <ExportPanel projects={filteredResults} />
                <button
                  onClick={() => setCompareMode(!compareMode)}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                    compareMode ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' :
                    isLight ? 'border-gray-300 text-gray-500 hover:text-gray-700' : 'border-gray-700 text-gray-400 hover:text-gray-300'
                  }`}
                >
                  对比 ({selectedProjects.size})
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                    showFilters ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' :
                    isLight ? 'border-gray-300 text-gray-500 hover:text-gray-700' : 'border-gray-700 text-gray-400 hover:text-gray-300'
                  }`}
                >
                  筛选 {hasActiveFilters ? '✓' : ''}
                </button>
              </div>
            </div>

            {/* 筛选面板 */}
            {showFilters && (
              <div className={`rounded-xl p-4 mb-4 border ${
                isLight ? 'bg-gray-100/80 border-gray-200' : 'bg-gray-900/80 border-gray-700'
              } animate-fade-in`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={`text-xs block mb-1 ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>轨道</label>
                    <select value={trackFilter} onChange={e => setTrackFilter(e.target.value as TrackFilter)}
                      className={`w-full rounded-lg px-2 py-1.5 text-xs border focus:outline-none focus:border-violet-500 ${
                        isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-300'
                      }`}>
                      <option value="all">全部</option>
                      <option value="neglected">被忽视</option>
                      <option value="high-star">高星</option>
                      <option value="steady">稳态</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs block mb-1 ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>语言</label>
                    <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)}
                      className={`w-full rounded-lg px-2 py-1.5 text-xs border focus:outline-none focus:border-violet-500 ${
                        isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-300'
                      }`}>
                      <option value="all">全部</option>
                      {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs block mb-1 ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>最低评分</label>
                    <input type="range" min={0} max={105} value={minScore} onChange={e => setMinScore(Number(e.target.value))}
                      className="w-full accent-violet-500" />
                    <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{minScore}</span>
                  </div>
                  <div>
                    <label className={`text-xs block mb-1 ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>最低 Star</label>
                    <input type="range" min={0} max={100000} step={100} value={minStars} onChange={e => setMinStars(Number(e.target.value))}
                      className="w-full accent-violet-500" />
                    <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{minStars.toLocaleString()}</span>
                  </div>
                </div>
                <div className={`mt-3 pt-3 border-t flex items-center gap-2 ${isLight ? 'border-gray-200' : 'border-gray-700'}`}>
                  <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>排序:</span>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
                    className={`rounded-lg px-2 py-1.5 text-xs border focus:outline-none focus:border-violet-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-300'
                    }`}>
                    <option value="recommendationIndex">推荐指数</option>
                    <option value="score">总评分</option>
                    <option value="stars">Star 数</option>
                    <option value="name">名称</option>
                  </select>
                  <button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                    className={`text-xs px-2 py-1 rounded-lg border ${
                      isLight ? 'bg-white border-gray-300 text-gray-600' : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}>
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            )}

            {filteredResults.length > 30 && !compareMode ? (
              <div className={`rounded-xl border overflow-hidden ${cardBg} backdrop-blur`}>
                <VirtualList
                  items={filteredResults}
                  itemHeight={280}
                  containerHeight={600}
                  onDetailClick={setSelectedDetailProject}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedResults.map((project) => (
                  <div key={project.repo.fullName} className={`rounded-xl p-0 transition-all duration-200 ${cardBg} backdrop-blur border overflow-hidden`}>
                    {compareMode && (
                      <button
                        onClick={() => toggleProjectSelection(project.repo.fullName)}
                        className={`absolute -left-1 top-4 w-5 h-5 rounded border flex items-center justify-center z-10 transition-all ${
                          selectedProjects.has(project.repo.fullName)
                            ? 'bg-violet-500 border-violet-500 text-white'
                            : 'border-gray-600 hover:border-violet-500'
                        }`}
                      >
                        {selectedProjects.has(project.repo.fullName) && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    )}
                    <div className={compareMode ? 'ml-8' : ''}>
                      <ResultCard project={project} onDetailClick={() => setSelectedDetailProject(project)} isFavorite={favorites.has(project.repo.fullName)} onFavoriteToggle={() => toggleFavorite(project.repo.fullName, project)} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 分页（虚拟滚动模式下隐藏） */}
            {totalPages > 1 && filteredResults.length <= 30 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  className={`text-xs px-2 py-1 rounded border disabled:opacity-40 ${
                    isLight ? 'border-gray-300 text-gray-600 hover:bg-gray-100' : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                  }`}>
                  上一页
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                      page === safePage ? 'bg-violet-600 text-white' :
                      isLight ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400 hover:bg-gray-800'
                    }`}>
                    {page}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className={`text-xs px-2 py-1 rounded border disabled:opacity-40 ${
                    isLight ? 'border-gray-300 text-gray-600 hover:bg-gray-100' : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                  }`}>
                  下一页
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {results.length === 0 && !hasSearched && (
          <div className="text-center py-20">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              isLight ? 'bg-gray-200/50' : 'bg-gray-800/50'
            }`}>
              <svg className={`w-8 h-8 ${isLight ? 'text-gray-400' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className={`${isLight ? 'text-gray-500' : 'text-gray-500'} text-sm`}>输入关键词，开始搜索并评估 GitHub 项目</p>
            <p className={`${isLight ? 'text-gray-400' : 'text-gray-600'} text-xs mt-2`}>基于 Ralph 三轨评估模型，挖掘真正高质量的开源项目</p>
          </div>
        )}

        {hasSearched && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-4">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className={`${isLight ? 'text-gray-700' : 'text-gray-300'} font-medium mb-1`}>未找到符合条件的推荐项目</h3>
            <p className={`${isLight ? 'text-gray-500' : 'text-gray-500'} text-sm`}>尝试更换搜索关键词，或调整筛选条件</p>
          </div>
        )}

        {/* 项目详情弹窗 */}
        {selectedDetailProject && (
          <ProjectDetail project={selectedDetailProject} onClose={() => setSelectedDetailProject(null)} />
        )}
      </main>

      {/* 新手引导 */}
      <OnboardingGuide />
    </div>
  );
}

export default App;
