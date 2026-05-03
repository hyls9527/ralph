import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import LoadingSpinner from '../../components/LoadingSpinner';

const mockLoading: {
  phase: 'idle' | 'searching' | 'evaluating' | 'done' | 'error';
  message: string;
  progress: number | undefined;
} = {
  phase: 'idle',
  message: '',
  progress: undefined,
};

vi.mock('../../stores/useAppStore', () => ({
  useAppStore: () => ({ loading: mockLoading }),
}));

describe('LoadingSpinner', () => {
  beforeEach(() => {
    mockLoading.phase = 'idle';
    mockLoading.message = '';
    mockLoading.progress = undefined;
  });

  it('idle 阶段返回 null', () => {
    mockLoading.phase = 'idle';
    const html = renderToString(<LoadingSpinner />);
    expect(html).toBe('');
  });

  it('done 阶段返回 null', () => {
    mockLoading.phase = 'done';
    const html = renderToString(<LoadingSpinner />);
    expect(html).toBe('');
  });

  it('searching 阶段显示搜索提示', () => {
    mockLoading.phase = 'searching';
    const html = renderToString(<LoadingSpinner />);
    expect(html).toContain('搜索');
  });

  it('evaluating 阶段显示评估提示', () => {
    mockLoading.phase = 'evaluating';
    const html = renderToString(<LoadingSpinner />);
    expect(html).toContain('评估');
  });

  it('error 阶段显示错误信息', () => {
    mockLoading.phase = 'error';
    const html = renderToString(<LoadingSpinner />);
    expect(html).toContain('错误');
  });

  it('显示自定义消息', () => {
    mockLoading.phase = 'searching';
    mockLoading.message = '正在处理...';
    const html = renderToString(<LoadingSpinner />);
    expect(html).toContain('正在处理...');
  });

  it('有进度时显示进度条', () => {
    mockLoading.phase = 'evaluating';
    mockLoading.progress = 45;
    const html = renderToString(<LoadingSpinner />);
    expect(html).toContain('45%');
  });

  it('无进度时不显示进度条', () => {
    mockLoading.phase = 'searching';
    mockLoading.progress = undefined;
    const html = renderToString(<LoadingSpinner />);
    expect(html).not.toContain('bg-violet-500 h-1.5 rounded-full');
  });

  it('进度为 0 时不显示进度条', () => {
    mockLoading.phase = 'searching';
    mockLoading.progress = 0;
    const html = renderToString(<LoadingSpinner />);
    expect(html).not.toContain('bg-violet-500 h-1.5 rounded-full');
  });

  it('渲染旋转动画元素', () => {
    mockLoading.phase = 'searching';
    const html = renderToString(<LoadingSpinner />);
    expect(html).toContain('animate-spin-slow');
  });
});
