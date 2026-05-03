import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import BadgeDisplay from '../../components/BadgeDisplay';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../../i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      generateBadge: '生成徽章',
      copyMarkdown: '复制 Markdown',
      shareCopied: '已复制',
    };
    return map[key] || key;
  },
}));

describe('BadgeDisplay', () => {
  it('渲染等级和分数', () => {
    const html = renderToString(
      <BadgeDisplay grade="S" score={95} repoFullName="owner/repo" />
    );
    expect(html).toContain('S');
    expect(html).toContain('95');
    expect(html).toContain('105');
  });

  it('渲染 A 等级', () => {
    const html = renderToString(
      <BadgeDisplay grade="A" score={80} repoFullName="owner/repo" />
    );
    expect(html).toContain('A');
    expect(html).toContain('80');
  });

  it('渲染 B 等级', () => {
    const html = renderToString(
      <BadgeDisplay grade="B" score={65} repoFullName="owner/repo" />
    );
    expect(html).toContain('B');
    expect(html).toContain('65');
  });

  it('渲染 C 等级', () => {
    const html = renderToString(
      <BadgeDisplay grade="C" score={50} repoFullName="owner/repo" />
    );
    expect(html).toContain('C');
    expect(html).toContain('50');
  });

  it('渲染 X 等级', () => {
    const html = renderToString(
      <BadgeDisplay grade="X" score={30} repoFullName="owner/repo" />
    );
    expect(html).toContain('X');
    expect(html).toContain('30');
  });

  it('显示生成徽章按钮', () => {
    const html = renderToString(
      <BadgeDisplay grade="S" score={95} repoFullName="owner/repo" />
    );
    expect(html).toContain('生成徽章');
  });

  it('初始状态不显示复制按钮', () => {
    const html = renderToString(
      <BadgeDisplay grade="S" score={95} repoFullName="owner/repo" />
    );
    expect(html).not.toContain('复制 Markdown');
  });

  it('sm 尺寸渲染', () => {
    const html = renderToString(
      <BadgeDisplay grade="S" score={95} repoFullName="owner/repo" size="sm" />
    );
    expect(html).toContain('S');
  });

  it('lg 尺寸渲染', () => {
    const html = renderToString(
      <BadgeDisplay grade="S" score={95} repoFullName="owner/repo" size="lg" />
    );
    expect(html).toContain('S');
  });

  it('未知等级回退到 X 样式', () => {
    const html = renderToString(
      <BadgeDisplay grade="Z" score={10} repoFullName="owner/repo" />
    );
    expect(html).toContain('Z');
    expect(html).toContain('10');
  });
});
