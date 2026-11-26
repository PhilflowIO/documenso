import { prisma } from '@documenso/prisma';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import type { Field, Recipient } from '@prisma/client';
import { DocumentSigningOrder, DocumentStatus, FieldType, RecipientRole, SigningStatus } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { THeadlessFieldInput, THeadlessFieldValue, THeadlessSigner } from '../../types/headless-signing';
import { isTspEnvelope } from '../../types/signature-level';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { fieldsContainUnsignedRequiredField } from '../../utils/advanced-fields-helpers';
import { extractFieldInsertionValues } from '../../utils/envelope-signing';
import { isRecipientTurnBySigningOrder } from '../../utils/recipient-groups';
import { assertRecipientNotExpired } from '../../utils/recipients';
import { completeDocumentWithToken } from '../document/complete-document-with-token';
import { signEnvelopeFieldWithToken } from '../field/sign-envelope-field-with-token';
import { getIsRecipientsTurnToSign } from '../recipient/get-is-recipient-turn';
import { assertSenderNotDisabled } from '../user/assert-user-not-disabled';
import { getHeadlessSigningRecipient, toHeadlessRecipientState } from './get-headless-signing-recipient';

export type HeadlessSignAndCompleteRecipientOptions = {
  envelopeId: string;
  recipientId: number;
  userId: number;
  teamId: number;
  fields: THeadlessFieldInput[];
  signer: THeadlessSigner;
};

const ENVELOPE_STATUS_ERROR_CODE: Record<DocumentStatus, AppErrorCode> = {
  [DocumentStatus.DRAFT]: AppErrorCode.ENVELOPE_DRAFT,
  [DocumentStatus.COMPLETED]: AppErrorCode.ENVELOPE_COMPLETED,
  [DocumentStatus.REJECTED]: AppErrorCode.ENVELOPE_REJECTED,
  [DocumentStatus.CANCELLED]: AppErrorCode.ENVELOPE_CANCELLED,
  [DocumentStatus.PENDING]: AppErrorCode.INVALID_REQUEST,
};

/**
 * The headless value has no nullable members and `DATE` carries no value;
 * translate it to the shape the public signing route takes.
 */
const toSignEnvelopeFieldValue = (value: THeadlessFieldValue): TSignEnvelopeFieldValue =>
  match(value)
    .with({ type: 'DATE' }, () => ({ type: FieldType.DATE, value: true }) as const)
    .otherwise((other) => other as TSignEnvelopeFieldValue);

/**
 * Signs every given field of one recipient and completes the recipient.
 *
 * All writes go through the same server functions as Documenso's own signing
 * page (`signEnvelopeFieldWithToken`, `completeDocumentWithToken`), so the
 * signing order, the auto-filled dates, the seal and the field rendering stay
 * exactly the fork's logic.
 *
 * Everything that can be decided before writing is checked before the first
 * write: envelope and recipient state, signing order, that every field belongs
 * to the recipient, every value (via the same `extractFieldInsertionValues`
 * the write uses), and that the result leaves no required field empty. A
 * request that fails those checks changes nothing. What is left after that is
 * a concurrent change between check and write; a retry with the same body is
 * safe because inserting a field overwrites its value and completing an
 * already completed recipient answers `ALREADY_SIGNED`.
 */
