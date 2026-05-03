import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import TrustBadge from '../../components/TrustBadge';
import type { TrustBadge as TrustBadgeType } from '../../types';

function makeBadge(
  overrides: Partial<TrustBadgeType['l1']> = {},
): TrustBadgeType {
  return {
    level: 2,
    l1: {
      status: 'recommended',
      icon: '✓',
      label: '推荐',
      color: 'emerald',
      ...overrides,
    },
  };
}

describe('TrustBadge', () => {
  it('渲染推荐徽章', () => {
    const html = renderToString(<TrustBadge badge={makeBadge()} />);
    expect(html).toContain('✓');
    expect(html).toContain('推荐');
  });

  it('渲染警告徽章', () => {
    const html = renderToString(
      <TrustBadge
        badge={makeBadge({
          status: 'caution',
          icon: '⚠',
          label: '注意',
          color: 'amber',
        })}
      />,
    );
    expect(html).toContain('⚠');
    expect(html).toContain('注意');
  });

  it('渲染危险徽章', () => {
    const html = renderToString(
      <TrustBadge
        badge={makeBadge({
          status: 'not-recommended',
          icon: '✗',
          label: '风险',
          color: 'rose',
        })}
      />,
    );
    expect(html).toContain('✗');
    expect(html).toContain('风险');
  });

  it('未知颜色回退到 amber', () => {
    const html = renderToString(
      <TrustBadge badge={makeBadge({ color: 'amber' as const })} />,
    );
    expect(html).toContain('amber');
  });

  it('应用正确的 CSS 类', () => {
    const html = renderToString(<TrustBadge badge={makeBadge()} />);
    expect(html).toContain('inline-flex');
    expect(html).toContain('rounded-full');
    expect(html).toContain('emerald');
  });
});
