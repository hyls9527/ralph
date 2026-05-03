import { useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useFilterSelector } from '../stores/slices/filterSlice';
import { useUiStore } from '../stores/slices/uiSlice';
import {
  applyDimensionWeights,
  filterAndSort,
  paginate,
  extractLanguages,
} from '../lib/filter-utils';
import type { DimensionWeights } from '../types';

export function useFilteredResults(dimensionWeights?: DimensionWeights) {
  const results = useAppStore(s => s.results);
  const filters = useFilterSelector();
  const currentPage = useUiStore(s => s.currentPage);

  const weightedResults = useMemo(() => {
    if (!dimensionWeights) return results;
    return applyDimensionWeights(results, dimensionWeights);
  }, [results, dimensionWeights]);

  const filteredResults = useMemo(
    () => filterAndSort(weightedResults, filters),
    [weightedResults, filters.sortBy, filters.sortOrder, filters.trackFilter, filters.languageFilter, filters.minScore, filters.minStars],
  );

  const pagination = useMemo(
    () => paginate(filteredResults, currentPage),
    [filteredResults, currentPage],
  );

  const languages = useMemo(() => extractLanguages(results), [results]);

  return {
    filteredResults,
    ...pagination,
    languages,
  };
}
