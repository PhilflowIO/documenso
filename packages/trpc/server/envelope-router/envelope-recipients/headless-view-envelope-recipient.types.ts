import { ZHeadlessRecipientStateSchema, ZHeadlessSignerSchema } from '@documenso/lib/types/headless-signing';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc';

export const headlessViewEnvelopeRecipientMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/{recipientId}/headless/view',
    summary: 'Record that a recipient opened the document (headless signing)',
    description:
      'For clients that run their own signing page. Records the same "document viewed" and, on the first call, ' +
      '"document opened" audit log entries and webhook as the Documenso signing page. The audit log names the ' +
      '`signer` IP address and user agent from the body. Only for pending version 2 SES envelopes of the team ' +
      'of the API token, for recipients without access or action authentication.',
    tags: ['Envelope Recipients'],
  },
};

export const ZHeadlessViewEnvelopeRecipientRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope the recipient belongs to.'),
  recipientId: z.number().describe('The ID of the recipient who opened the document.'),
  signer: ZHeadlessSignerSchema,
});

export const ZHeadlessViewEnvelopeRecipientResponseSchema = z.object({
  recipient: ZHeadlessRecipientStateSchema,
});

export type THeadlessViewEnvelopeRecipientRequest = z.infer<typeof ZHeadlessViewEnvelopeRecipientRequestSchema>;
export type THeadlessViewEnvelopeRecipientResponse = z.infer<typeof ZHeadlessViewEnvelopeRecipientResponseSchema>;
