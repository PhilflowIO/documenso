/**
 * A horizontal line printed on a page, such as a signing line or a run of
 * underscores. All values are in page points, `y` is the top edge of the line.
 */
export type PageLine = {
  x: number;
  y: number;
  width: number;
};

export type PageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PageImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/**
 * Shorter dark runs are letters, not lines. Three underscores at 11 pt are
 * about 18 pt long, which is the shortest blank anyone fills in.
 */
const MIN_LINE_LENGTH_PT = 16;

/**
 * Anything thicker is a filled shape (a table header, a black bar), not a line
 * to write on.
 */
const MAX_LINE_THICKNESS_PT = 4;

/**
 * Underscore glyphs in some fonts leave a hairline gap between each other, and
 * anti aliasing leaves light pixels in thin lines.
 */
const MAX_GAP_PT = 1;

const DARK_LUMINANCE_THRESHOLD = 170;

type Run = { start: number; end: number };

type Segment = { start: number; end: number; top: number; bottom: number; lastRow: number };

const isDarkPixel = (data: Uint8ClampedArray, offset: number) => {
  const alpha = data[offset + 3];

  if (alpha < 128) {
    return false;
  }

  const luminance = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];

  return luminance < DARK_LUMINANCE_THRESHOLD;
};

const findRowRuns = (image: PageImage, row: number, minLength: number, maxGap: number): Run[] => {
  const runs: Run[] = [];

  let runStart = -1;
  let lastDark = -1;

  for (let x = 0; x < image.width; x++) {
    if (!isDarkPixel(image.data, (row * image.width + x) * 4)) {
      continue;
    }

    if (runStart !== -1 && x - lastDark - 1 > maxGap) {
      if (lastDark - runStart + 1 >= minLength) {
        runs.push({ start: runStart, end: lastDark });
      }

      runStart = -1;
    }

    if (runStart === -1) {
      runStart = x;
    }

    lastDark = x;
  }

  if (runStart !== -1 && lastDark - runStart + 1 >= minLength) {
    runs.push({ start: runStart, end: lastDark });
  }

  return runs;
};

const overlapsHorizontally = (a: Run, b: Run) => {
  const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);

  return overlap >= Math.min(a.end - a.start, b.end - b.start) / 2;
};

/**
 * Find the horizontal lines on a rendered page: vector lines, underscore runs
 * and table rules alike, since they all look the same once drawn. Working on
 * pixels rather than the PDF operators means fonts, drawing operators and
 * clipping do not matter.
 *
 * @param image The page rendered on a white background.
 * @param scale Pixels per page point of the rendered image.
 */
export const detectPageLines = (image: PageImage, scale: number): PageLine[] => {
  const minLength = MIN_LINE_LENGTH_PT * scale;
  const maxGap = Math.max(1, Math.round(MAX_GAP_PT * scale));

  const openSegments: Segment[] = [];
  const closedSegments: Segment[] = [];

  for (let row = 0; row < image.height; row++) {
    const runs = findRowRuns(image, row, minLength, maxGap);

    for (const run of runs) {
      const segment = openSegments.find((open) => open.lastRow === row - 1 && overlapsHorizontally(open, run));

      if (segment) {
        segment.start = Math.min(segment.start, run.start);
        segment.end = Math.max(segment.end, run.end);
        segment.bottom = row;
        segment.lastRow = row;
        continue;
      }

      openSegments.push({ ...run, top: row, bottom: row, lastRow: row });
    }

    for (let i = openSegments.length - 1; i >= 0; i--) {
      if (openSegments[i].lastRow < row) {
        closedSegments.push(...openSegments.splice(i, 1));
      }
    }
  }

  closedSegments.push(...openSegments);

  return closedSegments
    .filter((segment) => (segment.bottom - segment.top + 1) / scale <= MAX_LINE_THICKNESS_PT)
    .map((segment) => ({
      x: segment.start / scale,
      y: segment.top / scale,
      width: (segment.end - segment.start + 1) / scale,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
};

const getHorizontalOverlap = (box: PageBox, line: Pick<PageLine, 'x' | 'width'>) => {
  return Math.min(box.x + box.width, line.x + line.width) - Math.max(box.x, line.x);
};

export type FieldSnap<TBox extends PageBox = PageBox> = {
  /**
   * Where the top of the box goes so its bottom edge sits on the target.
   */
  y: number;

  /**
   * The page line the box snapped to, if any.
   */
  line: PageLine | null;

  /**
   * The other box whose bottom edge the box was aligned with, if any.
   */
  alignedBox: TBox | null;
};

type FindFieldSnapOptions<TBox extends PageBox> = {
  box: PageBox;
  lines: PageLine[];

  /**
   * Other fields on the page, whose bottom edges the box can line up with.
   */
  boxes: TBox[];

  /**
   * The snapping distance in page points.
   */
  tolerance: number;
};

/**
 * Where a dragged field should snap so that its bottom edge sits on a line of
 * the page, or level with the bottom of another field.
 *
 * A page line has to overlap at least half of the field (or of the line, if it
 * is shorter), so a field next to a line does not jump onto it. It wins over
 * another field's edge, since the document is what the signer writes on.
 */
export const findFieldSnap = <TBox extends PageBox>({
  box,
  lines,
  boxes,
  tolerance,
}: FindFieldSnapOptions<TBox>): FieldSnap<TBox> | null => {
  const bottom = box.y + box.height;

  let bestLine: PageLine | null = null;

  for (const line of lines) {
    const distance = Math.abs(line.y - bottom);
    const minOverlap = Math.min(box.width, line.width) / 2;

    if (distance > tolerance || getHorizontalOverlap(box, line) < minOverlap) {
      continue;
    }

    if (!bestLine || distance < Math.abs(bestLine.y - bottom)) {
      bestLine = line;
    }
  }

  if (bestLine) {
    return { y: bestLine.y - box.height, line: bestLine, alignedBox: null };
  }

  let bestBox: TBox | null = null;

  for (const other of boxes) {
    const distance = Math.abs(other.y + other.height - bottom);

    if (distance > tolerance) {
      continue;
    }

    if (!bestBox || distance < Math.abs(bestBox.y + bestBox.height - bottom)) {
      bestBox = other;
    }
  }

  if (bestBox) {
    return { y: bestBox.y + bestBox.height - box.height, line: null, alignedBox: bestBox };
  }

  return null;
};
