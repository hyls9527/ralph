import { useEffect } from 'react';
import { escapeStack } from '../lib/escape-stack';
import type { ShortcutConfig } from '../types/shortcuts';

let toggleHelpModal: (() => void) | null = null;
let toggleThemeCallback: (() => void) | null = null;

export function setHelpModalToggle(fn: () => void): void {
  toggleHelpModal = fn;
}

export function setThemeToggle(fn: () => void): void {
  toggleThemeCallback = fn;
}

const SHORTCUTS: ShortcutConfig[] = [
  {
    id: 'focus-search',
    key: '/',
    context: 'global',
    action: () => {
      document.getElementById('search-input')?.focus();
    },
    description: { zh: '聚焦搜索框', en: 'Focus search bar' },
  },
  {
    id: 'toggle-theme',
    key: 'd',
    modifiers: ['ctrl'],
    context: 'global',
    action: () => {
      if (toggleThemeCallback) toggleThemeCallback();
    },
    description: { zh: '切换暗黑/明亮主题', en: 'Toggle dark/light theme' },
  },
  {
    id: 'close-overlay',
    key: 'Escape',
    context: 'global',
    when: () => escapeStack.hasItems(),
    action: () => escapeStack.handleEscape(),
    description: { zh: '关闭当前面板', en: 'Close current panel' },
  },
  {
    id: 'toggle-help',
    key: '?',
    context: 'global',
    when: () => !isInputFocused(),
    action: () => {
      if (toggleHelpModal) toggleHelpModal();
    },
    description: { zh: '打开快捷键帮助', en: 'Show keyboard shortcuts' },
  },
];

export interface KeyboardShortcutsOptions {
  onSearchFocus?: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onClosePopup?: () => void;
  onToggleTheme?: () => void;
  totalPages?: number;
}

export function useKeyboardShortcuts(options?: KeyboardShortcutsOptions) {
  const {
    onSearchFocus,
    onNextPage,
    onPrevPage,
    onClosePopup,
    onToggleTheme,
    totalPages = 1,
  } = options || {};

  useEffect(() => {
    if (onToggleTheme) {
      toggleThemeCallback = onToggleTheme;
    }

    const handler = (e: KeyboardEvent) => {
      for (const shortcut of SHORTCUTS) {
        if (shortcut.enabled === false) continue;

        if (matchShortcut(e, shortcut)) {
          if (!checkContext(e.target, shortcut.context)) continue;
          if (shortcut.when && !shortcut.when()) continue;

          e.preventDefault();
          shortcut.action();
          return;
        }
      }

      // Legacy shortcuts for backward compatibility
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.key === '/' || e.key === 's') && !isInput && onSearchFocus) {
        e.preventDefault();
        onSearchFocus();
        return;
      }

      if (e.key === 'Escape' && onClosePopup) {
        e.preventDefault();
        onClosePopup();
        return;
      }

      if (
        (e.key === 'ArrowRight' || e.key === 'ArrowDown') &&
        !isInput &&
        totalPages > 1 &&
        onNextPage
      ) {
        e.preventDefault();
        onNextPage();
        return;
      }

      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowUp') &&
        !isInput &&
        totalPages > 1 &&
        onPrevPage
      ) {
        e.preventDefault();
        onPrevPage();
        return;
      }

      if (e.key === 'd' && !isInput && onToggleTheme) {
        e.preventDefault();
        onToggleTheme();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    onSearchFocus,
    onNextPage,
    onPrevPage,
    onClosePopup,
    onToggleTheme,
    totalPages,
  ]);
}

export function getShortcutsForHelp(): Omit<
  ShortcutConfig,
  'action' | 'when'
>[] {
  return SHORTCUTS.map(({ action, when, ...rest }) => rest);
}

function matchShortcut(event: KeyboardEvent, config: ShortcutConfig): boolean {
  const { key, modifiers = [] } = config;

  if (event.key.toLowerCase() !== key.toLowerCase()) return false;
  if (modifiers.includes('ctrl') !== (event.ctrlKey || event.metaKey))
    return false;
  if (modifiers.includes('shift') !== event.shiftKey) return false;
  if (modifiers.includes('alt') !== event.altKey) return false;

  return true;
}

function checkContext(
  target: EventTarget | null,
  context: ShortcutConfig['context'],
): boolean {
  if (context === 'global') return true;

  const element = target as HTMLElement;

  switch (context) {
    case 'input':
      return isInputElement(element);
    case 'modal':
      return !!element.closest('[role="dialog"]');
    default:
      return true;
  }
}

function isInputElement(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase();
  return ['input', 'textarea'].includes(tag) || element.isContentEditable;
}

export function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  return isInputElement(activeElement as HTMLElement);
}
