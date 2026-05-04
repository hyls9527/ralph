import React, { useMemo } from 'react';
import type { ProjectRecommendation } from '../types';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';

interface TrendChartProps {
  projects: ProjectRecommendation[];
}

const TrendChart: React.FC<TrendChartProps> = ({ projects }) => {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const scoreDistribution = useMemo(() => {
    const bins = [0, 0, 0, 0];
    projects.forEach(p => {
      if (p.totalScore >= 84) bins[0]++;
      else if (p.totalScore >= 79) bins[1]++;
      else if (p.totalScore >= 73) bins[2]++;
      else bins[3]++;
    });
    return { S: bins[0], A: bins[1], B: bins[2], X: bins[3] };
  }, [projects]);

  const trackDistribution = useMemo(() => {
    const dist = { neglected: 0, 'high-star': 0, steady: 0 };
    projects.forEach(p => {
      dist[p.track]++;
    });
    return dist;
  }, [projects]);

  const avgScore = useMemo(() => {
    if (projects.length === 0) return 0;
    return projects.reduce((s, p) => s + p.totalScore, 0) / projects.length;
  }, [projects]);

  const maxDist = Math.max(scoreDistribution.S, scoreDistribution.A, scoreDistribution.B, scoreDistribution.X, 1);
  const chartHeight = 100;
  const barWidth = 40;
  const barGap = 20;
  const chartWidth = 4 * barWidth + 3 * barGap;

  const categories = [
    { label: t('sGrade'), value: scoreDistribution.S, color: '#8b5cf6' },
    { label: t('aGrade'), value: scoreDistribution.A, color: '#3b82f6' },
    { label: t('bGrade'), value: scoreDistribution.B, color: '#10b981' },
    { label: t('notSelected'), value: scoreDistribution.X, color: '#6b7280' },
  ];

  const trackCategories = [
    { label: t('neglected'), value: trackDistribution['neglected'], color: '#06b6d4' },
    { label: t('highStar'), value: trackDistribution['high-star'], color: '#f59e0b' },
    { label: t('steady'), value: trackDistribution['steady'], color: '#ec4899' },
  ];
  const maxTrackDist = Math.max(...trackCategories.map(c => c.value), 1);

  return (
    <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-900/80 border-gray-700' : 'bg-white/80 border-gray-200/80'}`}>
      <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('scoreDistributionStats')}</h3>
      <div className="flex gap-6">
        {/* 评分分布柱状图 */}
        <div className="flex-1">
          <div className={`flex items-center justify-between text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
            <span>{t('avgScore')}: <span className="text-violet-400 font-semibold">{avgScore.toFixed(1)}</span></span>
            <span>{t('totalProjects')}: {projects.length}</span>
          </div>
          <svg width={chartWidth + 20} height={chartHeight + 30} className="w-full" viewBox={`0 0 ${chartWidth + 20} ${chartHeight + 30}`}>
            {categories.map((cat, i) => {
              const barHeight = (cat.value / maxDist) * chartHeight;
              const x = 10 + i * (barWidth + barGap);
              const y = chartHeight - barHeight;
              return (
                <g key={cat.label}>
                  <rect x={x} y={y} width={barWidth} height={barHeight} rx={3} fill={cat.color} opacity={cat.value > 0 ? 0.8 : 0.3} />
                  {cat.value > 0 && (
                    <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fill="#d1d5db" fontSize={10}>{cat.value}</text>
                  )}
                  <text x={x + barWidth / 2} y={chartHeight + 15} textAnchor="middle" fill="#9ca3af" fontSize={9}>{cat.label}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 轨道分布柱状图 */}
        <div className="flex-1">
          <div className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('trackDistribution')}</div>
          <svg width={chartWidth / 4 * 3 + 20} height={chartHeight + 30} className="w-full" viewBox={`0 0 ${chartWidth / 4 * 3 + 20} ${chartHeight + 30}`}>
            {trackCategories.map((cat, i) => {
              const tw = chartWidth / 4 * 3;
              const bw = tw / 3 - 10;
              const barHeight = (cat.value / maxTrackDist) * chartHeight;
              const x = 10 + i * (bw + 10);
              const y = chartHeight - barHeight;
              return (
                <g key={cat.label}>
                  <rect x={x} y={y} width={bw} height={barHeight} rx={3} fill={cat.color} opacity={cat.value > 0 ? 0.8 : 0.3} />
                  {cat.value > 0 && (
                    <text x={x + bw / 2} y={y - 5} textAnchor="middle" fill="#d1d5db" fontSize={10}>{cat.value}</text>
                  )}
                  <text x={x + bw / 2} y={chartHeight + 15} textAnchor="middle" fill="#9ca3af" fontSize={9}>{cat.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default TrendChart;
