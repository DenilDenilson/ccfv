import type { APIRoute } from 'astro';
import { accessLogoutUrl, clearLocalAdminCookie } from '@/lib/auth/admin';
import { runtimeEnv } from '@/lib/env';
import { redirectTo } from '@/lib/http';

export const prerender = false;

/**
 * Logout endpoint used by the local form. Remote environments normally use
 * the direct Access logout link so the browser can clear the Access cookie.
 */
const logout: APIRoute = async () => {
  const destination = runtimeEnv().APP_ENV === 'local'
    ? '/admin/login?status=logged-out'
    : accessLogoutUrl('/admin');
  return redirectTo(destination, 303, [clearLocalAdminCookie()]);
};

export const GET = logout;
export const POST = logout;
