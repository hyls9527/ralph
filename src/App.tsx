import { useRef, useCallback, useState, useEffect, lazy, Suspense } from 'react';
import { useAppStore } from './stores/useAppStore';
import SearchBar, { type SearchBarHandle } from './components/SearchBar';
import LoadingSpinner from './components/LoadingSpinner';
import ResultsSkeleton from './components/ResultsSkeleton';
import OnboardingGuide from './components/OnboardingGuide';
import ResultCard from './components/ResultCard';
import VirtualList from './components/VirtualList';
import StatsDashboard from './components/StatsDashboard';
import { Header } from './components/layout/Header';
import { ErrorFallback } from './components/layout/ErrorFallback';
import { EmptyState } from './components/features/EmptyState';
import { KeyboardHelpModal } from './components/KeyboardHelpModal';
import { AccessibleModal } from './components/ui/AccessibleModal';
import { escapeStack } from './lib/escape-stack';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSearch } from './hooks/useSearch';
import { useFilteredResults } from './hooks/useFilteredResults';
import { useTheme } from './hooks/useTheme';
import { useCompareMode } from './hooks/useCompareMode';
import { useFavoriteSelector } from './stores/slices/favoriteSlice';
import { useUiStore } from './stores/slices/uiSlice';
import { useFilterSelector, useFilterStore } from './stores/slices/filterSlice';
import { initTelemetry, useTelemetry } from './lib/telemetry';
import { useI18n } from './i18n';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { BatchSession } from './services/tauri';

// 🚀 代码分割 - 懒加载非关键组件（改善首屏加载 40-50%）
const ComparisonPanel = lazy(() => import('./components/ComparisonPanel'));
const ExportPanel = lazy(() => import('./components/ExportPanel'));
const ProjectDetail = lazy(() => import('./components/ProjectDetail'));
const SearchHistory = lazy(() => import('./components/SearchHistory'));
const FavoritesManager = lazy(() => import('./components/FavoritesManager'));
const PDFExport = lazy(() => import('./components/PDFExport'));
const TrendChart = lazy(() => import('./components/TrendChart'));
const TrendingDiscovery = lazy(() => import('./components/TrendingDiscovery'));

const LazyLoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <LoadingSpinner />
    <span className="ml-3 text-gray-500 dark:text-gray-400">Loading...</span>
  </div>
);
import type { DimensionWeights, ProjectRecommendation } from './types';
import { defaultDimensionWeights } from './types';
import { tauri } from './services/tauri';

