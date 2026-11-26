import { APP_I18N_OPTIONS, isValidLanguageCode, type SupportedLanguageCodes } from '../constants/locales';

type ResolveDocumentLanguageOptions = {
  /** Chosen for this document, e.g. through the API or carried over from its template. */
  documentLanguage?: string | null;

  /** The team default, inheriting the organisation default; `null` when neither chose one. */
  settingsLanguage?: string | null;

  /** The interface language of whoever creates the document. */
  creatorLanguage?: string | null;
};

/**
 * The language a new document is written in, and with it its emails, its seal and, unless a format was chosen,
 * its date format. Nobody has to configure it: without a choice on the document, team or organisation the document
 * takes the creator's interface language. It is stored on the document at creation, so recipients and the seal see
 * one language no matter who looks. Unsupported languages fall through to English.
 */
export const resolveDocumentLanguage = ({
  documentLanguage,
  settingsLanguage,
  creatorLanguage,
}: ResolveDocumentLanguageOptions): SupportedLanguageCodes => {
  const language = [documentLanguage, settingsLanguage, creatorLanguage].find(isValidLanguageCode);

  return language ?? APP_I18N_OPTIONS.sourceLang;
};
