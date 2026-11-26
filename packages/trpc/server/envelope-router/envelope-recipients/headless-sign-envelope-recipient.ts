import { headlessSignAndCompleteRecipient } from '@documenso/lib/server-only/headless-signing/headless-sign-and-complete-recipient';

import { authenticatedProcedure } from '../../trpc';
import {
  headlessSignEnvelopeRecipientMeta,
  ZHeadlessSignEnvelopeRecipientRequestSchema,
  ZHeadlessSignEnvelopeRecipientResponseSchema,
} from './headless-sign-envelope-recipient.types';
import { assertHeadlessSigningApiToken } from './headless-signing-guard';

export const headlessSignEnvelopeRecipientRoute = authenticatedProcedure
  .meta(headlessSignEnvelopeRecipientMeta)
  .input(ZHeadlessSignEnvelopeRecipientRequestSchema)
  .output(ZHeadlessSignEnvelopeRecipientResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeId, recipientId, fields, signer } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        recipientId,
        fieldIds: fields.map((field) => field.fieldId),
      },
    });

    assertHeadlessSigningApiToken(ctx.metadata);

    return await headlessSignAndCompleteRecipient({
      envelopeId,
      recipientId,
      userId: user.id,
      teamId,
      fields,
      signer,
    });
  });
