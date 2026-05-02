import React from 'react';
import { useAppStore } from '../stores/useAppStore';

const LoadingSpinner: React.FC = () => {
  const { loading } = useAppStore();
  const { phase, message, progress } = loading;

  if (phase === 'idle' || phase === 'done') return null;

  const messages: Record<string, string> = {
    searching: message || '正在搜索 GitHub 项目...',
    evaluating: message || '正在深度评估项目质量...',
    error: message || '出现错误',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
      {phase === 'error' ? (
        <div className="text-rose-400 text-lg font-medium">{messages.error}</div>
      ) : (
        <>
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-violet-500/30 animate-spin-slow" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin-slow" style={{ animationDuration: '1s' }} />
          </div>
          <p className="mt-4 text-gray-400 text-sm">{messages[phase]}</p>
          {progress !== undefined && progress > 0 && (
            <div className="mt-2 w-48 bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LoadingSpinner;
