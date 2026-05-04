import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import React from 'react';
import { AccessibleModal } from '../../components/ui/AccessibleModal';

vi.mock('../../lib/focus-trap', () => ({
  FocusTrap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    lang: 'zh',
    switchLang: vi.fn(),
  }),
  t: (key: string) => key,
}));

describe('AccessibleModal', () => {
  it('open=false 时返回 null', () => {
    const { container } = render(
      <AccessibleModal open={false} onOpenChange={vi.fn()} title="Test">
        <p>Content</p>
      </AccessibleModal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('open=true 时渲染模态框', async () => {
    render(
      <AccessibleModal open={true} onOpenChange={vi.fn()} title="Test Title">
        <p>Modal Content</p>
      </AccessibleModal>
    );
    await waitFor(() => {
      expect(screen.getByText('Test Title')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText('Modal Content')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });

  it('渲染 description', async () => {
    render(
      <AccessibleModal
        open={true}
        onOpenChange={vi.fn()}
        title="Title"
        description="A description"
      >
        <p>Content</p>
      </AccessibleModal>
    );
    await waitFor(() => {
      expect(screen.getByText('A description')).toBeTruthy();
    });
  });

  it('无 description 时不渲染 aria-describedby', async () => {
    const { container } = render(
      <AccessibleModal open={true} onOpenChange={vi.fn()} title="Title">
        <p>Content</p>
      </AccessibleModal>
    );
    await waitFor(() => {
      expect(screen.getByText('Content')).toBeTruthy();
    });
    expect(container.querySelector('[aria-describedby]')).toBeNull();
  });

  it('设置 aria-labelledby', async () => {
    const { container } = render(
      <AccessibleModal open={true} onOpenChange={vi.fn()} title="Title">
        <p>Content</p>
      </AccessibleModal>
    );
    await waitFor(() => {
      expect(screen.getByText('Content')).toBeTruthy();
    });
    expect(container.querySelector('[aria-labelledby="modal-title"]')).toBeTruthy();
  });
});
