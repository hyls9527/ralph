import { create } from 'zustand';
import type { ProjectRecommendation, LoadingState } from '../types';

interface AppState {
  query: string;
  results: ProjectRecommendation[];
  loading: LoadingState;
  setQuery: (q: string) => void;
  setSearchResults: (results: ProjectRecommendation[]) => void;
  setLoading: (loading: Partial<LoadingState>) => void;
  setToken: (token: string) => void;
  token: string;
}

export const useAppStore = create<AppState>((set) => ({
  query: '',
  results: [],
  loading: { phase: 'idle', message: '' },
  token: '',
  setQuery: (q) => set({ query: q }),
  setSearchResults: (results) => set({ results, loading: { phase: 'done', message: '' } }),
  setLoading: (loading) => set((state) => ({ loading: { ...state.loading, ...loading } })),
  setToken: (token) => set({ token }),
}));
