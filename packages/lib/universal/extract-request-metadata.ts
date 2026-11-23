import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES } from '../constants/locales';
import { extractRequestLanguage } from '../utils/request-language';
import { getIpAddress } from './get-ip-address';

const ZIpSchema = z.string().ip();

export const ZRequestMetadataSchema = z.object({
  ipAddress: ZIpSchema.optional(),
  userAgent: z.string().optional(),
  /** The interface language of the requester, which a document created without a language is written in. */
  language: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
});

export type RequestMetadata = z.infer<typeof ZRequestMetadataSchema>;

export type ApiRequestMetadata = {
  /**
   * The general metadata of the request.
   */
  requestMetadata: RequestMetadata;

  /**
   * The source of the request.
   */
  source: 'apiV1' | 'apiV2' | 'app';

  /**
   * The method of authentication used to access the API.
   *
   * If the request is not authenticated, the value will be `null`.
   */
  auth: 'api' | 'session' | null;

  /**
   * The user that is performing the action.
   *
   * If a team API key is used, the user will classified as the team.
   */
  auditUser?: {
    id: number | null;
    email: string | null;
    name: string | null;
  };
};

export const extractRequestMetadata = (req: Request): RequestMetadata => {
  let ip: string | undefined;

  try {
    ip = getIpAddress(req);
  } catch {
    // Do nothing.
  }

  const parsedIp = ZIpSchema.safeParse(ip);

  const ipAddress = parsedIp.success ? parsedIp.data : undefined;
  const userAgent = req.headers.get('user-agent');

  return {
    ipAddress,
    userAgent: userAgent ?? undefined,
    language: extractRequestLanguage(req.headers) ?? undefined,
  };
};
