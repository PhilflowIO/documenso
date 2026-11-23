import type { PageRenderData } from '@documenso/lib/client-only/providers/envelope-render-provider';
import type { PageLine } from '@documenso/lib/universal/field-renderer/page-lines';
import { detectPageLines } from '@documenso/lib/universal/field-renderer/page-lines';
import { useEffect, useState } from 'react';

/**
 * Pixels per page point for the detection render. Two pixels keep a hairline
 * visible while the whole page stays a small image.
 */
const PAGE_LINES_RENDER_SCALE = 2;

/**
 * How close, on screen, a field's bottom edge has to come to a line to snap.
 * Fingers are less precise than a mouse pointer.
 */
export const SNAP_TOLERANCE_PX = 8;
export const SNAP_TOLERANCE_TOUCH_PX = 14;

/**
 * The lines found on each mounted page, so that placing a new field from the
 * sidebar, which happens outside of the page canvas, can snap as well.
 */
const detectedPageLines = new Map<string, PageLine[]>();

const getPageKey = (envelopeItemId: string, pageNumber: number) => `${envelopeItemId}:${pageNumber}`;

export const getDetectedPageLines = (envelopeItemId: string, pageNumber: number): PageLine[] => {
  return detectedPageLines.get(getPageKey(envelopeItemId, pageNumber)) ?? [];
};

type UseEnvelopeCanvasPageLinesOptions = {
  envelopeItemId: string | undefined;
  pageNumber: number;
  renderPageImage: PageRenderData['renderPageImage'];
};

/**
 * The horizontal lines printed on the page, in page points. Empty until they
 * have been detected, and for pages without any (e.g. a scan of handwriting).
 */
export const useEnvelopeCanvasPageLines = ({
  envelopeItemId,
  pageNumber,
  renderPageImage,
}: UseEnvelopeCanvasPageLinesOptions) => {
  const [pageLines, setPageLines] = useState<PageLine[]>([]);

  useEffect(() => {
    if (!renderPageImage || !envelopeItemId) {
      return;
    }

    let isCancelled = false;

    renderPageImage(PAGE_LINES_RENDER_SCALE)
      .then((image) => {
        if (isCancelled) {
          return;
        }

        const lines = detectPageLines(image, PAGE_LINES_RENDER_SCALE);

        detectedPageLines.set(getPageKey(envelopeItemId, pageNumber), lines);
        setPageLines(lines);
      })
      .catch((err) => {
        // Snapping is an aid, so a page that cannot be analysed just doesn't snap.
        console.error(err);
      });

    return () => {
      isCancelled = true;
    };
  }, [renderPageImage, envelopeItemId, pageNumber]);

  return pageLines;
};
