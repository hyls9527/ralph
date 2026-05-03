import React, { useMemo } from 'react';
import type { ProjectRecommendation } from '../types';
import { useI18n } from '../i18n';

interface ComparisonPanelProps {
  projects: ProjectRecommendation[];
  onExit: () => void;
  onRemoveProject?: (fullName: string) => void;
}

const DIMENSION_NAMES = ['质量', '维护', '实用', '文档', '社区', '安全'];

const DIMENSION_COLORS: Record<
  string,
  { stroke: string; fill: string; text: string }
> = {
  质量: {
    stroke: '#34d399',
    fill: 'rgba(52,211,153,0.15)',
    text: 'text-emerald-400',
  },
  维护: {
    stroke: '#60a5fa',
    fill: 'rgba(96,165,250,0.15)',
    text: 'text-blue-400',
  },
  实用: {
    stroke: '#a78bfa',
    fill: 'rgba(167,139,250,0.15)',
    text: 'text-violet-400',
  },
  文档: {
    stroke: '#fbbf24',
    fill: 'rgba(251,191,36,0.15)',
    text: 'text-amber-400',
  },
  社区: {
    stroke: '#f472b6',
    fill: 'rgba(244,114,182,0.15)',
    text: 'text-pink-400',
  },
  安全: {
    stroke: '#22d3ee',
    fill: 'rgba(34,211,238,0.15)',
    text: 'text-cyan-400',
  },
};

const PROJECT_COLORS = [
  { stroke: '#a78bfa', fill: 'rgba(167,139,250,0.2)' },
  { stroke: '#34d399', fill: 'rgba(52,211,153,0.2)' },
  { stroke: '#60a5fa', fill: 'rgba(96,165,250,0.2)' },
  { stroke: '#fbbf24', fill: 'rgba(251,191,36,0.2)' },
];

const GRADE_COLORS: Record<string, string> = {
  S: 'bg-violet-500/30 text-violet-300 border-violet-500/40',
  A: 'bg-blue-500/30 text-blue-300 border-blue-500/40',
  B: 'bg-green-500/30 text-green-300 border-green-500/40',
  X: 'bg-gray-500/30 text-gray-400 border-gray-500/40',
};

const getTrackLabel = (track: string): string => {
  switch (track) {
    case 'neglected':
      return t('trackNeglected');
    case 'high-star':
      return t('trackHighStar');
    case 'steady':
      return t('trackSteady');
    default:
      return track;
  }
};

interface RadarChartProps {
  projects: ProjectRecommendation[];
  size: number;
}

