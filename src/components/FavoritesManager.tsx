import { useState, useCallback, useEffect } from 'react';
import { useFavoriteStore, useFavoriteSelector } from '../stores/slices/favoriteSlice';
import { tauri } from '../services/tauri';
import { useI18n } from '../i18n';

interface FavoriteItem {
  repo: { full_name: string; description?: string; stargazers_count: number };
  totalScore: number;
  grade: string;
  track: string;
  recommendationIndex: number;
  favoritedAt: string;
}

interface FavoritesManagerProps {
  isLight: boolean;
}

const FavoritesManager: React.FC<FavoritesManagerProps> = ({ isLight }) => {
  const { t } = useI18n();
  const { isFavorite, toggleFavorite } = useFavoriteSelector();
  const loadFavorites = useFavoriteStore(s => s.loadFavorites);
  const [favoriteDetails, setFavoriteDetails] = useState<FavoriteItem[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadFavoriteDetails = useCallback(async () => {
    if (showFavorites && favoriteDetails.length > 0) return;
    setLoading(true);
    try {
      await loadFavorites();
      const data = await tauri.getFavorites();
      if (!Array.isArray(data)) {
        setFavoriteDetails([]);
        return;
      }
      const details: FavoriteItem[] = data.map(f => {
        try {
          const parsed = JSON.parse(f.evaluationJson) as FavoriteItem;
          return parsed;
        } catch {
          return {
            repo: { full_name: f.fullName, stargazers_count: 0 },
            totalScore: 0,
            grade: 'X',
            track: 'steady',
            recommendationIndex: 0,
            favoritedAt: '',
          } satisfies FavoriteItem;
        }
      });
      setFavoriteDetails(details);
    } catch (error) {
      alert(t('loadFavoritesFailed') + ': ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  }, [showFavorites, favoriteDetails.length, loadFavorites]);

  useEffect(() => {
    if (showFavorites) {
      void loadFavoriteDetails();
    }
  }, [showFavorites, loadFavoriteDetails]);

  const toggleFavorites = useCallback(() => {
    setShowFavorites(prev => !prev);
  }, []);

  const handleRemoveFavorite = useCallback(async (fullName: string) => {
    await toggleFavorite(fullName);
    setFavoriteDetails(prev => prev.filter(f => f.repo.full_name !== fullName));
  }, [toggleFavorite]);

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffHours < 1) return t('justNow');
    if (diffHours < 24) return t('hoursAgo', { n: diffHours });
    if (diffDays < 7) return t('daysAgo', { n: diffDays });
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

  const trackLabels: Record<string, string> = { neglected: t('neglected'), 'high-star': t('highStar'), steady: t('steady') };

  // Filter details to only show items that are still in favorites set
  const activeFavorites = favoriteDetails.filter(f => isFavorite(f.repo.full_name));

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
        {t('favorites')}
      </button>
    );
  }

  return (
    <div className={`rounded-xl p-4 mb-4 border animate-fade-in ${
      isLight ? 'bg-gray-100/80 border-gray-200' : 'bg-gray-900/80 border-gray-700'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
          {t('favorites')} ({activeFavorites.length})
        </h3>
        <button
          onClick={toggleFavorites}
          className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'} hover:text-gray-300 transition-colors`}
        >
          {t('collapse')}
        </button>
      </div>

      {loading ? (
        <div className={`text-center py-4 text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{t('loadingFavorites')}</div>
      ) : activeFavorites.length === 0 ? (
        <div className={`text-center py-4 text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('noFavorites')}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {activeFavorites.map((item) => (
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
                <div className={`flex items-center gap-2 mt-0.5 ${isLight ? 'text-gray-400' : 'text-gray-400'}`}>
                  <span>{trackLabels[item.track] || item.track}</span>
                  <span>·</span>
                  <span>{t('recommendationIndex')} {item.recommendationIndex.toFixed(2)}</span>
                  <span>·</span>
                  <span>{item.repo.stargazers_count} stars</span>
                  <span>·</span>
                  <span>{formatTime(item.favoritedAt)}</span>
                </div>
              </div>
              <button
                onClick={() => handleRemoveFavorite(item.repo.full_name)}
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
