import { useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useFilterSelector } from '../stores/slices/filterSlice';
import { useUiStore } from '../stores/slices/uiSlice';
import type { DimensionWeights } from '../types';

const ITEMS_PER_PAGE = 10;

export function useFilteredResults(dimensionWeights?: DimensionWeights) {
  const results = useAppStore(s => s.results);
  const filters = useFilterSelector();
  const currentPage = useUiStore(s => s.currentPage);

  // 权重调整后的重新评分
  const weightedResults = useMemo(() => {
    if (!dimensionWeights) return results;

    const totalWeight = Object.values(dimensionWeights).reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return results;

    return results.map(project => {
      const dims = project.dimensions || [];
      const weightedScore = dims.reduce((acc, dim) => {
        const ratio = dim.maxScore > 0 ? dim.score / dim.maxScore : 0;
        const weightKey = dim.dimension as keyof DimensionWeights;
        return acc + ratio * (dimensionWeights[weightKey] ?? 0);
      }, 0);

      return {
        ...project,
        weightedScore: Math.round(weightedScore * 10) / 10,
      };
    });
  }, [results, dimensionWeights]);

  // 过滤 + 排序
  const filteredResults = useMemo(() => {
    let filtered = weightedResults.filter(p => {
      if (filters.trackFilter !== 'all' && p.track !== filters.trackFilter) return false;
      if (filters.languageFilter !== 'all' && p.repo.language !== filters.languageFilter) return false;
      if (p.totalScore < filters.minScore) return false;
      if ((p.repo.stargazersCount || 0) < filters.minStars) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const aScore = a.totalScore;
      const bScore = b.totalScore;

      let aVal: number, bVal: number;
      switch (filters.sortBy) {
        case 'score':
          aVal = aScore;
          bVal = bScore;
          break;
        case 'stars':
          aVal = a.repo.stargazersCount || 0;
          bVal = b.repo.stargazersCount || 0;
          break;
        case 'recommendationIndex':
          aVal = a.recommendationIndex;
          bVal = b.recommendationIndex;
          break;
        case 'updatedAt':
          aVal = new Date(a.repo.updatedAt).getTime();
          bVal = new Date(b.repo.updatedAt).getTime();
          break;
        default:
          aVal = aScore;
          bVal = bScore;
      }
      return filters.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [weightedResults, filters.sortBy, filters.sortOrder, filters.trackFilter, filters.languageFilter, filters.minScore, filters.minStars]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedResults = useMemo(() =>
    filteredResults.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [filteredResults, safePage]
  );

  // 提取所有语言
  const languages = useMemo(() => {
    const set = new Set<string>();
    results.forEach(p => { if (p.repo.language) set.add(p.repo.language); });
    return Array.from(set).sort();
  }, [results]);

  return {
    filteredResults,
    paginatedResults,
    totalPages,
    currentPage: safePage,
    totalResults: filteredResults.length,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
    languages,
  };
}
