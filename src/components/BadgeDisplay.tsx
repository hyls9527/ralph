import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../i18n';

interface BadgeInfo {
  grade: string;
  score: number;
  color: string;
  url: string;
  markdown: string;
  html: string;
}

interface BadgeDisplayProps {
  grade: string;
  score: number;
  repoFullName: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<string, number> = {
  sm: 20,
  md: 28,
  lg: 36,
};

const gradeColorMap: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  A: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  B: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  C: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  X: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ grade, score, repoFullName, size = 'md' }) => {
  const { t } = useI18n();
  const [badge, setBadge] = useState<BadgeInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const colors = gradeColorMap[grade] || gradeColorMap.X;
  const imgHeight = sizeMap[size];

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<BadgeInfo>('generate_badge', {
        grade,
        score,
        repoFullName,
      });
      setBadgeInfo(result);
    } catch {
      setBadgeInfo(null);
    } finally {
      setLoading(false);
    }
  }, [grade, score, repoFullName]);

  const handleCopy = useCallback(async () => {
    if (!badgeInfo) return;
    try {
      await navigator.clipboard.writeText(badgeInfo.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [badgeInfo]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
          <span className="font-bold">{grade}</span>
          <span className="opacity-75">{score.toFixed(0)}/105</span>
        </div>

        {badgeInfo && (
          <img
            src={badgeInfo.url}
            alt={`Ralph ${grade} ${score.toFixed(0)}`}
            height={imgHeight}
            className="inline-block"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-3 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : t('generateBadge')}
        </button>

        {badgeInfo && (
          <button
            onClick={handleCopy}
            className="px-3 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
          >
            {copied ? t('shareCopied') : t('copyMarkdown')}
          </button>
        )}
      </div>

      {badgeInfo && (
        <div className="mt-1 p-2 rounded-md bg-black/20 border border-white/5">
          <code className="text-xs text-gray-400 break-all select-all">
            {badgeInfo.markdown}
          </code>
        </div>
      )}
    </div>
  );
};

export default BadgeDisplay;
