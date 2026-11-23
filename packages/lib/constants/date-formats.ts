import { DateTime } from 'luxon';

import { DEFAULT_DOCUMENT_TIME_ZONE } from './time-zones';

export const DEFAULT_DOCUMENT_DATE_FORMAT = 'yyyy-MM-dd hh:mm a';

export const VALID_DATE_FORMAT_VALUES = [
  DEFAULT_DOCUMENT_DATE_FORMAT,
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'dd-MM-yyyy',
  'MM/dd/yyyy',
  'yy-MM-dd',
  'MMMM dd, yyyy',
  'EEEE, MMMM dd, yyyy',
  'dd/MM/yyyy hh:mm a',
  'dd/MM/yyyy HH:mm',
  'dd-MM-yyyy hh:mm a',
  'dd-MM-yyyy HH:mm',
  'MM/dd/yyyy hh:mm a',
  'MM/dd/yyyy HH:mm',
  'dd.MM.yyyy',
  'dd.MM.yyyy HH:mm',
  'yyyy-MM-dd HH:mm',
  'yy-MM-dd hh:mm a',
  'yy-MM-dd HH:mm',
  'yyyy-MM-dd HH:mm:ss',
  'MMMM dd, yyyy hh:mm a',
  'MMMM dd, yyyy HH:mm',
  'EEEE, MMMM dd, yyyy hh:mm a',
  'EEEE, MMMM dd, yyyy HH:mm',
  "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
] as const;

export type ValidDateFormat = (typeof VALID_DATE_FORMAT_VALUES)[number];

