import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EmptyState } from '../../components/features/EmptyState';

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

describe('EmptyState', () => {
  it('有结果时返回 null', () => {
    const html = renderToString(<EmptyState hasResults={true} />);
    expect(html).toBe('');
  });

  it('无结果且未搜索时显示初始提示', () => {
    const html = renderToString(
      <EmptyState hasResults={false} hasSearched={false} />,
    );
    expect(html).toContain('开始搜索');
    expect(html).toContain('GitHub');
  });

  it('无结果且已搜索时显示无匹配提示', () => {
    const html = renderToString(
      <EmptyState hasResults={false} hasSearched={true} />,
    );
    expect(html).toContain('未找到匹配的项目');
    expect(html).toContain('尝试调整');
  });

  it('提供 onClearFilters 时显示清除按钮', () => {
    const html = renderToString(
      <EmptyState
        hasResults={false}
        hasSearched={true}
        onClearFilters={vi.fn()}
      />,
    );
    expect(html).toContain('清除筛选条件');
  });

  it('不提供 onClearFilters 时不显示清除按钮', () => {
    const html = renderToString(
      <EmptyState hasResults={false} hasSearched={true} />,
    );
    expect(html).not.toContain('清除筛选条件');
  });

  it('渲染搜索图标 SVG', () => {
    const html = renderToString(<EmptyState hasResults={false} />);
    expect(html).toContain('<svg');
  });
});
