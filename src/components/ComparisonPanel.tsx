import React from 'react';
import type { ProjectRecommendation } from '../types';
import { t } from '../i18n';

interface ComparisonPanelProps {
  projects: ProjectRecommendation[];
  onExit: () => void;
}

const dimensionColors: Record<string, string> = {
  '质量': 'text-emerald-400',
  '维护': 'text-blue-400',
  '实用': 'text-violet-400',
  '文档': 'text-amber-400',
  '社区': 'text-pink-400',
  '安全': 'text-cyan-400',
};

const gradeColors: Record<string, string> = {
  S: 'bg-violet-500/30 text-violet-300 border-violet-500/40',
  A: 'bg-blue-500/30 text-blue-300 border-blue-500/40',
  B: 'bg-green-500/30 text-green-300 border-green-500/40',
  X: 'bg-gray-500/30 text-gray-400 border-gray-500/40',
};

const ComparisonPanel: React.FC<ComparisonPanelProps> = ({ projects, onExit }) => {
  if (projects.length === 0) return null;

  const dimensionNames = ['质量', '维护', '实用', '文档', '社区', '安全'];

  return (
    <div className="mb-6 bg-gray-900/80 border border-violet-700/40 rounded-xl p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-violet-300">
          {t('compareTitle')} ({projects.length})
        </h3>
        <button onClick={onExit} className="text-xs text-gray-400 hover:text-gray-300 transition-colors">
          {t('exitCompare')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-gray-400 font-medium min-w-[80px]">{t('dimension')}</th>
              {projects.map(p => (
                <th key={p.repo.fullName} className="py-2 px-3 text-center min-w-[120px]">
                  <div className="text-gray-300 font-medium truncate">{p.repo.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-3 text-gray-400">{t('totalScoreLabel')}</td>
              {projects.map(p => (
                <td key={p.repo.fullName} className="py-2 px-3 text-center">
                  <span className="text-lg font-bold text-violet-400">{p.totalScore.toFixed(1)}</span>
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded border ${gradeColors[p.grade]}`}>
                    {p.grade}
                  </span>
                </td>
              ))}
            </tr>
            {dimensionNames.map(dim => {
              const scores = projects.map(p => {
                const d = p.dimensions?.find(d => d.dimension === dim);
                return d ? d.score : 0;
              });
              const maxScore = Math.max(...scores);

              return (
                <tr key={dim} className="border-b border-gray-800/50">
                  <td className={`py-2 px-3 ${dimensionColors[dim]}`}>{dim}</td>
                  {projects.map((p) => {
                    const d = p.dimensions?.find(d => d.dimension === dim);
                    const score = d ? d.score : 0;
                    const max = d ? d.maxScore : 1;
                    const pct = max > 0 ? (score / max) * 100 : 0;
                    const isBest = score === maxScore && maxScore > 0;
                    const color = dimensionColors[dim] || 'text-gray-400';

                    return (
                      <td key={p.repo.fullName} className="py-2 px-3 text-center">
                        <span className={`font-semibold ${color} ${isBest ? 'underline underline-offset-2' : ''}`}>
                          {score}/{max}
                        </span>
                        <div className="w-full h-0.5 bg-gray-700 rounded-full mt-1">
                          <div className={`h-full rounded-full ${isBest ? 'bg-violet-500' : 'bg-gray-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <td className="py-2 px-3 text-gray-400">{t('recommendationIndex')}</td>
              {projects.map(p => (
                <td key={p.repo.fullName} className="py-2 px-3 text-center">
                  <span className="text-sm font-semibold text-amber-400">{p.recommendationIndex.toFixed(2)}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-2 text-center">
        {t('underlineBest')}
      </p>
    </div>
  );
};

export default ComparisonPanel;
