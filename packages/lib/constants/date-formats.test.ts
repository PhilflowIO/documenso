import { describe, expect, it } from 'vitest';

import { DEFAULT_DOCUMENT_DATE_FORMAT, isValidDateFormat, resolveDocumentDateFormat } from './date-formats';

describe('resolveDocumentDateFormat', () => {
  it('uses an explicitly chosen format regardless of the document language', () => {
    expect(resolveDocumentDateFormat({ dateFormat: 'MM/dd/yyyy', language: 'de' })).toBe('MM/dd/yyyy');
    expect(resolveDocumentDateFormat({ dateFormat: DEFAULT_DOCUMENT_DATE_FORMAT, language: 'de' })).toBe(
      DEFAULT_DOCUMENT_DATE_FORMAT,
    );
  });

  it('derives the format from the document language when none was chosen', () => {
    expect(resolveDocumentDateFormat({ dateFormat: null, language: 'de' })).toBe('dd.MM.yyyy');
    expect(resolveDocumentDateFormat({ dateFormat: undefined, language: 'fr' })).toBe('dd/MM/yyyy');
    expect(resolveDocumentDateFormat({ dateFormat: '', language: 'nl' })).toBe('dd-MM-yyyy');
  });

  it('falls back to the global default for English, unknown or missing languages', () => {
    expect(resolveDocumentDateFormat({ dateFormat: null, language: 'en' })).toBe(DEFAULT_DOCUMENT_DATE_FORMAT);
    expect(resolveDocumentDateFormat({ dateFormat: null, language: 'xx' })).toBe(DEFAULT_DOCUMENT_DATE_FORMAT);
    expect(resolveDocumentDateFormat({ dateFormat: null, language: null })).toBe(DEFAULT_DOCUMENT_DATE_FORMAT);
  });

  it('only ever derives formats the format picker already offers', () => {
    for (const language of ['de', 'en', 'fr', 'es', 'it', 'nl', 'pl', 'pt-BR', 'ja', 'ko', 'zh']) {
      expect(isValidDateFormat(resolveDocumentDateFormat({ dateFormat: null, language }))).toBe(true);
    }
  });
});
