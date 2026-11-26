import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { THeadlessSigner } from '../../types/headless-signing';
import { viewedDocument } from '../document/viewed-document';
import { assertSenderNotDisabled } from '../user/assert-user-not-disabled';
import { getHeadlessSigningRecipient, toHeadlessRecipientState } from './get-headless-signing-recipient';

export type HeadlessViewRecipientOptions = {
  envelopeId: string;
  recipientId: number;
  userId: number;
  teamId: number;
  signer: THeadlessSigner;
};

/**
 * Records that the signer opened the document on the client's own signing
 * page: the same `DOCUMENT_VIEWED` entry (every call), `DOCUMENT_OPENED` entry
 * and webhook (first call only) that Documenso's signing page writes in its
 * loader.
 */
export const headlessViewRecipient = async ({
  envelopeId,
  recipientId,
  userId,
  teamId,
  signer,
}: HeadlessViewRecipientOptions) => {
  const recipient = await getHeadlessSigningRecipient({ envelopeId, recipientId, userId, teamId });

  const { envelope } = recipient;

  await assertSenderNotDisabled({ userId: envelope.userId });

  if (envelope.deletedAt || envelope.status !== DocumentStatus.PENDING) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document ${envelope.id} must be pending to be opened for signing`,
      statusCode: 400,
    });
  }

  await viewedDocument({
    token: recipient.token,
    recipientAccessAuth: [],
    requestMetadata: {
      ipAddress: signer.ipAddress,
      userAgent: signer.userAgent,
    },
  });

  const updatedRecipient = await prisma.recipient.findUniqueOrThrow({
    where: { id: recipient.id },
  });

  return {
    recipient: toHeadlessRecipientState(updatedRecipient),
  };
};
