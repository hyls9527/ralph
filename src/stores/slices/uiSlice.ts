import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectRecommendation } from '../../types';

export interface UIState {
  showSettings: boolean;
  showTrending: boolean;
  showFilters: boolean;
  showHelp: boolean;
  compareMode: boolean;
  selectedProjects: string[];
  currentPage: number;
  theme: 'dark' | 'light';
  selectedDetailProject: ProjectRecommendation | null;

  setShowSettings: (show: boolean) => void;
  setShowTrending: (show: boolean) => void;
  setShowFilters: (show: boolean) => void;
  setShowHelp: (show: boolean) => void;
  setCompareMode: (mode: boolean) => void;
  addSelectedProject: (fullName: string) => void;
  removeSelectedProject: (fullName: string) => void;
  clearSelectedProjects: () => void;
  setCurrentPage: (page: number) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setSelectedDetailProject: (project: ProjectRecommendation | null) => void;
}

export const useUiStore = create<UIState>()(
  persist(
    (set) => ({
      showSettings: false,
      showTrending: false,
      showFilters: false,
      showHelp: false,
      compareMode: false,
      selectedProjects: [],
      currentPage: 1,
      theme: 'dark',
      selectedDetailProject: null,

      setShowSettings: (showSettings) => set({ showSettings }),
      setShowTrending: (showTrending) => set({ showTrending }),
      setShowFilters: (showFilters) => set({ showFilters }),
      setShowHelp: (showHelp) => set({ showHelp }),
      setCompareMode: (compareMode) => set({ compareMode }),
      addSelectedProject: (fullName) =>
        set((state: UIState) => ({
          selectedProjects: [...state.selectedProjects, fullName],
        })),
      removeSelectedProject: (fullName) =>
        set((state: UIState) => ({
          selectedProjects: state.selectedProjects.filter(
            (p) => p !== fullName,
          ),
        })),
      clearSelectedProjects: () => set({ selectedProjects: [] }),
      setCurrentPage: (currentPage) => set({ currentPage }),
      setTheme: (theme) => set({ theme }),
      setSelectedDetailProject: (selectedDetailProject) =>
        set({ selectedDetailProject }),
    }),
    {
      name: 'ralph-ui-v3',
      version: 3,
    },
  ),
);
