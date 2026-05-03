import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import ErrorBoundary from '../../components/ErrorBoundary';

vi.mock('../../i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      errorOccurred: '发生错误',
      errorNetworkDetail: '网络连接异常，请检查网络后重试',
      errorPageLoad: '页面加载出错，请刷新重试',
      refreshPage: '刷新页面',
      goBack: '返回',
    };
    return map[key] || key;
  },
}));

describe('ErrorBoundary', () => {
  it('正常渲染子组件', () => {
    const html = renderToString(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    );
    expect(html).toContain('正常内容');
  });

  it('渲染多个子组件', () => {
    const html = renderToString(
      <ErrorBoundary>
        <span>子组件1</span>
        <span>子组件2</span>
      </ErrorBoundary>
    );
    expect(html).toContain('子组件1');
    expect(html).toContain('子组件2');
  });

  it('渲染嵌套子组件', () => {
    const html = renderToString(
      <ErrorBoundary>
        <div>
          <p>嵌套内容</p>
        </div>
      </ErrorBoundary>
    );
    expect(html).toContain('嵌套内容');
  });

  it('无 fallback 时正常渲染', () => {
    const html = renderToString(
      <ErrorBoundary>
        <div>无 fallback</div>
      </ErrorBoundary>
    );
    expect(html).toContain('无 fallback');
  });

  it('有 fallback 但无错误时仍渲染子组件', () => {
    const html = renderToString(
      <ErrorBoundary fallback={<div>备用</div>}>
        <div>正常</div>
      </ErrorBoundary>
    );
    expect(html).toContain('正常');
    expect(html).not.toContain('备用');
  });

  it('渲染空子组件', () => {
    const html = renderToString(
      <ErrorBoundary>
        {null}
      </ErrorBoundary>
    );
    expect(html).toBe('');
  });
});
