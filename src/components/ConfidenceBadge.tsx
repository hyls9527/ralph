import React from 'react';

type EvidenceLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

interface ConfidenceBadgeProps {
  level: EvidenceLevel;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

const LEVEL_CONFIG: Record<EvidenceLevel, { label: string; color: string; bgColor: string; confidence: string; description: string }> = {
  L1: {
    label: 'L1',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15 border-emerald-500/30',
    confidence: '100%',
    description: 'API 验证 — 最高置信度',
  },
  L2: {
    label: 'L2',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15 border-blue-500/30',
    confidence: '85%',
    description: '行为验证 — 高置信度',
  },
  L3: {
    label: 'L3',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15 border-amber-500/30',
    confidence: '80%',
    description: '文件验证 — 中等置信度',
  },
  L4: {
    label: 'L4',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15 border-orange-500/30',
    confidence: '50%',
    description: '声明验证 — 低置信度（得分上限 50%）',
  },
  L5: {
    label: 'L5',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15 border-red-500/30',
    confidence: '0%',
    description: '无证据 — 零置信度',
  },
};

const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ level, size = 'md', showDescription = false }) => {
  const config = LEVEL_CONFIG[level];
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <div className="inline-flex flex-col">
      <div className={`inline-flex items-center gap-1.5 rounded-md border ${config.bgColor} ${sizeClasses[size]} font-medium`}>
        <svg className={`w-3 h-3 ${config.color}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className={config.color}>{config.label}</span>
        <span className="text-gray-400 text-xs opacity-75">{config.confidence}</span>
      </div>
      {showDescription && (
        <span className="text-gray-500 text-xs mt-1">{config.description}</span>
      )}
    </div>
  );
};

export default ConfidenceBadge;
