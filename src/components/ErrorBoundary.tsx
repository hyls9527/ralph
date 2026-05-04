import { Component, ErrorInfo, ReactNode } from 'react';
import { t } from '../i18n';

// Helper function to check current theme (for class components that can't use hooks)
function isDarkTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      const isNetworkError = this.state.error?.message?.includes('fetch') ||
        this.state.error?.message?.includes('network') ||
        this.state.error?.message?.includes('invoke') ||
        this.state.error?.message?.includes('undefined');

      const userMessage = isNetworkError
        ? t('errorNetworkDetail')
        : t('errorPageLoad');

      return (
        <div className={`min-h-screen flex items-center justify-center ${
          isDarkTheme() ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'
        }`}>
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">{t('errorOccurred')}</h2>
            <p className={`text-sm mb-6 leading-relaxed ${isDarkTheme() ? 'text-gray-400' : 'text-gray-600'}`}>{userMessage}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="text-sm px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
              >
                {t('refreshPage')}
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                  isDarkTheme()
                    ? 'border border-gray-700 text-gray-300 hover:bg-gray-800'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t('goBack')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