export const DATE_FORMATS = [
  {
    key: 'yyyy-MM-dd_HH:mm_12H',
    label: 'YYYY-MM-DD hh:mm AM/PM',
    value: DEFAULT_DOCUMENT_DATE_FORMAT,
  },
  {
    key: 'yyyy-MM-dd_HH:mm',
    label: 'YYYY-MM-DD HH:mm',
    value: 'yyyy-MM-dd HH:mm',
  },
  {
    key: 'DDMMYYYY_TIME',
    label: 'DD/MM/YYYY HH:mm',
    value: 'dd/MM/yyyy HH:mm',
  },
  {
    key: 'DDMMYYYY_TIME_12H',
    label: 'DD/MM/YYYY HH:mm AM/PM',
    value: 'dd/MM/yyyy hh:mm a',
  },
  {
    key: 'DDMMYYYY_DASH_TIME',
    label: 'DD-MM-YYYY HH:mm',
    value: 'dd-MM-yyyy HH:mm',
  },
  {
    key: 'DDMMYYYY_DASH_TIME_12H',
    label: 'DD-MM-YYYY HH:mm AM/PM',
    value: 'dd-MM-yyyy hh:mm a',
  },
  {
    key: 'MMDDYYYY_TIME',
    label: 'MM/DD/YYYY HH:mm',
    value: 'MM/dd/yyyy HH:mm',
  },
  {
    key: 'MMDDYYYY_TIME_12H',
    label: 'MM/DD/YYYY HH:mm AM/PM',
    value: 'MM/dd/yyyy hh:mm a',
  },
  {
    key: 'DDMMYYYYHHMM',
    label: 'DD.MM.YYYY HH:mm',
    value: 'dd.MM.yyyy HH:mm',
  },
  {
    key: 'YYMMDD_TIME',
    label: 'YY-MM-DD HH:mm',
    value: 'yy-MM-dd HH:mm',
  },
  {
    key: 'YYMMDD_TIME_12H',
    label: 'YY-MM-DD HH:mm AM/PM',
    value: 'yy-MM-dd hh:mm a',
  },
  {
    key: 'YYYY_MM_DD_HH_MM_SS',
    label: 'YYYY-MM-DD HH:mm:ss',
    value: 'yyyy-MM-dd HH:mm:ss',
  },
  {
    key: 'MonthDateYear_TIME',
    label: 'Month Date, Year HH:mm',
    value: 'MMMM dd, yyyy HH:mm',
  },
  {
    key: 'MonthDateYear_TIME_12H',
    label: 'Month Date, Year HH:mm AM/PM',
    value: 'MMMM dd, yyyy hh:mm a',
  },
  {
    key: 'DayMonthYear_TIME',
    label: 'Day, Month Year HH:mm',
    value: 'EEEE, MMMM dd, yyyy HH:mm',
  },
  {
    key: 'DayMonthYear_TIME_12H',
    label: 'Day, Month Year HH:mm AM/PM',
    value: 'EEEE, MMMM dd, yyyy hh:mm a',
  },
  {
    key: 'ISO8601',
    label: 'ISO 8601',
    value: "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  },
  {
    key: 'YYYYMMDD',
    label: 'YYYY-MM-DD',
    value: 'yyyy-MM-dd',
  },
  {
    key: 'DDMMYYYY',
    label: 'DD/MM/YYYY',
    value: 'dd/MM/yyyy',
  },
  {
    key: 'DDMMYYYY_DASH',
    label: 'DD-MM-YYYY',
    value: 'dd-MM-yyyy',
  },
  {
    key: 'MMDDYYYY',
    label: 'MM/DD/YYYY',
    value: 'MM/dd/yyyy',
  },
  {
    key: 'DDMMYYYY_DOT',
    label: 'DD.MM.YYYY',
    value: 'dd.MM.yyyy',
  },
  {
    key: 'YYMMDD',
    label: 'YY-MM-DD',
    value: 'yy-MM-dd',
  },
  {
    key: 'MonthDateYear',
    label: 'Month Date, Year',
    value: 'MMMM dd, yyyy',
  },
  {
    key: 'DayMonthYear',
    label: 'Day, Month Year',
    value: 'EEEE, MMMM dd, yyyy',
  },
] satisfies {
  key: string;
  label: string;
  value: (typeof VALID_DATE_FORMAT_VALUES)[number];
}[];

/**
 * The date format a document gets when nobody chose one, keyed by document language.
 *
 * Only date formats the picker already offers are used, and only the date: a signing date on a contract is a
 * calendar day ("Ort, Datum"), the exact moment is in the audit log. Languages without an entry (including English)
 * keep `DEFAULT_DOCUMENT_DATE_FORMAT`.
 */
const DOCUMENT_LANGUAGE_DATE_FORMATS: Record<string, ValidDateFormat> = {
  de: 'dd.MM.yyyy',
  pl: 'dd.MM.yyyy',
  fr: 'dd/MM/yyyy',
  es: 'dd/MM/yyyy',
  it: 'dd/MM/yyyy',
  'pt-BR': 'dd/MM/yyyy',
  nl: 'dd-MM-yyyy',
  ja: 'yyyy-MM-dd',
  ko: 'yyyy-MM-dd',
  zh: 'yyyy-MM-dd',
};

/**
 * The format a document uses when it has no explicit date format: derived from the document language, because the
 * date is burned into the document and has to read right in the document's language, not the viewer's.
 */
export const getDocumentLanguageDateFormat = (language: string | null | undefined): ValidDateFormat => {
  if (!language) {
    return DEFAULT_DOCUMENT_DATE_FORMAT;
  }

  return DOCUMENT_LANGUAGE_DATE_FORMATS[language] ?? DEFAULT_DOCUMENT_DATE_FORMAT;
};

type ResolveDocumentDateFormatOptions = {
  /** The explicitly chosen format; `null`/empty means "follow the document language". */
  dateFormat: string | null | undefined;
  language: string | null | undefined;
};

/**
 * The single place that turns a stored (possibly unset) date format into the one that is actually rendered.
 * An explicit format always wins; otherwise the document language decides.
 */
export const resolveDocumentDateFormat = ({ dateFormat, language }: ResolveDocumentDateFormatOptions): string => {
  if (dateFormat) {
    return dateFormat;
  }

  return getDocumentLanguageDateFormat(language);
};

type ConvertToLocalSystemFormatOptions = {
  customText: string;
  dateFormat: string | null | undefined;
  /** The document language, used when `dateFormat` is unset. */
  language?: string | null;
  timezone: string | null | undefined;
};

export const convertToLocalSystemFormat = ({
  customText,
  dateFormat,
  language,
  timezone,
}: ConvertToLocalSystemFormatOptions): string => {
  const coalescedDateFormat = resolveDocumentDateFormat({ dateFormat, language });
  const coalescedTimezone = timezone ?? DEFAULT_DOCUMENT_TIME_ZONE;

  const parsedDate = DateTime.fromFormat(customText, coalescedDateFormat, {
    zone: coalescedTimezone,
  });

  if (!parsedDate.isValid) {
    return 'Invalid date';
  }

  const hasHour = DateTime.fromFormatExplain(customText, coalescedDateFormat).tokens.some(
    ({ literal, val }) => !literal && ['h', 'hh', 'H', 'HH'].includes(val),
  );

  // Formats without an hour are calendar dates, not moments, so converting them to the viewer's timezone could
  // only shift the day.
  if (!hasHour) {
    return parsedDate.toFormat(coalescedDateFormat);
  }

  return parsedDate.toLocal().toFormat(coalescedDateFormat);
};

export const isValidDateFormat = (dateFormat: unknown): dateFormat is ValidDateFormat => {
  return VALID_DATE_FORMAT_VALUES.includes(dateFormat as ValidDateFormat);
};
