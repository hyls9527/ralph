import { useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { tauri } from '../services/tauri';

export function useSearch() {
  const { setQuery, setLoading, setSearchResults } = useAppStore();

  const evaluate = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading({ phase: 'searching', message: '正在搜索 GitHub 项目...' });

    try {
      const response = await tauri.searchAndEvaluate(queryText);
      setQuery(queryText.trim());
      setSearchResults(response.results || []);
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
      setLoading({ phase: 'error', message: userMessage });
    }
  }, [setQuery, setLoading, setSearchResults]);

  const evaluateFromTrending = useCallback(async (repo: { full_name: string }) => {
    setLoading({ phase: 'evaluating', message: '正在评估项目...' });

    try {
      const response = await tauri.searchAndEvaluate(repo.full_name);
      setQuery(repo.full_name);
      setSearchResults(response.results || []);
    } catch (error) {
      const message = String(error);
      setLoading({
        phase: 'error',
        message: message.includes('invoke') ? '网络连接异常' : message,
      });
    }
  }, [setQuery, setLoading, setSearchResults]);

  const batchEvaluate = useCallback(async (queryText: string, count: number = 10) => {
    if (!queryText.trim()) return;

    setLoading({ phase: 'evaluating', message: `正在批量评定 ${count} 个项目...` });

    try {
      const response = await tauri.batchEvaluate(queryText, count);
      setQuery(queryText.trim());
      setSearchResults(response.results || []);
    } catch (error) {
      const message = String(error);
      setLoading({ phase: 'error', message });
    }
  }, [setQuery, setLoading, setSearchResults]);

  return { evaluate, evaluateFromTrending, batchEvaluate };
}
