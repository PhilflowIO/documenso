const SAMPLE_SIGNATURE_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">',
  '<g fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">',
  '<path d="M40 150C55 90 70 40 85 45C100 50 90 120 100 150C110 110 125 50 140 55C155 60 145 130 160 150',
  'C175 120 185 95 200 110C210 120 205 140 220 135C235 130 240 100 255 105C270 110 262 140 280 138',
  'C300 136 305 70 320 60C330 55 325 140 335 140C345 140 355 105 372 108C390 111 380 138 398 136',
  'C415 134 420 104 438 106C456 108 446 138 465 136C485 134 495 100 515 104C535 108 525 140 560 130"/>',
  '<path d="M70 172C200 162 380 160 560 152"/>',
  '</g></svg>',
].join('');

/**
 * A made up drawn signature, used as the sample value of signature fields in
 * the editor. It goes through the same ink cropping and layout as a real
 * drawn signature, so the sample sits where a signature will.
 *
 * Its natural size is that of a drawing pad export, so it is scaled down to the
 * field like a real signature rather than drawn at its own size.
 */
export const SAMPLE_SIGNATURE_IMAGE_AS_BASE64 = `data:image/svg+xml;base64,${btoa(SAMPLE_SIGNATURE_SVG)}`;
