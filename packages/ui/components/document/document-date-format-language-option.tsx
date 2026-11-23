import { getDocumentLanguageDateFormat } from '@documenso/lib/constants/date-formats';
import { SelectItem } from '@documenso/ui/primitives/select';
import { Trans } from '@lingui/react/macro';
import { DateTime } from 'luxon';

/**
 * Select value standing for "no explicit date format" (stored as `null`). Radix selects cannot hold `null`.
 */
export const DOCUMENT_LANGUAGE_DATE_FORMAT_VALUE = 'document-language';

export type DocumentDateFormatLanguageOptionProps = {
  /** The document language the format is derived from, so the example shows what will actually be burned in. */
  language: string | null | undefined;
  value?: string;
};

/**
 * The date format option meaning "follow the document language", labelled with a live example of the format it
 * currently resolves to, so the default is visible instead of hidden behind a blank choice.
 */
export const DocumentDateFormatLanguageOption = ({
  language,
  value = DOCUMENT_LANGUAGE_DATE_FORMAT_VALUE,
}: DocumentDateFormatLanguageOptionProps) => {
  // 31 December 14:30 reads unambiguously in every format: day, month and 12/24 h cannot be confused.
  const example = DateTime.fromObject({ year: DateTime.now().year, month: 12, day: 31, hour: 14, minute: 30 })
    // Pinned to the locale the server formats the signing date in.
    .setLocale('en-US')
    .toFormat(getDocumentLanguageDateFormat(language));

  return (
    <SelectItem value={value}>
      <Trans>Match document language ({example})</Trans>
    </SelectItem>
  );
};
