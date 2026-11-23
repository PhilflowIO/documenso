import { createCookie } from 'react-router';
import { describe, expect, it } from 'vitest';

import { resolveDocumentLanguage } from './document-language';
import { extractRequestLanguage, LANG_COOKIE_NAME } from './request-language';

describe('resolveDocumentLanguage', () => {
  it('takes the creator interface language when nobody chose a document language', () => {
    expect(resolveDocumentLanguage({ documentLanguage: null, settingsLanguage: null, creatorLanguage: 'de' })).toBe(
      'de',
    );
  });

  it('lets a language chosen on the document, then on the team or organisation, win over the creator', () => {
    expect(resolveDocumentLanguage({ documentLanguage: 'fr', settingsLanguage: 'en', creatorLanguage: 'de' })).toBe(
      'fr',
    );
    expect(resolveDocumentLanguage({ settingsLanguage: 'en', creatorLanguage: 'de' })).toBe('en');
  });

  it('falls back to English for unsupported or missing languages', () => {
    expect(resolveDocumentLanguage({ documentLanguage: 'xx', settingsLanguage: 'tlh', creatorLanguage: 'sv' })).toBe(
      'en',
    );
    expect(resolveDocumentLanguage({})).toBe('en');
  });
});

describe('extractRequestLanguage', () => {
  // The cookie exactly as the app writes it.
  const langCookie = createCookie(LANG_COOKIE_NAME, { path: '/' });

  const headersWithLangCookie = async (lang: string, acceptLanguage?: string) => {
    const cookie = (await langCookie.serialize(lang)).split(';')[0];

    return new Headers({
      cookie: `theme=dark; ${cookie}`,
      ...(acceptLanguage ? { 'accept-language': acceptLanguage } : {}),
    });
  };

  it('reads the language picked in the app over the browser languages', async () => {
    expect(extractRequestLanguage(await headersWithLangCookie('de', 'en-US,en;q=0.9'))).toBe('de');
  });

  it('falls back to the first supported browser language', async () => {
    expect(extractRequestLanguage(new Headers({ 'accept-language': 'sv-SE,de-DE;q=0.8,en;q=0.5' }))).toBe('de');
    expect(extractRequestLanguage(await headersWithLangCookie('sv', 'pt-BR,pt;q=0.9'))).toBe('pt-BR');
  });

  it('knows no language for a request that names none it supports', () => {
    expect(extractRequestLanguage(new Headers())).toBeNull();
    expect(extractRequestLanguage(new Headers({ cookie: 'lang=%%%', 'accept-language': 'sv' }))).toBeNull();
  });
});
