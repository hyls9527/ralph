import React, { useState, useMemo } from 'react';
import type { ProjectRecommendation } from '../types';
import TrustBadge from './TrustBadge';
import ConfidenceBadge from './ConfidenceBadge';
import ReportShare from './ReportShare';
import { t } from '../i18n';

interface ResultCardProps {
  project: ProjectRecommendation;
  onDetailClick: () => void;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
}

const areEqual = (prevProps: ResultCardProps, nextProps: ResultCardProps): boolean => {
  return (
    prevProps.project === nextProps.project &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.onDetailClick === nextProps.onDetailClick &&
    prevProps.onFavoriteToggle === nextProps.onFavoriteToggle
  );
};

const trackLabels: Record<string, string> = {
  neglected: '被忽视',
  'high-star': '高星',
  steady: '稳态',
};

const gradeColors: Record<string, string> = {
  S: 'bg-violet-500/30 text-violet-300 border-violet-500/40',
  A: 'bg-blue-500/30 text-blue-300 border-blue-500/40',
  B: 'bg-green-500/30 text-green-300 border-green-500/40',
  X: 'bg-gray-500/30 text-gray-400 border-gray-500/40',
};

const formatNumber = (num: number): string => {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

// SVG 雷达图组件
const RadarChart: React.FC<{ dimensions: { dimension: string; score: number; maxScore: number }[] }> = ({ dimensions }) => {
  const size = 200;
  const center = size / 2;
  const maxRadius = 80;
  const levels = 4;
  const n = dimensions.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const getPoint = (index: number, ratio: number) => {
    const angle = startAngle + index * angleStep;
    return {
      x: center + maxRadius * ratio * Math.cos(angle),
      y: center + maxRadius * ratio * Math.sin(angle),
    };
  };

  const levelPoints = useMemo(() =>
    Array.from({ length: levels }, (_, l) => {
      const ratio = (l + 1) / levels;
      return Array.from({ length: n }, (_, i) => getPoint(i, ratio));
    }), [n]);

  const labelPoints = useMemo(() =>
    dimensions.map((_, i) => getPoint(i, 1.15)), [n]);

  const dataPoints = dimensions.map((d, i) => {
    const ratio = d.maxScore > 0 ? Math.min(d.score / d.maxScore, 1) : 0;
    return getPoint(i, ratio);
  });

  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  const dimensionColors: string[] = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* 背景层级 */}
      {levelPoints.map((level, l) => (
        <polygon
          key={l}
          points={level.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#374151"
          strokeWidth={l === levels - 1 ? 1.5 : 0.5}
          opacity={0.6}
        />
      ))}
      {/* 轴线 */}
      {dimensions.map((_, i) => {
        const end = getPoint(i, 1);
        return <line key={i} x1={center} y1={center} x2={end.x} y2={end.y} stroke="#374151" strokeWidth={0.5} opacity={0.4} />;
      })}
      {/* 数据区域 */}
      <polygon points={polygonPoints} fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth={2} />
      {/* 数据点 */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={dimensionColors[i]} stroke="#111827" strokeWidth={1.5} />
      ))}
      {/* 维度标签 */}
      {labelPoints.map((p, i) => {
        const textAnchor = Math.abs(p.x - center) < 5 ? 'middle' : p.x < center ? 'end' : 'start';
        const dy = Math.abs(p.y - center) < 5 ? '0.3em' : p.y < center ? '-0.5em' : '1em';
        return (
          <text key={i} x={p.x} y={p.y} textAnchor={textAnchor} dy={dy}
            fill={dimensionColors[i]} fontSize="11" fontWeight="600">
            {dimensions[i].dimension}
          </text>
        );
      })}
    </svg>
  );
};

