import { isValidLanguageCode, type SupportedLanguageCodes } from '../constants/locales';

/**
 * The cookie holding the interface language. The app writes it with React Router's `createCookie`, which stores
 * unsigned values as base64 encoded JSON.
 */
export const LANG_COOKIE_NAME = 'lang';

const parseLangCookie = (cookieHeader: string): SupportedLanguageCodes | null => {
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...value] = cookie.trim().split('=');

    if (name !== LANG_COOKIE_NAME) {
      continue;
    }

    try {
      const language: unknown = JSON.parse(atob(decodeURIComponent(value.join('='))));

      return isValidLanguageCode(language) ? language : null;
    } catch {
      return null;
    }
  }

  return null;
};

const parseAcceptLanguage = (acceptLanguage: string): SupportedLanguageCodes | null => {
  for (const entry of acceptLanguage.split(',')) {
    const locale = entry.split(';')[0].trim();
    const [language] = locale.split('-');

    if (isValidLanguageCode(locale)) {
      return locale;
    }

    if (isValidLanguageCode(language)) {
      return language;
    }
  }

  return null;
};

/**
 * The interface language of the person behind a request: the language they picked in the app, else the first
 * supported language of their browser. `null` when neither names a supported language, e.g. for an API client.
 */
export const extractRequestLanguage = (headers: Headers): SupportedLanguageCodes | null => {
  return parseLangCookie(headers.get('cookie') ?? '') ?? parseAcceptLanguage(headers.get('accept-language') ?? '');
};
