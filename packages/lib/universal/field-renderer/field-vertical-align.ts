import type Konva from 'konva';

import type { TFieldMetaVerticalAlign } from '../../types/field-meta';

type KonvaVerticalAlign = 'top' | 'middle' | 'bottom';

/**
 * Konva has no baseline alignment, so baseline text is laid out bottom aligned
 * (which also makes overflowing text grow upwards, keeping the line fixed) and
 * then shifted down by `getKonvaTextBaselineOffset`.
 */
export const toKonvaVerticalAlign = (verticalAlign: TFieldMetaVerticalAlign): KonvaVerticalAlign => {
  return verticalAlign === 'baseline' ? 'bottom' : verticalAlign;
};

/**
 * The distance between the alphabetic baseline of a bottom aligned Konva text
 * line and the bottom of its line box.
 *
 * Mirrors how Konva positions the baseline within a line in `Text._sceneFunc`:
 * `(ascent - descent) / 2 + lineHeightPx / 2` from the top of the line box.
 */
export const getKonvaTextBaselineOffset = (text: Konva.Text) => {
  const metrics = text.measureSize('M');

  const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;

  const lineHeightPx = text.lineHeight() * text.fontSize();

  return lineHeightPx / 2 - (ascent - descent) / 2;
};

/**
 * Move a bottom aligned text node so the baseline of its last line sits on the
 * bottom edge of its box, when the field is aligned to the baseline.
 */
export const applyTextBaselineAlignment = (text: Konva.Text, verticalAlign: TFieldMetaVerticalAlign) => {
  if (verticalAlign !== 'baseline') {
    return;
  }

  text.y(text.y() + getKonvaTextBaselineOffset(text));
};
