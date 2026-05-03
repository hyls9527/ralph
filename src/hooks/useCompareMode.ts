import { useCallback } from 'react';
import { useUiStore } from '../stores/slices/uiSlice';

export function useCompareMode() {
  const compareMode = useUiStore((s) => s.compareMode);
  const selectedProjects = useUiStore((s) => s.selectedProjects);

  const {
    setCompareMode,
    addSelectedProject,
    removeSelectedProject,
    clearSelectedProjects,
  } = useUiStore();

  const toggleCompareMode = useCallback(() => {
    const newMode = !compareMode;
    setCompareMode(newMode);
    if (newMode) {
      clearSelectedProjects();
    }
  }, [compareMode, setCompareMode, clearSelectedProjects]);

  const toggleProjectSelection = useCallback(
    (fullName: string) => {
      if (selectedProjects.includes(fullName)) {
        removeSelectedProject(fullName);
      } else {
        addSelectedProject(fullName);
      }
    },
    [selectedProjects, addSelectedProject, removeSelectedProject],
  );

  return {
    compareMode,
    selectedProjects,
    toggleCompareMode,
    toggleProjectSelection,
    clearSelectedProjects,
    isSelected: (fullName: string) => selectedProjects.includes(fullName),
  };
}
