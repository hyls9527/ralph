import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';

interface HeaderProps {
  searchBarRef?: React.RefObject<HTMLElement>;
}

export function Header(_props?: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const { lang, switchLang } = useI18n();
  const isLight = !isDark;

  return (
    <header className={`border-b ${isLight ? 'bg-white/80 border-gray-200' : 'bg-gray-950/80 border-gray-800'} backdrop-blur sticky top-0 z-10`}>
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold">
          Ralph <span className="text-violet-400 font-normal text-sm">GitHub Project Evaluator</span>
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            id="ralph-lang-btn"
            onClick={() => switchLang(lang === 'zh' ? 'en' : 'zh')}
            className={`px-2 py-1.5 min-w-[44px] min-h-[44px] text-xs rounded-lg transition-colors ${isLight ? 'hover:bg-gray-200 text-gray-600' : 'hover:bg-gray-800 text-gray-400'}`}
            aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
          >
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
          <button
            onClick={toggleTheme}
            className={`p-2.5 min-w-[44px] min-h-[44px] rounded-lg transition-colors ${isLight ? 'hover:bg-gray-200 text-gray-600' : 'hover:bg-gray-800 text-gray-400'}`}
            aria-label={isLight ? '切换暗黑模式' : '切换明亮模式'}
          >
            {isLight ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
