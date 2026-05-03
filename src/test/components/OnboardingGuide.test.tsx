import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OnboardingGuide } from '../../components/OnboardingGuide';

vi.mock('../../services/tauri', () => ({
  tauri: {
    getSearchHistory: vi.fn().mockResolvedValue([]),
  },
}));

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
