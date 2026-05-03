import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { KeyboardHelpModal } from '../../components/KeyboardHelpModal';

const { mockEscapeStack } = vi.hoisted(() => ({
  mockEscapeStack: {
    register: vi.fn(),
    unregister: vi.fn(),
  },
}));

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  getShortcutsForHelp: () => [
    {
      id: 'search',
      key: '/',
      description: { zh: '聚焦搜索框', en: 'Focus search' },
      modifiers: [],
    },
    {
      id: 'help',
      key: '?',
      description: { zh: '显示帮助', en: 'Show help' },
      modifiers: [],
    },
  ],
  setHelpModalToggle: vi.fn(),
}));

vi.mock('../../lib/escape-stack', () => ({
  escapeStack: mockEscapeStack,
}));

describe('KeyboardHelpModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初始状态不显示', () => {
    const html = renderToString(<KeyboardHelpModal />);
    expect(html).toBe('');
  });

  it('组件渲染不崩溃', () => {
    expect(() => renderToString(<KeyboardHelpModal />)).not.toThrow();
  });

  it('多次渲染不崩溃', () => {
    expect(() => renderToString(<KeyboardHelpModal />)).not.toThrow();
    expect(() => renderToString(<KeyboardHelpModal />)).not.toThrow();
  });
});
