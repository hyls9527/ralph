import { useState, useCallback } from 'react';
import { tauri } from '../services/tauri';
import { t } from '../i18n';

interface HistoryItem {
  keyword: string;
  timestamp: number;
}

interface SearchHistoryProps {
  onReSearch: (query: string) => void;
  isLight: boolean;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ onReSearch, isLight }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (showHistory && history.length > 0) return;
    setLoading(true);
    try {
      const data = await tauri.getSearchHistory();
      setHistory(data);
    } catch (error) {
      alert(t('loadHistoryFailed') + ': ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  }, [showHistory, history.length]);

  const toggleHistory = useCallback(() => {
    setShowHistory(prev => {
      if (!prev) {
        loadHistory();
      }
      return !prev;
    });
  }, [loadHistory]);

  const clearHistory = useCallback(async () => {
    try {
      await tauri.clearSearchHistory();
      setHistory([]);
    } catch (error) {
      alert(t('clearHistoryFailed') + ': ' + (error instanceof Error ? error.message : String(error)));
    }
  }, []);

  const formatTime = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minsAgo', { n: diffMins });
    if (diffHours < 24) return t('hoursAgo', { n: diffHours });
    if (diffDays < 7) return t('daysAgo', { n: diffDays });
      return date.toLocaleDateString('zh-CN');
    } catch {
      return '';
    }
  };

  if (!showHistory) {
    return (
      <button
        onClick={toggleHistory}
        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
          isLight
            ? 'border-gray-300 text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            : 'border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800'
        }`}
      >
        {t('searchHistory')}
      </button>
    );
  }

  return (
    <div className={`rounded-xl p-4 mb-4 border animate-fade-in ${
      isLight ? 'bg-gray-100/80 border-gray-200' : 'bg-gray-900/80 border-gray-700'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
          {t('searchHistory')} ({history.length})
        </h3>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
            >
              {t('clear')}
            </button>
          )}
          <button
            onClick={toggleHistory}
            className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'} hover:text-gray-300 transition-colors`}
          >
            {t('collapse')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={`text-center py-4 text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('loadingHistory')}
        </div>
      ) : history.length === 0 ? (
        <div className={`text-center py-4 text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('noHistory')}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {history.map((item, index) => (
            <button
              key={index}
              onClick={() => onReSearch(item.keyword)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                isLight
                  ? 'hover:bg-white hover:shadow-sm'
                  : 'hover:bg-gray-800/80'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <svg className={`w-3.5 h-3.5 flex-shrink-0 ${isLight ? 'text-gray-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className={`truncate font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                  {item.keyword}
                </span>
              </div>
              <div className={`flex items-center gap-2 flex-shrink-0 ${isLight ? 'text-gray-400' : 'text-gray-400'}`}>
                <span className="text-xs">{formatTime(item.timestamp)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchHistory;
