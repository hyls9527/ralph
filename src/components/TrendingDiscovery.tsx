import React, { useState, useCallback, useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  tauri,
  type DiscoveryStatus,
  type DiscoveryConfig,
} from '../services/tauri';
import type { ProjectRecommendation } from '../types';
import { useI18n } from '../i18n';
import { useNotification } from '../hooks/useNotification';

interface TrendingDiscoveryProps {
  onEvaluateProject: (repo: ProjectRecommendation) => void;
}

const TRENDING_LANGS = [
  'All',
  'Rust',
  'TypeScript',
  'Python',
  'Go',
  'JavaScript',
  'Vue',
  'Svelte',
];

type TabMode = 'trending' | 'discovery';

const TrendingDiscovery: React.FC<TrendingDiscoveryProps> = ({
  onEvaluateProject,
}) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectRecommendation[]>([]);
  const [selectedLang, setSelectedLang] = useState('All');
  const [error, setError] = useState<string | null>(null);

  const [tabMode, setTabMode] = useState<TabMode>('trending');
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] =
    useState<DiscoveryStatus | null>(null);
  const [discoveryResults, setDiscoveryResults] = useState<
    ProjectRecommendation[]
  >([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [configForm, setConfigForm] = useState<DiscoveryConfig>({
    topics: [],
    languages: [],
    minStars: 10,
    maxStars: 500,
    minScore: 73,
    intervalMinutes: 60,
    maxPerRound: 5,
  });
  const [configSaving, setConfigSaving] = useState(false);
  const { notifyDiscovery, requestPermission, permission } = useNotification();
  const prevDiscoveryCount = useRef(0);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    (async () => {
      try {
        unlisten = await listen<{
          status: DiscoveryStatus;
          newDiscoveries: number;
        }>('discovery_update', (event) => {
          setDiscoveryStatus(event.payload.status);
          setDiscoveryRunning(event.payload.status.running);
          if (event.payload.newDiscoveries > 0) {
            loadDiscoveryResults().then(() => {
              const newCount = event.payload.status.discoveriesCount;
              if (
                newCount > prevDiscoveryCount.current &&
                prevDiscoveryCount.current > 0
              ) {
                notifyDiscovery(
                  t('newDiscoveries', { count: event.payload.newDiscoveries }),
                  0,
                  '',
                  newCount,
                );
              }
              prevDiscoveryCount.current = newCount;
            });
          }
        });
      } catch {
        // event listener setup failed - non-critical
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    checkDiscoveryStatus();
    loadDiscoveryConfig();
  }, []);

  const checkDiscoveryStatus = async () => {
    try {
      const status = await tauri.getDiscoveryStatus();
      setDiscoveryStatus(status);
      setDiscoveryRunning(status.running);
    } catch {
      // status check failed - non-critical
    }
  };

  const loadDiscoveryResults = async () => {
    try {
      const results = await tauri.getDiscoveryResults();
      setDiscoveryResults(results);
    } catch {
      // load failed - non-critical
    }
  };

  const loadDiscoveryConfig = async () => {
    try {
      const config = await tauri.getDiscoveryConfig();
      setConfigForm(config);
    } catch {
      // load failed - use defaults
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      await tauri.updateDiscoveryConfig(configForm);
      setShowSettings(false);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setConfigSaving(false);
    }
  };

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tauri.getTrendingRepos();
      setProjects(response.results || []);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStartDiscovery = async () => {
    setDiscoveryLoading(true);
    setError(null);
    try {
      const status = await tauri.startDiscovery();
      setDiscoveryStatus(status);
      setDiscoveryRunning(true);
      await loadDiscoveryResults();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleStopDiscovery = async () => {
    setDiscoveryLoading(true);
    try {
      const status = await tauri.stopDiscovery();
      setDiscoveryStatus(status);
      setDiscoveryRunning(false);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleClearDiscovery = async () => {
    try {
      await tauri.clearDiscoveryResults();
      setDiscoveryResults([]);
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handleExport = (format: 'json' | 'markdown') => {
    if (discoveryResults.length === 0) return;

    if (format === 'json') {
      const json = JSON.stringify(discoveryResults, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ralph-discovery-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const lines = ['# Ralph Discovery Results\n'];
      for (const r of discoveryResults) {
        lines.push(`## ${r.repo.fullName}`);
        lines.push(`- **Score**: ${r.totalScore}`);
        lines.push(`- **Grade**: ${r.grade}`);
        lines.push(`- **Stars**: ${r.repo.stargazersCount}`);
        lines.push(`- **Track**: ${r.track}`);
        if (r.repo.description) {
          lines.push(`- **Description**: ${r.repo.description}`);
        }
        lines.push('');
      }
      const md = lines.join('\n');
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ralph-discovery-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const filteredProjects =
    selectedLang === 'All'
      ? projects
      : projects.filter((p) => p.repo.language === selectedLang);

  const filteredDiscovery =
    selectedLang === 'All'
      ? discoveryResults
      : discoveryResults.filter((p) => p.repo.language === selectedLang);

  const formatTime = (iso: string | null) => {
    if (!iso) return '--';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg
            className="w-5 h-5 text-amber-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 3.258 1.37 6.12z"
              clipRule="evenodd"
            />
          </svg>
          {t('trendingTitle')}
        </h2>

        {/* Tab 切换 */}
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setTabMode('trending')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tabMode === 'trending'
                ? 'bg-amber-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Trending
          </button>
          <button
            onClick={() => {
              setTabMode('discovery');
              loadDiscoveryResults();
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tabMode === 'discovery'
                ? 'bg-violet-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Discovery
            {discoveryRunning && (
              <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">{t('language')}</span>
          <div className="flex gap-1">
            {TRENDING_LANGS.map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  selectedLang === lang
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 bg-rose-900/20 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* ===== Trending 模式 ===== */}
      {tabMode === 'trending' && (
        <>
          <div className="mb-3">
            <button
              onClick={fetchTrending}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {t('loading')}
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {t('trendingFetch')}
                </>
              )}
            </button>
          </div>

          {filteredProjects.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredProjects.map((project, i) => (
                <div
                  key={project.repo.fullName || i}
                  className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">
                      {project.repo.fullName}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {project.repo.description || t('noDescription')}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {project.repo.language && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-violet-500" />
                          {project.repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {(project.repo.stargazersCount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onEvaluateProject(project)}
                    className="ml-4 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-medium transition-colors"
                  >
                    {t('evaluateShort')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && projects.length === 0 && !error && (
            <div className="text-center py-12 text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.501 4.617a1 1 0 00.95.69h4.885c.969 0 1.371 1.24.588 1.81l-3.966 2.886a1 1 0 00-.364 1.118l1.502 4.617c.3.921-.755 1.688-1.54 1.118L12 17.049l-3.966 2.886c-.784.57-1.838-.197-1.539-1.118l1.502-4.617a1 1 0 00-.364-1.118l-3.966-2.886c-.783-.57-.38-1.81.588-1.81h4.885a1 1 0 00.95-.69l1.501-4.617z"
                />
              </svg>
              <p className="text-sm">{t('trendingHint')}</p>
            </div>
          )}
        </>
      )}

      {/* ===== Discovery 模式 ===== */}
      {tabMode === 'discovery' && (
        <>
          {/* 控制栏 */}
          <div className="flex items-center gap-3 mb-4">
            {!discoveryRunning ? (
              <button
                onClick={handleStartDiscovery}
                disabled={discoveryLoading}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {discoveryLoading ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {t('loading')}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                      />
                    </svg>
                    {t('startDiscovery')}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleStopDiscovery}
                disabled={discoveryLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
                {t('stopDiscovery')}
              </button>
            )}

            {discoveryResults.length > 0 && (
              <button
                onClick={handleClearDiscovery}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
              >
                {t('clearResults')}
              </button>
            )}

            {discoveryResults.length > 0 && (
              <>
                <button
                  onClick={() => handleExport('json')}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-emerald-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  JSON
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-emerald-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  MD
                </button>
              </>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                showSettings
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title="发现设置"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>

          {/* 设置面板 */}
          {showSettings && (
            <div className="mb-4 bg-gray-800/50 rounded-lg border border-gray-700 p-4">
              <h3 className="text-sm font-medium text-white mb-3">
                {t('discoverySettings')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {t('searchInterval')}
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={configForm.intervalMinutes}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        intervalMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {t('searchesPerRound')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={configForm.maxPerRound}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        maxPerRound: Number(e.target.value),
                      })
                    }
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {t('minScoreLabel')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={105}
                    step={0.5}
                    value={configForm.minScore}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        minScore: Number(e.target.value),
                      })
                    }
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {t('starRange')}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={configForm.minStars}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          minStars: Number(e.target.value),
                        })
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                      placeholder={t('minValue')}
                    />
                    <span className="text-gray-500 text-xs">-</span>
                    <input
                      type="number"
                      min={0}
                      value={configForm.maxStars}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          maxStars: Number(e.target.value),
                        })
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                      placeholder={t('maxValue')}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">
                    {t('searchTopics')}
                  </label>
                  <input
                    type="text"
                    value={configForm.topics.join(', ')}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        topics: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                    placeholder="developer-tools, rust, cli, ai, ..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">
                    {t('languagesComma')}
                  </label>
                  <input
                    type="text"
                    value={configForm.languages.join(', ')}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        languages: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                    placeholder="Rust, TypeScript, Python, Go"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleSaveConfig}
                  disabled={configSaving}
                  className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white rounded text-xs font-medium transition-colors"
                >
                  {configSaving ? t('saving') : t('saveConfig')}
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs font-medium transition-colors"
                >
                  {t('cancel')}
                </button>
                {permission !== 'granted' && (
                  <button
                    onClick={requestPermission}
                    className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-amber-200 rounded text-xs font-medium transition-colors"
                  >
                    {t('enableNotifications')}
                  </button>
                )}
                {permission === 'granted' && (
                  <span className="text-xs text-emerald-400">
                    {t('notificationsEnabled')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 状态信息 */}
          {discoveryStatus && (
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-2.5">
                <div className="text-xs text-gray-400">{t('statusLabel')}</div>
                <div className="text-sm font-medium flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full ${discoveryRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}
                  />
                  <span
                    className={
                      discoveryRunning ? 'text-green-400' : 'text-gray-400'
                    }
                  >
                    {discoveryRunning ? t('running') : t('stopped')}
                  </span>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2.5">
                <div className="text-xs text-gray-400">
                  {t('discoveredProjects')}
                </div>
                <div className="text-sm font-medium text-white mt-0.5">
                  {discoveryStatus.discoveriesCount}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2.5">
                <div className="text-xs text-gray-400">{t('lastRun')}</div>
                <div className="text-sm font-medium text-white mt-0.5 truncate">
                  {formatTime(discoveryStatus.lastRunAt)}
                </div>
              </div>
            </div>
          )}

          {/* 发现结果列表 */}
          {filteredDiscovery.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredDiscovery.map((project, i) => (
                <div
                  key={project.repo.fullName || i}
                  className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white truncate">
                        {project.repo.fullName}
                      </h3>
                      {project.grade && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            project.grade === 'S'
                              ? 'bg-amber-500/20 text-amber-400'
                              : project.grade === 'A'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : project.grade === 'B'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {project.grade}
                        </span>
                      )}
                      {project.totalScore !== undefined && (
                        <span className="text-[10px] text-gray-500">
                          {project.totalScore}分
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {project.repo.description || t('noDescription')}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {project.repo.language && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-violet-500" />
                          {project.repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {(project.repo.stargazersCount || 0).toLocaleString()}
                      </span>
                      {project.track && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50">
                          {project.track}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onEvaluateProject(project)}
                    className="ml-4 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-medium transition-colors"
                  >
                    {t('evaluateShort')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {!discoveryRunning && discoveryResults.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-sm">{t('discoveryEmptyHint')}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t('discoveryEmptySubHint')}
              </p>
            </div>
          )}

          {discoveryRunning && discoveryResults.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 animate-spin text-violet-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <p className="text-sm">{t('discoverySearching')}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t('discoveryFirstTime')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrendingDiscovery;
