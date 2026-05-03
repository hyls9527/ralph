import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ResultsSkeleton from '../../components/ResultsSkeleton';

describe('ResultsSkeleton', () => {
  it('默认渲染 3 个骨架卡片', () => {
    const html = renderToString(<ResultsSkeleton />);
    const matches = html.match(/animate-pulse/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });

  it('渲染指定数量的骨架卡片', () => {
    const html = renderToString(<ResultsSkeleton count={5} />);
    const matches = html.match(/animate-pulse/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(5);
  });

  it('渲染 1 个骨架卡片', () => {
    const html = renderToString(<ResultsSkeleton count={1} />);
    const matches = html.match(/animate-pulse/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('暗色模式下使用深色背景', () => {
    const html = renderToString(<ResultsSkeleton isLight={false} />);
    expect(html).toContain('bg-gray-900/60');
    expect(html).toContain('border-gray-800');
  });

  it('亮色模式下使用浅色背景', () => {
    const html = renderToString(<ResultsSkeleton isLight={true} />);
    expect(html).toContain('bg-white');
    expect(html).toContain('border-gray-200');
  });

  it('包含骨架占位元素', () => {
    const html = renderToString(<ResultsSkeleton count={1} />);
    expect(html).toContain('rounded');
    expect(html).toContain('animate-pulse');
  });

  it('渲染 0 个时不产生卡片', () => {
    const html = renderToString(<ResultsSkeleton count={0} />);
    const matches = html.match(/animate-pulse/g);
    expect(matches).toBeNull();
  });
});
