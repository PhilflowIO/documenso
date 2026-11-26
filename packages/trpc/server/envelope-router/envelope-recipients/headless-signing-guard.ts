import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

/**
 * Headless signing routes take the signer's IP address and user agent from the
 * request body and write them into the audit log. Only an API token may assert
 * those values: never the internal app handler and never a browser session,
 * which would let a signed-in user put any IP address into an audit trail.
 */
export const assertHeadlessSigningApiToken = (metadata: ApiRequestMetadata) => {
  if (metadata.source !== 'apiV2' || metadata.auth !== 'api') {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'This route is only accessible via the public API with an API token',
    });
  }
};
