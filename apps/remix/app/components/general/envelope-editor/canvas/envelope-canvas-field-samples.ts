import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import type { FieldSampleValue } from '@documenso/lib/universal/field-renderer/field-renderer';
import { SAMPLE_SIGNATURE_IMAGE_AS_BASE64 } from '@documenso/lib/universal/field-renderer/sample-signature';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { FieldType } from '@prisma/client';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

type GetFieldSampleValueOptions = {
  field: Pick<TLocalField, 'type' | 'fieldMeta'>;
  recipient: { name: string; email: string } | undefined;
  documentMeta: Pick<
    TEditorEnvelope['documentMeta'],
    'dateFormat' | 'timezone' | 'drawSignatureEnabled' | 'uploadSignatureEnabled'
  >;
  i18n: I18n;
};

/**
 * The value an empty field shows while editing, as close as possible to what
 * the recipient will fill in, so its width and position can be judged before
 * sending.
 *
 * Returns `null` where there is nothing better than the field name to show,
 * e.g. for a text field that already has a value of its own.
 */
export const getFieldSampleValue = ({
  field,
  recipient,
  documentMeta,
  i18n,
}: GetFieldSampleValueOptions): FieldSampleValue | null => {
  const recipientName = recipient?.name.trim() || i18n._(msg`Jane Doe`);

  const text = (value: string): FieldSampleValue => ({ type: 'text', text: value });

  return match(field.type)
    .with(FieldType.SIGNATURE, (): FieldSampleValue | null => {
      // Without an alignment the whole drawing pad is fitted, blank space and all,
      // so no sample could show where the ink of such a field ends up.
      if (field.fieldMeta?.type !== 'signature' || !field.fieldMeta.verticalAlign) {
        return null;
      }

      if (documentMeta.drawSignatureEnabled || documentMeta.uploadSignatureEnabled) {
        return { type: 'image', imageAsBase64: SAMPLE_SIGNATURE_IMAGE_AS_BASE64 };
      }

      return text(recipientName);
    })
    .with(FieldType.INITIALS, () => text(extractInitials(recipientName)))
    .with(FieldType.NAME, () => text(recipientName))
    .with(FieldType.EMAIL, () => text(recipient?.email || 'jane.doe@example.com'))
    .with(FieldType.DATE, () =>
      // Pinned to the locale the server formats the signing date in.
      text(
        DateTime.now()
          .setZone(documentMeta.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
          .setLocale('en-US')
          .toFormat(documentMeta.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT),
      ),
    )
    .with(FieldType.TEXT, (): FieldSampleValue | null => {
      const fieldMeta = field.fieldMeta?.type === 'text' ? field.fieldMeta : undefined;

      if (fieldMeta?.text) {
        return null;
      }

      const sampleText = i18n._(msg`Sample text`);

      // With a character limit, show the longest text the recipient can enter.
      if (fieldMeta?.characterLimit) {
        return text(`${sampleText} `.repeat(fieldMeta.characterLimit).slice(0, fieldMeta.characterLimit));
      }

      return text(sampleText);
    })
    .with(FieldType.NUMBER, (): FieldSampleValue | null => {
      const fieldMeta = field.fieldMeta?.type === 'number' ? field.fieldMeta : undefined;

      if (fieldMeta?.value) {
        return null;
      }

      return text(String(fieldMeta?.maxValue ?? 1234.56));
    })
    .otherwise(() => null);
};
