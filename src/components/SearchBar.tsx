import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { tauri } from '../services/tauri';
import { useI18n } from '../i18n';

interface HistoryItem {
  keyword: string;
  timestamp: number;
}

type SuggestionItem = {
  keyword: string;
  type: 'history' | 'popular';
};

export interface SearchBarHandle {
  setSearchAndExecute: (query: string) => void;
  focus: () => void;
}

const POPULAR_KEYWORDS = [
  'rust async',
  'react state management',
  'go web framework',
  'python ml',
  'typescript toolkit',
  'cli tool',
  'ai agent',
  'developer tools',
  'logging library',
  'api framework',
  'database orm',
  'testing framework',
];

type SearchBarProps = {
  ref?: React.Ref<SearchBarHandle>;
};

const SearchBar = function SearchBar({ ref: externalRef }: SearchBarProps) {
  const { t } = useI18n();
  const { setQuery, setLoading, setSearchResults } = useAppStore();
  const [localInput, setLocalInput] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const historyCacheRef = useRef<HistoryItem[]>([]);

  const preloadHistory = useCallback(async () => {
    if (historyCacheRef.current.length === 0) {
      try {
        const data = await tauri.getSearchHistory();
        historyCacheRef.current = data;
      } catch (e) {
        console.error('Failed to preload search history:', e);
      }
    }
  }, []);

  useEffect(() => {
    void preloadHistory();
  }, [preloadHistory]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const generateSuggestions = useCallback((input: string) => {
    const trimmed = input.trim();
    const suggestionsList: SuggestionItem[] = [];
    const seen = new Set<string>();

    if (trimmed) {
      const lowerInput = trimmed.toLowerCase();
      historyCacheRef.current
        .filter(
          (h) =>
            h.keyword.toLowerCase().includes(lowerInput) &&
            h.keyword.toLowerCase() !== lowerInput,
        )
        .slice(0, 5)
        .forEach((h) => {
          if (!seen.has(h.keyword)) {
            seen.add(h.keyword);
            suggestionsList.push({ keyword: h.keyword, type: 'history' });
          }
        });

      const remainingSlots = Math.max(0, 5 - suggestionsList.length);
      POPULAR_KEYWORDS.filter(
        (kw) =>
          kw.toLowerCase().includes(lowerInput) &&
          kw.toLowerCase() !== lowerInput &&
          !seen.has(kw),
      )
        .slice(0, remainingSlots)
        .forEach((kw) => {
          suggestionsList.push({ keyword: kw, type: 'popular' });
        });
    } else {
      historyCacheRef.current.slice(0, 5).forEach((h) => {
        if (!seen.has(h.keyword)) {
          seen.add(h.keyword);
          suggestionsList.push({ keyword: h.keyword, type: 'history' });
        }
      });

      const remainingSlots = Math.max(0, 8 - suggestionsList.length);
      POPULAR_KEYWORDS.slice(0, remainingSlots).forEach((kw) => {
        if (!seen.has(kw)) {
          suggestionsList.push({ keyword: kw, type: 'popular' });
        }
      });
    }

    if (suggestionsList.length > 0) {
      setSuggestions(suggestionsList.slice(0, 8));
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
      setSelectedIndex(-1);
    }
  }, []);

  useEffect(() => {
    generateSuggestions(localInput);
  }, [localInput, generateSuggestions]);

  const executeSearch = useCallback(
    async (queryText: string) => {
      if (!queryText.trim()) return;

      setQuery(queryText.trim());
      setLoading({ phase: 'searching', message: t('searching') });

      try {
        const response = await tauri.searchAndEvaluate(queryText.trim());
        setSearchResults(response.results);
      } catch (error) {
        const errorMessage = String(error);
        let userMessage = t('errorGeneric');
        if (
          errorMessage.includes('invoke') ||
          errorMessage.includes('undefined')
        ) {
          userMessage = t('errorNetwork');
        } else if (
          errorMessage.includes('rate limit') ||
          errorMessage.includes('403')
        ) {
          userMessage = t('errorRateLimit');
        } else if (
          errorMessage.includes('fetch') ||
          errorMessage.includes('network')
        ) {
          userMessage = t('errorNetwork');
        }
        setLoading({
          phase: 'error',
          message: userMessage,
        });
      }
    },
    [setQuery, setLoading, setSearchResults],
  );

  const handleSearch = useCallback(() => {
    setShowSuggestions(false);
    executeSearch(localInput);
  }, [localInput, executeSearch]);

  const selectSuggestion = (kw: string) => {
    setLocalInput(kw);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (e.key === 'Tab' && selectedIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[selectedIndex].keyword);
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && selectedIndex >= 0 && suggestions.length > 0) {
        selectSuggestion(suggestions[selectedIndex].keyword);
      } else {
        handleSearch();
      }
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const setSearchAndExecute = (query: string) => {
    setLocalInput(query);
    executeSearch(query);
  };

  const focus = () => {
    inputRef.current?.focus();
  };

  // Expose methods via ref
  useEffect(() => {
    if (externalRef && typeof externalRef !== 'function') {
      (externalRef as React.MutableRefObject<SearchBarHandle | null>).current =
        {
          setSearchAndExecute,
          focus,
        };
    }
    return () => {
      if (externalRef && typeof externalRef !== 'function') {
        (
          externalRef as React.MutableRefObject<SearchBarHandle | null>
        ).current = null;
      }
    };
  }, [externalRef, setSearchAndExecute, focus]);

  return (
    <div className="flex gap-2 mb-6" ref={containerRef}>
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          id="search-input"
          type="text"
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() =>
            localInput && suggestions.length > 0 && setShowSuggestions(true)
          }
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          autoComplete="off"
          className="w-full bg-gray-900 text-gray-100 placeholder-gray-600 rounded-lg pl-4 pr-10 py-3 text-sm border border-gray-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
        />
        {localInput && (
          <button
            onClick={() => {
              setLocalInput('');
              setShowSuggestions(false);
            }}
            aria-label={t('clear')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div
            role="listbox"
            aria-label={t('searchHistory')}
            className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
          >
            {suggestions.map((item, i) => (
              <button
                key={item.keyword + item.type}
                role="option"
                aria-selected={i === selectedIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(item.keyword);
                }}
                className={`w-full text-left px-4 py-2.5 min-h-[44px] text-sm transition-colors flex items-center gap-2 ${
                  i === selectedIndex
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {item.type === 'history' ? (
                  <svg
                    className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                )}
                <span className="truncate">{item.keyword}</span>
                {item.type === 'history' && (
                  <span className="ml-auto text-xs text-amber-500/50">
                    {t('historyTag')}
                  </span>
                )}
                {item.type === 'popular' && (
                  <span className="ml-auto text-xs text-gray-400">
                    {t('popularTag')}
                  </span>
                )}
                {i === selectedIndex && (
                  <span className="ml-1 text-xs text-gray-400">Tab</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={handleSearch}
        disabled={!localInput.trim()}
        className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {t('search')}
      </button>
    </div>
  );
};

export default SearchBar;
