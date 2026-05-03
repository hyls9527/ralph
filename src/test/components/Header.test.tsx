import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Header } from '../../components/layout/Header';

const mockToggleTheme = vi.fn();
const mockSwitchLang = vi.fn();

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: mockToggleTheme }),
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({ lang: 'zh', switchLang: mockSwitchLang }),
}));

describe('Header', () => {
  it('渲染应用标题', () => {
    const html = renderToString(<Header />);
    expect(html).toContain('Ralph');
    expect(html).toContain('GitHub Project Evaluator');
  });

  it('渲染语言切换按钮', () => {
    const html = renderToString(<Header />);
    expect(html).toContain('EN');
    expect(html).toContain('ralph-lang-btn');
  });

  it('渲染主题切换按钮', () => {
    const html = renderToString(<Header />);
    expect(html).toContain('切换暗黑模式');
  });

  it('渲染 Logo 图标', () => {
    const html = renderToString(<Header />);
    expect(html).toContain('bg-violet-600');
  });

  it('包含 sticky 定位样式', () => {
    const html = renderToString(<Header />);
    expect(html).toContain('sticky');
  });
});
