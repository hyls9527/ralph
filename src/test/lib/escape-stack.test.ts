import { describe, it, expect, vi } from 'vitest';
import { escapeStack } from '../../lib/escape-stack';

describe('escapeStack', () => {
  it('初始状态为空', () => {
    escapeStack.clear();
    expect(escapeStack.hasItems()).toBe(false);
  });

  it('注册后 hasItems 返回 true', () => {
    escapeStack.clear();
    escapeStack.register('modal1', vi.fn());
    expect(escapeStack.hasItems()).toBe(true);
  });

  it('注销后 hasItems 返回 false', () => {
    escapeStack.clear();
    escapeStack.register('modal1', vi.fn());
    escapeStack.unregister('modal1');
    expect(escapeStack.hasItems()).toBe(false);
  });

  it('getTopId 返回最后注册的 id', () => {
    escapeStack.clear();
    escapeStack.register('first', vi.fn(), 10);
    escapeStack.register('second', vi.fn(), 20);
    expect(escapeStack.getTopId()).toBe('second');
  });

  it('handleEscape 调用最顶层的 onClose', () => {
    escapeStack.clear();
    const onClose = vi.fn();
    escapeStack.register('modal1', onClose);
    const result = escapeStack.handleEscape();
    expect(result).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('空栈时 handleEscape 返回 false', () => {
    escapeStack.clear();
    const result = escapeStack.handleEscape();
    expect(result).toBe(false);
  });

  it('clear 清空所有项', () => {
    escapeStack.clear();
    escapeStack.register('a', vi.fn());
    escapeStack.register('b', vi.fn());
    escapeStack.clear();
    expect(escapeStack.hasItems()).toBe(false);
  });

  it('按优先级排序', () => {
    escapeStack.clear();
    escapeStack.register('low', vi.fn(), 100);
    escapeStack.register('high', vi.fn(), 1);
    expect(escapeStack.getTopId()).toBe('low');
  });
});
