import React, { useCallback } from 'react';
import type { ProjectRecommendation } from '../types';
import { t } from '../i18n';

interface PDFExportProps {
  projects: ProjectRecommendation[];
  query: string;
}

/**
 * HTML转义函数 - 防止XSS攻击
 * 转义 < > & " ' / 等特殊字符
 */
function escapeHtml(str: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return str.replace(/[&<>"'/]/g, (char) => escapeMap[char] || char);
}

const PDFExport: React.FC<PDFExportProps> = ({ projects, query }) => {
  const exportPDF = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(t('allowPopup'));
      return;
    }

    const gradeColors: Record<string, string> = {
      S: '#8b5cf6',
      A: '#3b82f6',
      B: '#10b981',
      X: '#6b7280',
    };

    const trackLabels: Record<string, string> = {
      neglected: t('neglected'),
      'high-star': t('highStar'),
      steady: t('steady'),
    };

    // 安全：对所有用户输入进行HTML转义
    const rows = projects
      .map(
        (p) => `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;font-size:11px;">
          <div style="font-weight:600;">${escapeHtml(p.repo.fullName)}</div>
          <div style="color:#6b7280;font-size:10px;">${escapeHtml(p.repo.description || '')}</div>
        </td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;">
          <span style="background:${gradeColors[p.grade] || '#6b7280'};color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;">${escapeHtml(p.grade)}</span>
          <div style="margin-top:2px;">${p.totalScore.toFixed(1)}</div>
        </td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;">
          ${escapeHtml(trackLabels[p.track] || p.track)}
        </td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;">
          ${p.recommendationIndex.toFixed(2)}
        </td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;">
          ${p.repo.stargazersCount}
        </td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;">
          ${escapeHtml(p.evidenceLevel)}
        </td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;">
          ${
            p.dimensions
              ?.map((d) => `${escapeHtml(d.dimension)}:${d.score}/${d.maxScore}`)
              .join('<br>') || ''
          }
        </td>
      </tr>`
      )
      .join('');

    // 安全：转义查询字符串和其他动态内容
    const escapedQuery = escapeHtml(query);
    const now = new Date().toLocaleString('zh-CN');
    const totalProjects = projects.length;
    const sCount = projects.filter(p => p.grade === 'S').length;
    const aCount = projects.filter(p => p.grade === 'A').length;
    const bCount = projects.filter(p => p.grade === 'B').length;
    const avgScore = (projects.reduce((s, p) => s + p.totalScore, 0) / (projects.length || 1)).toFixed(1);
    const maxRecommendation = projects.reduce((m, p) => Math.max(m, p.recommendationIndex), 0).toFixed(2);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${t('ralphReport')} - ${escapedQuery}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; color: #111827; }
    .header { display:flex; align-items:center; justify-content:space-between; padding:16px 24px; border-bottom:2px solid #8b5cf6; }
    .header h1 { margin:0; font-size:18px; color:#8b5cf6; }
    .header .meta { font-size:11px; color:#6b7280; }
    .summary { display:flex; gap:24px; padding:12px 24px; background:#f9fafb; border-bottom:1px solid #e5e7eb; }
    .summary .item { text-align:center; }
    .summary .item .value { font-size:20px; font-weight:bold; color:#8b5cf6; }
    .summary .item .label { font-size:10px; color:#6b7280; }
    table { width:100%; border-collapse:collapse; margin-top:12px; }
    th { background:#f3f4f6; padding:8px; border:1px solid #e5e7eb; font-size:11px; text-align:left; color:#374151; }
    .footer { padding:12px 24px; border-top:1px solid #e5e7eb; font-size:9px; color:#9ca3af; text-align:center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Ralph GitHub Project Evaluator</h1>
    <div class="meta">
      ${t('queryLabel')}: ${escapedQuery}<br/>
      ${t('generatedAt')}: ${now}<br/>
      ${t('projectCount')}: ${totalProjects}
    </div>
  </div>
  <div class="summary">
    <div class="item"><div class="value">${sCount}</div><div class="label">${t('sGrade')}</div></div>
    <div class="item"><div class="value">${aCount}</div><div class="label">${t('aGrade')}</div></div>
    <div class="item"><div class="value">${bCount}</div><div class="label">${t('bGrade')}</div></div>
    <div class="item"><div class="value">${avgScore}</div><div class="label">${t('avgScore')}</div></div>
    <div class="item"><div class="value">${maxRecommendation}</div><div class="label">${t('maxRecIndex')}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:28%;">${t('projectLabel')}</th>
        <th style="width:8%;">${t('grade')}</th>
        <th style="width:8%;">${t('trackLabel')}</th>
        <th style="width:10%;">${t('recommendationIndex')}</th>
        <th style="width:8%;">Stars</th>
        <th style="width:6%;">${t('evidenceLabel')}</th>
        <th style="width:32%;">${t('dimensions')}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="footer">
    ${t('footerText')}
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }, [projects, query]);

  if (projects.length === 0) return null;

  return (
    <button
      onClick={exportPDF}
      className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800 transition-colors flex items-center gap-1"
      title={t('exportPdfTooltip')}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      {t('pdfReport')}
    </button>
  );
};

export default PDFExport;
