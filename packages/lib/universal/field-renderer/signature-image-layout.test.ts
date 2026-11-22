import { describe, expect, it } from 'vitest';

import { getSignatureInkBounds, layoutSignatureImage } from './signature-image-layout';

type Pixel = [number, number, number, number];

const TRANSPARENT: Pixel = [0, 0, 0, 0];
const WHITE: Pixel = [255, 255, 255, 255];
const INK: Pixel = [0, 0, 0, 255];

/**
 * Build an RGBA image filled with `background`, with ink painted on every
 * `[x, y]` coordinate given.
 */
const createImage = (width: number, height: number, ink: Array<[number, number]>, background = TRANSPARENT) => {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    data.set(background, i * 4);
  }

  for (const [x, y] of ink) {
    data.set(INK, (y * width + x) * 4);
  }

  return { data, width, height };
};

describe('getSignatureInkBounds', () => {
  it('returns null for an image without ink', () => {
    expect(getSignatureInkBounds(createImage(10, 10, []))).toBeNull();
    expect(getSignatureInkBounds(createImage(10, 10, [], WHITE))).toBeNull();
  });

  it('trims transparent space around a drawn signature', () => {
    const ink: Array<[number, number]> = [];

    for (let x = 100; x < 200; x++) {
      ink.push([x, 40]);
      ink.push([x, 59]);
    }

    expect(getSignatureInkBounds(createImage(400, 200, ink))).toEqual({
      x: 100,
      y: 40,
      width: 100,
      height: 20,
    });
  });

  it('trims a white background from an uploaded signature', () => {
    expect(getSignatureInkBounds(createImage(50, 50, [[10, 20]], WHITE))).toEqual({
      x: 10,
      y: 20,
      width: 1,
      height: 1,
    });
  });

  it('ignores near-transparent anti-aliasing noise', () => {
    const image = createImage(20, 20, [[5, 5]]);

    image.data.set([0, 0, 0, 10], (15 * 20 + 15) * 4);

    expect(getSignatureInkBounds(image)).toEqual({ x: 5, y: 5, width: 1, height: 1 });
  });
});

describe('layoutSignatureImage', () => {
  const base = { contentWidth: 200, contentHeight: 50, fieldWidth: 100, fieldHeight: 100 };

  it('fits the content into the field, keeping the aspect ratio', () => {
    const { width, height } = layoutSignatureImage(base);

    expect(width).toBe(100);
    expect(height).toBe(25);
  });

  it('centers on both axes by default', () => {
    expect(layoutSignatureImage(base)).toEqual({ x: 0, y: 37.5, width: 100, height: 25 });
  });

  it('sits the content on the bottom edge of the field', () => {
    expect(layoutSignatureImage({ ...base, verticalAlign: 'bottom' })).toEqual({
      x: 0,
      y: 75,
      width: 100,
      height: 25,
    });
  });

  it('sits the content on the bottom edge when aligned to the baseline', () => {
    expect(layoutSignatureImage({ ...base, verticalAlign: 'baseline' }).y).toBe(75);
  });

  it('never upscales content smaller than the field', () => {
    expect(layoutSignatureImage({ ...base, contentWidth: 20, contentHeight: 5, verticalAlign: 'bottom' })).toEqual({
      x: 40,
      y: 95,
      width: 20,
      height: 5,
    });
  });

  it('aligns to the top edge of the field', () => {
    expect(layoutSignatureImage({ ...base, verticalAlign: 'top' }).y).toBe(0);
  });

  it('aligns horizontally when the content is narrower than the field', () => {
    const tall = { contentWidth: 50, contentHeight: 100, fieldWidth: 200, fieldHeight: 100 };

    expect(layoutSignatureImage({ ...tall, textAlign: 'left' }).x).toBe(0);
    expect(layoutSignatureImage(tall).x).toBe(75);
    expect(layoutSignatureImage({ ...tall, textAlign: 'right' }).x).toBe(150);
  });
});
