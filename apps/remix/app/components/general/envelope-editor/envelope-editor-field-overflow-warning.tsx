import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { isFieldTextWiderThanField } from '@documenso/lib/universal/field-renderer/render-generic-text-field';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import { AlertTriangleIcon } from 'lucide-react';
import { match, P } from 'ts-pattern';

import { getFieldSampleValue } from './canvas/envelope-canvas-field-samples';
import { EnvelopeEditorSettingsDialog } from './envelope-editor-settings-dialog';

type EnvelopeEditorFieldOverflowWarningProps = {
  field: TLocalField;
};

/**
 * Tells the sender, in words, that the value of the selected field will run
 * past its edges. The canvas shows the overflow too, but is silent for screen
 * readers and easy to miss on a small field.
 */
export const EnvelopeEditorFieldOverflowWarning = ({ field }: EnvelopeEditorFieldOverflowWarningProps) => {
  const { i18n } = useLingui();

  const { envelope, editorConfig } = useCurrentEnvelopeEditor();
  const { pageSizes } = useCurrentEnvelopeRender();

  const pageSize = pageSizes.get(field.envelopeItemId, field.page);

  const recipient = envelope.recipients.find((r) => r.id === field.recipientId);

  const realValue = match(field.fieldMeta)
    .with({ type: 'text', text: P.string.minLength(1) }, (meta) => meta.text)
    .with({ type: 'number', value: P.string.minLength(1) }, (meta) => meta.value)
    .otherwise(() => null);

  const sampleValue = getFieldSampleValue({ field, recipient, documentMeta: envelope.documentMeta, i18n });

  const text = realValue ?? (sampleValue?.type === 'text' ? sampleValue.text : null);

  const characterLimit = field.fieldMeta?.type === 'text' ? field.fieldMeta.characterLimit : undefined;

  // A free text field only shows a made up sample, so warning about its width
  // would be a false alarm.
  const isFreeText = field.type === FieldType.TEXT && !realValue && !characterLimit;

  if (
    !pageSize ||
    !text ||
    isFreeText ||
    field.type === FieldType.SIGNATURE ||
    !isFieldTextWiderThanField({ field, text, pageWidth: pageSize.width, pageHeight: pageSize.height })
  ) {
    return null;
  }

  return (
    <div role="status" className="mt-3 flex flex-row items-start gap-2 text-xs text-yellow-700 dark:text-yellow-400">
      <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />

      <div className="flex flex-col items-start gap-1">
        <p>
          {match({ type: field.type, isLimitSample: !realValue && Boolean(characterLimit) })
            .with({ type: FieldType.DATE }, () => (
              <Trans>The date is wider than the field. Widen the field or use a shorter format.</Trans>
            ))
            .with({ isLimitSample: true }, () => (
              <Trans>At {characterLimit} characters the text is wider than the field.</Trans>
            ))
            .otherwise(() => (
              <Trans>This value is wider than the field. Widen the field or reduce the font size.</Trans>
            ))}
        </p>

        {field.type === FieldType.DATE && editorConfig.settings?.allowConfigureDateFormat && (
          <>
            <EnvelopeEditorSettingsDialog
              trigger={
                <Button type="button" variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-xs">
                  <Trans>Change date format</Trans>
                </Button>
              }
            />

            <p className="text-muted-foreground">
              <Trans>Applies to all date fields in this document.</Trans>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
