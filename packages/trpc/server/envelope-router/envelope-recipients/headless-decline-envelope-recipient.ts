import { headlessDeclineRecipient } from '@documenso/lib/server-only/headless-signing/headless-decline-recipient';

import { authenticatedProcedure } from '../../trpc';
import {
  headlessDeclineEnvelopeRecipientMeta,
  ZHeadlessDeclineEnvelopeRecipientRequestSchema,
  ZHeadlessDeclineEnvelopeRecipientResponseSchema,
} from './headless-decline-envelope-recipient.types';
import { assertHeadlessSigningApiToken } from './headless-signing-guard';

export const headlessDeclineEnvelopeRecipientRoute = authenticatedProcedure
  .meta(headlessDeclineEnvelopeRecipientMeta)
  .input(ZHeadlessDeclineEnvelopeRecipientRequestSchema)
  .output(ZHeadlessDeclineEnvelopeRecipientResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeId, recipientId, reason, signer } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        recipientId,
      },
    });

    assertHeadlessSigningApiToken(ctx.metadata);

    return await headlessDeclineRecipient({
      envelopeId,
      recipientId,
      userId: user.id,
      teamId,
      reason,
      signer,
    });
  });