export const headlessSignAndCompleteRecipient = async ({
  envelopeId,
  recipientId,
  userId,
  teamId,
  fields: fieldInputs,
  signer,
}: HeadlessSignAndCompleteRecipientOptions) => {
  const recipient = await getHeadlessSigningRecipient({ envelopeId, recipientId, userId, teamId });

  const { envelope } = recipient;

  await assertSenderNotDisabled({ userId: envelope.userId });

  const requestMetadata: RequestMetadata = {
    ipAddress: signer.ipAddress,
    userAgent: signer.userAgent,
  };

  // A retry of a request whose response got lost: answer with the state, write nothing.
  if (recipient.signingStatus === SigningStatus.SIGNED) {
    return await buildResult({ status: 'ALREADY_SIGNED', recipient, recipientsBefore: null });
  }

  if (recipient.signingStatus === SigningStatus.REJECTED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Recipient ${recipient.id} has already rejected the document`,
      statusCode: 400,
    });
  }

  if (envelope.deletedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document ${envelope.id} has been deleted`,
      statusCode: 400,
    });
  }

  if (envelope.status !== DocumentStatus.PENDING) {
    throw new AppError(ENVELOPE_STATUS_ERROR_CODE[envelope.status], {
      message: `Document ${envelope.id} must be pending to be signed, found ${envelope.status}`,
      statusCode: 400,
    });
  }

  assertRecipientNotExpired(recipient);

  // An assistant fills fields of other recipients, which is a different flow.
  if (recipient.role === RecipientRole.ASSISTANT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Headless signing is not available for assistant recipients',
      statusCode: 400,
    });
  }

  if (envelope.documentMeta?.signingOrder === DocumentSigningOrder.SEQUENTIAL) {
    const isRecipientsTurn = await getIsRecipientsTurnToSign({ token: recipient.token });

    if (!isRecipientsTurn) {
      throw new AppError(AppErrorCode.RECIPIENT_OUT_OF_TURN, {
        message: `Recipient ${recipient.id} attempted to sign before it was their turn`,
        statusCode: 400,
      });
    }
  }

  const recipientFields = await prisma.field.findMany({
    where: {
      envelopeId: envelope.id,
      recipientId: recipient.id,
    },
  });

  const seenFieldIds = new Set<number>();

  const plannedFields = fieldInputs.map(({ fieldId, value }) => {
    if (seenFieldIds.has(fieldId)) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Field ${fieldId} is given more than once`,
        statusCode: 400,
      });
    }

    seenFieldIds.add(fieldId);

    const field = recipientFields.find((recipientField) => recipientField.id === fieldId);

    if (!field) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Field ${fieldId} not found for recipient ${recipient.id}`,
        statusCode: 404,
      });
    }

    if (field.type !== value.type) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Field ${fieldId} is a ${field.type} field, got a ${value.type} value`,
        statusCode: 400,
      });
    }

    if (field.fieldMeta?.readOnly) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Field ${fieldId} is read only`,
        statusCode: 400,
      });
    }

    const fieldValue = toSignEnvelopeFieldValue(value);

    // Dry run of the exact validation the write performs, so an invalid value
    // fails the whole request before any field is touched.
    const insertion = extractFieldInsertionValues({
      fieldValue,
      field,
      documentMeta: envelope.documentMeta,
    });

    return { field, fieldValue, insertion };
  });

  // What the recipient's fields will look like once written. Empty dates are
  // filled by the completion itself.
  const fieldsAfterSigning: Field[] = recipientFields.map((field) => {
    const planned = plannedFields.find((plannedField) => plannedField.field.id === field.id);

    if (planned) {
      return { ...field, ...planned.insertion };
    }

    if (field.type === FieldType.DATE) {
      return { ...field, inserted: true };
    }

    return field;
  });

  if (fieldsContainUnsignedRequiredField(fieldsAfterSigning)) {
    throw new AppError(AppErrorCode.RECIPIENT_HAS_UNSIGNED_FIELDS, {
      message: `Recipient ${recipient.id} would be left with unsigned required fields`,
      statusCode: 400,
    });
  }

  const recipientsBefore = await prisma.recipient.findMany({
    where: { envelopeId: envelope.id },
  });

  for (const { field, fieldValue } of plannedFields) {
    await signEnvelopeFieldWithToken({
      token: recipient.token,
      fieldId: field.id,
      fieldValue,
      requestMetadata,
    });
  }

  try {
    await completeDocumentWithToken({
      token: recipient.token,
      id: { type: 'envelopeId', id: envelope.id },
      requestMetadata,
    });
  } catch (err) {
    // A concurrent request completed the recipient first; it owns the side effects.
    if (err instanceof AppError && err.code === AppErrorCode.RECIPIENT_ALREADY_SIGNED) {
      return await buildResult({ status: 'ALREADY_SIGNED', recipient, recipientsBefore: null });
    }

    throw err;
  }

  return await buildResult({ status: 'SIGNED', recipient, recipientsBefore });
};

type BuildResultOptions = {
  status: 'SIGNED' | 'ALREADY_SIGNED';
  recipient: Recipient & { envelope: { id: string; signatureLevel: string } };
  /**
   * The recipients before this request signed. Null when this request did not
   * complete the recipient, in which case nobody became next because of it.
   */
  recipientsBefore: Recipient[] | null;
};

const buildResult = async ({ status, recipient, recipientsBefore }: BuildResultOptions) => {
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: recipient.envelope.id },
    include: {
      documentMeta: true,
      recipients: {
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      },
    },
  });

  const updatedRecipient = envelope.recipients.find((candidate) => candidate.id === recipient.id);

  if (!updatedRecipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
      statusCode: 404,
    });
  }

  const sequencing = { strictlySequential: isTspEnvelope(envelope) };

  // Recipients whose turn started with this completion, so the client can
  // tell them. Only meaningful in SEQUENTIAL mode: in PARALLEL everyone could
  // act from the start.
  const nextRecipients =
    recipientsBefore && envelope.documentMeta?.signingOrder === DocumentSigningOrder.SEQUENTIAL
      ? envelope.recipients.filter((candidate) => {
          if (candidate.id === recipient.id) {
            return false;
          }

          if (candidate.role === RecipientRole.CC || candidate.signingStatus !== SigningStatus.NOT_SIGNED) {
            return false;
          }

          const isTurnNow = isRecipientTurnBySigningOrder(envelope.recipients, candidate, sequencing);
          const wasTurnBefore = isRecipientTurnBySigningOrder(recipientsBefore, candidate, sequencing);

          return isTurnNow && !wasTurnBefore;
        })
      : [];

  const allRecipientsSigned = envelope.recipients.every(
    (candidate) => candidate.role === RecipientRole.CC || candidate.signingStatus === SigningStatus.SIGNED,
  );

  const fields = await prisma.field.findMany({
    where: { envelopeId: envelope.id, recipientId: recipient.id },
    orderBy: { id: 'asc' },
    select: { id: true, type: true, inserted: true, customText: true },
  });

  return {
    status,
    recipient: toHeadlessRecipientState(updatedRecipient),
    nextRecipients: nextRecipients.map(toHeadlessRecipientState),
    allRecipientsSigned,
    fields,
  };
};
