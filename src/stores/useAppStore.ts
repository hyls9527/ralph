import { create } from 'zustand';
import type { ProjectRecommendation, LoadingState } from '../types';

interface AppState {
  query: string;
  results: ProjectRecommendation[];
  loading: LoadingState;
  selectedProject: ProjectRecommendation | null;
  setQuery: (q: string) => void;
  setSearchResults: (results: ProjectRecommendation[]) => void;
  setLoading: (loading: Partial<LoadingState>) => void;
  setSelectedProject: (project: ProjectRecommendation | null) => void;
  setToken: (token: string) => void;
  token: string;
}

export const useAppStore = create<AppState>((set) => ({
  query: '',
  results: [],
  loading: { phase: 'idle', message: '' },
  selectedProject: null,
  token: '',
  setQuery: (q) => set({ query: q }),
  setSearchResults: (results) => set({ results, loading: { phase: 'done', message: '' } }),
  setLoading: (loading) => set((state) => ({ loading: { ...state.loading, ...loading } })),
  setSelectedProject: (project) => set({ selectedProject: project }),
  setToken: (token) => set({ token }),
}));
