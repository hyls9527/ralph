import { useTheme } from '../../hooks/useTheme';

interface ErrorFallbackProps {
  error: string;
  onRetry?: () => void;
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const { isDark } = useTheme();
  const isLight = !isDark;

  return (
    <div
      className={`min-h-screen ${isLight ? 'bg-gray-50 text-gray-900' : 'bg-gray-950 text-gray-100'} flex items-center justify-center`}
    >
      <div className="text-center p-8 max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-rose-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2">发生错误</h2>
        <p
          className={`text-sm mb-6 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {error}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm px-6 py-2.5 min-h-[44px] bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}
