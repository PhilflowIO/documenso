import {
  HEADLESS_DECLINE_REASON_MAX_LENGTH,
  ZHeadlessRecipientStateSchema,
  ZHeadlessSignerSchema,
} from '@documenso/lib/types/headless-signing';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc';

export const headlessDeclineEnvelopeRecipientMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/{recipientId}/headless/decline',
    summary: 'Decline the document as the recipient (headless signing)',
    description:
      'For clients that run their own signing page. The recipient declines the document themselves: the audit ' +
      'log attributes the rejection to the recipient (unlike `/envelope/recipient/{recipientId}/reject`, which ' +
      'attributes it to the API user) and names the `signer` IP address and user agent from the body.',
    tags: ['Envelope Recipients'],
  },
};

export const ZHeadlessDeclineEnvelopeRecipientRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope the recipient belongs to.'),
  recipientId: z.number().describe('The ID of the recipient who declines.'),
  reason: z.string().trim().min(1).max(HEADLESS_DECLINE_REASON_MAX_LENGTH).describe('Why the recipient declined.'),
  signer: ZHeadlessSignerSchema,
});

export const ZHeadlessDeclineEnvelopeRecipientResponseSchema = z.object({
  recipient: ZHeadlessRecipientStateSchema,
});

export type THeadlessDeclineEnvelopeRecipientRequest = z.infer<typeof ZHeadlessDeclineEnvelopeRecipientRequestSchema>;
export type THeadlessDeclineEnvelopeRecipientResponse = z.infer<typeof ZHeadlessDeclineEnvelopeRecipientResponseSchema>;
