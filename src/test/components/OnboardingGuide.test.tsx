import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OnboardingGuide } from '../../components/OnboardingGuide';

vi.mock('../../services/tauri', () => ({
  tauri: {
    getSearchHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../i18n', () => {
  const mockT = (key: string) => {
    const map: Record<string, string> = {
      skipGuide: '跳过引导',
      nextStep: '下一步',
      getStarted: '开始使用',
      onboardingSearch: '搜索框提示',
      onboardingSettings: '设置提示',
      onboardingTrending: '趋势提示',
      onboardingLang: '语言提示',
    };
    return map[key] || key;
  };
  return {
    t: mockT,
    useI18n: () => ({ t: mockT, lang: 'zh', switchLang: vi.fn() }),
  };
});

describe('OnboardingGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('组件渲染不崩溃', () => {
    expect(() => renderToString(<OnboardingGuide />)).not.toThrow();
  });

  it('初始状态不显示引导提示', () => {
    const html = renderToString(<OnboardingGuide />);
    expect(html).toBe('');
  });

  it('多次渲染不崩溃', () => {
    expect(() => renderToString(<OnboardingGuide />)).not.toThrow();
    expect(() => renderToString(<OnboardingGuide />)).not.toThrow();
  });
});
