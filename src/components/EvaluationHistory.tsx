import React, { useState, useEffect, useCallback } from 'react';
import { tauri } from '../services/tauri';
import { t } from '../i18n';

interface ScoreTrendPoint {
  score: number;
  grade: string;
  track: string;
  evaluatedAt: string;
}

interface EvaluationHistoryProps {
  repoFullName: string;
  isLight?: boolean;
}

const gradeColors: Record<string, string> = {
  S: 'bg-violet-500/30 text-violet-300 border-violet-500/40',
  A: 'bg-blue-500/30 text-blue-300 border-blue-500/40',
  B: 'bg-green-500/30 text-green-300 border-green-500/40',
  X: 'bg-gray-500/30 text-gray-400 border-gray-500/40',
};

const trackLabels: Record<string, string> = {
  neglected: t('neglected'),
  'high-star': t('highStar'),
  steady: t('steady'),
};

const EvaluationHistory: React.FC<EvaluationHistoryProps> = ({ repoFullName, isLight }) => {
  const [trend, setTrend] = useState<ScoreTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrend = useCallback(async () => {
    if (!repoFullName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tauri.getEvaluationHistory(repoFullName);
      setTrend(data);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [repoFullName]);

  useEffect(() => {
    void fetchTrend();
  }, [fetchTrend]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="w-6 h-6 animate-spin text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-sm py-4 text-center ${isLight ? 'text-rose-500' : 'text-rose-400'}`}>
        {error}
      </div>
    );
  }

  if (trend.length === 0) {
    return (
      <div className={`text-sm py-8 text-center ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
        {t('noEvaluationHistory')}
      </div>
    );
  }

  // 计算评分变化
  const latestScore = trend[trend.length - 1]?.score || 0;
  const firstScore = trend[0]?.score || 0;
  const scoreDiff = latestScore - firstScore;
  const hasImproved = scoreDiff > 0;
  const hasDeclined = scoreDiff < 0;

  // SVG 趋势图
  const width = 400;
  const height = 120;
  const padding = { top: 10, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxScore = Math.max(...trend.map(t => t.score), 105);
  const minScore = Math.min(...trend.map(t => t.score), 0);
  const scoreRange = maxScore - minScore || 1;

  const getX = (i: number) => padding.left + (i / Math.max(trend.length - 1, 1)) * chartWidth;
  const getY = (score: number) => padding.top + chartHeight - ((score - minScore) / scoreRange) * chartHeight;

  const linePath = trend.map((t, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(t.score)}`).join(' ');

  return (
    <div>
      {/* 评分变化摘要 */}
      <div className={`rounded-lg p-3 mb-3 ${isLight ? 'bg-gray-50' : 'bg-gray-800/50'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
            {t('totalEvaluations', { n: trend.length })}
          </span>
          {trend.length >= 2 && (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                {t('scoreChange')}
              </span>
              <span className={`text-sm font-bold flex items-center gap-1 ${
                hasImproved ? 'text-emerald-500' : hasDeclined ? 'text-rose-500' : 'text-gray-400'
              }`}>
                {hasImproved && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                  </svg>
                )}
                {hasDeclined && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414l3.586 3.586H12z" clipRule="evenodd" />
                  </svg>
                )}
                {scoreDiff > 0 ? '+' : ''}{scoreDiff.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SVG 趋势图 */}
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="mx-auto" viewBox={`0 0 ${width} ${height}`}>
          {/* 网格线 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={padding.top + chartHeight * ratio}
              x2={width - padding.right}
              y2={padding.top + chartHeight * ratio}
              stroke={isLight ? '#e5e7eb' : '#374151'}
              strokeWidth={0.5}
              opacity={0.6}
            />
          ))}

          {/* Y 轴标签 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const score = minScore + scoreRange * (1 - ratio);
            return (
              <text
                key={i}
                x={padding.left - 8}
                y={padding.top + chartHeight * ratio + 4}
                textAnchor="end"
                fill={isLight ? '#9ca3af' : '#6b7280'}
                fontSize="10"
              >
                {score.toFixed(0)}
              </text>
            );
          })}

          {/* 趋势线 */}
          {trend.length >= 2 && (
            <path
              d={linePath}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 数据点 */}
          {trend.map((t, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getY(t.score)}
                r={4}
                fill="#8b5cf6"
                stroke={isLight ? '#ffffff' : '#111827'}
                strokeWidth={1.5}
              />
              {/* 等级标签 */}
              <text
                x={getX(i)}
                y={getY(t.score) - 10}
                textAnchor="middle"
                fill={t.grade === 'S' ? '#a855f7' : t.grade === 'A' ? '#3b82f6' : t.grade === 'B' ? '#22c55e' : '#6b7280'}
                fontSize="10"
                fontWeight="600"
              >
                {t.grade}
              </text>
              {/* X 轴日期标签（只显示部分） */}
              {i % Math.max(Math.ceil(trend.length / 5), 1) === 0 && (
                <text
                  x={getX(i)}
                  y={height - 5}
                  textAnchor="middle"
                  fill={isLight ? '#9ca3af' : '#6b7280'}
                  fontSize="9"
                >
                  {new Date(t.evaluatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* 详细历史记录 */}
      <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
        {trend.slice().reverse().slice(0, 10).map((pt, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-2 rounded-lg text-xs ${
              isLight ? 'bg-gray-50' : 'bg-gray-800/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`font-semibold px-1.5 py-0.5 rounded border ${gradeColors[pt.grade]}`}>
                {pt.grade}{t('gradeSuffix')}
              </span>
              <span className={isLight ? 'text-gray-700' : 'text-gray-300'}>
                {pt.score.toFixed(1)}{t('scoreUnit')}
              </span>
              <span className={isLight ? 'text-gray-500' : 'text-gray-400'}>
                {trackLabels[pt.track] || pt.track}{t('trackLabel')}
              </span>
            </div>
            <span className={isLight ? 'text-gray-400' : 'text-gray-500'}>
              {new Date(pt.evaluatedAt).toLocaleString('zh-CN')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EvaluationHistory;
