import { signEnvelopeFieldWithToken } from '@documenso/lib/server-only/field/sign-envelope-field-with-token';

import { procedure } from '../trpc';
import { ZSignEnvelopeFieldRequestSchema, ZSignEnvelopeFieldResponseSchema } from './sign-envelope-field.types';

// Note that this is an unauthenticated public procedure route.
export const signEnvelopeFieldRoute = procedure
  .input(ZSignEnvelopeFieldRequestSchema)
  .output(ZSignEnvelopeFieldResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, metadata } = ctx;
    const { token, fieldId, fieldValue, authOptions } = input;

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    return await signEnvelopeFieldWithToken({
      token,
      fieldId,
      fieldValue,
      authOptions,
      userId: user?.id,
      requestMetadata: metadata.requestMetadata,
    });
  });
