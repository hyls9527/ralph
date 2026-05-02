import React, { useState, useCallback } from 'react';
import { tauri } from '../services/tauri';
import type { ProjectRecommendation } from '../types';
import { t } from '../i18n';

interface TrendingDiscoveryProps {
  onEvaluateProject: (repo: ProjectRecommendation) => void;
}

const TRENDING_LANGS = ['All', 'Rust', 'TypeScript', 'Python', 'Go', 'JavaScript', 'Vue', 'Svelte'];

const TrendingDiscovery: React.FC<TrendingDiscoveryProps> = ({ onEvaluateProject }) => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectRecommendation[]>([]);
  const [selectedLang, setSelectedLang] = useState('All');
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 3.258 1.37 6.12z" clipRule="evenodd" />
          </svg>
          {t('trendingTitle')}
        </h2>
        <button
          onClick={fetchTrending}
          disabled={loading}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('loading')}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('trendingFetch')}
            </>
          )}
        </button>
      </div>

      {/* 筛选器 */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">{t('language')}</span>
          <div className="flex gap-1">
            {TRENDING_LANGS.map(lang => (
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

      {/* 项目列表 */}
      {projects.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {projects.map((project, i) => (
            <div
              key={project.repo.fullName || i}
              className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-white truncate">
                  {project.repo.fullName}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{project.repo.description || t('noDescription')}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {project.repo.language && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      {project.repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
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

      {/* 空状态 */}
      {!loading && projects.length === 0 && !error && (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.501 4.617a1 1 0 00.95.69h4.885c.969 0 1.371 1.24.588 1.81l-3.966 2.886a1 1 0 00-.364 1.118l1.502 4.617c.3.921-.755 1.688-1.54 1.118L12 17.049l-3.966 2.886c-.784.57-1.838-.197-1.539-1.118l1.502-4.617a1 1 0 00-.364-1.118l-3.966-2.886c-.783-.57-.38-1.81.588-1.81h4.885a1 1 0 00.95-.69l1.501-4.617z" />
          </svg>
          <p className="text-sm">{t('trendingHint')}</p>
        </div>
      )}
    </div>
  );
};

export default TrendingDiscovery;
