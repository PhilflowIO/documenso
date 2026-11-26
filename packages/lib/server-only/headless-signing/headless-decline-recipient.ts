import { prisma } from '@documenso/prisma';

import type { THeadlessSigner } from '../../types/headless-signing';
import { rejectDocumentWithToken } from '../document/reject-document-with-token';
import { getHeadlessSigningRecipient, toHeadlessRecipientState } from './get-headless-signing-recipient';

export type HeadlessDeclineRecipientOptions = {
  envelopeId: string;
  recipientId: number;
  userId: number;
  teamId: number;
  reason: string;
  signer: THeadlessSigner;
};

/**
 * The signer declines on the client's own signing page.
 *
 * Goes through `rejectDocumentWithToken`, the function behind Documenso's own
 * reject dialog, so the audit log attributes the rejection to the recipient
 * (not to the API user, unlike `POST /envelope/recipient/{id}/reject`) and the
 * same seal, webhook and email jobs run.
 */
export const headlessDeclineRecipient = async ({
  envelopeId,
  recipientId,
  userId,
  teamId,
  reason,
  signer,
}: HeadlessDeclineRecipientOptions) => {
  const recipient = await getHeadlessSigningRecipient({ envelopeId, recipientId, userId, teamId });

  // Status, already-actioned and expiry checks live in `rejectDocumentWithToken`.
  await rejectDocumentWithToken({
    token: recipient.token,
    id: { type: 'envelopeId', id: recipient.envelope.id },
    reason,
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
