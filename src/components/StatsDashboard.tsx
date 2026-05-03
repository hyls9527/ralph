import React, { useEffect, useState, useCallback } from 'react';
import { tauri } from '../services/tauri';
import type { StatsData } from '../types';
import { useI18n } from '../i18n';

const gradeColors: Record<string, string> = {
  S: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  A: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  B: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  X: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const trackColors: Record<string, string> = {
  neglected: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'high-star': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  steady: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

const bucketColors: Record<string, string> = {
  '90-105': 'bg-violet-500',
  '80-89': 'bg-blue-500',
  '73-79': 'bg-emerald-500',
  '60-72': 'bg-amber-500',
  '0-59': 'bg-rose-500',
};

const bucketBorderColors: Record<string, string> = {
  '90-105': 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  '80-89': 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  '73-79': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  '60-72': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  '0-59': 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const evidenceColors: Record<string, string> = {
  L1: 'bg-emerald-500',
  L2: 'bg-blue-500',
  L3: 'bg-amber-500',
  L4: 'bg-orange-500',
  L5: 'bg-rose-500',
};

const evidenceLabels: Record<string, string> = {
  L1: 'L1 API验证',
  L2: 'L2 行为验证',
  L3: 'L3 文件验证',
  L4: 'L4 声明验证',
  L5: 'L5 无证据',
};

const languageColors = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
  'bg-teal-500', 'bg-indigo-500',
];

const StatsDashboard: React.FC = () => {
  const { t } = useI18n();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tauri.getStats();
      setStats(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-3 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-rose-400 mb-2">{t('loadFailed')}</p>
        <button
          onClick={loadStats}
          className="text-violet-400 hover:text-violet-300 underline text-sm"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p>{t('noStatsData')}</p>
      </div>
    );
  }

  const maxGradeCount = Math.max(...stats.byGrade.map(g => g.count), 1);
  const maxTrackCount = Math.max(...stats.byTrack.map(t => t.count), 1);
  const maxBucketCount = Math.max(...(stats.scoreDistribution?.map(b => b.count) || [1]), 1);
  const maxLanguageCount = Math.max(...(stats.byLanguage?.map(l => l.count) || [1]), 1);
  const maxEvidenceCount = Math.max(...(stats.byEvidence?.map(e => e.count) || [1]), 1);
  const passRate = stats.total > 0 ? ((stats.byGrade.filter(g => ['S', 'A', 'B'].includes(g.grade)).reduce((s, g) => s + g.count, 0)) / stats.total * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-gray-400 mt-1">{t('totalEvaluated')}</div>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
          <div className="text-2xl font-bold text-violet-400">{stats.avgScore}</div>
          <div className="text-xs text-gray-400 mt-1">{t('avgScore')}</div>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
          <div className="text-2xl font-bold text-amber-400">{stats.topScore}</div>
          <div className="text-xs text-gray-400 mt-1">{t('topScore')}</div>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
          <div className="text-2xl font-bold text-emerald-400">{stats.recent7d}</div>
          <div className="text-xs text-gray-400 mt-1">{t('recent7d')}</div>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
          <div className="text-2xl font-bold text-cyan-400">{passRate}%</div>
          <div className="text-xs text-gray-400 mt-1">{t('passRate')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/40 rounded-xl p-5 border border-gray-700/50">
          <h3 className="text-sm font-medium text-gray-300 mb-4">{t('scoreDistribution')}</h3>
          <div className="space-y-3">
            {(stats.scoreDistribution || []).map(({ bucket, count }) => (
              <div key={bucket} className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${bucketBorderColors[bucket] || 'border-gray-500/30 bg-gray-500/10 text-gray-400'}`}>
                  {bucket}
                </span>
                <div className="flex-1 bg-gray-700/50 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${bucketColors[bucket] || 'bg-gray-500'}`}
                    style={{ width: `${(count / maxBucketCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
              </div>
            ))}
            {(!stats.scoreDistribution || stats.scoreDistribution.length === 0) && (
              <p className="text-xs text-gray-500 text-center py-4">{t('noData')}</p>
            )}
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-xl p-5 border border-gray-700/50">
          <h3 className="text-sm font-medium text-gray-300 mb-4">{t('gradeDistribution')}</h3>
          <div className="space-y-3">
            {stats.byGrade.map(({ grade, count }) => (
              <div key={grade} className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${gradeColors[grade] || gradeColors.X}`}>
                  {grade}
                </span>
                <div className="flex-1 bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      grade === 'S' ? 'bg-violet-500' :
                      grade === 'A' ? 'bg-blue-500' :
                      grade === 'B' ? 'bg-emerald-500' : 'bg-gray-500'
                    }`}
                    style={{ width: `${(count / maxGradeCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800/40 rounded-xl p-5 border border-gray-700/50">
          <h3 className="text-sm font-medium text-gray-300 mb-4">{t('trackDistribution')}</h3>
          <div className="space-y-3">
            {stats.byTrack.map(({ track, count }) => (
              <div key={track} className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${trackColors[track] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                  {({ neglected: t('neglected'), 'high-star': t('highStar'), steady: t('steady') })[track] || track}
                </span>
                <div className="flex-1 bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      track === 'neglected' ? 'bg-amber-500' :
                      track === 'high-star' ? 'bg-rose-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${(count / maxTrackCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-xl p-5 border border-gray-700/50">
          <h3 className="text-sm font-medium text-gray-300 mb-4">{t('languageDistribution')}</h3>
          <div className="space-y-2.5">
            {(stats.byLanguage || []).map(({ language, count }, i) => (
              <div key={language} className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-600/30 bg-gray-700/30 text-gray-300 min-w-[70px]">
                  {language}
                </span>
                <div className="flex-1 bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${languageColors[i % languageColors.length]}`}
                    style={{ width: `${(count / maxLanguageCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
              </div>
            ))}
            {(!stats.byLanguage || stats.byLanguage.length === 0) && (
              <p className="text-xs text-gray-500 text-center py-4">{t('noData')}</p>
            )}
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-xl p-5 border border-gray-700/50">
          <h3 className="text-sm font-medium text-gray-300 mb-4">{t('evidenceDistribution')}</h3>
          <div className="space-y-2.5">
            {(stats.byEvidence || []).map(({ evidenceLevel, count }) => (
              <div key={evidenceLevel} className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-600/30 bg-gray-700/30 text-gray-300 min-w-[90px]">
                  {evidenceLabels[evidenceLevel] || evidenceLevel}
                </span>
                <div className="flex-1 bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${evidenceColors[evidenceLevel] || 'bg-gray-500'}`}
                    style={{ width: `${(count / maxEvidenceCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
              </div>
            ))}
            {(!stats.byEvidence || stats.byEvidence.length === 0) && (
              <p className="text-xs text-gray-500 text-center py-4">{t('noData')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={loadStats}
          className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          {t('refresh')}
        </button>
      </div>
    </div>
  );
};

export default StatsDashboard;
