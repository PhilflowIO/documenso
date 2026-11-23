import { shouldUseSecureCookies } from '@documenso/lib/constants/auth';
import { LANG_COOKIE_NAME } from '@documenso/lib/utils/request-language';
import { createCookie } from 'react-router';

export const langCookie = createCookie(LANG_COOKIE_NAME, {
  path: '/',
  maxAge: 60 * 60 * 24 * 365 * 2,
  httpOnly: true,
  secure: shouldUseSecureCookies(),
});
