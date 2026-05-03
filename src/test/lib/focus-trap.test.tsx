import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { FocusTrap } from '../../lib/focus-trap';

function MockFocusTrap({
  children,
  active,
}: {
  children: React.ReactNode;
  active: boolean;
}) {
  return active ? (
    <div data-testid="focus-trap">{children}</div>
  ) : (
    <div>{children}</div>
  );
}

vi.mock('focus-trap-react', () => ({
  __esModule: true,
  default: MockFocusTrap,
  FocusTrap: MockFocusTrap,
}));

describe('FocusTrap', () => {
  it('active=true 时渲染子元素', () => {
    const html = renderToString(
      <FocusTrap active={true}>
        <button>Click me</button>
      </FocusTrap>,
    );
    expect(html).toContain('Click me');
    expect(html).toContain('data-testid="focus-trap"');
  });

  it('active=false 时渲染子元素但无 focus-trap 标记', () => {
    const html = renderToString(
      <FocusTrap active={false}>
        <button>Click me</button>
      </FocusTrap>,
    );
    expect(html).toContain('Click me');
    expect(html).not.toContain('data-testid="focus-trap"');
  });

  it('传递 focusTrapOptions', () => {
    const html = renderToString(
      <FocusTrap active={true} focusTrapOptions={{ escapeDeactivates: false }}>
        <span>Content</span>
      </FocusTrap>,
    );
    expect(html).toContain('Content');
  });
});
