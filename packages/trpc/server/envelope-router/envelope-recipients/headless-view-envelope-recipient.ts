import { headlessViewRecipient } from '@documenso/lib/server-only/headless-signing/headless-view-recipient';

import { authenticatedProcedure } from '../../trpc';
import { assertHeadlessSigningApiToken } from './headless-signing-guard';
import {
  headlessViewEnvelopeRecipientMeta,
  ZHeadlessViewEnvelopeRecipientRequestSchema,
  ZHeadlessViewEnvelopeRecipientResponseSchema,
} from './headless-view-envelope-recipient.types';

export const headlessViewEnvelopeRecipientRoute = authenticatedProcedure
  .meta(headlessViewEnvelopeRecipientMeta)
  .input(ZHeadlessViewEnvelopeRecipientRequestSchema)
  .output(ZHeadlessViewEnvelopeRecipientResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeId, recipientId, signer } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        recipientId,
      },
    });

    assertHeadlessSigningApiToken(ctx.metadata);

    return await headlessViewRecipient({
      envelopeId,
      recipientId,
      userId: user.id,
      teamId,
      signer,
    });
  });
