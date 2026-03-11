/**
 * i18n 模块测试
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTranslations, detectSystemLocale, SUPPORTED_LOCALES, Locale } from './index';

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
      return flattenKeys(nestedValue as Record<string, unknown>, nextKey);
    }
    return [nextKey];
  });
}

describe('i18n', () => {
  describe('SUPPORTED_LOCALES', () => {
    it('should have 4 supported locales', () => {
      expect(SUPPORTED_LOCALES.length).toBe(4);
    });

    it('should include zh-CN, zh-TW, en, ja', () => {
      const codes = SUPPORTED_LOCALES.map(l => l.code);
      expect(codes).toContain('zh-CN');
      expect(codes).toContain('zh-TW');
      expect(codes).toContain('en');
      expect(codes).toContain('ja');
    });

    it('should have name and nativeName for each locale', () => {
      SUPPORTED_LOCALES.forEach(locale => {
        expect(locale.name).toBeTruthy();
        expect(locale.nativeName).toBeTruthy();
      });
    });
  });

  describe('getTranslations', () => {
    it('returns translations for each supported locale', () => {
      for (const locale of SUPPORTED_LOCALES) {
        const t = getTranslations(locale.code as Locale);
        expect(t).toBeDefined();
        expect(t.common).toBeDefined();
      }
    });

    it('keeps the same translation key tree across all locales', () => {
      const zhCNKeys = flattenKeys(getTranslations('zh-CN') as Record<string, unknown>).sort();

      for (const locale of ['en', 'zh-TW', 'ja'] as const) {
        expect(flattenKeys(getTranslations(locale) as Record<string, unknown>).sort()).toEqual(zhCNKeys);
      }
    });

    it('should fallback to zh-CN for unknown locale', () => {
      const t = getTranslations('unknown' as Locale);
      const zhCN = getTranslations('zh-CN');
      expect(t).toEqual(zhCN);
    });
  });

  describe('detectSystemLocale', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should detect zh-CN for Chinese Simplified', () => {
      vi.stubGlobal('navigator', { language: 'zh-CN' });
      expect(detectSystemLocale()).toBe('zh-CN');
    });

    it('should detect zh-TW for Chinese Traditional', () => {
      vi.stubGlobal('navigator', { language: 'zh-TW' });
      expect(detectSystemLocale()).toBe('zh-TW');
    });

    it('should detect zh-TW for Hong Kong Chinese', () => {
      vi.stubGlobal('navigator', { language: 'zh-HK' });
      expect(detectSystemLocale()).toBe('zh-TW');
    });

    it('should detect en for English', () => {
      vi.stubGlobal('navigator', { language: 'en-US' });
      expect(detectSystemLocale()).toBe('en');
    });

    it('should detect ja for Japanese', () => {
      vi.stubGlobal('navigator', { language: 'ja-JP' });
      expect(detectSystemLocale()).toBe('ja');
    });

    it('should default to zh-CN for unknown languages', () => {
      vi.stubGlobal('navigator', { language: 'de-DE' });
      expect(detectSystemLocale()).toBe('zh-CN');
    });
  });
});
