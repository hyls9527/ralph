import { useState, useEffect } from 'react';
import { getShortcutsForHelp } from '../hooks/useKeyboardShortcuts';
import { escapeStack } from '../lib/escape-stack';

export function KeyboardHelpModal() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');

  useEffect(() => {
    const toggle = () => setOpen((prev) => !prev);
    import('../hooks/useKeyboardShortcuts').then(({ setHelpModalToggle }) => {
      setHelpModalToggle(toggle);
    });

    // Detect language
    const savedLang = localStorage.getItem('ralph-language');
    setLang(savedLang === 'en' ? 'en' : 'zh');

    return () => {
      escapeStack.unregister('help');
    };
  }, []);

  useEffect(() => {
    if (open) {
      escapeStack.register('help', () => setOpen(false), 0);
      return () => escapeStack.unregister('help');
    }
  }, [open]);

  const shortcuts = getShortcutsForHelp();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-help-title"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="keyboard-help-title"
          className="text-xl font-semibold mb-4 text-gray-900 dark:text-white"
        >
          ⌨️ {lang === 'zh' ? '键盘快捷键' : 'Keyboard Shortcuts'}
        </h2>

        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-gray-700 dark:text-gray-300">
                {shortcut.description[lang] || shortcut.description.en}
              </span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono border border-gray-300 dark:border-gray-600">
                {formatShortcut(shortcut)}
              </kbd>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          Press{' '}
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
            Esc
          </kbd>{' '}
          to close
        </p>
      </div>
    </div>
  );
}

function formatShortcut(
  config: Omit<import('../types/shortcuts').ShortcutConfig, 'action' | 'when'>,
): string {
  const modifier = config.modifiers?.includes('ctrl') ? 'Ctrl+' : '';
  return `${modifier}${config.key.toUpperCase()}`;
}
