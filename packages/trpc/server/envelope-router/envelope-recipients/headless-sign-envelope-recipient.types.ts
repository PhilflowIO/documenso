import {
  ZHeadlessFieldInputSchema,
  ZHeadlessRecipientStateSchema,
  ZHeadlessSignerSchema,
} from '@documenso/lib/types/headless-signing';
import FieldSchema from '@documenso/prisma/generated/zod/modelSchema/FieldSchema';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc';

export const headlessSignEnvelopeRecipientMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/{recipientId}/headless/sign',
    summary: 'Sign all fields of a recipient and complete them (headless signing)',
    description:
      'For clients that run their own signing page. Inserts the given values into the fields of the recipient ' +
      'and completes the recipient in one call, through the same logic as the Documenso signing page: signing ' +
      'order, auto-filled dates, sealing once everyone has signed. Field IDs are the ones ' +
      '`GET /envelope/{envelopeId}` returns. The request is checked in full before anything is written; a ' +
      'rejected request changes nothing. A recipient who already signed gets `status: ALREADY_SIGNED` and no ' +
      'write. `nextRecipients` lists who became due with this completion (sequential signing only). The audit ' +
      'log names the `signer` IP address and user agent from the body. Only for pending version 2 SES envelopes ' +
      'of the team of the API token, for recipients without access or action authentication.',
    tags: ['Envelope Recipients'],
  },
};

export const ZHeadlessSignEnvelopeRecipientRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope the recipient belongs to.'),
  recipientId: z.number().describe('The ID of the recipient who signs.'),
  fields: z
    .array(ZHeadlessFieldInputSchema)
    .max(500)
    .describe(
      'One entry per field to fill. Fields of the recipient that are not listed keep their value; empty date ' +
        'fields are filled with the signing time.',
    ),
  signer: ZHeadlessSignerSchema,
});

export const ZHeadlessSignEnvelopeRecipientResponseSchema = z.object({
  status: z.enum(['SIGNED', 'ALREADY_SIGNED']),
  recipient: ZHeadlessRecipientStateSchema,
  nextRecipients: ZHeadlessRecipientStateSchema.array().describe(
    'Recipients whose turn started with this completion. Empty in parallel signing and when nothing was written.',
  ),
  allRecipientsSigned: z
    .boolean()
    .describe('True once every non-CC recipient has signed; the sealed document follows asynchronously.'),
  fields: FieldSchema.pick({ id: true, type: true, inserted: true, customText: true }).array(),
});

export type THeadlessSignEnvelopeRecipientRequest = z.infer<typeof ZHeadlessSignEnvelopeRecipientRequestSchema>;
export type THeadlessSignEnvelopeRecipientResponse = z.infer<typeof ZHeadlessSignEnvelopeRecipientResponseSchema>;