// 轨道专属指标徽章
const TrackMetricBadge: React.FC<{ track: string; project: ProjectRecommendation }> = ({ track, project }) => {
  if (track === 'neglected') {
    const { neglectIndex } = project;
    if (neglectIndex === undefined) return null;
    const color = neglectIndex >= 20 ? 'text-amber-300 border-amber-500/40 bg-amber-900/20' :
                  neglectIndex >= 10 ? 'text-emerald-300 border-emerald-500/40 bg-emerald-900/20' :
                  'text-gray-300 border-gray-500/40 bg-gray-900/20';
    return (
      <span className={`text-xs px-2 py-0.5 rounded border ${color}`} title="忽视指数">
        忽视: {neglectIndex.toFixed(1)}
      </span>
    );
  }
  if (track === 'high-star') {
    const { valueDensity } = project;
    if (valueDensity === undefined) return null;
    const color = valueDensity >= 0.8 ? 'text-amber-300 border-amber-500/40 bg-amber-900/20' :
                  valueDensity >= 0.6 ? 'text-emerald-300 border-emerald-500/40 bg-emerald-900/20' :
                  'text-rose-300 border-rose-500/40 bg-rose-900/20';
    return (
      <span className={`text-xs px-2 py-0.5 rounded border ${color}`} title="价值密度">
        价值密度: {valueDensity.toFixed(2)}
      </span>
    );
  }
  if (track === 'steady') {
    const { steadyState } = project;
    if (steadyState === undefined) return null;
    const color = steadyState >= 0.6 ? 'text-emerald-300 border-emerald-500/40 bg-emerald-900/20' :
                  steadyState >= 0.4 ? 'text-amber-300 border-amber-500/40 bg-amber-900/20' :
                  'text-rose-300 border-rose-500/40 bg-rose-900/20';
    return (
      <span className={`text-xs px-2 py-0.5 rounded border ${color}`} title="稳态系数">
        稳态: {steadyState.toFixed(2)}
      </span>
    );
  }
  return null;
};

// 防博弈警告指示器
const AntiGamingWarning: React.FC<{ warnings?: string[] }> = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="mt-3 bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span className="text-xs font-semibold text-amber-400">防博弈警告 ({warnings.length})</span>
      </div>
      <ul className="space-y-0.5">
        {warnings.slice(0, 3).map((w, i) => (
          <li key={i} className="text-xs text-amber-300/80 pl-5 relative before:content-['•'] before:absolute before:left-3 before:text-amber-500">
            {w}
          </li>
        ))}
        {warnings.length > 3 && (
          <li className="text-xs text-amber-400/60 pl-5">+{warnings.length - 3} 条更多</li>
        )}
      </ul>
    </div>
  );
};

