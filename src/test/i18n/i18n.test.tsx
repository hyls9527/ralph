import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { I18nProvider, useI18n, t } from '../../i18n/index';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

describe('i18n', () => {
  describe('useI18n hook', () => {
    it('默认语言为 zh', () => {
      const { result } = renderHook(() => useI18n(), { wrapper });
      expect(result.current.lang).toBe('zh');
    });

    it('switchLang 切换为 en', () => {
      const { result } = renderHook(() => useI18n(), { wrapper });
      act(() => {
        result.current.switchLang('en');
      });
      expect(result.current.lang).toBe('en');
    });

    it('switchLang 切换回 zh', () => {
      const { result } = renderHook(() => useI18n(), { wrapper });
      act(() => {
        result.current.switchLang('en');
      });
      act(() => {
        result.current.switchLang('zh');
      });
      expect(result.current.lang).toBe('zh');
    });
  });

  describe('t function', () => {
    it('返回中文翻译', () => {
      const text = t('searchPlaceholder');
      expect(text).toBeTruthy();
    });

    it('处理参数替换', () => {
      const text = t('pipelineSummaryDesc', { layers: '7', initial: '80', final: '75' });
      expect(text).toContain('7');
      expect(text).toContain('80');
      expect(text).toContain('75');
    });

    it('未知 key 返回 key 本身', () => {
      const text = t('nonexistentKey' as never);
      expect(text).toBe('nonexistentKey');
    });
  });
});
