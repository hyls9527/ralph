import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ErrorFallback } from '../../components/layout/ErrorFallback';

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: true }),
}));

describe('ErrorFallback', () => {
  it('渲染错误信息', () => {
    const html = renderToString(<ErrorFallback error="Something went wrong" />);
    expect(html).toContain('发生错误');
    expect(html).toContain('Something went wrong');
  });

  it('有 onRetry 时渲染重试按钮', () => {
    const html = renderToString(
      <ErrorFallback error="Error" onRetry={vi.fn()} />
    );
    expect(html).toContain('重试');
  });

  it('无 onRetry 时不渲染重试按钮', () => {
    const html = renderToString(<ErrorFallback error="Error" />);
    expect(html).not.toContain('重试');
  });

  it('渲染错误图标 SVG', () => {
    const html = renderToString(<ErrorFallback error="Error" />);
    expect(html).toContain('svg');
    expect(html).toContain('rose-400');
  });
});
