import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';

interface EmptyStateProps {
  hasResults: boolean;
  hasSearched?: boolean;
  onClearFilters?: () => void;
}

export function EmptyState({
  hasResults,
  hasSearched = false,
  onClearFilters,
}: EmptyStateProps) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const isLight = !isDark;

  if (hasResults) return null;

  return (
    <div
      className={`text-center py-16 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}
    >
      <svg
        className="w-16 h-16 mx-auto mb-4 opacity-30"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <h3 className="text-lg font-medium mb-2">
        {hasSearched ? t('noMatchFound') : t('startSearch')}
      </h3>
      <p className="text-sm max-w-md mx-auto mb-4">
        {hasSearched ? t('tryAdjust') : t('searchHint')}
      </p>
      {onClearFilters && (
        <button
          onClick={onClearFilters}
          className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
            isLight
              ? 'border-gray-300 text-gray-600 hover:bg-gray-100'
              : 'border-gray-700 text-gray-400 hover:bg-gray-800'
          }`}
        >
          {t('clearFilters')}
        </button>
      )}
    </div>
  );
}
