import React from 'react';
import type { ProjectRecommendation } from '../types';

interface ExportPanelProps {
  projects: ProjectRecommendation[];
}

const ExportPanel: React.FC<ExportPanelProps> = ({ projects }) => {
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
    const md = `# Ralph 评定报告

> 生成时间: ${new Date().toLocaleString('zh-CN')}
> 项目数量: ${projects.length}

---

${projects.map(p => `## ${p.repo.fullName}

- **描述**: ${p.repo.description || '无'}
- **URL**: ${p.repo.htmlUrl}
- **语言**: ${p.repo.language || 'N/A'}
- **Star**: ${p.repo.stargazersCount} | **Fork**: ${p.repo.forksCount}
- **总分**: ${p.totalScore.toFixed(1)} / 105
- **等级**: ${p.grade} 级
- **轨道**: ${p.track}
- **推荐指数**: ${p.recommendationIndex.toFixed(2)}
- **证据等级**: ${p.evidenceLevel}
- **一句话推荐**: ${p.oneLiner}

### 六维评分

| 维度 | 得分 | 满分 | 达成率 |
|------|------|------|--------|
${p.dimensions.map(d => `| ${d.dimension} | ${d.score} | ${d.maxScore} | ${(d.maxScore > 0 ? (d.score / d.maxScore) * 100 : 0).toFixed(1)}% |`).join('\n')}

### 子分数详情

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

  return (
    <div className="flex items-center gap-2 mt-3">
      <button onClick={exportJSON}
        className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:border-violet-500 hover:text-violet-300 transition-colors flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        导出 JSON
      </button>
      <button onClick={exportMarkdown}
        className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:border-violet-500 hover:text-violet-300 transition-colors flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        导出 Markdown
      </button>
    </div>
  );
};

export default ExportPanel;
