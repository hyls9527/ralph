import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ConfidenceBadge from '../../components/ConfidenceBadge';

describe('ConfidenceBadge', () => {
  it('渲染 L1 最高置信度', () => {
    const html = renderToString(<ConfidenceBadge level="L1" />);
    expect(html).toContain('L1');
    expect(html).toContain('100%');
    expect(html).toContain('emerald');
  });

  it('渲染 L2 高置信度', () => {
    const html = renderToString(<ConfidenceBadge level="L2" />);
    expect(html).toContain('L2');
    expect(html).toContain('85%');
    expect(html).toContain('blue');
  });

  it('渲染 L3 中等置信度', () => {
    const html = renderToString(<ConfidenceBadge level="L3" />);
    expect(html).toContain('L3');
    expect(html).toContain('80%');
    expect(html).toContain('amber');
  });

  it('渲染 L4 低置信度', () => {
    const html = renderToString(<ConfidenceBadge level="L4" />);
    expect(html).toContain('L4');
    expect(html).toContain('50%');
    expect(html).toContain('orange');
  });

  it('渲染 L5 零置信度', () => {
    const html = renderToString(<ConfidenceBadge level="L5" />);
    expect(html).toContain('L5');
    expect(html).toContain('0%');
    expect(html).toContain('red');
  });

  it('默认不显示描述', () => {
    const html = renderToString(<ConfidenceBadge level="L1" />);
    expect(html).not.toContain('API 验证');
  });

  it('showDescription 为 true 时显示描述', () => {
    const html = renderToString(
      <ConfidenceBadge level="L1" showDescription={true} />,
    );
    expect(html).toContain('API 验证');
    expect(html).toContain('最高置信度');
  });

  it('sm 尺寸应用正确类名', () => {
    const html = renderToString(<ConfidenceBadge level="L1" size="sm" />);
    expect(html).toContain('text-xs');
  });

  it('lg 尺寸应用正确类名', () => {
    const html = renderToString(<ConfidenceBadge level="L1" size="lg" />);
    expect(html).toContain('text-sm');
  });

  it('渲染 SVG 图标', () => {
    const html = renderToString(<ConfidenceBadge level="L1" />);
    expect(html).toContain('<svg');
  });
});
