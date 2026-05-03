import React from 'react';
import type { ProjectRecommendation } from '../types';
import { useI18n } from '../i18n';

interface ExportPanelProps {
  projects: ProjectRecommendation[];
}

const ExportPanel: React.FC<ExportPanelProps> = ({ projects }) => {
  const { t } = useI18n();
  if (projects.length === 0) return null;

  const exportJSON = () => {
    const data = projects.map(p => ({
      repo: p.repo,
      totalScore: p.totalScore,
      grade: p.grade,
      track: p.track,
      oneLiner: p.oneLiner,
      evidenceLevel: p.evidenceLevel,
      neglectIndex: p.neglectIndex,
      recommendationIndex: p.recommendationIndex,
      valueDensity: p.valueDensity,
      steadyState: p.steadyState,
      dimensions: p.dimensions,
      vetoFlags: p.vetoFlags,
      gateChecks: p.gateChecks,
      confidenceTier: p.confidenceTier,
      decisionTrail: p.decisionTrail,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ralph-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    const md = `# ${t('ralphReport')}

> ${t('generatedAt')}: ${new Date().toLocaleString('zh-CN')}
> ${t('projectCount')}: ${projects.length}

---

${projects.map(p => `## ${p.repo.fullName}

- **${t('descriptionLabel')}**: ${p.repo.description || t('noneValue')}
- **URL**: ${p.repo.htmlUrl}
- **${t('language')}**: ${p.repo.language || 'N/A'}
- **Star**: ${p.repo.stargazersCount} | **Fork**: ${p.repo.forksCount}
- **${t('totalScoreLabel')}**: ${p.totalScore.toFixed(1)} / 105
- **${t('grade')}**: ${p.grade}${t('gradeSuffix')}
- **${t('trackLabel')}**: ${p.track}
- **${t('recommendationIndex')}**: ${p.recommendationIndex.toFixed(2)}
- **${t('evidenceLevel')}**: ${p.evidenceLevel}
- **${t('oneLinerLabel')}**: ${p.oneLiner}

### ${t('dimensions')}

| ${t('dimension')} | ${t('scoreLabel')} | ${t('maxScoreLabel')} | ${t('achievementRate')} |
|------|------|------|--------|
${p.dimensions.map(d => `| ${d.dimension} | ${d.score} | ${d.maxScore} | ${(d.maxScore > 0 ? (d.score / d.maxScore) * 100 : 0).toFixed(1)}% |`).join('\n')}

### ${t('subScoreDetails')}

${p.dimensions.map(d => `**${d.dimension}**:\n${d.subScores.map(([name, score, max]) => `- ${name}: ${score}/${max}`).join('\n')}`).join('\n\n')}

---`).join('\n')}
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ralph-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = [
      'Repository', 'Description', 'Language', 'Stars', 'Forks',
      'Total Score', 'Grade', 'Track', 'Recommendation Index',
      'Evidence Level', 'Confidence Tier', 'Neglect Index',
      'Value Density', 'Steady State', 'One Liner',
      'Quality', 'Maintenance', 'Practical', 'Documentation', 'Community', 'Security',
      'Veto Flags', 'Gate Checks Passed',
    ];

    const dimName = (name: string) => {
      const map: Record<string, string> = {
        '质量': 'Quality', '维护': 'Maintenance', '实用': 'Practical',
        '文档': 'Documentation', '社区': 'Community', '安全': 'Security',
      };
      return map[name] || name;
    };

    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = projects.map(p => {
      const dimMap: Record<string, string> = {};
      p.dimensions.forEach(d => {
        dimMap[dimName(d.dimension)] = `${d.score}/${d.maxScore}`;
      });

      return [
        escapeCSV(p.repo.fullName),
        escapeCSV(p.repo.description || ''),
        p.repo.language || '',
        p.repo.stargazersCount,
        p.repo.forksCount,
        p.totalScore.toFixed(1),
        p.grade,
        p.track,
        p.recommendationIndex.toFixed(2),
        p.evidenceLevel,
        p.confidenceTier,
        p.neglectIndex.toFixed(1),
        p.valueDensity?.toFixed(2) ?? '',
        p.steadyState?.toFixed(2) ?? '',
        escapeCSV(p.oneLiner),
        dimMap['Quality'] ?? '',
        dimMap['Maintenance'] ?? '',
        dimMap['Practical'] ?? '',
        dimMap['Documentation'] ?? '',
        dimMap['Community'] ?? '',
        dimMap['Security'] ?? '',
        escapeCSV(p.vetoFlags.join('; ')),
        p.gateChecks.filter(g => g.passed).length,
      ].join(',');
    });

    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ralph-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <button onClick={exportJSON}
        className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:border-violet-500 hover:text-violet-300 transition-colors flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {t('jsonExport')}
      </button>
      <button onClick={exportCSV}
        className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:border-violet-500 hover:text-violet-300 transition-colors flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {t('csvExport')}
      </button>
      <button onClick={exportMarkdown}
        className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:border-violet-500 hover:text-violet-300 transition-colors flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {t('mdExport')}
      </button>
    </div>
  );
};

export default ExportPanel;
