import React, { useState, useMemo } from 'react';
import type { ProjectRecommendation } from '../types';
import EvaluationHistory from './EvaluationHistory';
import PipelineVisualization from './PipelineVisualization';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

interface ProjectDetailProps {
  project: ProjectRecommendation;
  onClose: () => void;
}

const dimensionColors: Record<string, string> = {
  '质量': 'bg-emerald-500',
  '维护': 'bg-blue-500',
  '实用': 'bg-violet-500',
  '文档': 'bg-amber-500',
  '社区': 'bg-pink-500',
  '安全': 'bg-cyan-500',
};

const dimensionStrokeColors: Record<string, string> = {
  '质量': '#10b981',
  '维护': '#3b82f6',
  '实用': '#8b5cf6',
  '文档': '#f59e0b',
  '社区': '#ec4899',
  '安全': '#06b6d4',
};

const RadarChart: React.FC<{ dimensions: ProjectRecommendation['dimensions']; size?: number; isDark: boolean }> = ({ dimensions, size = 200, isDark }) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const levels = 5;

  const angleSlice = (2 * Math.PI) / dimensions.length;

  const getPoint = (i: number, value: number, maxVal: number) => {
    const angle = angleSlice * i - Math.PI / 2;
    const r = maxVal > 0 ? (value / maxVal) * radius : 0;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const levelPolygons = Array.from({ length: levels }, (_, level) => {
    const r = (radius / levels) * (level + 1);
    const points = dimensions.map((_, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
    return <polygon key={level} points={points} fill="none" stroke={isDark ? '#374151' : '#d1d5db'} strokeWidth="0.5" />;
  });

  const axes = dimensions.map((_, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x2 = cx + radius * Math.cos(angle);
    const y2 = cy + radius * Math.sin(angle);
    return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke={isDark ? '#374151' : '#d1d5db'} strokeWidth="0.5" />;
  });

  const dataPoints = dimensions.map((dim, i) => getPoint(i, dim.score, dim.maxScore));
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  const labels = dimensions.map((dim, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const labelR = radius + 18;
    const x = cx + labelR * Math.cos(angle);
    const y = cy + labelR * Math.sin(angle);
    return (
      <text
        key={i}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        className={isDark ? 'fill-gray-400' : 'fill-gray-500'}
        style={{ fontSize: '10px' }}
      >
        {dim.dimension}
      </text>
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {levelPolygons}
      {axes}
      <polygon points={dataPolygon} fill="rgba(139, 92, 246, 0.2)" stroke="#8b5cf6" strokeWidth="1.5" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#8b5cf6" />
      ))}
      {labels}
    </svg>
  );
};

const ActivityTimeline: React.FC<{ project: ProjectRecommendation; isDark: boolean }> = ({ project, isDark }) => {
  const { t } = useI18n();
  const { repo, decisionTrail } = project;

  const events = useMemo(() => {
    const items: { date: string; label: string; detail: string; type: 'created' | 'updated' | 'pushed' | 'eval' }[] = [];

    if (repo.createdAt) {
      items.push({ date: repo.createdAt, label: t('repoCreated'), detail: '', type: 'created' });
    }
    if (repo.pushedAt && repo.pushedAt !== repo.updatedAt) {
      items.push({ date: repo.pushedAt, label: t('lastPush'), detail: '', type: 'pushed' });
    }
    if (repo.updatedAt) {
      items.push({ date: repo.updatedAt, label: t('lastUpdated'), detail: '', type: 'updated' });
    }

    if (decisionTrail && decisionTrail.length > 0) {
      decisionTrail.forEach((step) => {
        items.push({
          date: new Date().toISOString(),
          label: step.step,
          detail: `${step.action}: ${step.before.toFixed(1)} → ${step.after.toFixed(1)} (${step.reason})`,
          type: 'eval',
        });
      });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [repo, decisionTrail, t]);

  const typeIcons: Record<string, string> = {
    created: '🆕',
    updated: '🔄',
    pushed: '⬆️',
    eval: '📊',
  };

  const typeColors: Record<string, string> = {
    created: 'border-emerald-500 bg-emerald-500',
    updated: 'border-blue-500 bg-blue-500',
    pushed: 'border-amber-500 bg-amber-500',
    eval: 'border-violet-500 bg-violet-500',
  };

  return (
    <div className="space-y-1">
      {events.map((event, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-2.5 h-2.5 rounded-full border-2 ${typeColors[event.type]}`} />
            {i < events.length - 1 && <div className={`w-px flex-1 my-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />}
          </div>
          <div className="pb-3 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{typeIcons[event.type]}</span>
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{event.label}</span>
            </div>
            {event.detail && (
              <p className="text-xs text-gray-500 mt-0.5">{event.detail}</p>
            )}
            <p className="text-xs text-gray-600 mt-0.5">
              {new Date(event.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

const SecuritySummary: React.FC<{ project: ProjectRecommendation; isDark: boolean }> = ({ project, isDark }) => {
  const { t } = useI18n();
  const { trustBadge, vetoFlags, gateChecks } = project;

  const securityGate = gateChecks.find(g => g.gate.includes('安全') || g.gate.includes('Security'));
  const licenseGate = gateChecks.find(g => g.gate.includes('License') || g.gate.includes('协议'));

  const securityScore = project.dimensions.find(d => d.dimension === '安全')?.score ?? 0;
  const securityMax = project.dimensions.find(d => d.dimension === '安全')?.maxScore ?? 20;
  const securityPct = securityMax > 0 ? (securityScore / securityMax) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('securityScore')}</span>
          <span className={`text-sm font-semibold ${securityPct >= 70 ? 'text-emerald-400' : securityPct >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
            {securityScore}/{securityMax}
          </span>
        </div>
        <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div
            className={`h-full rounded-full transition-all ${securityPct >= 70 ? 'bg-emerald-500' : securityPct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${securityPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
          <span className={`text-xs block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('licenseStatus')}</span>
          <span className={`text-sm font-medium ${licenseGate?.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
            {licenseGate?.passed ? t('passed') : t('failed')}
          </span>
        </div>
        <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
          <span className={`text-xs block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('securityGate')}</span>
          <span className={`text-sm font-medium ${securityGate?.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
            {securityGate?.passed ? t('passed') : t('failed')}
          </span>
        </div>
        <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
          <span className={`text-xs block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('trustLevel')}</span>
          <span className={`text-sm font-medium ${
            trustBadge.l1.status === 'recommended' ? 'text-emerald-400' :
            trustBadge.l1.status === 'caution' ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {trustBadge.l1.label}
          </span>
        </div>
        <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
          <span className={`text-xs block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('vetoFlags')}</span>
          <span className={`text-sm font-medium ${vetoFlags.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {vetoFlags.length === 0 ? t('none') : `${vetoFlags.length}`}
          </span>
        </div>
      </div>

      {vetoFlags.length > 0 && (
        <div className="space-y-1.5">
          {vetoFlags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 bg-rose-900/20 border border-rose-500/30 rounded-lg p-2.5">
              <span className="text-xs text-rose-400 flex-shrink-0 mt-0.5">⚠️</span>
              <span className="text-xs text-rose-300">{flag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onClose }) => {
  const { t } = useI18n();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'dimensions' | 'visual' | 'activity' | 'security' | 'gates' | 'warnings' | 'history' | 'pipeline'>('overview');
  const { repo, trustBadge, totalScore, grade, track, oneLiner, evidenceLevel, recommendationIndex, dimensions, vetoFlags, gateChecks, neglectIndex, valueDensity, steadyState, confidenceTier } = project;

  const trackLabels: Record<string, string> = { neglected: t('neglected'), 'high-star': t('highStar'), steady: t('steady') };
  const gradeColors: Record<string, string> = {
    S: 'bg-violet-500/30 text-violet-300 border-violet-500/40',
    A: 'bg-blue-500/30 text-blue-300 border-blue-500/40',
    B: 'bg-green-500/30 text-green-300 border-green-500/40',
    X: 'bg-gray-500/30 text-gray-400 border-gray-500/40',
  };

  const formatNumber = (num: number): string => num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num.toString();

  const tabs = [
    { key: 'overview' as const, label: t('overview') },
    { key: 'visual' as const, label: t('visual') },
    { key: 'dimensions' as const, label: t('dimensionDetails') },
    { key: 'pipeline' as const, label: t('pipeline') },
    { key: 'activity' as const, label: t('activity') },
    { key: 'security' as const, label: t('security') },
    { key: 'gates' as const, label: t('gateChecks') },
    { key: 'warnings' as const, label: t('warnings') },
    { key: 'history' as const, label: t('historyTrend') },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl border overflow-hidden animate-fade-in ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className={`text-xl font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className="hover:text-violet-400 transition-colors">
                  {repo.fullName}
                </a>
              </h2>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{repo.description}</p>
              <div className={`flex items-center gap-3 mt-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {formatNumber(repo.stargazersCount)}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  {formatNumber(repo.forksCount)}
                </span>
                {repo.language && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    {repo.language}
                  </span>
                )}
                <span>{t('updated')} {new Date(repo.updatedAt).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-violet-400">{totalScore.toFixed(1)}</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded border ${gradeColors[grade]}`}>{grade}{t('gradeSuffix')}</span>
              <button onClick={onClose} className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} transition-colors`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>{trackLabels[track]}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>{t('evidenceLabel')}: {evidenceLevel}</span>
            <span className="text-xs px-2 py-0.5 bg-violet-900/30 text-violet-300 rounded border border-violet-700/40">{t('recommendationIndex')}: {recommendationIndex.toFixed(2)}</span>
            <span className={`text-xs px-2 py-0.5 rounded border ${
              confidenceTier === 'tier1-core' ? 'bg-emerald-900/20 text-emerald-300 border-emerald-500/40' :
              confidenceTier === 'tier2-extended' ? 'bg-blue-900/20 text-blue-300 border-blue-500/40' :
              isDark ? 'bg-gray-800 text-gray-400 border-gray-600/40' : 'bg-gray-100 text-gray-600 border-gray-300/40'
            }`}>{t('confidenceTier')}: {t(confidenceTier)}</span>
            {track === 'neglected' && neglectIndex !== undefined && (
              <span className="text-xs px-2 py-0.5 bg-emerald-900/20 text-emerald-300 rounded border border-emerald-500/40">{t('neglectIndex')}: {neglectIndex.toFixed(1)}</span>
            )}
            {track === 'high-star' && valueDensity !== undefined && (
              <span className="text-xs px-2 py-0.5 bg-amber-900/20 text-amber-300 rounded border border-amber-500/40">{t('valueDensity')}: {valueDensity.toFixed(2)}</span>
            )}
            {track === 'steady' && steadyState !== undefined && (
              <span className="text-xs px-2 py-0.5 bg-blue-900/20 text-blue-300 rounded border border-blue-500/40">{t('steadyState')}: {steadyState.toFixed(2)}</span>
            )}
          </div>
        </div>

        <div className={`flex border-b overflow-x-auto ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key ? 'text-violet-400 border-b-2 border-violet-500' : `${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
              }`}>
              {tab.label}
              {tab.key === 'warnings' && vetoFlags && vetoFlags.length > 0 && (
                <span className="ml-1 text-xs text-amber-400">({vetoFlags.length})</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className={`rounded-lg p-4 border-l-2 border-violet-500 ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{oneLiner}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                  <span className={`text-xs block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('qualityScore')}</span>
                  <span className="text-lg font-semibold text-emerald-400">{trustBadge.l2?.keyMetrics.qualityScore ?? '-'}</span>
                </div>
                <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                  <span className={`text-xs block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('maintenanceScore')}</span>
                  <span className="text-lg font-semibold text-blue-400">{trustBadge.l2?.keyMetrics.maintenanceScore ?? '-'}</span>
                </div>
                <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                  <span className={`text-xs block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('securityStatus')}</span>
                  <span className={`text-lg font-semibold ${
                    trustBadge.l2?.keyMetrics.securityStatus === 'passed' ? 'text-emerald-400' :
                    trustBadge.l2?.keyMetrics.securityStatus === 'warning' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {trustBadge.l2?.keyMetrics.securityStatus === 'passed' ? t('securityPassed') :
                     trustBadge.l2?.keyMetrics.securityStatus === 'warning' ? t('securityWarning') : t('securityFailed')}
                  </span>
                </div>
                <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                  <span className={`text-xs block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('evidenceLevel')}</span>
                  <span className="text-lg font-semibold text-violet-400">{evidenceLevel}</span>
                </div>
              </div>
              {repo.topics && repo.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {repo.topics.map(topic => (
                    <span key={topic} className="text-xs px-2 py-0.5 bg-violet-900/20 text-violet-300 rounded-full border border-violet-700/30">
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'visual' && (
            <div className="space-y-4">
              <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                <h4 className={`text-sm font-medium mb-3 text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('dimensionRadar')}</h4>
                <RadarChart dimensions={dimensions} size={220} isDark={isDark} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {dimensions.map(dim => {
                  return (
                    <div key={dim.dimension} className={`rounded-lg p-3 text-center ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                      <div className="text-lg font-bold" style={{ color: dimensionStrokeColors[dim.dimension] }}>
                        {dim.score.toFixed(1)}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{dim.dimension}</div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/ {dim.maxScore}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'dimensions' && (
            <div className="space-y-3">
              {dimensions.map((dim) => {
                const pct = dim.maxScore > 0 ? (dim.score / dim.maxScore) * 100 : 0;
                return (
                  <div key={dim.dimension} className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{dim.dimension}</span>
                      <span className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{dim.score} / {dim.maxScore}</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <div className={`h-full rounded-full ${dimensionColors[dim.dimension] || 'bg-gray-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    {dim.subScores && dim.subScores.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {dim.subScores.map(([name, score, maxScore], i) => {
                          const subPct = maxScore > 0 ? (score / maxScore) * 100 : 0;
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'} w-20 truncate`}>{name}</span>
                              <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                <div className={`h-full rounded-full ${subPct >= 70 ? 'bg-emerald-500' : subPct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${subPct}%` }} />
                              </div>
                              <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'} w-12 text-right`}>{score}/{maxScore}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'activity' && (
            <ActivityTimeline project={project} isDark={isDark} />
          )}

          {activeTab === 'security' && (
            <SecuritySummary project={project} isDark={isDark} />
          )}

          {activeTab === 'gates' && (
            <div className="space-y-2">
              {gateChecks.map((gate, i) => (
                <div key={i} className={`flex items-center justify-between rounded-lg p-3 ${isDark ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                  <div>
                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{gate.gate}</span>
                    {gate.reason && <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{gate.reason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{gate.evidenceLevel}</span>
                    <span className={`text-sm font-medium ${gate.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {gate.passed ? t('passed') : t('failed')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'warnings' && (
            <div>
              {vetoFlags && vetoFlags.length > 0 ? (
                <div className="space-y-2">
                  {vetoFlags.map((w, i) => (
                    <div key={i} className="flex items-start gap-3 bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                      <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-amber-300">{w}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('noWarnings')}</div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <EvaluationHistory repoFullName={repo.fullName} />
          )}

          {activeTab === 'pipeline' && (
            <PipelineVisualization project={project} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
