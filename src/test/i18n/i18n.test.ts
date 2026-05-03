import { describe, it, expect, beforeEach } from 'vitest';
import { getLang, setLang, t } from '../../i18n/index';

describe('i18n', () => {
  beforeEach(() => {
    setLang('zh');
  });

  describe('getLang / setLang', () => {
    it('默认语言为 zh', () => {
      expect(getLang()).toBe('zh');
    });

    it('setLang 切换为 en', () => {
      setLang('en');
      expect(getLang()).toBe('en');
    });

    it('setLang 切换回 zh', () => {
      setLang('en');
      setLang('zh');
      expect(getLang()).toBe('zh');
    });
  });

  describe('t()', () => {
    it('返回中文文本', () => {
      expect(t('search')).toBe('搜索');
    });

    it('切换英文后返回英文文本', () => {
      setLang('en');
      expect(t('search')).toBe('Search');
    });

    it('未知 key 返回 key 本身', () => {
      const result = t('nonexistent_key' as any);
      expect(typeof result).toBe('string');
    });

    it('支持参数替换', () => {
      const result = t('processing' as any, { count: 5 });
      expect(result).toContain('5');
    });

    it('多个参数替换', () => {
      const result = t('evaluatingProject' as any, { name: 'test-repo' });
      expect(result).toContain('test-repo');
    });
  });
});
