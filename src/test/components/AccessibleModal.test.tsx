import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { AccessibleModal } from '../../components/ui/AccessibleModal';

vi.mock('../../lib/focus-trap', () => ({
  FocusTrap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('AccessibleModal', () => {
  it('open=false 时返回 null', () => {
    const html = renderToString(
      <AccessibleModal open={false} onOpenChange={vi.fn()} title="Test">
        <p>Content</p>
      </AccessibleModal>
    );
    expect(html).toBe('');
  });

  it('open=true 时渲染模态框', () => {
    const html = renderToString(
      <AccessibleModal open={true} onOpenChange={vi.fn()} title="Test Title">
        <p>Modal Content</p>
      </AccessibleModal>
    );
    expect(html).toContain('Test Title');
    expect(html).toContain('Modal Content');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it('渲染 description', () => {
    const html = renderToString(
      <AccessibleModal
        open={true}
        onOpenChange={vi.fn()}
        title="Title"
        description="A description"
      >
        <p>Content</p>
      </AccessibleModal>
    );
    expect(html).toContain('A description');
    expect(html).toContain('aria-describedby');
  });

  it('无 description 时不设置 aria-describedby', () => {
    const html = renderToString(
      <AccessibleModal open={true} onOpenChange={vi.fn()} title="Title">
        <p>Content</p>
      </AccessibleModal>
    );
    expect(html).not.toContain('aria-describedby');
  });

  it('设置 aria-labelledby', () => {
    const html = renderToString(
      <AccessibleModal open={true} onOpenChange={vi.fn()} title="Title">
        <p>Content</p>
      </AccessibleModal>
    );
    expect(html).toContain('aria-labelledby="modal-title"');
  });
});
