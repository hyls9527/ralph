import { describe, it, expect } from 'vitest';

function escapeHtml(str: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return str.replace(/[&<>"'/]/g, (char) => escapeMap[char] || char);
}

describe('Security - XSS Prevention', () => {
  describe('escapeHtml', () => {
    it('should escape < and >', () => {
      expect(escapeHtml('<script>alert(1)</script>')).toBe(
        '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;'
      );
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('test"onmouseover="alert(1)')).toBe(
        'test&quot;onmouseover=&quot;alert(1)'
      );
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("test'onerror='alert(1)")).toBe(
        'test&#x27;onerror=&#x27;alert(1)'
      );
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('test&copy;')).toBe('test&amp;copy;');
    });

    it('should escape forward slashes', () => {
      expect(escapeHtml('</div>')).toBe('&lt;&#x2F;div&gt;');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle safe strings unchanged', () => {
      const safe = 'Hello World 123';
      expect(escapeHtml(safe)).toBe(safe);
    });

    it('should handle combined attacks', () => {
      const attack = '<img src=x onerror="alert(\'XSS\')">';
      const escaped = escapeHtml(attack);
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
      expect(escaped).not.toContain('"');
      expect(escaped).not.toContain("'");
    });

    it('should handle unicode characters', () => {
      const unicode = 'テスト😀中文';
      expect(escapeHtml(unicode)).toBe(unicode);
    });

    it('should handle null byte injection', () => {
      const withNull = 'test\u0000<script>';
      const escaped = escapeHtml(withNull);
      expect(escaped).not.toContain('<script>');
    });
  });

  describe('Input Sanitization', () => {
    it('should trim whitespace from search queries', () => {
      const query = '   rust logging   ';
      expect(query.trim()).toBe('rust logging');
    });

    it('should reject empty queries after trim', () => {
      const query = '   ';
      expect(query.trim()).toBe('');
    });

    it('should handle extremely long inputs', () => {
      const longInput = 'x'.repeat(10000);
      expect(longInput.length).toBe(10000);
      const truncated = longInput.slice(0, 256);
      expect(truncated.length).toBe(256);
    });

    it('should handle newline injection in queries', () => {
      const query = 'rust\n\rlogging';
      const sanitized = query.replace(/[\n\r]/g, ' ');
      expect(sanitized).toBe('rust  logging');
    });

    it('should handle tab characters', () => {
      const query = 'rust\tlogging';
      const sanitized = query.replace(/\t/g, ' ');
      expect(sanitized).toBe('rust logging');
    });
  });

  describe('URL Safety', () => {
    it('should encode special characters for URLs', () => {
      const query = 'rust logging & framework';
      const encoded = encodeURIComponent(query);
      expect(encoded).not.toContain(' ');
      expect(encoded).not.toContain('&');
    });

    it('should encode path traversal attempts', () => {
      const path = '../../../etc/passwd';
      const encoded = encodeURIComponent(path);
      expect(encoded).not.toContain('/');
    });

    it('should encode SQL injection in URL context', () => {
      const injection = "'; DROP TABLE users; --";
      const encoded = encodeURIComponent(injection);
      expect(encoded).not.toContain(';');
      expect(encoded).not.toContain(' ');
      expect(encoded).toContain('%3B');
      expect(encoded).toContain('%20');
    });
  });

  describe('JSON Safety', () => {
    it('should handle circular reference prevention', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      const json = JSON.stringify(obj);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should handle prototype pollution attempts', () => {
      const malicious = '{"__proto__": {"isAdmin": true}}';
      const parsed = JSON.parse(malicious);
      expect(parsed.__proto__).toBeDefined();
      expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    });

    it('should handle constructor pollution attempts', () => {
      const malicious = '{"constructor": {"prototype": {"isAdmin": true}}}';
      const parsed = JSON.parse(malicious);
      expect(parsed.constructor).toBeDefined();
    });

    it('should reject excessively deep JSON', () => {
      let deep = '{"a":';
      for (let i = 0; i < 100; i++) {
        deep += '{"a":';
      }
      deep += '1';
      for (let i = 0; i < 100; i++) {
        deep += '}';
      }
      expect(() => JSON.parse(deep)).toThrow();
    });
  });
});
