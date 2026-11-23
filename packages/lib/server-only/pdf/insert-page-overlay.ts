import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import type { PDF, PDFPage, Rectangle } from '@libpdf/core';
import { PDF as PDFDocument } from '@libpdf/core';
import { groupBy, unique } from 'remeda';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { ContentImageMap } from '../../universal/content-renderer/content-renderer';
import { insertFieldInPDFV2, type OverlayContent } from './insert-field-in-pdf-v2';

type InsertPageOverlaysOptions = {
  pdfDoc: PDF;
  fields: FieldWithSignature[];
  contents?: OverlayContent[];
  images?: ContentImageMap;
};

export const insertPageOverlays = async ({ pdfDoc, fields, contents = [], images }: InsertPageOverlaysOptions) => {
  const fieldsByPage = groupBy(fields, (field) => field.page);
  const contentsByPage = groupBy(contents, (content) => content.contentMeta.page);

  const pageNumbers = unique([...Object.keys(fieldsByPage), ...Object.keys(contentsByPage)].map(Number));

  for (const pageNumber of pageNumbers) {
    const page = pdfDoc.getPage(pageNumber - 1);

    if (!page) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Page ${pageNumber} does not exist`,
      });
    }

    const pageWidth = page.width;
    const pageHeight = page.height;

    const overlayBytes = await insertFieldInPDFV2({
      pageWidth,
      pageHeight,
      fields: fieldsByPage[pageNumber] ?? [],
      contents: contentsByPage[pageNumber] ?? [],
      images,
    });

    const overlayPdf = await PDFDocument.load(overlayBytes);

    const embeddedPage = await pdfDoc.embedPage(overlayPdf, 0);

    const { x, y } = getOverlayPosition({
      visibleBox: getVisibleBox(page),
      rotation: page.rotation,
      overlayHeight: embeddedPage.box.height,
    });

    page.drawPage(embeddedPage, {
      x,
      y,
      rotate: {
        angle: page.rotation,
      },
    });
  }
};

/**
 * The region pdf.js renders and the client places fields against: the CropBox
 * clipped to the MediaBox, in user space, which need not start at the origin.
 */
const getVisibleBox = (page: PDFPage): Rectangle => {
  const mediaBox = page.getMediaBox();
  const cropBox = page.getCropBox();

  const x = Math.max(mediaBox.x, cropBox.x);
  const y = Math.max(mediaBox.y, cropBox.y);
  const right = Math.min(mediaBox.x + mediaBox.width, cropBox.x + cropBox.width);
  const top = Math.min(mediaBox.y + mediaBox.height, cropBox.y + cropBox.height);

  if (right <= x || top <= y) {
    return mediaBox;
  }

  return { x, y, width: right - x, height: top - y };
};

type GetOverlayPositionOptions = {
  visibleBox: Rectangle;
  rotation: 0 | 90 | 180 | 270;
  overlayHeight: number;
};

/**
 * Where to draw the overlay so the corner Konva draws from, its top-left,
 * lands on the corner the viewer shows top-left after the page rotation.
 *
 * The overlay's own height is used rather than the page height because Skia
 * writes the overlay page at whole points, so on fractional pages it differs
 * from the page by up to half a point and the top-left corner moves with it.
 */
const getOverlayPosition = ({ visibleBox, rotation, overlayHeight }: GetOverlayPositionOptions) => {
  const left = visibleBox.x;
  const bottom = visibleBox.y;
  const right = visibleBox.x + visibleBox.width;
  const top = visibleBox.y + visibleBox.height;

  switch (rotation) {
    case 90:
      return { x: left + overlayHeight, y: bottom };
    case 180:
      return { x: right, y: bottom + overlayHeight };
    case 270:
      return { x: right - overlayHeight, y: top };
    default:
      return { x: left, y: top - overlayHeight };
  }
};
