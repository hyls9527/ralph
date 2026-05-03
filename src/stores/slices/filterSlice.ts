import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export interface FilterState {
  sortBy: 'recommendationIndex' | 'score' | 'stars' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  trackFilter: 'all' | 'neglected' | 'high-star' | 'steady';
  languageFilter: string;
  minScore: number;
  minStars: number;

  setSortBy: (sortBy: FilterState['sortBy']) => void;
  setSortOrder: (sortOrder: FilterState['sortOrder']) => void;
  setTrackFilter: (trackFilter: FilterState['trackFilter']) => void;
  setLanguageFilter: (languageFilter: string) => void;
  setMinScore: (minScore: number) => void;
  setMinStars: (minStars: number) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: Omit<
  FilterState,
  | 'setSortBy'
  | 'setSortOrder'
  | 'setTrackFilter'
  | 'setLanguageFilter'
  | 'setMinScore'
  | 'setMinStars'
  | 'resetFilters'
> = {
  sortBy: 'recommendationIndex',
  sortOrder: 'desc',
  trackFilter: 'all',
  languageFilter: 'all',
  minScore: 0,
  minStars: 0,
};

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      ...DEFAULT_FILTERS,

      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setTrackFilter: (trackFilter) => set({ trackFilter }),
      setLanguageFilter: (languageFilter) => set({ languageFilter }),
      setMinScore: (minScore) => set({ minScore }),
      setMinStars: (minStars) => set({ minStars }),

      resetFilters: () => set(DEFAULT_FILTERS),
    }),
    {
      name: 'ralph-filters-v3',
      version: 4,
    },
  ),
);

export function useFilterSelector() {
  return useFilterStore(
    useShallow((state) => ({
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      trackFilter: state.trackFilter,
      languageFilter: state.languageFilter,
      minScore: state.minScore,
      minStars: state.minStars,
    })),
  );
}
