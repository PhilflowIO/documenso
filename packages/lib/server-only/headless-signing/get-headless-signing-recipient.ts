import { prisma } from '@documenso/prisma';
import { EnvelopeType, RecipientRole } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isTspEnvelope } from '../../types/signature-level';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type GetHeadlessSigningRecipientOptions = {
  envelopeId: string;
  recipientId: number;
  userId: number;
  teamId: number;
};

/**
 * Resolves a recipient for a headless signing action, scoped to the team of
 * the API token.
 *
 * The envelope must be visible to the token (`getEnvelopeWhereInput`) AND
 * belong to the token's team. The second condition is stricter than the rest
 * of API v2, which also lets a user reach envelopes they own in another team:
 * headless signing acts for a signer, so a token must never reach beyond the
 * team it was issued for.
 *
 * Every mismatch (unknown recipient, recipient of another envelope, envelope of
 * another team) answers the same NOT_FOUND so nothing leaks about other teams.
 */
export const getHeadlessSigningRecipient = async ({
  envelopeId,
  recipientId,
  userId,
  teamId,
}: GetHeadlessSigningRecipientOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: { type: 'envelopeId', id: envelopeId },
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      envelope: {
        AND: [envelopeWhereInput, { teamId }],
      },
    },
    include: {
      envelope: {
        include: {
          documentMeta: true,
        },
      },
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
      statusCode: 404,
    });
  }

  const { envelope } = recipient;

  if (envelope.internalVersion !== 2) {
    throw new AppError(AppErrorCode.ENVELOPE_LEGACY, {
      message: 'Headless signing is only available for version 2 envelopes',
      statusCode: 400,
    });
  }

  // TSP (AES/QES) recipients complete through the CSC signing flow, which needs
  // the signer's browser for the credential OAuth round-trip.
  if (isTspEnvelope(envelope)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Headless signing is not available for advanced or qualified signature envelopes',
      statusCode: 400,
    });
  }

  // Recipient auth (account, passkey, 2FA, password) is proven on Documenso's
  // own signing page. A headless client cannot prove it here, so refuse up
  // front instead of failing halfway through a signing.
  const { recipientAccessAuthRequired, recipientActionAuthRequired } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
    recipientAuth: recipient.authOptions,
  });

  if (recipientAccessAuthRequired || recipientActionAuthRequired) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Headless signing is not available for recipients with access or action authentication',
      statusCode: 400,
    });
  }

  if (recipient.role === RecipientRole.CC) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CC recipients do not act on a document',
      statusCode: 400,
    });
  }

  return recipient;
};

export type HeadlessSigningRecipient = Awaited<ReturnType<typeof getHeadlessSigningRecipient>>;

export const toHeadlessRecipientState = (recipient: {
  id: number;
  email: string;
  name: string;
  role: RecipientRole;
  signingOrder: number | null;
  readStatus: HeadlessSigningRecipient['readStatus'];
  signingStatus: HeadlessSigningRecipient['signingStatus'];
  sendStatus: HeadlessSigningRecipient['sendStatus'];
  signedAt: Date | null;
  rejectionReason: string | null;
}) => ({
  id: recipient.id,
  email: recipient.email,
  name: recipient.name,
  role: recipient.role,
  signingOrder: recipient.signingOrder,
  readStatus: recipient.readStatus,
  signingStatus: recipient.signingStatus,
  sendStatus: recipient.sendStatus,
  signedAt: recipient.signedAt,
  rejectionReason: recipient.rejectionReason,
});
