import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onSearchFocus: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onClosePopup: () => void;
  onToggleTheme: () => void;
  hasPopupOpen: boolean;
  totalPages: number;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { onSearchFocus, onNextPage, onPrevPage, onClosePopup, onToggleTheme, hasPopupOpen, totalPages } = options;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in input/textarea
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // / or s: Focus search
      if ((e.key === '/' || e.key === 's') && !isInput) {
        e.preventDefault();
        onSearchFocus();
        return;
      }

      // Escape: Close popups
      if (e.key === 'Escape') {
        if (hasPopupOpen) {
          e.preventDefault();
          onClosePopup();
        }
        return;
      }

      // Arrow navigation for pages
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (!isInput && totalPages > 1) {
          e.preventDefault();
          onNextPage();
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (!isInput && totalPages > 1) {
          e.preventDefault();
          onPrevPage();
        }
        return;
      }

      // d: toggle dark/light theme
      if (e.key === 'd' && !isInput) {
        e.preventDefault();
        onToggleTheme();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSearchFocus, onNextPage, onPrevPage, onClosePopup, onToggleTheme, hasPopupOpen, totalPages]);
}