const RadarChart: React.FC<RadarChartProps> = ({ projects, size }) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const levels = 5;

  const angleSlice = (2 * Math.PI) / DIMENSION_NAMES.length;

  const getPoint = (i: number, value: number, maxVal: number) => {
    const angle = angleSlice * i - Math.PI / 2;
    const r = (value / maxVal) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const getLabelPoint = (i: number) => {
    const angle = angleSlice * i - Math.PI / 2;
    const r = radius + 18;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const projectData = useMemo(() => {
    return projects.map((p, pi) => {
      const scores = DIMENSION_NAMES.map((dim) => {
        const d = p.dimensions?.find((d) => d.dimension === dim);
        return d ? (d.score / d.maxScore) * 100 : 0;
      });
      return { scores, color: PROJECT_COLORS[pi % PROJECT_COLORS.length] };
    });
  }, [projects]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto"
    >
      {Array.from({ length: levels }).map((_, level) => {
        const r = (radius / levels) * (level + 1);
        const points = DIMENSION_NAMES.map((_, i) => {
          const angle = angleSlice * i - Math.PI / 2;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        }).join(' ');
        return (
          <polygon
            key={level}
            points={points}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
          />
        );
      })}

      {DIMENSION_NAMES.map((_, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={cx + radius * Math.cos(angle)}
            y2={cy + radius * Math.sin(angle)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
          />
        );
      })}

      {projectData.map((pd, pi) => {
        const points = DIMENSION_NAMES.map((_, i) => {
          const pt = getPoint(i, pd.scores[i], 100);
          return `${pt.x},${pt.y}`;
        }).join(' ');

        return (
          <g key={`project-${pi}`}>
            <polygon
              points={points}
              fill={pd.color.fill}
              stroke={pd.color.stroke}
              strokeWidth="1.5"
            />
            {DIMENSION_NAMES.map((_, i) => {
              const pt = getPoint(i, pd.scores[i], 100);
              return (
                <circle
                  key={`dot-${pi}-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  fill={pd.color.stroke}
                />
              );
            })}
          </g>
        );
      })}

      {DIMENSION_NAMES.map((dim, i) => {
        const lp = getLabelPoint(i);
        const anchor =
          lp.x < cx - 5 ? 'end' : lp.x > cx + 5 ? 'start' : 'middle';
        return (
          <text
            key={`label-${i}`}
            x={lp.x}
            y={lp.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-gray-400"
            fontSize="10"
          >
            {dim}
          </text>
        );
      })}
    </svg>
  );
};

const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  projects,
  onExit,
  onRemoveProject,
}) => {
  const { t } = useI18n();
  if (projects.length === 0) return null;

  const winners = useMemo(() => {
    const result: Record<string, string[]> = {};
    DIMENSION_NAMES.forEach((dim) => {
      let bestScore = -1;
      let bestProjects: string[] = [];
      projects.forEach((p) => {
        const d = p.dimensions?.find((d) => d.dimension === dim);
        const score = d ? d.score : 0;
        if (score > bestScore) {
          bestScore = score;
          bestProjects = [p.repo.fullName];
        } else if (score === bestScore && bestScore > 0) {
          bestProjects.push(p.repo.fullName);
        }
      });
      if (bestScore > 0) result[dim] = bestProjects;
    });
    return result;
  }, [projects]);

  const handleExportMarkdown = () => {
    let md = `# ${t('comparisonReport')}\n\n`;
    md += `> ${t('comparisonMeta', { count: projects.length, time: new Date().toLocaleString() })}\n\n`;

    md += `## ${t('overview')}\n\n`;
    md += `| ${t('project')} | ${t('score')} | ${t('grade')} | ${t('track')} | ${t('recommendationIndex')} | ${t('stars')} |\n`;
    md += '|------|------|------|------|----------|------|\n';
    projects.forEach((p) => {
      md += `| ${p.repo.fullName} | ${p.totalScore.toFixed(1)} | ${p.grade} | ${getTrackLabel(p.track)} | ${p.recommendationIndex.toFixed(2)} | ${p.repo.stargazersCount} |\n`;
    });

    md += `\n## ${t('dimensionComparison')}\n\n`;
    md +=
      `| ${t('dimension')} | ` +
      projects.map((p) => p.repo.name).join(' | ') +
      ` | ${t('winner')} |\n`;
    md += '|------|' + projects.map(() => '------|').join('') + '------|\n';
    DIMENSION_NAMES.forEach((dim) => {
      const scores = projects.map((p) => {
        const d = p.dimensions?.find((d) => d.dimension === dim);
        return d ? `${d.score}/${d.maxScore}` : '-';
      });
      const winnerNames = (winners[dim] || [])
        .map((fn) => fn.split('/')[1])
        .join(', ');
      md += `| ${dim} | ${scores.join(' | ')} | ${winnerNames} |\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ralph-comparison-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mb-6 bg-gray-900/80 border border-violet-700/40 rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-violet-300">
            {t('compareTitle')} ({projects.length})
          </h3>
          <span className="text-xs text-gray-500">
            {projects.length === 1
              ? t('selectMoreToCompare')
              : t('projectsSideBySide', { count: projects.length })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {projects.length >= 2 && (
            <button
              onClick={handleExportMarkdown}
              className="text-xs px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center gap-1"
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
              {t('exportMD')}
            </button>
          )}
          <button
            onClick={onExit}
            className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            {t('exitCompare')}
          </button>
        </div>
      </div>

      {projects.length >= 2 && (
        <div className="mb-5">
          <RadarChart projects={projects} size={240} />
        </div>
      )}

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(projects.length, 4)}, 1fr)`,
        }}
      >
        {projects.map((p, pi) => (
          <div
            key={p.repo.fullName}
            className="bg-gray-800/40 rounded-lg border border-gray-700/50 p-3 relative group"
          >
            {onRemoveProject && (
              <button
                onClick={() => onRemoveProject(p.repo.fullName)}
                className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-700/0 hover:bg-gray-700 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all text-xs"
                title={t('removeProject')}
              >
                ×
              </button>
            )}

            <div className="mb-2">
              <h4 className="text-sm font-medium text-white truncate pr-4">
                {p.repo.name}
              </h4>
              <p className="text-[10px] text-gray-500 truncate">
                {p.repo.owner}
              </p>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-lg font-bold"
                style={{
                  color: PROJECT_COLORS[pi % PROJECT_COLORS.length].stroke,
                }}
              >
                {p.totalScore.toFixed(1)}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${GRADE_COLORS[p.grade]}`}
              >
                {p.grade}
              </span>
              <span className="text-[10px] text-gray-500">
                {getTrackLabel(p.track)}
              </span>
            </div>

            <div className="space-y-1.5">
              {DIMENSION_NAMES.map((dim) => {
                const d = p.dimensions?.find((d) => d.dimension === dim);
                const score = d ? d.score : 0;
                const max = d ? d.maxScore : 1;
                const pct = max > 0 ? (score / max) * 100 : 0;
                const isWinner = (winners[dim] || []).includes(p.repo.fullName);
                const colorInfo = DIMENSION_COLORS[dim];

                return (
                  <div key={dim} className="flex items-center gap-2">
                    <span className={`text-[10px] w-7 ${colorInfo.text}`}>
                      {dim}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isWinner ? 'ring-1 ring-white/30' : ''}`}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isWinner
                            ? colorInfo.stroke
                            : 'rgba(255,255,255,0.3)',
                        }}
                      />
                    </div>
                    <span
                      className={`text-[10px] w-10 text-right ${isWinner ? 'text-white font-medium' : 'text-gray-500'}`}
                    >
                      {score}/{max}
                      {isWinner && ' 👑'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-2 border-t border-gray-700/50 flex items-center justify-between text-[10px]">
              <span className="text-gray-500">
                ⭐ {p.repo.stargazersCount.toLocaleString()}
              </span>
              <span className="text-amber-400 font-medium">
                RI: {p.recommendationIndex.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {projects.length < 2 && (
        <p className="text-xs text-gray-500 text-center mt-3">
          {t('selectAtLeastOne')}
        </p>
      )}
    </div>
  );
};

export default ComparisonPanel;
