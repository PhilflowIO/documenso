import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { DocumentSigningOrder, FieldType, ReadStatus, SigningStatus } from '@documenso/prisma/client';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { THeadlessDeclineEnvelopeRecipientRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/headless-decline-envelope-recipient.types';
import type {
  THeadlessSignEnvelopeRecipientRequest,
  THeadlessSignEnvelopeRecipientResponse,
} from '@documenso/trpc/server/envelope-router/envelope-recipients/headless-sign-envelope-recipient.types';
import type { THeadlessViewEnvelopeRecipientRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/headless-view-envelope-recipient.types';
import { type APIRequestContext, expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

// 1x1 transparent PNG.
const PNG_SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// The signer as the client's own signing page saw them. Deliberately different
// from what Playwright sends (its own user agent, a loopback address, and the
// spoofed X-Forwarded-For below) so the tests prove the body wins.
const SIGNER = {
  ipAddress: '203.0.113.7',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessSigningTest/1.0',
};

const SPOOFED_FORWARDED_FOR = '198.51.100.99';

const headersFor = (authToken: string) => ({
  Authorization: `Bearer ${authToken}`,
  'Content-Type': 'application/json',
  'X-Forwarded-For': SPOOFED_FORWARDED_FOR,
});

const view = (request: APIRequestContext, authToken: string, body: THeadlessViewEnvelopeRecipientRequest) =>
  request.post(`${baseUrl}/envelope/recipient/${body.recipientId}/headless/view`, {
    headers: headersFor(authToken),
    data: body,
  });

const sign = (request: APIRequestContext, authToken: string, body: THeadlessSignEnvelopeRecipientRequest) =>
  request.post(`${baseUrl}/envelope/recipient/${body.recipientId}/headless/sign`, {
    headers: headersFor(authToken),
    data: body,
  });

const decline = (request: APIRequestContext, authToken: string, body: THeadlessDeclineEnvelopeRecipientRequest) =>
  request.post(`${baseUrl}/envelope/recipient/${body.recipientId}/headless/decline`, {
    headers: headersFor(authToken),
    data: body,
  });

type SeededRecipient = Awaited<ReturnType<typeof seedPendingDocumentWithFullFields>>['recipients'][number];

const fieldOf = (recipient: SeededRecipient, type: FieldType) => {
  const field = recipient.fields.find((candidate) => candidate.type === type);

  if (!field) {
    throw new Error(`Seeded recipient has no ${type} field`);
  }

  return field;
};

const fullSignatureBody = (envelopeId: string, recipient: SeededRecipient): THeadlessSignEnvelopeRecipientRequest => ({
  envelopeId,
  recipientId: recipient.id,
  fields: [
    { fieldId: fieldOf(recipient, FieldType.SIGNATURE).id, value: { type: 'SIGNATURE', value: PNG_SIGNATURE } },
    { fieldId: fieldOf(recipient, FieldType.TEXT).id, value: { type: 'TEXT', value: 'Kiel' } },
    { fieldId: fieldOf(recipient, FieldType.DATE).id, value: { type: 'DATE' } },
  ],
  signer: SIGNER,
});

const seedV2Envelope = async ({
  user,
  team,
  recipients,
  sequential = false,
}: {
  user: User;
  team: Team;
  recipients: string[];
  sequential?: boolean;
}) => {
  const { document, recipients: seededRecipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients,
    fields: [FieldType.SIGNATURE, FieldType.TEXT, FieldType.DATE],
    recipientsCreateOptions: recipients.map((_, index) => ({
      readStatus: ReadStatus.NOT_OPENED,
      signedAt: null,
      signingOrder: index + 1,
    })),
    updateDocumentOptions: {
      internalVersion: 2,
    },
  });

  if (sequential) {
    await prisma.documentMeta.update({
      where: { id: document.documentMetaId },
      data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
    });
  }

  return { envelope: document, recipients: seededRecipients };
};

const countAuditLogs = async (envelopeId: string) => await prisma.documentAuditLog.count({ where: { envelopeId } });

test.describe('Headless signing', () => {
  let user: User;
  let team: Team;
  let token: string;

  test.beforeEach(async () => {
    ({ user, team } = await seedUser());
    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-headless-signing',
      expiresIn: null,
    }));
  });

  test('view records the opening with the signer IP address and user agent from the body', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    const res = await view(request, token, { envelopeId: envelope.id, recipientId: recipient.id, signer: SIGNER });

    expect(res.ok(), await res.text()).toBeTruthy();

    const body = await res.json();

    expect(body.recipient.readStatus).toBe(ReadStatus.OPENED);
    expect(body.recipient).not.toHaveProperty('token');

    const opened = await prisma.documentAuditLog.findMany({
      where: { envelopeId: envelope.id, type: 'DOCUMENT_OPENED' },
    });

    expect(opened).toHaveLength(1);
    expect(opened[0].ipAddress).toBe(SIGNER.ipAddress);
    expect(opened[0].userAgent).toBe(SIGNER.userAgent);
    expect(opened[0].email).toBe(recipient.email);

    // A second view adds a "viewed" entry but never a second "opened".
    const second = await view(request, token, { envelopeId: envelope.id, recipientId: recipient.id, signer: SIGNER });

    expect(second.ok()).toBeTruthy();

    expect(await prisma.documentAuditLog.count({ where: { envelopeId: envelope.id, type: 'DOCUMENT_OPENED' } })).toBe(
      1,
    );
    expect(await prisma.documentAuditLog.count({ where: { envelopeId: envelope.id, type: 'DOCUMENT_VIEWED' } })).toBe(
      2,
    );
  });

  test('sign inserts every field, completes the recipient and audits the signer', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    const res = await sign(request, token, fullSignatureBody(envelope.id, recipient));

    expect(res.ok(), await res.text()).toBeTruthy();

    const body = (await res.json()) as THeadlessSignEnvelopeRecipientResponse;

    expect(body.status).toBe('SIGNED');
    expect(body.recipient.signingStatus).toBe(SigningStatus.SIGNED);
    expect(body.allRecipientsSigned).toBe(true);
    expect(body.nextRecipients).toEqual([]);
    expect(body.fields.every((field) => field.inserted)).toBe(true);

    const signature = await prisma.signature.findFirstOrThrow({
      where: { fieldId: fieldOf(recipient, FieldType.SIGNATURE).id },
    });

    expect(signature.signatureImageAsBase64).toBe(PNG_SIGNATURE);
    expect(signature.typedSignature).toBeNull();

    const text = await prisma.field.findUniqueOrThrow({ where: { id: fieldOf(recipient, FieldType.TEXT).id } });

    expect(text.customText).toBe('Kiel');

    // The date is stamped by Documenso, not by the client.
    const date = await prisma.field.findUniqueOrThrow({ where: { id: fieldOf(recipient, FieldType.DATE).id } });

    expect(date.inserted).toBe(true);
    expect(date.customText).not.toBe('');

    const signerLogs = await prisma.documentAuditLog.findMany({
      where: {
        envelopeId: envelope.id,
        type: { in: ['DOCUMENT_FIELD_INSERTED', 'DOCUMENT_RECIPIENT_COMPLETED'] },
      },
    });

    expect(signerLogs.filter((log) => log.type === 'DOCUMENT_FIELD_INSERTED')).toHaveLength(3);
    expect(signerLogs.filter((log) => log.type === 'DOCUMENT_RECIPIENT_COMPLETED')).toHaveLength(1);

    for (const log of signerLogs) {
      expect(log.ipAddress).toBe(SIGNER.ipAddress);
      expect(log.userAgent).toBe(SIGNER.userAgent);
      expect(log.email).toBe(recipient.email);
    }
  });

  test('sign accepts a typed signature', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    const res = await sign(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      fields: [
        { fieldId: fieldOf(recipient, FieldType.SIGNATURE).id, value: { type: 'SIGNATURE', value: 'Erika Muster' } },
      ],
      signer: SIGNER,
    });

    expect(res.ok(), await res.text()).toBeTruthy();

    const signature = await prisma.signature.findFirstOrThrow({
      where: { fieldId: fieldOf(recipient, FieldType.SIGNATURE).id },
    });

    expect(signature.typedSignature).toBe('Erika Muster');
    expect(signature.signatureImageAsBase64).toBeNull();
  });

  test('sign of an already signed recipient answers ALREADY_SIGNED and writes nothing', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    const first = await sign(request, token, fullSignatureBody(envelope.id, recipient));

    expect(first.ok(), await first.text()).toBeTruthy();

    const auditLogsAfterFirst = await countAuditLogs(envelope.id);

    const second = await sign(request, token, {
      ...fullSignatureBody(envelope.id, recipient),
      fields: [{ fieldId: fieldOf(recipient, FieldType.TEXT).id, value: { type: 'TEXT', value: 'Overwritten' } }],
    });

    expect(second.ok(), await second.text()).toBeTruthy();

    const body = (await second.json()) as THeadlessSignEnvelopeRecipientResponse;

    expect(body.status).toBe('ALREADY_SIGNED');
    expect(body.recipient.signingStatus).toBe(SigningStatus.SIGNED);

    const text = await prisma.field.findUniqueOrThrow({ where: { id: fieldOf(recipient, FieldType.TEXT).id } });

    expect(text.customText).toBe('Kiel');

    // Sealing may add its own entries in the background; nothing of the signer may be added.
    const signerLogs = await prisma.documentAuditLog.count({
      where: { envelopeId: envelope.id, type: { in: ['DOCUMENT_FIELD_INSERTED', 'DOCUMENT_RECIPIENT_COMPLETED'] } },
    });

    expect(signerLogs).toBe(4);
    expect(await countAuditLogs(envelope.id)).toBeGreaterThanOrEqual(auditLogsAfterFirst);
  });

  test('sign out of turn is refused before anything is written, and the turn passes on', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({
      user,
      team,
      recipients: ['first@test.documenso.com', 'second@test.documenso.com'],
      sequential: true,
    });
    const [first, second] = recipients;

    const auditLogsBefore = await countAuditLogs(envelope.id);

    const outOfTurn = await sign(request, token, fullSignatureBody(envelope.id, second));

    expect(outOfTurn.status()).toBe(400);
    expect(await outOfTurn.text()).toContain('before it was their turn');

    const untouched = await prisma.field.findMany({ where: { recipientId: second.id } });

    expect(untouched.every((field) => !field.inserted)).toBe(true);
    expect(await countAuditLogs(envelope.id)).toBe(auditLogsBefore);

    const firstRes = await sign(request, token, fullSignatureBody(envelope.id, first));

    expect(firstRes.ok(), await firstRes.text()).toBeTruthy();

    const firstBody = (await firstRes.json()) as THeadlessSignEnvelopeRecipientResponse;

    expect(firstBody.allRecipientsSigned).toBe(false);
    expect(firstBody.nextRecipients.map((recipient) => recipient.id)).toEqual([second.id]);
    expect(firstBody.nextRecipients[0].email).toBe(second.email);

    const secondRes = await sign(request, token, fullSignatureBody(envelope.id, second));

    expect(secondRes.ok(), await secondRes.text()).toBeTruthy();

    const secondBody = (await secondRes.json()) as THeadlessSignEnvelopeRecipientResponse;

    expect(secondBody.allRecipientsSigned).toBe(true);
    expect(secondBody.nextRecipients).toEqual([]);
  });

  test('sign without a value for a required field changes nothing', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    const auditLogsBefore = await countAuditLogs(envelope.id);

    const res = await sign(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      fields: [{ fieldId: fieldOf(recipient, FieldType.TEXT).id, value: { type: 'TEXT', value: 'Kiel' } }],
      signer: SIGNER,
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('unsigned required fields');

    const fields = await prisma.field.findMany({ where: { recipientId: recipient.id } });

    expect(fields.every((field) => !field.inserted)).toBe(true);
    expect(await countAuditLogs(envelope.id)).toBe(auditLogsBefore);

    const unchangedRecipient = await prisma.recipient.findUniqueOrThrow({ where: { id: recipient.id } });

    expect(unchangedRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
  });

  test('sign refuses a field of another recipient and changes nothing', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({
      user,
      team,
      recipients: ['first@test.documenso.com', 'second@test.documenso.com'],
    });
    const [first, second] = recipients;

    const res = await sign(request, token, {
      envelopeId: envelope.id,
      recipientId: first.id,
      fields: [
        { fieldId: fieldOf(first, FieldType.SIGNATURE).id, value: { type: 'SIGNATURE', value: PNG_SIGNATURE } },
        { fieldId: fieldOf(second, FieldType.TEXT).id, value: { type: 'TEXT', value: 'Not mine' } },
      ],
      signer: SIGNER,
    });

    expect(res.status()).toBe(404);

    const fields = await prisma.field.findMany({ where: { envelopeId: envelope.id } });

    expect(fields.every((field) => !field.inserted)).toBe(true);
  });

  test('sign refuses a value of the wrong type and a malformed PNG', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    const wrongType = await sign(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      fields: [{ fieldId: fieldOf(recipient, FieldType.SIGNATURE).id, value: { type: 'TEXT', value: 'x' } }],
      signer: SIGNER,
    });

    expect(wrongType.status()).toBe(400);

    const badPng = await sign(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      fields: [
        {
          fieldId: fieldOf(recipient, FieldType.SIGNATURE).id,
          value: { type: 'SIGNATURE', value: 'data:image/png;base64,bm90IGEgcG5n' },
        },
      ],
      signer: SIGNER,
    });

    expect(badPng.status()).toBe(400);

    expect(await prisma.signature.count({ where: { recipientId: recipient.id } })).toBe(0);
  });

  test('a token of another team reaches no recipient', async ({ request }) => {
    const { user: otherUser, team: otherTeam } = await seedUser();
    const { envelope, recipients } = await seedV2Envelope({
      user: otherUser,
      team: otherTeam,
      recipients: ['signer@test.documenso.com'],
    });
    const [recipient] = recipients;

    const viewRes = await view(request, token, { envelopeId: envelope.id, recipientId: recipient.id, signer: SIGNER });
    const signRes = await sign(request, token, fullSignatureBody(envelope.id, recipient));
    const declineRes = await decline(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      reason: 'Should not work',
      signer: SIGNER,
    });

    expect(viewRes.status()).toBe(404);
    expect(signRes.status()).toBe(404);
    expect(declineRes.status()).toBe(404);

    const untouched = await prisma.recipient.findUniqueOrThrow({ where: { id: recipient.id } });

    expect(untouched.readStatus).toBe(ReadStatus.NOT_OPENED);
    expect(untouched.signingStatus).toBe(SigningStatus.NOT_SIGNED);
  });

  test('an envelope the token user owns in another team is out of reach', async ({ request }) => {
    // Elsewhere in API v2 a user also reaches envelopes they own outside the
    // token's team. Headless signing acts for a signer and must stay inside
    // the team the token was issued for.
    const { team: otherTeam } = await seedUser();
    const { envelope, recipients } = await seedV2Envelope({
      user,
      team: otherTeam,
      recipients: ['signer@test.documenso.com'],
    });
    const [recipient] = recipients;

    const res = await sign(request, token, fullSignatureBody(envelope.id, recipient));

    expect(res.status()).toBe(404);

    const untouched = await prisma.recipient.findUniqueOrThrow({ where: { id: recipient.id } });

    expect(untouched.signingStatus).toBe(SigningStatus.NOT_SIGNED);
  });

  test('a recipient paired with the wrong envelope is not found', async ({ request }) => {
    const target = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const other = await seedV2Envelope({ user, team, recipients: ['other@test.documenso.com'] });

    const res = await sign(request, token, fullSignatureBody(other.envelope.id, target.recipients[0]));

    expect(res.status()).toBe(404);
  });

  test('requests without an API token are refused', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    // Without any credentials the CSRF guard already stops the request.
    const anonymous = await request.post(`${baseUrl}/envelope/recipient/${recipient.id}/headless/sign`, {
      headers: { 'Content-Type': 'application/json' },
      data: fullSignatureBody(envelope.id, recipient),
    });

    expect(anonymous.status()).toBe(403);

    // Past the CSRF guard (same origin) but still without a token or session.
    const sameOrigin = await request.post(`${baseUrl}/envelope/recipient/${recipient.id}/headless/sign`, {
      headers: { 'Content-Type': 'application/json', Origin: new URL(WEBAPP_BASE_URL).origin },
      data: fullSignatureBody(envelope.id, recipient),
    });

    expect(sameOrigin.status()).toBe(401);

    // A made-up token is refused too.
    const forged = await sign(request, 'api_notarealtoken0000000000', fullSignatureBody(envelope.id, recipient));

    expect(forged.ok()).toBeFalsy();
    expect(await prisma.signature.count({ where: { recipientId: recipient.id } })).toBe(0);
  });

  test('signer metadata is validated', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    const badIp = await view(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      signer: { ipAddress: 'not-an-ip', userAgent: SIGNER.userAgent },
    });

    expect(badIp.status()).toBe(400);

    const longUserAgent = await view(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      signer: { ipAddress: SIGNER.ipAddress, userAgent: 'x'.repeat(513) },
    });

    expect(longUserAgent.status()).toBe(400);

    const ipv6 = await view(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      signer: { ipAddress: '2001:db8::1' },
    });

    expect(ipv6.ok(), await ipv6.text()).toBeTruthy();

    const opened = await prisma.documentAuditLog.findFirstOrThrow({
      where: { envelopeId: envelope.id, type: 'DOCUMENT_OPENED' },
    });

    expect(opened.ipAddress).toBe('2001:db8::1');
  });

  test('decline rejects as the recipient and audits the signer', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    const res = await decline(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      reason: 'Falscher Betrag',
      signer: SIGNER,
    });

    expect(res.ok(), await res.text()).toBeTruthy();

    const body = await res.json();

    expect(body.recipient.signingStatus).toBe(SigningStatus.REJECTED);
    expect(body.recipient.rejectionReason).toBe('Falscher Betrag');

    const rejected = await prisma.documentAuditLog.findFirstOrThrow({
      where: { envelopeId: envelope.id, type: 'DOCUMENT_RECIPIENT_REJECTED' },
    });

    expect(rejected.ipAddress).toBe(SIGNER.ipAddress);
    expect(rejected.userAgent).toBe(SIGNER.userAgent);
    // Attributed to the recipient, not to the API user.
    expect(rejected.email).toBe(recipient.email);
    expect(rejected.userId).not.toBe(user.id);

    // A declined recipient can neither decline again nor sign.
    const again = await decline(request, token, {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      reason: 'Again',
      signer: SIGNER,
    });

    expect(again.status()).toBe(400);

    const signAfterDecline = await sign(request, token, fullSignatureBody(envelope.id, recipient));

    expect(signAfterDecline.ok()).toBeFalsy();
  });

  test('recipients with action authentication are refused', async ({ request }) => {
    const { envelope, recipients } = await seedV2Envelope({ user, team, recipients: ['signer@test.documenso.com'] });
    const [recipient] = recipients;

    await prisma.recipient.update({
      where: { id: recipient.id },
      data: { authOptions: { accessAuth: [], actionAuth: ['PASSWORD'] } },
    });

    const res = await sign(request, token, fullSignatureBody(envelope.id, recipient));

    expect(res.status()).toBe(400);
    expect(await prisma.signature.count({ where: { recipientId: recipient.id } })).toBe(0);
  });

  test('the endpoints are part of the OpenAPI document', async ({ request }) => {
    const res = await request.get(`${baseUrl}/openapi.json`);

    expect(res.ok()).toBeTruthy();

    const document = await res.json();
    const paths = Object.keys(document.paths);

    expect(paths).toContain('/envelope/recipient/{recipientId}/headless/view');
    expect(paths).toContain('/envelope/recipient/{recipientId}/headless/sign');
    expect(paths).toContain('/envelope/recipient/{recipientId}/headless/decline');
  });
});
