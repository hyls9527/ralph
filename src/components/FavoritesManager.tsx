import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface FavoriteItem {
  repo: { full_name: string; description?: string; stargazers_count: number };
  totalScore: number;
  grade: string;
  track: string;
  recommendationIndex: number;
  favoritedAt: string;
}

interface FavoritesManagerProps {
  onReSearch: (query: string) => void;
  isLight: boolean;
}

const FavoritesManager: React.FC<FavoritesManagerProps> = ({ isLight }) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadFavorites = useCallback(async () => {
    if (showFavorites && favorites.length > 0) return;
    setLoading(true);
    try {
      const data = await invoke<FavoriteItem[]>('get_favorites');
      setFavorites(data);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [showFavorites, favorites.length]);

  const toggleFavorites = useCallback(() => {
    setShowFavorites(prev => {
      if (!prev) loadFavorites();
      return !prev;
    });
  }, [loadFavorites]);

  const removeFavorite = useCallback(async (fullName: string) => {
    try {
      await invoke('remove_favorite', { fullName });
      setFavorites(prev => prev.filter(f => f.repo.full_name !== fullName));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  }, []);

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffHours < 1) return '刚刚';
      if (diffHours < 24) return `${diffHours} 小时前`;
      if (diffDays < 7) return `${diffDays} 天前`;
      return date.toLocaleDateString('zh-CN');
    } catch {
      return '';
    }
  };

  const gradeColors: Record<string, string> = {
    S: 'text-violet-400',
    A: 'text-blue-400',
    B: 'text-green-400',
    X: 'text-rose-400',
  };

  const trackLabels: Record<string, string> = { neglected: '被忽视', 'high-star': '高星', steady: '稳态' };

  if (!showFavorites) {
    return (
      <button
        onClick={toggleFavorites}
        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
          isLight
            ? 'border-gray-300 text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            : 'border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800'
        }`}
      >
        收藏夹
      </button>
    );
  }

  return (
    <div className={`rounded-xl p-4 mb-4 border animate-fade-in ${
      isLight ? 'bg-gray-100/80 border-gray-200' : 'bg-gray-900/80 border-gray-700'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
          收藏夹 ({favorites.length})
        </h3>
        <button
          onClick={toggleFavorites}
          className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-500'} hover:text-gray-300 transition-colors`}
        >
          收起
        </button>
      </div>

      {loading ? (
        <div className={`text-center py-4 text-xs ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>加载中...</div>
      ) : favorites.length === 0 ? (
        <div className={`text-center py-4 text-xs ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>
          暂无收藏。在评定结果中点击星标添加收藏。
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {favorites.map((item) => (
            <div
              key={item.repo.full_name}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                isLight ? 'hover:bg-white' : 'hover:bg-gray-800/80'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium truncate ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                    {item.repo.full_name}
                  </span>
                  <span className={`font-bold ${gradeColors[item.grade] || 'text-gray-400'}`}>{item.grade}</span>
                  <span className="text-violet-400">{item.totalScore.toFixed(1)}</span>
                </div>
                <div className={`flex items-center gap-2 mt-0.5 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span>{trackLabels[item.track] || item.track}</span>
                  <span>·</span>
                  <span>推荐指数 {item.recommendationIndex.toFixed(2)}</span>
                  <span>·</span>
                  <span>{item.repo.stargazers_count} stars</span>
                  <span>·</span>
                  <span>{formatTime(item.favoritedAt)}</span>
                </div>
              </div>
              <button
                onClick={() => removeFavorite(item.repo.full_name)}
                className="text-rose-400 hover:text-rose-300 ml-2 flex-shrink-0 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesManager;
