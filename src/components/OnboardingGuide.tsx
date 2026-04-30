import React, { useState, useEffect, useCallback } from 'react';

interface TooltipProps {
  targetId: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  visible: boolean;
  onClose: () => void;
  onNext?: () => void;
  hasMore?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  targetId,
  content,
  position = 'bottom',
  visible,
  onClose,
  onNext,
  hasMore = false,
}) => {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!visible) return;
    const target = document.getElementById(targetId);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const offset = 12;

    switch (position) {
      case 'bottom':
        setStyle({
          position: 'fixed' as const,
          top: rect.bottom + offset,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
          zIndex: 9999,
        });
        break;
      case 'top':
        setStyle({
          position: 'fixed' as const,
          bottom: window.innerHeight - rect.top + offset,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
          zIndex: 9999,
        });
        break;
      case 'left':
        setStyle({
          position: 'fixed' as const,
          top: rect.top + rect.height / 2,
          right: window.innerWidth - rect.left + offset,
          transform: 'translateY(-50%)',
          zIndex: 9999,
        });
        break;
      case 'right':
        setStyle({
          position: 'fixed' as const,
          top: rect.top + rect.height / 2,
          left: rect.right + offset,
          transform: 'translateY(-50%)',
          zIndex: 9999,
        });
        break;
    }
  }, [visible, targetId, position]);

  if (!visible) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-[9998]"
        onClick={onClose}
      />
      {/* Tooltip */}
      <div
        style={style}
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 max-w-xs animate-fade-in"
      >
        <p className="text-sm text-gray-200 leading-relaxed mb-3">{content}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 text-gray-400 hover:text-gray-200 transition-colors"
          >
            跳过引导
          </button>
          {hasMore && onNext ? (
            <button
              onClick={onNext}
              className="text-xs px-4 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
            >
              下一步
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-xs px-4 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
            >
              开始使用
            </button>
          )}
        </div>
      </div>
    </>
  );
};

interface OnboardingGuideProps {
  isLight?: boolean;
}

const STEPS = [
  {
    targetId: 'ralph-search-input',
    content: '🔍 这里是搜索框 — 输入关键词如 "rust logging" 即可搜索并评估 GitHub 项目。也可以按 / 键快速聚焦。',
    position: 'bottom' as const,
  },
  {
    targetId: 'ralph-settings-btn',
    content: '⚙️ 设置面板 — 可配置 GitHub Token、启动批量评定、自定义各维度权重。',
    position: 'bottom' as const,
  },
  {
    targetId: 'ralph-trending-btn',
    content: '🔥 Trending 探索 — 发现 GitHub 上的热门项目，一键评估感兴趣的项目。',
    position: 'bottom' as const,
  },
  {
    targetId: 'ralph-lang-btn',
    content: '🌐 语言切换 — 支持中英文双语界面，点击即可切换。',
    position: 'bottom' as const,
  },
];

const OnboardingGuide: React.FC<OnboardingGuideProps> = () => {
  const [showGuide, setShowGuide] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem('ralph-onboarding-seen');
    if (!hasSeen) {
      // 延迟显示，确保页面已渲染
      const timer = setTimeout(() => setShowGuide(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = useCallback(() => {
    setShowGuide(false);
    localStorage.setItem('ralph-onboarding-seen', '1');
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  }, [currentStep, handleClose]);

  if (!showGuide) return null;

  const step = STEPS[currentStep];

  return (
    <Tooltip
      key={currentStep}
      targetId={step.targetId}
      content={step.content}
      position={step.position}
      visible={showGuide}
      onClose={handleClose}
      onNext={handleNext}
      hasMore={currentStep < STEPS.length - 1}
    />
  );
};

export { OnboardingGuide, Tooltip };
export default OnboardingGuide;
