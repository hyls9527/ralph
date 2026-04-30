import React, { useState, useCallback, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import type { ProjectRecommendation } from '../types';

interface HistoryItem {
  query: string;
  resultCount: number;
  timestamp: string;
}

interface SearchResponse {
  results: ProjectRecommendation[];
  meta: {
    queryId: string;
    totalCandidates: number;
    evaluatedCount: number;
    dataSource: string;
  };
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
  'rust async', 'react state management', 'go web framework',
  'python ml', 'typescript toolkit', 'cli tool',
  'ai agent', 'developer tools', 'logging library',
  'api framework', 'database orm', 'testing framework',
];

const SearchBar = forwardRef<SearchBarHandle>((_props, ref) => {
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
        const data = await invoke<HistoryItem[]>('get_search_history');
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
        .filter(h => h.query.toLowerCase().includes(lowerInput) && h.query.toLowerCase() !== lowerInput)
        .slice(0, 5)
        .forEach(h => {
          if (!seen.has(h.query)) {
            seen.add(h.query);
            suggestionsList.push({ keyword: h.query, type: 'history' });
          }
        });

      const remainingSlots = Math.max(0, 5 - suggestionsList.length);
      POPULAR_KEYWORDS
        .filter(kw =>
          kw.toLowerCase().includes(lowerInput) &&
          kw.toLowerCase() !== lowerInput &&
          !seen.has(kw)
        )
        .slice(0, remainingSlots)
        .forEach(kw => {
          suggestionsList.push({ keyword: kw, type: 'popular' });
        });
    } else {
      historyCacheRef.current
        .slice(0, 5)
        .forEach(h => {
          if (!seen.has(h.query)) {
            seen.add(h.query);
            suggestionsList.push({ keyword: h.query, type: 'history' });
          }
        });

      const remainingSlots = Math.max(0, 8 - suggestionsList.length);
      POPULAR_KEYWORDS
        .slice(0, remainingSlots)
        .forEach(kw => {
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

  const executeSearch = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;

    setQuery(queryText.trim());
    setLoading({ phase: 'searching', message: '正在搜索 GitHub 项目...' });

    try {
      const response = await invoke<SearchResponse>('search_and_evaluate', {
        query: queryText.trim(),
      });
      setSearchResults(response.results);
    } catch (error) {
      const errorMessage = String(error);
      let userMessage = '搜索失败，请稍后重试';
      if (errorMessage.includes('invoke') || errorMessage.includes('undefined')) {
        userMessage = '网络连接异常，请确保在 Tauri 桌面环境中运行';
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('403')) {
        userMessage = 'GitHub API 限流，请在设置中配置 Token 后重试';
      } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        userMessage = '网络连接异常，请检查网络后重试';
      }
      setLoading({
        phase: 'error',
        message: userMessage,
      });
    }
  }, [setQuery, setLoading, setSearchResults]);

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
        setSelectedIndex(i => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length);
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
      handleSearch();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  useImperativeHandle(ref, () => ({
    setSearchAndExecute: (query: string) => {
      setLocalInput(query);
      executeSearch(query);
    },
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  return (
    <div className="flex gap-2 mb-6" ref={containerRef}>
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="输入搜索关键词，如 'rust logging' 或 'react state management'"
          className="w-full bg-gray-900 text-gray-100 placeholder-gray-600 rounded-lg pl-4 pr-10 py-3 text-sm border border-gray-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
        />
        {localInput && (
          <button
            onClick={() => { setLocalInput(''); setShowSuggestions(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
            {suggestions.map((item, i) => (
              <button
                key={item.keyword + item.type}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(item.keyword); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                  i === selectedIndex ? 'bg-violet-600/20 text-violet-300' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {item.type === 'history' ? (
                  <svg className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                )}
                <span className="truncate">{item.keyword}</span>
                {item.type === 'history' && (
                  <span className="ml-auto text-xs text-amber-500/50">历史</span>
                )}
                {item.type === 'popular' && (
                  <span className="ml-auto text-xs text-gray-500">热门</span>
                )}
                {i === selectedIndex && (
                  <span className="ml-1 text-xs text-gray-500">Tab</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={handleSearch}
        disabled={!localInput.trim()}
        className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        搜索
      </button>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