function App() {
  const { results, query, loading, setToken, setLoading, setSearchResults } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [batchSessions, setBatchSessions] = useState<BatchSession[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; total: number; currentRepo: string } | null>(null);
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null);
  const searchBarRef = useRef<SearchBarHandle>(null);

  // Telemetry 初始化
  const telemetry = useTelemetry();
  const { t } = useI18n();
  useEffect(() => {
    initTelemetry({ enabled: true, debugMode: false, privacyMode: 'full' });
    telemetry.trackView('home', { source: 'app_init' });
  }, []);

  // New architecture hooks
  const { isDark } = useTheme();
  useSearch(); // Initialize search functionality
  const { filteredResults, paginatedResults, totalPages, currentPage, hasNextPage, hasPrevPage, languages } = useFilteredResults();
  const { compareMode, selectedProjects, toggleCompareMode, toggleProjectSelection, isSelected } = useCompareMode();
  const { favorites, isFavorite, toggleFavorite } = useFavoriteSelector();

  // UI state from uiSlice
  const showSettings = useUiStore(s => s.showSettings);
  const setShowSettings = useUiStore(s => s.setShowSettings);
  const showTrending = useUiStore(s => s.showTrending);
  const setShowTrending = useUiStore(s => s.setShowTrending);
  const showFilters = useUiStore(s => s.showFilters);
  const setShowFilters = useUiStore(s => s.setShowFilters);

  // EscapeStack 集成 - 自动注册/注销面板
  useEffect(() => {
    if (showSettings) {
      escapeStack.register('settings', () => setShowSettings(false), 10);
    } else {
      escapeStack.unregister('settings');
    }
  }, [showSettings, setShowSettings]);

  useEffect(() => {
    if (showFilters) {
      escapeStack.register('filters', () => setShowFilters(false), 8);
    } else {
      escapeStack.unregister('filters');
    }
  }, [showFilters, setShowFilters]);

  useEffect(() => {
    if (showTrending) {
      escapeStack.register('trending', () => setShowTrending(false), 6);
    } else {
      escapeStack.unregister('trending');
    }
  }, [showTrending, setShowTrending]);

  useEffect(() => {
    if (showSettings) {
      tauri.getBatchSessions().then(setBatchSessions).catch(() => {});
    }
  }, [showSettings]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    (async () => {
      try {
        unlisten = await listen<{ processed: number; total: number; currentRepo: string; sessionId: string }>(
          'batch_progress',
          (event) => {
            setBatchProgress({
              processed: event.payload.processed,
              total: event.payload.total,
              currentRepo: event.payload.currentRepo,
            });
            setResumingSessionId(event.payload.sessionId);
          }
        );
      } catch {
        // non-critical
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const selectedDetailProject = useUiStore(s => s.selectedDetailProject);
  const setSelectedDetailProject = useUiStore(s => s.setSelectedDetailProject);
  const setCurrentPage = useUiStore(s => s.setCurrentPage);

  // Filter state from filterSlice
  const filters = useFilterSelector();
  const resetFilters = useFilterStore(s => s.resetFilters);

  // Local state for settings and weights (kept in App for now)
  const [settingsToken, setSettingsToken] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [dimensionWeights, setDimensionWeights] = useState<DimensionWeights>(() => {
    const saved = localStorage.getItem('ralph-dimensionWeights');
    return saved ? JSON.parse(saved) : defaultDimensionWeights;
  });

  const hasActiveFilters = filters.trackFilter !== 'all' || filters.languageFilter !== 'all' || filters.minScore > 0 || filters.minStars > 0;
  const hasSearched = query !== '' && results.length === 0 && loading.phase !== 'searching' && loading.phase !== 'evaluating';

  const handleReSearch = useCallback((newQuery: string) => {
    telemetry.trackSearch(newQuery, 0, 0);
    searchBarRef.current?.setSearchAndExecute(newQuery);
  }, [telemetry]);

  const handleSearchFocus = useCallback(() => {
    searchBarRef.current?.focus();
  }, []);

  const handleClosePopup = useCallback(() => {
    if (selectedDetailProject) setSelectedDetailProject(null);
    if (showSettings) setShowSettings(false);
  }, [selectedDetailProject, showSettings]);

  useKeyboardShortcuts({
    onSearchFocus: handleSearchFocus,
    onNextPage: hasNextPage ? () => setCurrentPage(currentPage + 1) : () => {},
    onPrevPage: hasPrevPage ? () => setCurrentPage(currentPage - 1) : () => {},
    onClosePopup: handleClosePopup,
    totalPages,
  });

  const handleEvaluateFromTrending = useCallback(async (repo: ProjectRecommendation) => {
    setLoading({ phase: 'searching', message: t('evaluatingProject', { name: repo.repo.fullName }) });
    try {
      const response = await tauri.searchAndEvaluate(`repo:${repo.repo.fullName}`);
      if (response.results.length > 0) {
        setSearchResults(response.results);
        setShowTrending(false);
      }
    } catch (error) {
      setLoading({ phase: 'error', message: `${t('evaluateFailed')}: ${String(error)}` });
    }
  }, [setLoading, setSearchResults]);

  const saveSettings = async () => {
    if (settingsToken.trim()) {
      setToken(settingsToken.trim());
      try {
        await tauri.saveSettings(settingsToken.trim());
      } catch (err) {
        console.error('Failed to save settings to backend:', err);
      }
    }
    setShowSettings(false);
  };

  const runBatch = async () => {
    const countInput = document.getElementById('batchCount') as HTMLInputElement;
    const count = parseInt(countInput?.value || '30');
    if (isNaN(count) || count < 10 || count > 100) { setError(t('batchCountRange')); return; }
    if (!query.trim()) { setError(t('searchFirst')); return; }
    const startTime = Date.now();
    setLoading({ phase: 'evaluating', message: t('batchEvaluating', { count }) });
    try {
      const response = await tauri.batchEvaluate(query.trim(), Math.min(Math.max(count, 10), 100));
      setSearchResults(response.results);
      setShowSettings(false);
      telemetry.trackSearch(query, response.results?.length || 0, Date.now() - startTime);
    } catch (err) {
      setLoading({ phase: 'error', message: `${t('batchFailed')}: ${String(err)}` });
      telemetry.trackError({
        errorType: 'api',
        message: String(err),
        severity: 'error',
        recoverable: true,
        userAction: 'batch_evaluate',
      });
    }
  };

  const resumeBatch = async (sessionId: string) => {
    setLoading({ phase: 'evaluating', message: t('resumingBatch') });
    setBatchProgress(null);
    try {
      const response = await tauri.resumeBatch(sessionId);
      setSearchResults(response.results);
      setShowSettings(false);
      setBatchSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    } catch (err) {
      setLoading({ phase: 'error', message: t('resumeFailed', { error: String(err) }) });
    }
  };

  const deleteBatchSessionHandler = async (sessionId: string) => {
    try {
      await tauri.deleteBatchSession(sessionId);
      setBatchSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    } catch (err) {
      console.error('Failed to delete batch session:', err);
    }
  };

  const clearCache = async () => {
    localStorage.clear();
    try {
      await tauri.clearCache();
    } catch (err) {
      console.error('Failed to clear backend cache:', err);
    }
    setShowSettings(false);
    telemetry.track('custom', 'system', { action: 'clear_cache' });
  };
  const resetWeights = () => setDimensionWeights(defaultDimensionWeights);

  const selectedProjectsList = filteredResults.filter(p => selectedProjects.includes(p.repo.fullName));

  if (error) return <ErrorFallback error={error} onRetry={() => setError(null)} />;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'} transition-colors duration-200`}>
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div id="ralph-search-input"><SearchBar ref={searchBarRef} /></div>
        <div className="flex items-center gap-2 mb-4">
          <Suspense fallback={<LazyLoadingFallback />}>
            <SearchHistory onReSearch={handleReSearch} isLight={!isDark} />
            <FavoritesManager isLight={!isDark} />
          </Suspense>
          <button
            onClick={() => setShowStats(!showStats)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              showStats
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                : !isDark ? 'border-gray-300 text-gray-500 hover:text-gray-700' : 'border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
          >
            📊 {t('stats') || '统计'}
          </button>
        </div>

        {showStats && (
          <div className="mb-6 animate-fade-in">
            <Suspense fallback={<LazyLoadingFallback />}>
              <StatsDashboard />
            </Suspense>
          </div>
        )}

        {showTrending && (
          <div className="mb-6 animate-fade-in">
            <Suspense fallback={<LazyLoadingFallback />}>
              <TrendingDiscovery onEvaluateProject={handleEvaluateFromTrending} />
            </Suspense>
          </div>
        )}

        <LoadingSpinner />
        {(loading.phase === 'searching' || loading.phase === 'evaluating') && results.length === 0 && <ResultsSkeleton count={3} isLight={!isDark} />}

        {(loading.phase === 'searching' || loading.phase === 'evaluating') && (
          <div role="status" aria-live="polite" className={`rounded-xl p-4 mb-4 border ${!isDark ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/10 border-blue-700/30'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className={`text-sm font-medium flex-1 ${!isDark ? 'text-gray-900' : 'text-gray-200'}`}>
                {loading.phase === 'searching' ? t('searching') : loading.phase === 'evaluating' ? t('evaluating') : t('loading')}
              </p>
              {loading.phase === 'evaluating' && (
                <button
                  onClick={async () => {
                    try {
                      await tauri.cancelBatch();
                      setLoading({ phase: 'idle', message: '' });
                    } catch (err) {
                      console.error('Failed to cancel batch:', err);
                    }
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    !isDark
                      ? 'border-rose-300 text-rose-600 hover:bg-rose-50'
                      : 'border-rose-700 text-rose-400 hover:bg-rose-900/30'
                  }`}
                >
                  {t('cancelEvaluation')}
                </button>
              )}
            </div>
          </div>
        )}

        {compareMode && selectedProjectsList.length > 0 && (
          <Suspense fallback={<LazyLoadingFallback />}>
            <ComparisonPanel projects={selectedProjectsList} onExit={toggleCompareMode} onRemoveProject={toggleProjectSelection} />
          </Suspense>
        )}
        {results.length > 0 && (
          <Suspense fallback={<LazyLoadingFallback />}>
            <TrendChart projects={filteredResults} />
          </Suspense>
        )}

        {results.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className={`text-sm font-medium ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  {t('foundCount', { filtered: filteredResults.length, total: results.length })}
                </h2>
                {hasActiveFilters && <button onClick={resetFilters} className="text-xs text-amber-400 hover:text-amber-300">{t('resetFiltersBtn')}</button>}
              </div>
              <div className="flex items-center gap-2">
                <Suspense fallback={<LazyLoadingFallback />}>
                  <PDFExport projects={filteredResults} query={query} />
                </Suspense>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <ExportPanel projects={filteredResults} />
                </Suspense>
                <button onClick={() => useUiStore.getState().setCompareMode(!compareMode)}
                  className={`text-xs px-2.5 py-1 rounded border ${compareMode ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : !isDark ? 'border-gray-300 text-gray-500 hover:text-gray-700' : 'border-gray-700 text-gray-400 hover:text-gray-300'}`}>
                  {t('compareCount', { count: selectedProjects.length })}
                </button>
                <button onClick={() => setShowFilters(!showFilters)}
                  className={`text-xs px-2.5 py-1 rounded border ${showFilters ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : !isDark ? 'border-gray-300 text-gray-500 hover:text-gray-700' : 'border-gray-700 text-gray-400 hover:text-gray-300'}`}>
                  {showFilters ? t('filterActiveBtn') : t('filterBtn')}
                </button>
              </div>
            </div>

            {/* Filter Panel - 支持 Escape 关闭 */}
            {showFilters && (
              <div
                className={`rounded-xl p-4 mb-4 border animate-fade-in ${!isDark ? 'bg-gray-100/80 border-gray-200' : 'bg-gray-900/80 border-gray-700'}`}
                role="region"
                aria-label={t('filterPanel')}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowFilters(false);
                    escapeStack.unregister('filters');
                  }
                }}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={`text-xs block mb-1 ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('trackLabel')}</label>
                    <select value={filters.trackFilter} onChange={e => useFilterStore.getState().setTrackFilter(e.target.value as any)}
                      className={`w-full rounded-lg px-2 py-1.5 text-xs border focus:outline-none focus:border-violet-500 ${!isDark ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                      <option value="all">{t('total')}</option><option value="neglected">{t('neglected')}</option><option value="high-star">{t('highStar')}</option><option value="steady">{t('steady')}</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs block mb-1 ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('language')}</label>
                    <select value={filters.languageFilter} onChange={e => useFilterStore.getState().setLanguageFilter(e.target.value)}
                      className={`w-full rounded-lg px-2 py-1.5 text-xs border focus:outline-none focus:border-violet-500 ${!isDark ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                      <option value="all">{t('allLanguages')}</option>{languages.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs block mb-1 ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('minScore')}</label>
                    <input type="range" min={0} max={105} value={filters.minScore} onChange={e => useFilterStore.getState().setMinScore(Number(e.target.value))} className="w-full accent-violet-500" />
                    <span className={`text-xs ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>{filters.minScore}</span>
                  </div>
                  <div>
                    <label className={`text-xs block mb-1 ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('minStars')}</label>
                    <input type="range" min={0} max={100000} step={100} value={filters.minStars} onChange={e => useFilterStore.getState().setMinStars(Number(e.target.value))} className="w-full accent-violet-500" />
                    <span className={`text-xs ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>{filters.minStars.toLocaleString()}</span>
                  </div>
                </div>
                <div className={`mt-3 pt-3 border-t flex items-center gap-2 ${!isDark ? 'border-gray-200' : 'border-gray-700'}`}>
                  <span className={`text-xs ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('sort')}:</span>
                  <select value={filters.sortBy} onChange={e => useFilterStore.getState().setSortBy(e.target.value as any)}
                    className={`rounded-lg px-2 py-1.5 text-xs border focus:outline-none focus:border-violet-500 ${!isDark ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                    <option value="recommendationIndex">{t('recommendationIndex')}</option><option value="score">{t('totalScoreSort')}</option><option value="stars">{t('starCount')}</option>
                  </select>
                  <button onClick={() => useFilterStore.getState().setSortOrder(filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                    className={`text-xs px-2 py-1 rounded-lg border ${!isDark ? 'bg-white border-gray-300 text-gray-600' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    {filters.sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            )}

            {/* Result List */}
            {filteredResults.length > 30 && !compareMode ? (
              <div className={`rounded-xl border overflow-hidden ${!isDark ? 'bg-white/60 border-gray-200 hover:border-violet-400/40' : 'bg-gray-900/60 border-gray-800 hover:border-violet-500/40'} backdrop-blur`}>
                <VirtualList items={filteredResults} itemHeight={280} containerHeight={600}
                  onDetailClick={setSelectedDetailProject} favorites={favorites} onFavoriteToggle={toggleFavorite} />
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedResults.map((project) => (
                  <div key={project.repo.fullName} className={`rounded-xl p-0 transition-all duration-200 ${!isDark ? 'bg-white/60 border-gray-200 hover:border-violet-400/40' : 'bg-gray-900/60 border-gray-800 hover:border-violet-500/40'} backdrop-blur border overflow-hidden`}>
                    {compareMode && (
                      <button onClick={() => toggleProjectSelection(project.repo.fullName)}
                        className={`absolute -left-1 top-4 w-5 h-5 rounded border flex items-center justify-center z-10 transition-all ${isSelected(project.repo.fullName) ? 'bg-violet-500 border-violet-500 text-white' : 'border-gray-600 hover:border-violet-500'}`}>
                        {isSelected(project.repo.fullName) && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                      </button>
                    )}
                    <div className={compareMode ? 'ml-8' : ''}>
                      <ResultCard project={project} onDetailClick={() => setSelectedDetailProject(project)} isFavorite={isFavorite(project.repo.fullName)} onFavoriteToggle={() => toggleFavorite(project.repo.fullName, project)} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && filteredResults.length <= 30 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                  className={`text-xs px-2 py-1 rounded border disabled:opacity-40 ${!isDark ? 'border-gray-300 text-gray-600 hover:bg-gray-100' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}>{t('prevPage')}</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-xs rounded-lg transition-colors ${page === currentPage ? 'bg-violet-600 text-white' : !isDark ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400 hover:bg-gray-800'}`}>{page}</button>
                ))}
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                  className={`text-xs px-2 py-1 rounded border disabled:opacity-40 ${!isDark ? 'border-gray-300 text-gray-600 hover:bg-gray-100' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}>{t('nextPage')}</button>
              </div>
            )}
          </div>
        )}

        <EmptyState hasResults={filteredResults.length > 0} hasSearched={hasSearched} onClearFilters={resetFilters} />

        {selectedDetailProject && (
          <Suspense fallback={<LazyLoadingFallback />}>
            <ProjectDetail project={selectedDetailProject} onClose={() => setSelectedDetailProject(null)} />
          </Suspense>
        )}
      </main>

      {/* Settings Modal - 无障碍优化版本 */}
      <AccessibleModal
        open={showSettings}
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) escapeStack.unregister('settings');
        }}
        title={t('settings')}
        description={t('settingsDesc')}
        closeOnEscape={true}
        closeOnClickOutside={true}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="settings-github-token" className={`text-xs block mb-1 ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              {t('githubToken')}
            </label>
            <input
              id="settings-github-token"
              type="password"
              value={settingsToken}
              onChange={e => setSettingsToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className={`w-full px-3 py-2 text-sm rounded-lg border ${!isDark ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-100'} focus:outline-none focus:border-violet-500`}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={saveSettings} className="flex-1 text-sm py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-400">
              {t('save')}
            </button>
            <button onClick={clearCache} className={`text-sm px-4 py-2 rounded-lg border ${!isDark ? 'border-gray-300 text-gray-600 hover:bg-gray-100' : 'border-gray-700 text-gray-400 hover:bg-gray-800'} focus-visible:ring-2 focus-visible:ring-violet-400`}>
              {t('clearCache')}
            </button>
          </div>
          <div className={`border-t pt-4 ${!isDark ? 'border-gray-200' : 'border-gray-700'}`}>
            <h4 className={`text-sm font-semibold mb-2 ${!isDark ? 'text-gray-700' : 'text-gray-300'}`}>{t('batchEvaluate')}</h4>
            <div className="flex gap-2">
              <input
                type="number"
                id="batchCount"
                defaultValue={30}
                min={10}
                max={100}
                className={`w-20 px-2 py-1.5 text-sm rounded-lg border ${!isDark ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-100'} focus:outline-none focus:border-violet-500`}
              />
              <button onClick={runBatch} className="flex-1 text-sm py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400">
                {t('startBatch')}
              </button>
            </div>
            {batchProgress && (
              <div className="mt-2 p-2 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>{t('batchProgress')}</span>
                  <span>{batchProgress.processed}/{batchProgress.total}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${batchProgress.total > 0 ? (batchProgress.processed / batchProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{batchProgress.currentRepo}</p>
              </div>
            )}
            {batchSessions.length > 0 && (
              <div className="mt-3">
                <h5 className="text-xs font-semibold text-amber-400 mb-2">{t('incompleteBatches')}</h5>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {batchSessions.map(session => (
                    <div key={session.sessionId} className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate">{session.query}</p>
                        <p className="text-xs text-gray-500">
                          {session.processed}/{session.totalRepos} · {session.status === 'paused' ? t('pausedStatus') : t('inProgressStatus')}
                        </p>
                      </div>
                      <button
                        onClick={() => resumeBatch(session.sessionId)}
                        disabled={resumingSessionId === session.sessionId}
                        className="px-2 py-1 text-xs bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white rounded transition-colors"
                      >
                        {resumingSessionId === session.sessionId ? t('resumingStatus') : t('continueBtn')}
                      </button>
                      <button
                        onClick={() => deleteBatchSessionHandler(session.sessionId)}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-400 rounded transition-colors"
                      >
                        {t('deleteBtn')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className={`border-t pt-4 ${!isDark ? 'border-gray-200' : 'border-gray-700'}`}>
            <h4 className={`text-sm font-semibold mb-2 ${!isDark ? 'text-gray-700' : 'text-gray-300'}`}>{t('customWeights')}</h4>
            <p className={`text-xs mb-3 ${!isDark ? 'text-amber-600' : 'text-amber-400'}`}>
              {t('weightsWarning')}
            </p>
            <div className="space-y-2">
              {Object.entries(dimensionWeights).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <label htmlFor={`weight-${key}`} className={`text-xs w-16 ${!isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    {({ quality: t('qualityDim'), maintenance: t('maintenanceDim'), practical: t('practicalDim'), documentation: t('documentationDim'), community: t('communityDim'), security: t('securityDim') })[key] || key}
                  </label>
                  <input
                    type="range"
                    id={`weight-${key}`}
                    min={0}
                    max={50}
                    value={String(value)}
                    onChange={e => setDimensionWeights(p => ({ ...p, [key]: Number(e.target.value) }))}
                    className="flex-1 accent-violet-500"
                  />
                  <span className={`text-xs w-8 text-right ${!isDark ? 'text-gray-700' : 'text-gray-300'}`}>{value}</span>
                </div>
              ))}
            </div>
            <button onClick={resetWeights} className={`flex-1 text-xs py-2 rounded-lg border mt-3 ${!isDark ? 'border-gray-300 text-gray-600 hover:bg-gray-100' : 'border-gray-700 text-gray-400 hover:bg-gray-800'} focus-visible:ring-2 focus-visible:ring-violet-400`}>
              {t('resetDefault')}
            </button>
          </div>
          <button
            onClick={() => setShowSettings(false)}
            className={`w-full text-sm py-2 ${!isDark ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-300'} focus-visible:ring-2 focus-visible:ring-violet-400`}
          >
            {t('close')}
          </button>
        </div>
      </AccessibleModal>

      <OnboardingGuide />
      <KeyboardHelpModal />
    </div>
  );
}

export default App;
