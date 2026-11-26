import { RecipientSchema } from '@documenso/prisma/generated/zod/modelSchema/RecipientSchema';
import { z } from 'zod';

import { isBase64Image, isPngSignatureDataUrl } from '../constants/signatures';

/**
 * Headless signing lets an API client that runs its own signing page record
 * what the signer did, while Documenso keeps the field values, the signing
 * order, the seal and the audit trail.
 *
 * The client is trusted with one thing the public signing page derives from
 * request headers: who the signer is on the network. That is why these
 * values are only ever accepted on API-token-authenticated routes.
 */

export const HEADLESS_SIGNER_USER_AGENT_MAX_LENGTH = 512;

export const HEADLESS_IMAGE_SIGNATURE_MAX_LENGTH = 1024 * 1024;

export const HEADLESS_TYPED_SIGNATURE_MAX_LENGTH = 256;

export const HEADLESS_TEXT_VALUE_MAX_LENGTH = 2048;

export const HEADLESS_DECLINE_REASON_MAX_LENGTH = 500;

// Unicode "Other" category: control characters, format characters, unassigned
// code points and surrogates. None belongs in a user agent or a typed signature.
const CONTROL_CHARACTER_REGEX = /\p{C}/u;

export const ZHeadlessSignerSchema = z
  .object({
    ipAddress: z.string().ip().describe('The IP address of the signer, as seen by the client that serves the page.'),
    userAgent: z
      .string()
      .min(1)
      .max(HEADLESS_SIGNER_USER_AGENT_MAX_LENGTH)
      .refine((value) => !CONTROL_CHARACTER_REGEX.test(value), {
        message: 'User agent must not contain control characters',
      })
      .optional()
      .describe('The user agent of the signer browser.'),
  })
  .strict()
  .describe(
    'The signer as seen by the client that serves the signing page. Recorded in the audit log instead of the ' +
      'values of the API request itself.',
  );

export type THeadlessSigner = z.infer<typeof ZHeadlessSignerSchema>;

/**
 * A drawn signature as a PNG data URL, or a typed signature. Same limits as
 * the embedded signing flow (`persist-embed-signature.types.ts`).
 */
export const ZHeadlessSignatureValueSchema = z
  .string()
  .min(1)
  .max(HEADLESS_IMAGE_SIGNATURE_MAX_LENGTH)
  .refine(
    (value) => {
      if (isBase64Image(value)) {
        return isPngSignatureDataUrl(value);
      }

      return value.length <= HEADLESS_TYPED_SIGNATURE_MAX_LENGTH && !CONTROL_CHARACTER_REGEX.test(value);
    },
    {
      message: 'Signature must be a PNG data URL or a short typed signature',
    },
  );

const ZHeadlessTextValueSchema = z.string().max(HEADLESS_TEXT_VALUE_MAX_LENGTH);

/**
 * The value for one field. Mirrors `ZSignEnvelopeFieldValue` of the public
 * signing route, with length limits added because the public route has none.
 *
 * `DATE` carries no value: Documenso stamps the server time in the timezone and
 * format of the envelope, exactly like on its own signing page.
 */
export const ZHeadlessFieldValueSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SIGNATURE'),
    value: ZHeadlessSignatureValueSchema,
  }),
  z.object({
    type: z.literal('TEXT'),
    value: ZHeadlessTextValueSchema,
  }),
  z.object({
    type: z.literal('NAME'),
    value: ZHeadlessTextValueSchema,
  }),
  z.object({
    type: z.literal('INITIALS'),
    value: ZHeadlessTextValueSchema,
  }),
  z.object({
    type: z.literal('EMAIL'),
    value: ZHeadlessTextValueSchema,
  }),
  z.object({
    type: z.literal('NUMBER'),
    value: ZHeadlessTextValueSchema,
  }),
  z.object({
    type: z.literal('DROPDOWN'),
    value: ZHeadlessTextValueSchema,
  }),
  z.object({
    type: z.literal('DATE'),
  }),
  z.object({
    type: z.literal('CHECKBOX'),
    value: z.array(z.number().int().min(0)).describe('The indices of the selected options'),
  }),
  z.object({
    type: z.literal('RADIO'),
    value: z.number().int().min(0).describe('The index of the selected option'),
  }),
]);

export type THeadlessFieldValue = z.infer<typeof ZHeadlessFieldValueSchema>;

export const ZHeadlessFieldInputSchema = z.object({
  fieldId: z.number().int().describe('The ID of the field, as returned by `GET /envelope/{envelopeId}`.'),
  value: ZHeadlessFieldValueSchema,
});

export type THeadlessFieldInput = z.infer<typeof ZHeadlessFieldInputSchema>;

/**
 * The state of a recipient after a headless action. Never includes the
 * recipient token: a client running its own signing page has no use for it.
 */
export const ZHeadlessRecipientStateSchema = RecipientSchema.pick({
  id: true,
  email: true,
  name: true,
  role: true,
  signingOrder: true,
  readStatus: true,
  signingStatus: true,
  sendStatus: true,
  signedAt: true,
  rejectionReason: true,
});

export type THeadlessRecipientState = z.infer<typeof ZHeadlessRecipientStateSchema>;
