import React, { useState, useCallback } from 'react';
import type { ProjectRecommendation } from '../types';

interface ReportShareProps {
  project: ProjectRecommendation;
}

const ReportShare: React.FC<ReportShareProps> = ({ project }) => {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateMarkdown = useCallback((p: ProjectRecommendation): string => {
    const dims = p.dimensions || [];
    const dimRows = dims.map(d => {
      const ratio = d.maxScore > 0 ? ((d.score / d.maxScore) * 100).toFixed(1) : '0.0';
      return `| ${d.dimension} | ${d.score}/${d.maxScore} | ${ratio}% |`;
    }).join('\n');

    const subScoreRows = dims.flatMap(d =>
      (d.subScores || []).map(([name, score, max]) => `  - ${name}: ${score}/${max}`)
    ).join('\n');

    return `# ${p.repo.fullName} - Ralph 评估报告

> 评估时间: ${new Date().toLocaleString('zh-CN')}
> 评估版本: Ralph v0.8.0

## 项目信息

| 属性 | 值 |
|------|------|
| 仓库 | [${p.repo.fullName}](${p.repo.htmlUrl}) |
| 描述 | ${p.repo.description || '无'} |
| Stars | ⭐ ${p.repo.stargazersCount} |
| Forks | 🔀 ${p.repo.forksCount} |
| 语言 | ${p.repo.language || 'N/A'} |
| 创建时间 | ${new Date(p.repo.createdAt).toLocaleDateString('zh-CN')} |
| 更新时间 | ${new Date(p.repo.updatedAt).toLocaleDateString('zh-CN')} |

## 评估结果

- **轨道**: ${p.track === 'neglected' ? '被忽视项目挖掘' : p.track === 'high-star' ? '高星项目甄别' : '稳态项目评估'}
- **等级**: ${p.grade === 'S' ? '🏆 S 级' : p.grade === 'A' ? '🥇 A 级' : p.grade === 'B' ? '🥈 B 级' : '❌ 不推荐'}
- **总分**: ${p.totalScore.toFixed(1)} / 105
- **推荐指数**: ${p.recommendationIndex.toFixed(2)}

### 六维评分

| 维度 | 得分 | 满分 | 得分率 |
|------|------|------|--------|
${dimRows}

${subScoreRows ? `### 子项得分\n\n${subScoreRows}` : ''}

### 一票否决检查

${p.vetoFlags && p.vetoFlags.length > 0 ? p.vetoFlags.map(f => `- ❌ ${f}`).join('\n') : '- ✅ 无一票否决项'}

### 信任徽章

${p.trustBadge || '无'}

---

> 本评估由 [Ralph](https://github.com/ralph-evaluator) 自动生成
> 三轨覆盖，无盲区。穿透热度噪音，直抵项目品质。
`;
  }, []);

  const handleCopy = async () => {
    const markdown = generateMarkdown(project);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  const handleExport = async () => {
    const markdown = generateMarkdown(project);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.repo.fullName.replace(/\//g, '-')}-evaluation.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
        title="生成评估报告"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-gray-100">评估报告 - {project.repo.fullName}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-900/50 p-4 rounded-lg">
                {generateMarkdown(project)}
              </pre>
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-700">
              <button
                onClick={handleCopy}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {copied ? '✓ 已复制' : '复制到剪贴板'}
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
              >
                导出 Markdown
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportShare;
