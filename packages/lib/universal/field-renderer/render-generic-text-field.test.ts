import '../../server-only/konva/skia-backend';

import { FieldType } from '@prisma/client';
import Konva from 'konva';
import { describe, expect, it } from 'vitest';

import type { TFieldMetaSchema } from '../../types/field-meta';
import type { FieldToRender } from './field-renderer';
import { isFieldTextWiderThanField, renderGenericTextFieldElement } from './render-generic-text-field';

const PAGE = { width: 600, height: 800 };

/**
 * A field in the lower half of the page, 120 x 60 px: tall enough for three
 * lines at the default 12 px, narrow enough that a date with time wraps.
 */
const FIELD_BOX = { positionX: 30, positionY: 60, width: 20, height: 7.5 };

const LONG_DATE = '2026-11-23 10:54 AM';

const createField = (
  type: FieldType,
  fieldMeta: TFieldMetaSchema,
  sampleText?: string,
  box: Pick<FieldToRender, 'positionX' | 'positionY' | 'width' | 'height'> = FIELD_BOX,
): FieldToRender => ({
  renderId: `field-${type}`,
  envelopeItemId: 'item',
  recipientId: 1,
  type,
  page: 1,
  customText: '',
  inserted: false,
  ...box,
  fieldMeta,
  sampleValue: sampleText ? { type: 'text', text: sampleText } : null,
});

const renderInEditor = (field: FieldToRender) => {
  const pageLayer = new Konva.Layer();

  const { fieldGroup } = renderGenericTextFieldElement(field, {
    pageLayer,
    pageWidth: PAGE.width,
    pageHeight: PAGE.height,
    mode: 'edit',
    editable: true,
    scale: 1,
    translations: null,
  });

  const fieldText = fieldGroup.findOne<Konva.Text>('.field-text');

  if (!fieldText) {
    throw new Error('The field has no text node');
  }

  return { fieldGroup, fieldText };
};

const expectedFieldRect = (box: Pick<FieldToRender, 'positionX' | 'positionY' | 'width' | 'height'>) => ({
  x: (box.positionX / 100) * PAGE.width,
  y: (box.positionY / 100) * PAGE.height,
  width: (box.width / 100) * PAGE.width,
  height: (box.height / 100) * PAGE.height,
});

const expectRect = (rect: ReturnType<Konva.Node['getClientRect']>, expected: typeof FIELD_BOX) => {
  const fieldRect = expectedFieldRect(expected);

  expect(rect.x).toBeCloseTo(fieldRect.x, 5);
  expect(rect.y).toBeCloseTo(fieldRect.y, 5);
  expect(rect.width).toBeCloseTo(fieldRect.width, 5);
  expect(rect.height).toBeCloseTo(fieldRect.height, 5);
};

const LONG_TEXT =
  'Ein langer Text, der weder in die Breite noch in die Höhe dieses Feldes passt und deshalb überläuft.';

describe('renderGenericTextFieldElement', () => {
  it.each([
    ['upwards from the line', 'baseline'],
    ['upwards from the bottom', 'bottom'],
    ['downwards from the top', 'top'],
  ] as const)('measures a field by its rectangle when its value overflows %s', (_, verticalAlign) => {
    const field = createField(FieldType.TEXT, { type: 'text', text: LONG_TEXT, overflow: 'auto', verticalAlign });

    const { fieldGroup, fieldText } = renderInEditor(field);

    // The text node itself reaches towards the page edge, which is what
    // stretched the selection box before.
    expect(fieldText.height()).toBeGreaterThan(expectedFieldRect(FIELD_BOX).height * 2);

    expectRect(fieldGroup.getClientRect({ skipStroke: true, skipShadow: true }), FIELD_BOX);
  });

  it('measures a single line field by its rectangle when its value overflows sideways', () => {
    const box = { ...FIELD_BOX, height: 2 };
    const field = createField(FieldType.TEXT, { type: 'text', text: LONG_TEXT, overflow: 'auto' }, undefined, box);

    const { fieldGroup, fieldText } = renderInEditor(field);

    expect(fieldText.width()).toBeGreaterThan(expectedFieldRect(box).width * 2);

    expectRect(fieldGroup.getClientRect({ skipStroke: true, skipShadow: true }), box);
  });

  it.each([
    [FieldType.DATE, { type: 'date', overflow: 'auto', verticalAlign: 'baseline' }, LONG_DATE],
    [FieldType.EMAIL, { type: 'email', overflow: 'auto' }, 'max.mustermann@beispiel-unternehmen.de'],
  ] as const)('keeps a %s on one line in a field tall enough to wrap it', (type, fieldMeta, sample) => {
    const { fieldText } = renderInEditor(createField(type, fieldMeta, sample));

    expect(fieldText.wrap()).toBe('none');
    expect(fieldText.textArr).toHaveLength(1);
    expect(fieldText.getTextWidth()).toBeGreaterThan(expectedFieldRect(FIELD_BOX).width);
  });

  it('still wraps a text value in a field tall enough for it', () => {
    const { fieldText } = renderInEditor(
      createField(FieldType.TEXT, { type: 'text', text: 'Hamburg, Altona Nord Ost', overflow: 'auto' }),
    );

    expect(fieldText.wrap()).toBe('word');
    expect(fieldText.textArr.length).toBeGreaterThan(1);
  });
});

describe('isFieldTextWiderThanField', () => {
  it('warns about a date wider than a field tall enough for a second line', () => {
    const field = createField(FieldType.DATE, { type: 'date', overflow: 'auto' });

    expect(isFieldTextWiderThanField({ field, text: LONG_DATE, pageWidth: PAGE.width, pageHeight: PAGE.height })).toBe(
      true,
    );
  });

  it('does not warn about text that wraps in a field tall enough for it', () => {
    const field = createField(FieldType.TEXT, { type: 'text', overflow: 'auto' });

    expect(
      isFieldTextWiderThanField({
        field,
        text: 'Hamburg, Altona Nord Ost',
        pageWidth: PAGE.width,
        pageHeight: PAGE.height,
      }),
    ).toBe(false);
  });
});
