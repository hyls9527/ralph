import { useEffect, useCallback } from 'react';
import { useUiStore } from '../stores/slices/uiSlice';
import { setThemeToggle } from '../hooks/useKeyboardShortcuts';

export function useTheme() {
  const theme = useUiStore(s => s.theme);
  const setTheme = useUiStore(s => s.setTheme);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [theme, setTheme]);

  useEffect(() => {
    // Register toggle function for keyboard shortcuts
    setThemeToggle(toggleTheme);

    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme, toggleTheme]);

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
