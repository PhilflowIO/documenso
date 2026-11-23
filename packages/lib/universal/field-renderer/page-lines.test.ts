import { describe, expect, it } from 'vitest';

import { detectPageLines, findFieldSnap } from './page-lines';

/**
 * A white page with black rectangles painted on it, given in pixels.
 */
const createPage = (width: number, height: number, rects: Array<[number, number, number, number]>) => {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);

  for (const [x, y, w, h] of rects) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        data.set([0, 0, 0, 255], (row * width + col) * 4);
      }
    }
  }

  return { data, width, height };
};

describe('detectPageLines', () => {
  it('finds signing lines and underscore runs in page points, but not letters or filled shapes', () => {
    const scale = 2;

    const underscores: Array<[number, number, number, number]> = [];

    // Ten underscore glyphs, 5.5 pt wide, with a one pixel gap between them.
    for (let i = 0; i < 10; i++) {
      underscores.push([200 + i * 11, 400, 10, 2]);
    }

    const page = createPage(600, 600, [
      // A 1 pt vector line from x 50 to 250 pt at y 100 pt.
      [100, 200, 400, 2],
      ...underscores,
      // A dash, too short to write on.
      [100, 300, 20, 2],
      // A filled bar, too thick to be a line.
      [100, 500, 400, 20],
    ]);

    expect(detectPageLines(page, scale)).toEqual([
      { x: 50, y: 100, width: 200 },
      { x: 100, y: 200, width: 54.5 },
    ]);
  });
});

describe('findFieldSnap', () => {
  const line = { x: 100, y: 500, width: 200 };

  it('puts the bottom edge of a field near a line onto it', () => {
    const snap = findFieldSnap({
      box: { x: 120, y: 470, width: 100, height: 25 },
      lines: [line],
      boxes: [],
      tolerance: 6,
    });

    expect(snap).toEqual({ y: 475, line, alignedBox: null });
  });

  it('leaves a field alone when the line is out of reach or beside it', () => {
    const outOfReach = findFieldSnap({
      box: { x: 120, y: 460, width: 100, height: 25 },
      lines: [line],
      boxes: [],
      tolerance: 6,
    });

    const beside = findFieldSnap({
      box: { x: 260, y: 475, width: 100, height: 25 },
      lines: [line],
      boxes: [],
      tolerance: 6,
    });

    expect(outOfReach).toBeNull();
    expect(beside).toBeNull();
  });

  it('lines a field up with the bottom of another field, unless a page line is in reach', () => {
    const otherField = { x: 400, y: 480, width: 80, height: 22 };

    const alignedWithField = findFieldSnap({
      box: { x: 320, y: 475, width: 60, height: 30 },
      lines: [line],
      boxes: [otherField],
      tolerance: 6,
    });

    const onLine = findFieldSnap({
      box: { x: 150, y: 472, width: 60, height: 30 },
      lines: [line],
      boxes: [{ ...otherField, y: 476 }],
      tolerance: 6,
    });

    expect(alignedWithField).toEqual({ y: 472, line: null, alignedBox: otherField });
    expect(onLine?.line).toEqual(line);
    expect(onLine?.y).toBe(470);
  });
});
