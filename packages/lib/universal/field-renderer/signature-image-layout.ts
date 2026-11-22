import type { TFieldMetaVerticalAlign, TFieldTextAlignSchema } from '../../types/field-meta';

export type SignatureInkBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RGBAImageData = {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
};

/**
 * Pixels with an alpha value at or below this are treated as background. Only
 * the faintest antialiasing falls below it, so cropping there is invisible
 * while letting the visible ink touch the field edge.
 */
const INK_ALPHA_THRESHOLD = 16;

/**
 * Opaque pixels lighter than this (average of the RGB channels) are treated
 * as background, so uploaded signatures with a white or paper-coloured
 * backdrop are trimmed the same way as transparent drawn signatures.
 */
const INK_LIGHTNESS_THRESHOLD = 235;

/**
 * Find the bounding box of the actual ink within a signature image.
 *
 * Signature images are captured from a full-size drawing pad, so most of the
 * image is empty space. Fitting the whole image into a field shrinks the
 * signature and floats it in the middle of the field, which makes it
 * impossible to place a signature on a signature line.
 *
 * Returns `null` when no ink is found, in which case the whole image should be
 * used.
 */
export const getSignatureInkBounds = (imageData: RGBAImageData): SignatureInkBounds | null => {
  const { data, width, height } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;

    for (let x = 0; x < width; x++) {
      const offset = rowOffset + x * 4;

      const alpha = data[offset + 3];

      if (alpha <= INK_ALPHA_THRESHOLD) {
        continue;
      }

      const lightness = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;

      if (lightness >= INK_LIGHTNESS_THRESHOLD) {
        continue;
      }

      if (x < minX) {
        minX = x;
      }

      if (x > maxX) {
        maxX = x;
      }

      if (y < minY) {
        minY = y;
      }

      if (y > maxY) {
        maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

type LayoutSignatureImageOptions = {
  /**
   * The dimensions of the source content, usually the ink bounds.
   */
  contentWidth: number;
  contentHeight: number;
  fieldWidth: number;
  fieldHeight: number;
  textAlign?: TFieldTextAlignSchema | null;
  verticalAlign?: TFieldMetaVerticalAlign | null;
};

/**
 * Scale content down to fit the field while keeping its aspect ratio, then
 * position it by the alignment. Defaults to centered on both axes, the
 * historical behaviour.
 */
export const layoutSignatureImage = ({
  contentWidth,
  contentHeight,
  fieldWidth,
  fieldHeight,
  textAlign,
  verticalAlign,
}: LayoutSignatureImageOptions) => {
  const scale = Math.min(fieldWidth / contentWidth, fieldHeight / contentHeight, 1);

  const width = contentWidth * scale;
  const height = contentHeight * scale;

  let x = (fieldWidth - width) / 2;
  let y = (fieldHeight - height) / 2;

  if (textAlign === 'left') {
    x = 0;
  }

  if (textAlign === 'right') {
    x = fieldWidth - width;
  }

  if (verticalAlign === 'top') {
    y = 0;
  }

  // Images have no descent, so the ink sits on the bottom edge for both.
  if (verticalAlign === 'bottom' || verticalAlign === 'baseline') {
    y = fieldHeight - height;
  }

  return { x, y, width, height };
};
