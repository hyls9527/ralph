import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import EvaluationHistory from '../../components/EvaluationHistory';

vi.mock('../../services/tauri', () => ({
  tauri: {
    getEvaluationHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../i18n', () => {
  const mockT = (key: string) => {
    const map: Record<string, string> = {
      noEvaluationHistory: '暂无评估历史',
      neglected: '被忽视',
      highStar: '高星',
      steady: '稳态',
    };
    return map[key] || key;
  };
  return {
    t: mockT,
    useI18n: () => ({ t: mockT, lang: 'zh', switchLang: vi.fn() }),
  };
});

describe('EvaluationHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染空状态（初始无数据）', () => {
    const html = renderToString(
      <EvaluationHistory repoFullName="test/repo" />
    );
    expect(html).toContain('暂无评估历史');
  });

  it('组件渲染不崩溃', () => {
    expect(() =>
      renderToString(<EvaluationHistory repoFullName="test/repo" />)
    ).not.toThrow();
  });

  it('亮色模式正常渲染', () => {
    expect(() =>
      renderToString(<EvaluationHistory repoFullName="test/repo" isLight={true} />)
    ).not.toThrow();
  });

  it('暗色模式正常渲染', () => {
    expect(() =>
      renderToString(<EvaluationHistory repoFullName="test/repo" isLight={false} />)
    ).not.toThrow();
  });
});
