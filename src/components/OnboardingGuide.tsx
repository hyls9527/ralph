import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n';

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
      <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={onClose} />
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
            {t('skipGuide')}
          </button>
          {hasMore && onNext ? (
            <button
              onClick={onNext}
              className="text-xs px-4 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
            >
              {t('nextStep')}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-xs px-4 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
            >
              {t('getStarted')}
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

const OnboardingGuide: React.FC<OnboardingGuideProps> = () => {
  const { t } = useI18n();
  const [showGuide, setShowGuide] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      targetId: 'ralph-search-input',
      content: t('onboardingSearch'),
      position: 'bottom' as const,
    },
    {
      targetId: 'ralph-settings-btn',
      content: t('onboardingSettings'),
      position: 'bottom' as const,
    },
    {
      targetId: 'ralph-trending-btn',
      content: t('onboardingTrending'),
      position: 'bottom' as const,
    },
    {
      targetId: 'ralph-lang-btn',
      content: t('onboardingLang'),
      position: 'bottom' as const,
    },
  ];

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
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleClose();
    }
  }, [currentStep, handleClose]);

  if (!showGuide) return null;

  const step = steps[currentStep];

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
