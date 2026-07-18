import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  translate,
  type Locale,
  type MessageKey,
  type MessageParams
} from './messages.js';

interface I18nValue {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: MessageKey, params?: MessageParams): string;
}

const fallbackValue: I18nValue = {
  locale: 'zh-CN',
  setLocale(locale) {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Components rendered without the application provider stay in Chinese.
    }
  },
  t: (key, params) => translate('zh-CN', key, params)
};

const I18nContext = createContext<I18nValue>(fallbackValue);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale(next) {
      setLocaleState(next);
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        // The in-memory preference still applies when storage is unavailable.
      }
    },
    t: (key, params) => translate(locale, key, params)
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