// 维度子分数下钻
const DimensionDrillDown: React.FC<{ dimension: { dimension: string; score: number; maxScore: number; subScores?: [string, number, number][] } }> = ({ dimension }) => {
  const [open, setOpen] = useState(false);
  if (!dimension.subScores || dimension.subScores.length === 0) return null;

  return (
    <div className="border-t border-gray-700/50 pt-1.5 mt-1.5">
      <button onClick={() => setOpen(!open)} className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1 w-full">
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        {dimension.subScores.length} 项子分数
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 animate-fade-in">
          {dimension.subScores.map(([name, score, maxScore], i) => {
            const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 w-20 truncate">{name}</span>
                <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-gray-400 w-12 text-right">{score}/{maxScore}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ResultCard: React.FC<ResultCardProps> = ({ project, onDetailClick, isFavorite, onFavoriteToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const [radarView, setRadarView] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const { repo, trustBadge, totalScore, grade, track, oneLiner, evidenceLevel, recommendationIndex, dimensions, vetoFlags } = project;

  const dimensionColors: Record<string, string> = {
    '质量': 'text-emerald-400',
    '维护': 'text-blue-400',
    '实用': 'text-violet-400',
    '文档': 'text-amber-400',
    '社区': 'text-pink-400',
    '安全': 'text-cyan-400',
  };

  const hasVetoFlags = trustBadge.l2?.gateChecks.some(g => !g.passed);

  const handleShare = async () => {
    const text = t('shareText', { projectName: repo.fullName, score: totalScore.toFixed(1), grade, track: trackLabels[track] || track, url: repo.htmlUrl });
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-800 hover:border-violet-500/40 transition-all duration-200 animate-fade-in">
      {/* 否决项指示器 */}
      {hasVetoFlags && (
        <div className="h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 rounded-t-xl" />
      )}
      <div className="p-5">
        {/* Header: 项目名称 + 徽章 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">
              <a
                href={repo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-violet-400 transition-colors"
              >
                {repo.fullName}
              </a>
            </h3>
            <p className="text-sm text-gray-400 mt-1">{repo.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <TrustBadge badge={trustBadge} />
            <ConfidenceBadge level={evidenceLevel} size="sm" />
          </div>
        </div>

        {/* 统计栏 */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
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
          <span>更新于 {new Date(repo.updatedAt).toLocaleDateString('zh-CN')}</span>
          {onFavoriteToggle && (
            <button
              onClick={onFavoriteToggle}
              className={`transition-colors flex items-center gap-1 ${
                isFavorite ? 'text-amber-400 hover:text-amber-300' : 'text-gray-400 hover:text-amber-400'
              }`}
            >
              <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.501 4.617a1 1 0 00.95.69h4.885c.969 0 1.371 1.24.588 1.81l-3.966 2.886a1 1 0 00-.364 1.118l1.502 4.617c.3.921-.755 1.688-1.54 1.118L12 17.049l-3.966 2.886c-.784.57-1.838-.197-1.539-1.118l1.502-4.617a1 1 0 00-.364-1.118l-3.966-2.886c-.783-.57-.38-1.81.588-1.81h4.885a1 1 0 00.95-.69l1.501-4.617z" />
              </svg>
            </button>
          )}
          <ReportShare project={project} />
          <button
            onClick={handleShare}
            className={`transition-colors flex items-center gap-1 ${
              shareCopied ? 'text-emerald-400' : 'text-gray-400 hover:text-violet-400'
            }`}
            title={shareCopied ? '已复制到剪贴板' : '分享'}
          >
            {shareCopied ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            )}
          </button>
          <button onClick={onDetailClick} className="ml-auto text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
            详情
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>

        {/* 评分 + 等级 + 轨道 + 推荐指数 */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-violet-400">{totalScore.toFixed(1)}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${gradeColors[grade]}`}>
              {grade}级
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded">
            {trackLabels[track]}
          </span>
          <TrackMetricBadge track={track} project={project} />
          <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded">
            证据: {evidenceLevel}
          </span>
          <span className="text-xs px-2 py-0.5 bg-violet-900/30 text-violet-300 rounded border border-violet-700/40">
            推荐指数: {recommendationIndex.toFixed(2)}
          </span>
        </div>

        {/* 六维评分 — 进度条 / 雷达图切换 */}
        {dimensions && dimensions.length > 0 && (
          <div className="mt-4 bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">六维评分</span>
              <button
                onClick={() => setRadarView(!radarView)}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                {radarView ? '进度条' : '雷达图'}
              </button>
            </div>
            {radarView ? (
              <RadarChart dimensions={dimensions} />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {dimensions.map((dim) => {
                  const pct = dim.maxScore > 0 ? (dim.score / dim.maxScore) * 100 : 0;
                  const color = dimensionColors[dim.dimension] || 'text-gray-400';
                  return (
                    <div key={dim.dimension} className="flex flex-col">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{dim.dimension}</span>
                        <span className={`font-semibold ${color}`}>{dim.score}/{dim.maxScore}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <DimensionDrillDown dimension={dim} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 防博弈警告指示器 */}
        <AntiGamingWarning warnings={vetoFlags} />

        {/* 一句话推荐 */}
        <div className="mt-3 bg-gray-800/50 rounded-lg p-3 border-l-2 border-violet-500">
          <p className="text-sm text-gray-300">{oneLiner}</p>
        </div>

        {/* 展开 L2 详情 */}
        {trustBadge.l2 && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
            >
              <svg
                className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              {expanded ? '收起详情' : '展开 L2 评估详情'}
            </button>

            {expanded && (
              <div className="mt-2 bg-gray-800/50 rounded-lg p-4 text-xs space-y-2 animate-fade-in">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-gray-400 block">质量分</span>
                    <span className="text-lg font-semibold text-emerald-400">{trustBadge.l2.keyMetrics.qualityScore}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">维护分</span>
                    <span className="text-lg font-semibold text-blue-400">{trustBadge.l2.keyMetrics.maintenanceScore}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">安全状态</span>
                    <span className={`text-lg font-semibold ${
                      trustBadge.l2.keyMetrics.securityStatus === 'passed' ? 'text-emerald-400' :
                      trustBadge.l2.keyMetrics.securityStatus === 'warning' ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {trustBadge.l2.keyMetrics.securityStatus === 'passed' ? '通过' :
                       trustBadge.l2.keyMetrics.securityStatus === 'warning' ? '警告' : '未通过'}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="text-gray-500 block mb-1">检查项</span>
                  <div className="space-y-1">
                    {trustBadge.l2.gateChecks.map((gate, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-gray-400">{gate.gate}</span>
                        <span className={gate.passed ? 'text-emerald-400' : 'text-rose-400'}>
                          {gate.passed ? '通过' : '未通过'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {trustBadge.l2.evidenceSummary && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-gray-400">{trustBadge.l2.evidenceSummary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ResultCard, areEqual);
